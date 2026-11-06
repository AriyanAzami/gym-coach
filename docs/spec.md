# Gym Coach — specification

A personal training app. A phone PWA and a Postgres database do the day-to-day
work (today's plan, logging, progress) in plain code. A coach model writes
training blocks and check-ins on demand, in a GitHub Action, and never touches
the fast paths.

Nothing in this repository is personal. Every coaching number lives in a `rules`
document in the database; every example file in the repository uses fabricated
values. See [Data and secrets](#10-data-and-secrets).

---

## 1. Architecture

```
Phone PWA (GitHub Pages)   ──supabase-js──►   Supabase
Claude chat (Supabase MCP) ───────────────►   Postgres + Auth + RLS + Storage + Edge Functions
                                                      │
                                                      │ edge fn dispatch-job (verifies the owner's JWT)
                                                      ▼
                                      GitHub repository_dispatch { job_id }
                                                      ▼
                        GitHub Action coach.yml → Claude Code CLI (Opus, subscription token)
                        context.mjs → claude -p → validate.mjs → save.mjs
```

Three tiers, by cost:

| Tier | What | Latency | Cost |
| :-- | :-- | :-- | :-- |
| Views + engine | today's plan, next targets, volume, rotation, trends | instant | free |
| App writes | logging, notes, rules edits, block activation | instant | free |
| AI jobs | generate/revise a block, check-in, ask | 1–5 min | subscription |

The only AI step is `claude -p` inside the Action. Nothing in the app blocks on
a model.

### Repository layout

```
app/                  static PWA, no build step (GitHub Pages)
  index.html  manifest.webmanifest  sw.js
  css/app.css
  js/config.js        Supabase URL + anon key (public identifiers)
  js/engine.js        ES module, pure functions: targets, volume, rotation
  js/store.js         Supabase client, auth, queries, realtime, offline outbox
  js/ui.js  js/app.js  js/charts.js
  js/screens-*.js     today, workout, block, progress, coach, settings
  vendor/supabase.js  vendored @supabase/supabase-js UMD
coach/                AI runner (Node, runs only in the Action)
  context.mjs  validate.mjs  save.mjs  lib/db.mjs
  prompts/{block,revise_block,checkin,ask}.md
  schema/{rules,block}.schema.json
supabase/
  config.toml  migrations/*.sql  functions/dispatch-job/index.ts
  seed/rules.example.json        fabricated values only
migrate/              one-off Notion import; out/ is gitignored
  normalize.mjs  load.mjs  verify.mjs
test/                 node --test
.github/workflows/    coach.yml  pages.yml  test.yml
docs/                 spec.md  plan.md  claude-project-instructions.md
```

### Technology choices

- **Frontend:** vanilla HTML/CSS/JS, no framework, no build step. `engine.js` and
  the screens are ES modules loaded with `<script type="module">`, so the same
  files run in the browser and under `node --test`. `supabase-js` is vendored as
  a UMD bundle (`@supabase/supabase-js@2.119.0`, global `supabase`) in a classic
  `<script>` before the modules.
- **Node:** 24 (`node --test`, no test framework). Runtime dependencies for
  `coach/` and `migrate/`: `@supabase/supabase-js`, `ajv`, `ajv-formats`.
  `package-lock.json` is committed; the Action runs `npm ci`.
- **Supabase CLI** via `npx supabase`. `db push` and `functions deploy` need no
  Docker (`functions deploy` uses the API bundler); local `functions serve`
  would, and is not part of the workflow.

---

## 2. Data model

Every table carries:

```sql
id       uuid primary key default gen_random_uuid()
user_id  uuid not null references auth.users(id) on delete cascade default auth.uid()
```

and RLS enabled with a single policy per operation, `user_id = auth.uid()`.
Weights are always a `numeric` value plus a `unit text check (unit in ('lb','kg'))`
column; there is no bare weight anywhere in the schema. Enumerated fields are
`text` with a `check` constraint rather than Postgres enums, so they can be
extended by a migration without a type rewrite.

| Table | Columns beyond the common ones |
| :-- | :-- |
| `exercises` | `name` (unique per user), `primary_muscle`, `secondary_muscles text[]`, `equipment`, `increment` + `unit`, `load_mode` ∈ total/per_hand, `movement_tags text[]`, `cues`, `flag` (nullable active coaching flag), `active bool` |
| `blocks` | `name`, `status` ∈ draft/active/archived, `starts_on`, `ends_on`, `rationale` (markdown), `source_job_id` |
| `block_days` | `block_id`, `day_index`, `name`, `warmup_note`; unique `(block_id, day_index)` |
| `block_slots` | `day_id`, `position`, `exercise_id`, `sets`, `rep_min`, `rep_max`, `rest_s`, `non_negotiable bool`, `cut_order`, `notes`. **No weight column exists.** |
| `sessions` | `date`, `block_id`, `day_index`, `kind` ∈ training/rest, `status` ∈ planned/done/partial/skipped, `duration_min`, `calories`, `avg_hr`, `peak_hr`, `hr_zones jsonb`, `effort_1_10`, `pain` (default `none`), `notes`, `source` ∈ app/notion_import, `notion_page_id` unique nullable |
| `session_exercises` | `session_id`, `slot_id` (nullable, `on delete set null`), `exercise_id`, `position`, `target_weight` + `target_unit`, `target_reps`, `target_sets`, `deviation_note` |
| `sets` | `session_exercise_id`, `set_no`, `weight` + `unit`, `reps`, `partial bool`, `done bool`; unique `(session_exercise_id, set_no)` |
| `body_metrics` | `date`, `weight` + `unit`, `waist_note`, `arm_cm`, `notes`, `notion_page_id` unique nullable |
| `decisions` | `date`, `title`, `body` (markdown), `block_id` nullable |
| `coach_notes` | `body`, `created_at`, `consumed_by_job` nullable |
| `documents` | `key` ∈ manual/rules, `version int`, `body_md` (manual), `body_json jsonb` (rules), `created_at`; unique `(user_id, key, version)` |
| `ai_jobs` | `kind` ∈ block/revise_block/checkin/ask, `instructions`, `target_block_id`, `status` ∈ queued/running/done/failed, `output_md`, `error`, `created_at`, `started_at`, `finished_at` |

Constraints that matter:

- One active block per user:
  `create unique index blocks_one_active on blocks(user_id) where status = 'active'`.
- `documents` is **append-only**: it has `select` and `insert` policies and no
  `update` or `delete` policy, so RLS refuses any change to a stored version.
  The latest `version` for a key wins; history and rollback are reads plus a new
  insert.
- `ai_jobs` has a `select` policy only. Rows are created by the edge function
  with the service-role key after it has verified the caller's JWT, which keeps
  the app from leaving queued jobs that no Action will ever pick up. The table
  joins the `supabase_realtime` publication so the app can watch job status.
- A private Storage bucket, `shots`, is created for future screenshots, with an
  owner-only policy on `storage.objects` — no public access, no anon read.

`exercises.load_mode` is an addition to the brief's column list, needed because
the brief requires per-hand dumbbell and cable loads to stay per hand. Whether a
load is per hand is a property of the exercise rather than of a set, so it lives
on `exercises` and flows into every target through the engine.

`documents.body_md` / `body_json` is a deliberate split of what the brief calls
one `body` column: a `text` column for the manual's markdown and a `jsonb`
column for the rules, with a check constraint that exactly the right one is set
for each key. Storing markdown as a JSON string would make every read and every
rules-editor diff awkward for no gain.

---

## 3. Views

Derived state is never hand-maintained. Every view is created
`with (security_invoker = true)` so it obeys the RLS policies of its underlying
tables for the `authenticated` role.

| View | Grain | Contents |
| :-- | :-- | :-- |
| `lift_history` | one logged set | `date`, `exercise_id`, `session_id`, `set_no`, `weight`, `unit`, `reps`, `partial`, for training sessions with status done/partial and `sets.done` |
| `lift_exposures` | one exercise in one session | working-set count, top `weight` + `unit`, `reps` array in set order |
| `lift_state` | one exercise | `last_date`, `last_weight` + `unit`, `last_reps[]`, `sessions_since_change`, `stall_count`, `flag` |
| `weekly_muscle_volume` | week × muscle | direct sets (`primary_muscle`) + indirect sets (`secondary_muscles`) × `rules.volume.indirect_factor`, over ISO calendar weeks |
| `training_rate` | one row | sessions per week over the trailing 4 and 8 weeks |
| `rotation_next` | one row | the next `day_index` of the active block |
| `body_trend` | one week | weekly average weight and the 3-week rolling rate of change |

Two of these need definition rather than description:

**`lift_state.stall_count`** counts consecutive exposures, counting back from the
most recent, where the weight *and* the full-rep pattern equal the previous
exposure's. Partial reps are excluded from the comparison. Implemented as
gaps-and-islands over `lift_exposures`: `lag()` gives the previous exposure, a
boolean says whether it repeated, and the count is the number of leading
repeats in date-descending order. `sessions_since_change` counts exposures since
the weight or rep pattern last moved.

**`rotation_next`** takes the active block's latest *complete* training session
and returns the following `day_index`, wrapping at the block's day count. A
`done` session is complete. A `partial` session is complete unless it either
logged nothing for the day's first slot or logged fewer than
`rules.rotation.complete_fraction` of the day's slots. With no complete session
in the active block, the next day is `day_index` 0. Rest sessions are ignored.

`weekly_muscle_volume` and `rotation_next` read `rules` through a
`current_documents` view (the highest `version` per key per user), so changing
`indirect_factor` or `complete_fraction` in the app changes the views with no
migration.

---

## 4. The rules document

The single source of every coaching number. Stored as `documents.body_json`
where `key = 'rules'`, validated against `coach/schema/rules.schema.json` on
every save — by the app before it inserts a version, and by `validate.mjs` and
`save.mjs` in the Action. No coaching number appears as a constant in
`engine.js`, `validate.mjs` or any SQL.

Sections, with their meaning. **The values below are illustrative placeholders,
not anyone's programme:**

```jsonc
{
  "units": { "weight": "lb", "body": "kg" },
  "progression": {
    "scheme": "double",                  // clear the top of the range, then add load
    "increments": { "barbell": 5, "dumbbell": 5, "machine": 10, "cable": 5 },
    "increment_unit": "lb",
    "most_recent_entry_decides": true,   // the last logged exposure, not the best
    "partials_count": false
  },
  "stall": {
    "sessions_to_trigger": 3,
    "interventions": ["move_earlier", "lengthen_rest", "add_set", "change_variation"]
  },
  "session": {
    "max_exercises": 8,
    "rest_s": { "compound": 120, "isolation": 60 },
    "supersets": "isolation_only"
  },
  "volume": {
    "min_weekly_sets": { "default": 8, "by_muscle": { "chest": 10 } },
    "indirect_factor": 0.5,
    "count_over": "calendar_week_at_observed_rate"
  },
  "priority": ["back", "chest", "shoulders", "legs", "arms", "core"],
  "constraints": { "banned_movement_tags": [], "equipment_unavailable": [] },
  "rotation": { "complete_fraction": 0.6, "gap_flag_days": 10 },
  "deload": {
    "triggers": { "stalled_exercises": 3, "effort_above": 9 },
    "backstop_weeks": 12,
    "set_factor": 0.5
  },
  "warmup": { "note": "...", "core_mobility_placement": "warmup" },
  "nutrition": {
    "protein_g_per_kg": 1.6,
    "gain_band_kg_per_week": [0.1, 0.3],
    "weigh_in_cadence": "weekly",
    "adjustment": { "above_band": "hold", "below_band": "add_calories" }
  },
  "opener": {
    "policy": "conservative",
    "label": "first exposure — conservative opener",
    "fraction_of_similar": 0.7
  }
}
```

The schema makes all twelve sections and every key above `required`, forbids
`additionalProperties`, and bounds the numbers (positive increments, fractions
in `[0,1]`, rep and rest ranges ordered). A rules document that fails the schema
is never stored and never reaches a job.

`supabase/seed/rules.example.json` is this shape with fabricated values and is
the only rules file in the repository. The owner's real rules arrive through the
migration (§9) and are only ever edited in the app.

---

## 5. Pipeline A — today's plan (code only)

`app/js/engine.js` is pure: plain data in, plain data out, no Supabase, no DOM,
no clock except an injected `today`. `node --test` covers it.

Inputs: `rotation_next`, the active block's days and slots, `lift_state` rows,
and the current `rules`.

For each slot, one exact target:

1. **With history** — take the most recent exposure for that exercise. If every
   working set reached `rep_max`, add one `increment` for the exercise's
   equipment and drop to `rep_min`. Otherwise keep the weight and aim one rep
   higher, capped at `rep_max`. Partial reps never count toward clearing a range.
2. **Stalled** — when `lift_state.stall_count >= rules.stall.sessions_to_trigger`,
   the target carries the next unused intervention from
   `rules.stall.interventions`, in order, as a label on the card.
3. **No history** — a conservative opener derived from
   `rules.opener.fraction_of_similar` of the nearest logged exercise sharing the
   primary muscle and equipment, or no weight at all when there is nothing to
   derive from. Always labelled with `rules.opener.label`.
4. **Flagged** — an exercise with `exercises.flag` set surfaces that text at the
   top of the card.

Output card: day name, warm-up note, then each exercise as
`sets × reps @ target`, with its rest, the last logged numbers beside it,
non-negotiables named, and the cut order shown. Pressing it creates a `planned`
session and writes one `session_exercises` row per slot holding the computed
targets, so the plan the owner saw is the plan that gets logged against.

## 6. Pipeline B — logging (code only)

- **Done as prescribed**, for the whole session or one exercise: copies the
  stored targets into `sets` and marks them `done`.
- **Edit actuals**: tap an exercise, adjust weight/reps/partial per set with
  large touch targets, nothing smaller than 44 px.
- **Finish**: duration, calories, average and peak HR, HR zones, effort,
  pain (defaults to `none`), notes — all optional. Status becomes `done` or
  `partial` by the same completeness rule `rotation_next` uses.
- Views recompute on read, so the next target is correct the moment a set is
  saved.
- **Offline:** writes go through an outbox in `localStorage`; `store.js` flushes
  it on reconnect and on load. The last rendered Today card is cached too, so
  the app opens useful without a network.

## 7. Pipeline C — AI jobs

App buttons create jobs: **Generate block** (with a free-text box for this
block's instructions), **Request changes** on a draft (comment → `revise_block`),
**Check-in**, **Ask coach**. **Add note** is not a job — it inserts a
`coach_notes` row.

### dispatch-job (Supabase Edge Function)

1. Rejects any request without an `Authorization: Bearer <jwt>` that
   `auth.getUser()` resolves to an existing user. `verify_jwt` stays on.
2. Inserts the `ai_jobs` row with the service-role key and that user's id.
3. `POST https://api.github.com/repos/{GH_REPO}/dispatches` with
   `{ "event_type": "coach-job", "client_payload": { "job_id": "<uuid>" } }`.
   Nothing else goes in the payload — no instructions, no data.
4. A failed dispatch marks the job `failed` with a short error and returns 502.

Secrets, set with `supabase secrets set`: `GH_DISPATCH_TOKEN` (fine-grained PAT,
this repository only, **Contents: write** — the permission GitHub requires for
`POST /repos/{owner}/{repo}/dispatches`), and `GH_REPO`.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

### coach.yml

```yaml
on:
  repository_dispatch: { types: [coach-job] }
  workflow_dispatch:   { inputs: { job_id: { required: true } } }
permissions: { contents: read }
concurrency: { group: coach }
timeout-minutes: 25
```

Steps: checkout → Node 24 → `npm ci` → `npm i -g @anthropic-ai/claude-code` →
`context.mjs` → `claude -p` → `save.mjs`.

**`context.mjs <job_id>`** marks the job `running` and writes `work/context.json`
with the service-role key: current rules and manual, the last eight weeks of
sessions and sets, `lift_state`, `weekly_muscle_volume` against the rules
targets, `training_rate`, `body_trend`, the current and previous block,
recent decisions, unconsumed `coach_notes`, the job's own instructions, and —
for `revise_block` — the draft block being revised.

**The model call.** `--allowedTools` only decides what runs without a prompt; the
tools the model *has* are set by `--tools`. Both are needed:

```bash
claude -p "$(cat coach/prompts/$KIND.md)" \
  --model opus \
  --max-turns 40 \
  --tools "Read,Write,Edit,Bash" \
  --allowedTools "Read" "Write" "Edit" "Bash(node coach/validate.mjs:*)" \
  --disallowedTools "mcp__*" \
  > work/claude.log 2>&1
```

`-p` is non-interactive, so a tool call outside the allow rules is refused
rather than queued for a human. `Bash(node coach/validate.mjs:*)` is a trailing
wildcard: it matches `node coach/validate.mjs` and any arguments, and Claude
Code's shell-operator awareness means it does not approve
`node coach/validate.mjs && curl ...`. Auth is `CLAUDE_CODE_OAUTH_TOKEN` from
GitHub Secrets, produced by `claude setup-token`.

The model writes `work/output.json` (block kinds) or `work/output.md`
(checkin, ask), runs the validator itself, and fixes failures until it passes.

**`validate.mjs`** gates, every threshold read from the rules document:

| Gate | Source |
| :-- | :-- |
| JSON Schema | `coach/schema/block.schema.json` |
| exercises per day ≤ max | `rules.session.max_exercises` |
| no banned `movement_tags` | `rules.constraints.banned_movement_tags` |
| unknown exercises explicitly flagged `new` with muscle, equipment, tags | schema |
| rest within bounds | `rules.session.rest_s` |
| weekly sets per muscle at the observed rate ≥ minimum, for every priority muscle | `rules.volume`, `training_rate`, `rules.priority` |
| priority order roughly respected (a higher-priority muscle gets at least as many sets as a lower one, within a tolerance) | `rules.priority` |
| core and mobility in the warm-up, not last | `rules.warmup.core_mobility_placement` |
| **no weight anywhere in the plan** | structural |

It prints a numbered list of failures and exits non-zero. Nothing else.

**`save.mjs <job_id>`** re-validates from scratch — the model's claim that it
passed is never trusted — then: block kinds become a new `blocks` row with
status `draft` plus its days, slots, rationale and a `decisions` entry; other
kinds land in `output_md`. Consumed `coach_notes` get `consumed_by_job` set. The
job becomes `done`. Any failure anywhere sets the job `failed` with a short
error string in the row.

**Prompts** in `coach/prompts/` contain no personal data. They tell the model to
read `work/context.json`, treat the manual and rules as binding, honour the
job's instructions and the unconsumed notes, show the volume arithmetic in the
rationale, and cite a logged number for every decision.

The app subscribes to `ai_jobs` over Supabase realtime and shows status live,
then renders the draft block with its rationale and volume table and three
buttons: **Activate** (which archives the current active block in the same
transaction), **Request changes**, **Discard**.

### Public-repo safety for the Action

Workflow logs on a public repository are world-readable, so:

- `claude` stdout and stderr go to `work/claude.log`. Nothing ever `cat`s a file
  under `work/`, in any step, including `if: failure()` steps. The scripts print
  only the job id and a status word.
- No `actions/upload-artifact`. Errors travel in the `ai_jobs` row, which is
  behind RLS.
- Triggers are `repository_dispatch` (type `coach-job`) and `workflow_dispatch`
  only. No `pull_request_target`, no `issue_comment`, no `schedule` — forks and
  outside contributors never reach a secret.
- `permissions: contents: read`, one concurrency group, 25-minute timeout.

---

## 8. App screens

Mobile-first, dark-mode aware, installable. Email + password sign-in only.

| Screen | Contents |
| :-- | :-- |
| Today | the computed plan, start/resume, week counters, quick body log |
| Workout | per-exercise logging, done-as-prescribed, rest timer, finish sheet |
| Block | active block, drafts with rationale and volume table, generate and revise |
| Progress | lift charts from `lift_history`, weekly volume against target, body-weight trend |
| Coach | notes, check-ins, ask, job history with live status |
| Settings | rules editor with schema validation and version history/rollback, manual editor, exercises list/edit, sign out |

---

## 9. Migration from Notion

One-off, under `migrate/`, with every output in gitignored `migrate/out/`.
Notion stays read-only until verification passes.

1. **Export** — raw JSON including page bodies, for six sources: gym log, lift
   tracker, monthly plans, body metrics, the coach operating manual, and the
   decision log. The Notion MCP server is available in this session and is used
   for the export; the fallback is an internal-integration token and the REST
   API. Page and data-source ids, and the expected row counts used for
   verification, live in `migrate/out/sources.local.json` — never in the
   repository.
2. **Normalize** — `normalize.mjs` parses the free text into rows: set notation
   such as `3x8-10 (Oct 21)` or `4x12`, per-hand loads such as `13 lb/hand`
   (kept per-hand with a note), and restated-versus-prescribed weights. Legacy
   session types from before the block structure import as training sessions
   with no block day. Rest rows become `kind = 'rest'`. Anything ambiguous goes
   to `migrate/out/review.md` as a question rather than a guess.
3. **Derive documents** — the manual becomes `documents.manual` v1 verbatim.
   Every rule and number in it becomes `documents.rules` v1, matching the
   schema. The decision log becomes `decisions`. The active monthly plan becomes
   an `active` block with its days and slots. The lift tracker becomes
   `exercises`, carrying muscle, cues, flag text for flagged rows, and
   `active = false` for removed ones. Stored "next target" text is **not**
   imported — targets are computed now.
4. **Load** — `load.mjs` is idempotent: it upserts on `notion_page_id` for
   sessions and body metrics and on name for exercises, using the service-role
   key from a gitignored local `.env`. Re-running it changes nothing.
5. **Verify** — `verify.mjs` writes `migrate/out/report.md`: row counts against
   the expected ones; for every lift-tracker row, Notion's last weight, reps and
   date against `lift_state`, listing every mismatch; and today's plan for the
   next rotation day printed beside the old "next target" text. The report is
   reviewed and every mismatch resolved before the migration counts as done.

---

## 10. Data and secrets

**Security.** Public sign-ups are disabled in the Supabase dashboard; the one
user is created there by hand. RLS is enabled on every table with
`user_id = auth.uid()` for every operation, and every view is
`security_invoker = true`. The Storage bucket reserved for future screenshots is
private with an owner-only RLS policy. A test signs in with no session at all
and asserts that every table and view returns zero rows and refuses every write.
The edge function rejects any request whose JWT does not resolve to an existing
user.

**What may be committed.** The Supabase project URL and anon key, in
`app/js/config.js` — public identifiers, exactly like a Firebase web config,
with access enforced by RLS.

**What may never be committed.** Service-role key, Claude OAuth token, GitHub
PAT — these live only in GitHub Secrets and Supabase secrets. And no personal
data of any kind: no training numbers, no body metrics, no injuries or diet
details, no operating-manual text, no Notion ids, no email addresses. The
`rules` and `manual` documents live in the database behind RLS. Every example
and seed file in the repository uses fabricated values, which is why the numbers
in §4 above are placeholders rather than anyone's actual programme.

**Deploy.** Owner: create the Supabase project, disable sign-ups, create the
user, `supabase login`, run `claude setup-token` and store it as the
`CLAUDE_CODE_OAUTH_TOKEN` GitHub secret, and create the fine-grained PAT
(this repository only, Contents: write). Automated from there: `gh secret set`
for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, `supabase secrets set` for
`GH_DISPATCH_TOKEN` and `GH_REPO`, `supabase db push`,
`supabase functions deploy dispatch-job`, GitHub Pages enabled through
`pages.yml`, and the project URL and anon key written into `app/js/config.js`.

**End-to-end check.** Sign in on the phone URL → Today renders from migrated
data → log "done as prescribed" on a test session, then delete it → create a
`checkin` job, watch it reach `done`, and read the Action log to confirm it
contains no personal data.
