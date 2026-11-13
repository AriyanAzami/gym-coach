# Gym Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the repository into a personal training app — a phone PWA over Supabase, with today's plan and logging in plain code and block generation in a GitHub Action driven by Claude Code.

**Architecture:** Postgres holds the data and derives every piece of state through views; `app/js/engine.js` is pure and turns views plus the `rules` document into one exact target per slot; the only model call is `claude -p` inside `coach.yml`, reached through a Supabase Edge Function that dispatches nothing but a job id.

**Tech Stack:** Vanilla HTML/CSS/ES-module JS (no build step), vendored `@supabase/supabase-js@2.119.0` UMD, Supabase (Postgres 15+, Auth, RLS, Edge Functions on Deno), Node 24 with `node --test`, `ajv` for JSON Schema, GitHub Actions, GitHub Pages.

**Spec:** [docs/spec.md](spec.md)

## Global Constraints

- Commit straight to `main`. One imperative line under 60 characters, no body. **No trailers of any kind** — no `Co-Authored-By`, no "Generated with", no attribution. Commit when a piece works, not per edit.
- **The repository is public and holds zero personal data:** no training numbers, no body metrics, no injuries or diet details, no operating-manual text, no Notion ids, no email addresses. Every example and seed file uses clearly fabricated values.
- Supabase URL and anon key may be committed (`app/js/config.js`). Service-role key, `CLAUDE_CODE_OAUTH_TOKEN` and the GitHub PAT live only in GitHub Secrets and Supabase secrets.
- **Least hardcode:** every coaching number — rep ranges, increments, rest, caps, the stall rule, deload triggers, volume targets, muscle priority, banned movements, nutrition targets — is read from the `rules` document. A coaching constant in `engine.js`, `validate.mjs` or SQL is a bug.
- Weights are always a value plus a unit column. `block_slots` has no weight column and a generated plan contains no weight.
- No build step and no framework in `app/`. Vendored libraries go in `app/vendor/`.
- Nothing under `work/` is ever printed, `cat`ed or uploaded by a workflow step, including `if: failure()` steps.
- Node 24. Test command: `npm test` → `node --test test/`.

## Review Focus

Five things the spec implies, that no single task's happy path exercises, most likely to bite first:

1. **Unit mismatch.** An exposure logged in `kg` while `rules.progression.increment_unit` is `lb` (or the reverse) must convert before adding an increment, never add across units. → Task 6.
2. **Per-hand loads.** A dumbbell or cable exposure recorded per hand must stay per hand through progression and must never be compared against a total-load exposure of the same exercise. → Task 7.
3. **Empty first run.** No active block, no sessions, no `rules` document: the engine returns an empty plan with a reason and every screen renders a prompt instead of throwing. → Tasks 7, 9, 11.
4. **Date boundaries.** `sessions.date` is a Postgres `date` and the phone has a local timezone; "today" and ISO week starts must not shift a day in either direction. → Task 9.
5. **Degenerate block shapes.** A block with zero days (rotation modulo), a day with zero slots, and two complete sessions on one date must not divide by zero or pick a day twice. → Tasks 4, 9.

---

## Phase 0 — ground

### Task 1: Clean slate and scaffolding

**Files:**
- Delete: every tracked file except `LICENSE` and `.git` — `.claude-plugin/`, `skills/`, `references/`, `templates/`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `DISCLAIMER.md`, `.gitignore`
- Create: `.gitignore`, `package.json`, `CLAUDE.md`, `.github/workflows/test.yml`, `test/.gitkeep`
- Keep: `docs/spec.md`, `docs/plan.md`

**Interfaces:**
- Produces: `npm test` → `node --test test/`; `npm run validate:rules` → `node coach/validate.mjs --rules <file>`

- [ ] **Step 1: Remove every old file**

```bash
git rm -r --cached . && git clean -fdx -e docs -e .git
```
Then restore `LICENSE` (MIT, owner's name unchanged) and `docs/`.

- [ ] **Step 2: Write `.gitignore`**

Must cover: `node_modules/`, `.env*`, `work/`, `migrate/out/`, `*.local.json`, `.DS_Store`, `Thumbs.db`, `desktop.ini`, `.vscode/`, `.idea/`, and `gym-coach-build-prompt.md` so the brief can never be committed.

- [ ] **Step 3: Write `package.json`**

`"type": "module"`, `"private": true`, `"engines": { "node": ">=24" }`, scripts `test` and `validate:rules`, dependencies `@supabase/supabase-js@^2.119.0`, `ajv`, `ajv-formats`.

- [ ] **Step 4: Write `CLAUDE.md`**

The Global Constraints section above, as repo rules: git rules, no personal data, rules-as-data, never print data in Actions, no build step in `app/`.

- [ ] **Step 5: Write `.github/workflows/test.yml`**

`on: [push, pull_request]`, `permissions: contents: read`, Node 24, `npm ci`, `npm test`.

- [ ] **Step 6: Verify the tree is clean and tests run**

Run: `git status --short && npm install && npm test`
Expected: only the new files staged; `npm test` passes with zero tests.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: clear the repo and scaffold the rebuild"
```

---

## Phase 1 — database

### Task 2: Tables, RLS and the one-active-block rule

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20261106215343_0001_tables.sql`
- Test: `test/sql-shape.test.mjs`

**Interfaces:**
- Produces: the 12 tables of spec §2 with their exact column names; every later task reads these names.

- [ ] **Step 1: Write `supabase/config.toml`**

`project_id = "gym-coach"`, `[auth] enable_signup = false`, `[db] major_version = 17`.

- [ ] **Step 2: Write `20261106215343_0001_tables.sql`**

In order: `create extension if not exists pgcrypto`; the 12 tables of spec §2, each with `id uuid primary key default gen_random_uuid()` and `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`; the unit `check` on every weight column; `exercises.load_mode text not null default 'total' check (load_mode in ('total','per_hand'))`; `create unique index blocks_one_active on blocks(user_id) where status = 'active'`; then for each table `alter table … enable row level security` and four policies (`select`, `insert`, `update`, `delete`) `using (user_id = auth.uid()) with check (user_id = auth.uid())` — **except** `documents`, which gets `select` and `insert` only, and `ai_jobs`, which gets `select` only.

Then two platform pieces: `alter publication supabase_realtime add table ai_jobs;` so the app can watch job status, and `insert into storage.buckets (id, name, public) values ('shots','shots',false) on conflict do nothing;` with an owner-only policy on `storage.objects` for that bucket.

- [ ] **Step 3: Write the failing shape test**

`test/sql-shape.test.mjs` reads the migration text and asserts, without a database:
```js
test('no table stores a bare weight', () => {
  // every `weight` or `target_weight` column is accompanied by a unit column in the same table
});
test('block_slots has no weight column', () => { /* assert !/weight/.test(blockSlotsDDL) */ });
test('documents has no update or delete policy', () => { /* assert policy count === 2 */ });
test('ai_jobs has only a select policy', () => { /* assert policy count === 1 */ });
test('every table enables row level security', () => { /* one alter … enable row level security per create table */ });
test('the shots bucket is created private', () => { /* assert /'shots','shots',false/ */ });
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS once the migration satisfies all five.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: schema with RLS on every table"
```

### Task 3: Lift views

**Files:**
- Create: `supabase/migrations/20261106215401_0002_lift_views.sql`
- Modify: `test/sql-shape.test.mjs`

**Interfaces:**
- Produces: `current_documents(user_id, key, version, body_md, body_json)`, `lift_history`, `lift_exposures`, `lift_state(exercise_id, last_date, last_weight, last_unit, last_reps, sessions_since_change, stall_count, flag)`

- [ ] **Step 1: Write `20261106215401_0002_lift_views.sql`**

Every view `create view … with (security_invoker = true) as`.
- `current_documents`: `distinct on (user_id, key) … order by user_id, key, version desc`.
- `lift_history`: `sessions ⋈ session_exercises ⋈ sets` where `sessions.kind = 'training'`, `sessions.status in ('done','partial')`, `sets.done`.
- `lift_exposures`: group `lift_history` by `(user_id, exercise_id, session_id, date)` → `work_sets` (count where not `partial`), `weight` (`max`), `unit`, `reps` (`array_agg … order by set_no`), `full_reps` (same, filtered to `not partial`).
- `lift_state`: over `lift_exposures` partitioned by `(user_id, exercise_id)` ordered by `date`, `lag()` the weight and `full_reps` to a boolean `repeated`; `stall_count` is the number of leading `repeated` rows in date-descending order (gaps-and-islands: `row_number()` minus the row number of the latest non-repeat); `sessions_since_change` counts exposures since weight or `full_reps` last changed; left-join `exercises.flag`.

- [ ] **Step 2: Extend the shape test**

```js
test('every view is security_invoker', () => {
  // each `create view` in supabase/migrations is followed by `with (security_invoker = true)`
});
```

- [ ] **Step 3: Run the test**

Run: `npm test` → PASS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: lift history, exposures and lift state views"
```

### Task 4: Volume, rate, rotation and body views

**Files:**
- Create: `supabase/migrations/20261106215430_0003_derived_views.sql`

**Interfaces:**
- Produces: `weekly_muscle_volume(week_start, muscle, direct_sets, indirect_sets, total_sets)`, `training_rate(per_week_4w, per_week_8w)`, `rotation_next(day_index, day_id, reason)`, `body_trend(week_start, avg_weight, unit, rate_3w)`

- [ ] **Step 1: Write `20261106215430_0003_derived_views.sql`**

- `weekly_muscle_volume`: `date_trunc('week', sessions.date)` as `week_start`; direct sets counted against `exercises.primary_muscle`, indirect against `unnest(exercises.secondary_muscles)` multiplied by `(body_json->'volume'->>'indirect_factor')::numeric` read per user from `current_documents`; `coalesce` the factor to `0.5` **only** when no rules document exists yet, so a first run does not error.
- `training_rate`: done training sessions in the trailing 28 and 56 days divided by 4 and 8.
- `rotation_next`: the active block's latest complete training session, where complete means `status = 'done'`, or `status = 'partial'` with a logged set for the day's first slot **and** logged slots `>=` `rules.rotation.complete_fraction` of the day's slots; next `day_index` is `(last + 1) % day_count`, guarded so `day_count = 0` yields `null` with `reason = 'block has no days'`; no complete session yields `day_index = 0`, `reason = 'first day of the block'`; ties on one date break by `sessions.created_at`.
- `body_trend`: weekly average `body_metrics.weight` and the difference against the average three weeks earlier.

- [ ] **Step 2: Verify the migrations parse**

Run: `npx supabase db lint --schema public` if a project is linked, otherwise `npx supabase db diff --help` is not a check — instead confirm the files apply in Task 24's `db push` and treat any syntax error there as this task's failure.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: volume, rate, rotation and body trend views"
```

### Task 5: The rules schema

**Files:**
- Create: `coach/schema/rules.schema.json`, `supabase/seed/rules.example.json`
- Test: `test/rules-schema.test.mjs`

**Interfaces:**
- Produces: `coach/schema/rules.schema.json` (JSON Schema draft 2020-12), the contract every later task reads rules through.

- [ ] **Step 1: Write the failing schema test**

```js
test('the example rules validate', () => { assert.equal(validate(example), true); });
test('a missing section fails', () => { /* delete r.volume → invalid */ });
test('an unknown key fails', () => { /* r.volume.extra = 1 → invalid */ });
test('indirect_factor outside [0,1] fails', () => { /* 1.5 → invalid */ });
test('rep range with min above max fails', () => { /* invalid */ });
test('a negative increment fails', () => { /* invalid */ });
test('the example contains no real programme values', () => {
  // every number in the example appears in docs/spec.md §4 — i.e. it is the documented placeholder set
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test` → FAIL, module not found

- [ ] **Step 3: Write `rules.schema.json`**

`"$schema": "https://json-schema.org/draft/2020-12/schema"`, `type: object`, `additionalProperties: false`, every one of the eleven sections in spec §4 `required`, each section itself `additionalProperties: false` with its keys `required` and bounded: increments `exclusiveMinimum: 0`; `indirect_factor`, `complete_fraction`, `set_factor`, `fraction_of_similar` in `[0,1]`; `max_exercises` and `sessions_to_trigger` integers `>= 1`; `interventions` and `priority` arrays of unique strings with `minItems: 1`; `gain_band_kg_per_week` a two-number array; `rest_s` values integers `>= 0`.

- [ ] **Step 4: Write `supabase/seed/rules.example.json`**

Exactly the placeholder values in spec §4 — fabricated, generic, not the owner's.

- [ ] **Step 5: Run the test**

Run: `npm test` → PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: rules JSON schema and fabricated example"
```

---

## Phase 2 — engine (pure, test-first)

### Task 6: Units, increments and rounding

**Files:**
- Create: `app/js/engine.js`
- Test: `test/engine-units.test.mjs`

**Interfaces:**
- Produces, all exported from `app/js/engine.js`:
  - `toUnit(value: number, from: 'lb'|'kg', to: 'lb'|'kg') -> number`
  - `incrementFor(exercise: {equipment, increment, unit}, rules) -> {value: number, unit: 'lb'|'kg'}` — the exercise's own `increment` when set, else `rules.progression.increments[equipment]` in `rules.progression.increment_unit`
  - `addIncrement(load: {value, unit}, inc: {value, unit}) -> {value, unit}` — converts `inc` into `load.unit`, adds, rounds to two decimals, and keeps `load.unit`

- [ ] **Step 1: Write the failing tests**

```js
test('addIncrement keeps the logged unit and converts the increment', () => {
  assert.deepEqual(addIncrement({value: 100, unit: 'kg'}, {value: 5, unit: 'lb'}),
                   {value: 102.27, unit: 'kg'});
});
test('addIncrement in matching units is exact', () => {
  assert.deepEqual(addIncrement({value: 135, unit: 'lb'}, {value: 5, unit: 'lb'}),
                   {value: 140, unit: 'lb'});
});
test('incrementFor prefers the exercise increment over the rules default', () => { /* … */ });
test('incrementFor falls back to the rules increment for the equipment', () => { /* … */ });
test('incrementFor throws a named error for unknown equipment', () => { /* no silent default */ });
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/engine-units.test.mjs` → FAIL

- [ ] **Step 3: Implement the three functions**

Pure, no imports, no coaching constants — the only literal is the lb/kg conversion factor `0.45359237`, which is a unit definition, not a coaching number.

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/engine-units.test.mjs` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: engine unit and increment maths"
```

### Task 7: Next target for one slot

**Files:**
- Modify: `app/js/engine.js`
- Test: `test/engine-target.test.mjs`

**Interfaces:**
- Consumes: `incrementFor`, `addIncrement` from Task 6
- Produces: `nextTarget({slot, exercise, state, similar, rules}) -> {weight, unit, reps, sets, label, lastLogged, perHand}`
  - `slot` is a `block_slots` row, `exercise` an `exercises` row, `state` a `lift_state` row or `null`, `similar` the candidate `lift_state` rows for the opener lookup, `rules` the rules document
  - `label` is `null`, `rules.opener.label`, or the stall intervention name
  - `perHand` is `exercise.load_mode === 'per_hand'`

- [ ] **Step 1: Write the failing tests**

```js
test('clearing the top of the range adds one increment and drops to rep_min', () => {
  // slot 3×8–10, last 3 sets of 10 at 100 lb → 105 lb × 8
});
test('inside the range keeps the weight and aims one rep higher', () => {
  // last 3 sets of 8 → same weight × 9
});
test('one rep short on a single set does not progress', () => {
  // reps [10,10,9] → same weight × 10, not an increment
});
test('partial reps do not count toward clearing the range', () => {
  // reps [10,10,10] with the last partial → same weight
});
test('a stall at the trigger carries the first intervention', () => {
  // stall_count === rules.stall.sessions_to_trigger → label === 'move_earlier'
});
test('a longer stall carries the next intervention in order', () => { /* … */ });
test('no history yields a labelled conservative opener', () => {
  // fraction_of_similar × the nearest same-muscle same-equipment load, label === rules.opener.label
});
test('no history and nothing similar yields no weight, still labelled', () => {
  assert.equal(target.weight, null);
});
test('a per-hand exposure stays per hand after progression', () => {
  // perHand === true and the weight is the per-hand number
});
test('a per-hand exposure is never compared with a total-load exposure', () => {
  // the opener's similar-lift lookup skips candidates whose load_mode differs
});
test('reps never exceed rep_max', () => { /* … */ });
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/engine-target.test.mjs` → FAIL

- [ ] **Step 3: Implement `nextTarget`**

Every threshold from `rules`: `progression.partials_count`, `progression.most_recent_entry_decides`, `stall.sessions_to_trigger`, `stall.interventions`, `opener.fraction_of_similar`, `opener.label`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/engine-target.test.mjs` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: next target from logged history and rules"
```

### Task 8: Today's plan card

**Files:**
- Modify: `app/js/engine.js`
- Test: `test/engine-plan.test.mjs`

**Interfaces:**
- Consumes: `nextTarget` from Task 7
- Produces: `planForDay({day, slots, exercises, states, rules}) -> {dayName, warmupNote, flags: string[], exercises: Array<{name, sets, reps, weight, unit, perHand, restS, lastLogged, nonNegotiable, cutOrder, label, notes}>, reason}`

- [ ] **Step 1: Write the failing tests**

```js
test('one entry per slot in slot position order', () => { /* … */ });
test('flags from flagged exercises surface at the top', () => {
  assert.deepEqual(plan.flags, ['left knee: stop at 8']); // fabricated
});
test('non-negotiable slots are marked', () => { /* … */ });
test('cut order is carried through', () => { /* … */ });
test('a day with no slots yields an empty plan with a reason', () => {
  assert.equal(plan.exercises.length, 0);
  assert.match(plan.reason, /no exercises/i);
});
test('rest comes from the slot, falling back to the rules rest for the category', () => { /* … */ });
```

- [ ] **Step 2: Run to verify failure** → FAIL

- [ ] **Step 3: Implement `planForDay`**

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: assemble today's plan card"
```

### Task 9: Dates, rotation fallback and volume helpers

**Files:**
- Modify: `app/js/engine.js`
- Test: `test/engine-dates.test.mjs`

**Interfaces:**
- Produces:
  - `ymd(date: Date) -> string` — local calendar date, never UTC-shifted
  - `isoWeekStart(ymd: string) -> string` — Monday
  - `nextDayIndex({lastCompleteIndex: number|null, dayCount: number}) -> number|null`
  - `volumeVsTarget({weeklyVolume, rules, perWeekRate}) -> Array<{muscle, sets, target, shortBy}>`
  - `sessionComplete({slotCount, loggedSlotPositions: number[], rules}) -> boolean`

- [ ] **Step 1: Write the failing tests**

```js
test('ymd uses the local calendar date', () => {
  // 2026-03-01T00:30:00+03:30 → '2026-03-01', not '2026-02-28'
});
test('isoWeekStart returns Monday for every day of a week', () => { /* 7 cases */ });
test('isoWeekStart crosses a year boundary correctly', () => { /* … */ });
test('nextDayIndex wraps at the last day', () => { /* 2 of 3 → 0 */ });
test('nextDayIndex returns null for a block with no days', () => {
  assert.equal(nextDayIndex({lastCompleteIndex: null, dayCount: 0}), null);
});
test('nextDayIndex with no history is day 0', () => { /* … */ });
test('sessionComplete is false when the first slot is unlogged', () => {
  // loggedSlotPositions omits 0, fraction otherwise met → false
});
test('sessionComplete uses complete_fraction from rules', () => { /* … */ });
test('volumeVsTarget reports the shortfall per priority muscle at the observed rate', () => { /* … */ });
test('volumeVsTarget with no rules document returns an empty list, not NaN', () => { /* … */ });
```

- [ ] **Step 2: Run to verify failure** → FAIL

- [ ] **Step 3: Implement the five functions**

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: date, rotation and volume helpers"
```

---

## Phase 3 — app

### Task 10: Shell, auth and the data layer

**Files:**
- Create: `app/index.html`, `app/css/app.css`, `app/js/config.js`, `app/js/store.js`, `app/js/ui.js`, `app/js/app.js`, `app/vendor/supabase.js`
- Test: `test/store-outbox.test.mjs`

**Interfaces:**
- Produces:
  - `store.js`: `signIn(email, pw)`, `signOut()`, `onAuth(cb)`, `load()` (one round of reads into `store.state`), `insert(table, row)`, `update(table, id, patch)`, `remove(table, id)`, `dispatchJob(kind, instructions, targetBlockId) -> {job_id}` (calls the edge function with the session's JWT), `subscribeJobs(cb)`, `flushOutbox()`, `queue(op)`
  - `ui.js`: `h(text)`, `el(id)`, `sheet(html)`, `toast(msg)`, `confirm(title, body)`
  - `app.js`: `go(screen, params)`, `register(name, screen)`, `screens` registry; each `screens-*.js` calls `register`
  - `store.state`: `{rules, manual, activeBlock, days, slots, exercises, liftState, rotation, weeklyVolume, trainingRate, bodyTrend, jobs, session}`

- [ ] **Step 1: Vendor supabase-js and verify the global**

```bash
curl -fsSL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js -o app/vendor/supabase.js
node -e "assert(/^var supabase=/.test(require('fs').readFileSync('app/vendor/supabase.js','utf8')))"
```

- [ ] **Step 2: Write the failing outbox test**

```js
test('a write while offline is queued and replayed in order', () => { /* fake client records calls */ });
test('a replayed write that conflicts is dropped, not retried forever', () => { /* … */ });
test('the outbox survives a reload', () => { /* serialised through a fake localStorage */ });
```

- [ ] **Step 3: Run to verify failure** → FAIL

- [ ] **Step 4: Write `config.js`**

Supabase URL and anon key as `window.GYM_CONFIG`, with a comment that these are public identifiers protected by RLS. Placeholder values until Task 24.

- [ ] **Step 5: Write `store.js`, `ui.js`, `app.js`, `index.html`, `app.css`**

`index.html`: viewport with `viewport-fit=cover`, `theme-color`, manifest link, the vendored UMD in a classic `<script>`, then `<script type="module" src="js/app.js">`. A six-tab bottom bar: Today, Workout, Block, Progress, Coach, Settings. `app.css`: dark-mode-aware via `prefers-color-scheme` with CSS custom properties, touch targets at least 44 px, safe-area insets.

- [ ] **Step 6: Run to verify pass** → PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: app shell, auth and Supabase data layer"
```

### Task 11: Today screen

**Files:**
- Create: `app/js/screens-today.js`

**Interfaces:**
- Consumes: `planForDay`, `nextDayIndex` (Tasks 8–9), `store.state`
- Produces: `screens.today.render()`; the action `start-session` which inserts a `planned` session plus one `session_exercises` row per slot holding the computed targets, then goes to `workout`

- [ ] **Step 1: Render the plan card**

Day name, warm-up note, flags at the top, then each exercise as `sets × reps @ target` with its rest, the last logged numbers beside it, non-negotiables named, cut order shown. Below it: sessions this week, weekly volume shortfall summary, last body weight with a quick log button.

- [ ] **Step 2: Handle every empty state**

No session, no active block, no rules document, a block with no days, an unresolvable rotation — each renders a short explanation and the one button that fixes it. Never a thrown error, never a blank screen.

- [ ] **Step 3: Verify in the browser**

Run: `npx http-server app -p 5050` and open `http://localhost:5050` signed out, then signed in with an empty database.
Expected: the sign-in form, then the "no active block" state — no console errors in either.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: today screen"
```

### Task 12: Workout screen

**Files:**
- Create: `app/js/screens-workout.js`

**Interfaces:**
- Consumes: the `planned` session and its `session_exercises` rows
- Produces: `screens.workout.render()`; actions `done-as-prescribed` (whole session or one exercise), `edit-set`, `finish-session`

- [ ] **Step 1: Done as prescribed**

Copies `session_exercises` targets into `sets` rows with `done = true`, for one exercise or for every exercise at once.

- [ ] **Step 2: Per-set editing**

Weight, reps and a partial toggle per set, with large touch targets; adding and removing a set; a rest timer started from the slot's `rest_s`.

- [ ] **Step 3: Finish sheet**

Duration, calories, average and peak HR, HR zones, effort, pain (defaults to `none`), notes — all optional. Status set to `done` or `partial` by `sessionComplete` from Task 9.

- [ ] **Step 4: Verify in the browser**

Start a session against a fabricated block, log it done as prescribed, finish it, and confirm Today's next target changes.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: workout logging screen"
```

### Task 13: Block screen

**Files:**
- Create: `app/js/screens-block.js`

**Interfaces:**
- Consumes: `blocks`, `block_days`, `block_slots`, `ai_jobs`; `dispatchJob(kind, instructions, targetBlockId)` from `store.js`
- Produces: `screens.block.render()`; actions `generate-block`, `request-changes`, `activate-block`, `discard-block`

- [ ] **Step 1: Render the active block and any drafts**

Days, slots, rationale as markdown, and the draft's volume table against the rules targets.

- [ ] **Step 2: Generate and revise**

"Generate block" opens a free-text box for this block's instructions and calls `dispatchJob('block', …)`. "Request changes" on a draft opens a comment box and calls `dispatchJob('revise_block', comment, draftId)`. Job status renders live from the realtime subscription.

- [ ] **Step 3: Activate, discard**

Activate archives the current active block and sets the draft `active` in one request, relying on the `blocks_one_active` index to reject a double-activation. Discard deletes the draft after a confirm.

- [ ] **Step 4: Verify in the browser**

Insert a fabricated draft by hand, activate it, confirm the previous active block became `archived` and that activating twice fails cleanly.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: block screen with generate and revise"
```

### Task 14: Progress screen

**Files:**
- Create: `app/js/screens-progress.js`, `app/js/charts.js`

**Interfaces:**
- Consumes: `lift_history`, `weekly_muscle_volume`, `body_trend`
- Produces: `screens.progress.render()`; `charts.js` exports `line(points, opts) -> string` (inline SVG) and `bars(rows, opts) -> string`

- [ ] **Step 1: Write `charts.js`**

Inline SVG, no charting library: a line chart for one lift's weight over time and a bar chart for weekly sets against target. Both legible in light and dark via `currentColor` and CSS custom properties.

- [ ] **Step 2: Render the three sections**

Per-exercise lift chart with a picker, weekly volume against target per muscle, body-weight trend with the 3-week rate.

- [ ] **Step 3: Verify in the browser**

Confirm both themes render and an exercise with a single data point does not produce a broken path.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: progress charts"
```

### Task 15: Coach screen

**Files:**
- Create: `app/js/screens-coach.js`

**Interfaces:**
- Consumes: `coach_notes`, `ai_jobs`, `dispatchJob`
- Produces: `screens.coach.render()`; actions `add-note`, `checkin`, `ask-coach`

- [ ] **Step 1: Notes**

A text box that inserts a `coach_notes` row immediately — no job — and a list showing which notes are still unconsumed.

- [ ] **Step 2: Check-in and ask**

Buttons that dispatch `checkin` and `ask` jobs; the job list shows status live and renders `output_md` as markdown when a job reaches `done`, or the error string when it reaches `failed`.

- [ ] **Step 3: Verify in the browser**

Add a note and confirm it appears as unconsumed; insert a fabricated `done` job row and confirm its output renders.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: coach notes, check-ins and ask"
```

### Task 16: Settings screen

**Files:**
- Create: `app/js/screens-settings.js`

**Interfaces:**
- Consumes: `documents`, `current_documents`, `exercises`, `coach/schema/rules.schema.json` (fetched and validated in the browser with a vendored `ajv` bundle or a hand-written check — see Step 2)
- Produces: `screens.settings.render()`; actions `save-rules`, `rollback-rules`, `save-manual`, `edit-exercise`, `sign-out`

- [ ] **Step 1: Rules editor**

A JSON text area loaded from the current rules version, with the schema's section names as inline guidance.

- [ ] **Step 2: Validate before saving**

Vendor `ajv`'s standalone browser bundle into `app/vendor/` and validate against `coach/schema/rules.schema.json`, which is copied to `app/schema/rules.schema.json` by the Pages workflow so the app and the Action share one file. A failing save shows every error and inserts nothing.

- [ ] **Step 3: Version history and rollback**

List every stored version with its date; "roll back to this version" inserts it as a new version rather than editing history.

- [ ] **Step 4: Manual editor and exercises list**

Markdown text area for the manual, inserted as a new version. Exercise list with edit for muscle, equipment, increment, tags, cues, flag and `active`.

- [ ] **Step 5: Verify in the browser**

Save a deliberately invalid rules document and confirm it is refused with errors and that `documents` gained no row; then save a valid edit and confirm the version count went up by one.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: settings with rules editor and history"
```

### Task 17: PWA and Pages deploy

**Files:**
- Create: `app/manifest.webmanifest`, `app/sw.js`, `app/icons/*`, `.github/workflows/pages.yml`

**Interfaces:**
- Produces: a deployed site at the Pages URL; `sw.js` exposes a `VERSION` constant bumped on every deploy

- [ ] **Step 1: Manifest and icons**

`name`, `short_name`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `theme_color`, 192 and 512 px icons plus an apple-touch icon. Generic name and description — no personal data.

- [ ] **Step 2: Service worker**

Precache the shell, CSS, modules and `vendor/supabase.js`; network-only for the Supabase origin; cache-first with background refresh for same-origin assets.

- [ ] **Step 3: Pages workflow**

`on: push: branches: [main], paths: [app/**, coach/schema/**, .github/workflows/pages.yml]`; `permissions: { contents: read, pages: write, id-token: write }`; copy `coach/schema/rules.schema.json` to `app/schema/`; `actions/configure-pages`, `actions/upload-pages-artifact` with `path: app`, `actions/deploy-pages`.

- [ ] **Step 4: Verify**

Run: `gh workflow run pages.yml` after the first push, then `gh run watch`.
Expected: success, and the Pages URL serves `index.html`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: installable PWA deployed to Pages"
```

---

## Phase 4 — AI pipeline

### Task 18: Block schema and the validator

**Files:**
- Create: `coach/schema/block.schema.json`, `coach/validate.mjs`
- Test: `test/validate.test.mjs`, `test/fixtures/block.valid.json`, `test/fixtures/context.json`

**Interfaces:**
- Produces:
  - `block.schema.json`: a plan is `{name, starts_on, ends_on, rationale, days: [{day_index, name, warmup_note, slots: [{position, exercise, sets, rep_min, rep_max, rest_s, non_negotiable, cut_order, notes, new?: {primary_muscle, secondary_muscles, equipment, movement_tags, increment, increment_unit}}]}]}`, `additionalProperties: false` throughout, and **no `weight` property anywhere**
  - `validate.mjs`: exports `validateBlock(plan, context) -> string[]` (failure lines, empty when it passes); as a CLI, `node coach/validate.mjs [--plan work/output.json] [--context work/context.json]` prints the numbered failures and exits 1, or prints `ok` and exits 0. `--rules <file>` validates a rules document instead.

- [ ] **Step 1: Write the failing tests**

One test per gate, each asserting on the returned failure lines:
```js
test('a valid plan returns no failures', () => { assert.deepEqual(validateBlock(valid, ctx), []); });
test('too many exercises in a day fails', () => { /* max_exercises + 1 → /max_exercises/ */ });
test('a banned movement tag fails', () => { /* … */ });
test('an unknown exercise without a new block fails', () => { /* … */ });
test('an unknown exercise with a complete new block passes', () => { /* … */ });
test('rest below or above the rules bounds fails', () => { /* … */ });
test('a priority muscle under its weekly minimum at the observed rate fails', () => {
  // the failure line states the arithmetic: sets/session × sessions/week vs the minimum
});
test('priority order inverted beyond tolerance fails', () => { /* … */ });
test('core placed last instead of in the warm-up fails', () => { /* … */ });
test('any weight anywhere in the plan fails', () => { /* a stray `weight` key → /weight/ */ });
test('a plan that is not valid JSON Schema fails with the schema path', () => { /* … */ });
test('validate.mjs --rules reports schema errors for a bad rules document', () => { /* … */ });
```

- [ ] **Step 2: Run to verify failure** → FAIL

- [ ] **Step 3: Write `block.schema.json` and `validate.mjs`**

Every threshold read from `context.rules`; the only literals are the structural checks. Failures are numbered lines, each naming the day, the slot and the rule.

- [ ] **Step 4: Run to verify pass**

Run: `npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: block schema and rules-driven validator"
```

### Task 19: Context builder

**Files:**
- Create: `coach/lib/db.mjs`, `coach/context.mjs`

**Interfaces:**
- Produces:
  - `db.mjs`: `serviceClient()` from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; `getJob(id)`, `setJobStatus(id, patch)`
  - `context.mjs`: CLI `node coach/context.mjs <job_id>` — marks the job `running`, writes `work/context.json`, prints only `job <id> running`

- [ ] **Step 1: Write `db.mjs`**

Throws a named error when either environment variable is missing.

- [ ] **Step 2: Write `context.mjs`**

Collects exactly the fields in spec §7: current rules and manual, eight weeks of sessions with their exercises and sets, `lift_state`, `weekly_muscle_volume` with the rules targets alongside, `training_rate`, `body_trend`, current and previous block with days and slots, recent `decisions`, `coach_notes` where `consumed_by_job is null`, the job's `kind` and `instructions`, and for `revise_block` the draft identified by `target_block_id`.

- [ ] **Step 3: Verify it prints nothing but status**

Run: `grep -nE "console\.(log|error|info)" coach/context.mjs coach/lib/db.mjs`
Expected: every match prints only a job id, a status word or a short error — no row data, no context, no instructions.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: job context builder"
```

### Task 20: Save

**Files:**
- Create: `coach/save.mjs`
- Test: `test/save-shape.test.mjs`

**Interfaces:**
- Consumes: `validateBlock` (Task 18), `db.mjs` (Task 19)
- Produces: `node coach/save.mjs <job_id>` — prints only `job <id> done` or `job <id> failed`; exports `rowsForBlock(plan, jobId, userId) -> {block, days, slots, decision}` so the mapping is testable without a database

- [ ] **Step 1: Write the failing test**

```js
test('rowsForBlock produces no slot with a weight column', () => { /* … */ });
test('rowsForBlock sets the block status to draft and carries source_job_id', () => { /* … */ });
test('rowsForBlock writes one decisions entry carrying the rationale', () => { /* … */ });
test('rowsForBlock maps new exercises to exercises rows before slots reference them', () => { /* … */ });
```

- [ ] **Step 2: Run to verify failure** → FAIL

- [ ] **Step 3: Implement `save.mjs`**

Re-runs `validateBlock` from the files on disk before writing anything. Block kinds insert the exercises any `new` slot needs, then the block, days and slots, the rationale and a `decisions` entry; `checkin` and `ask` write `output_md`. Unconsumed notes that went into the context get `consumed_by_job` set. The job becomes `done`. Any throw anywhere sets the job `failed` with a one-line error and exits 1.

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: save validated job output"
```

### Task 21: Prompts

**Files:**
- Create: `coach/prompts/block.md`, `coach/prompts/revise_block.md`, `coach/prompts/checkin.md`, `coach/prompts/ask.md`
- Test: `test/prompts.test.mjs`

**Interfaces:**
- Produces: four prompts, each telling the model which file to read, which file to write, and to run `node coach/validate.mjs` until it passes

- [ ] **Step 1: Write the failing test**

```js
test('no prompt contains personal data', () => {
  // no digits that could be a load or a body weight, no email, no Notion id pattern
});
test('every prompt names work/context.json and its output file', () => { /* … */ });
test('the block prompts require the validator to pass', () => { /* /validate\.mjs/ */ });
```

- [ ] **Step 2: Run to verify failure** → FAIL

- [ ] **Step 3: Write the four prompts**

Generic. The manual and rules in the context are binding; the job's instructions and the unconsumed notes must be honoured; the rationale must show the volume arithmetic; every decision must cite a logged number from the context.

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: generic coach prompts"
```

### Task 22: dispatch-job edge function

**Files:**
- Create: `supabase/functions/dispatch-job/index.ts`

**Interfaces:**
- Consumes: `POST { kind, instructions, target_block_id }` with `Authorization: Bearer <supabase jwt>`
- Produces: `201 { job_id }`, or `401`, `400`, `502`

- [ ] **Step 1: Write the function**

Verify the JWT with an anon client's `auth.getUser(token)` and reject anything that does not resolve to a user. Validate `kind` against the four allowed values and cap `instructions` length. Insert the `ai_jobs` row with the service-role client and that user's id. `POST` to `https://api.github.com/repos/${GH_REPO}/dispatches` with `event_type: 'coach-job'` and `client_payload: { job_id }` and nothing else, using `GH_DISPATCH_TOKEN`. A non-204 response marks the job `failed` and returns 502.

- [ ] **Step 2: Verify the payload carries only the job id**

Run: `grep -n "client_payload" -A3 supabase/functions/dispatch-job/index.ts`
Expected: one key, `job_id`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: dispatch-job edge function"
```

### Task 23: coach.yml

**Files:**
- Create: `.github/workflows/coach.yml`
- Test: `test/workflow-safety.test.mjs`

**Interfaces:**
- Consumes: `repository_dispatch` type `coach-job` with `client_payload.job_id`, or `workflow_dispatch` input `job_id`
- Produces: a run that leaves the `ai_jobs` row `done` or `failed`

- [ ] **Step 1: Write the failing safety test**

```js
test('coach.yml triggers on nothing but repository_dispatch and workflow_dispatch', () => { /* … */ });
test('coach.yml never prints anything under work/', () => {
  // no cat/type/upload-artifact/tee/echo referencing work/
});
test('coach.yml declares contents: read, a concurrency group and a timeout', () => { /* … */ });
test('the claude step restricts tools and redirects output to a file', () => {
  // --tools present, --allowedTools present, `> work/claude.log 2>&1` present
});
```

- [ ] **Step 2: Run to verify failure** → FAIL

- [ ] **Step 3: Write `coach.yml`**

`JOB_ID: ${{ github.event.client_payload.job_id || inputs.job_id }}`. Steps: checkout, Node 24 with npm cache, `npm ci`, `npm i -g @anthropic-ai/claude-code`, `node coach/context.mjs "$JOB_ID"`, the `claude -p` call exactly as in spec §7 with `CLAUDE_CODE_OAUTH_TOKEN` in `env`, then `node coach/save.mjs "$JOB_ID"`. A final `if: failure()` step marks the job `failed` and prints only the job id.

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: coach workflow with log-safe output"
```

---

## Phase 5 — deploy

### Task 24: Deploy and end-to-end check

**Files:**
- Modify: `app/js/config.js`
- Create: `docs/deploy.md` (the owner's checklist, generic)

**Interfaces:**
- Produces: a live Pages URL, a reachable edge function, and a job that completes

- [ ] **Step 1: Hand the owner their checklist**

Only the steps that need their hands: create the Supabase project; disable sign-ups; create the one user; `npx supabase login`; `claude setup-token` and store it as the `CLAUDE_CODE_OAUTH_TOKEN` GitHub secret; create a fine-grained PAT scoped to this repository with **Contents: write**; hand over the project ref, URL, anon key, service-role key and the PAT into a gitignored `.env`.

- [ ] **Step 2: Set the secrets**

Pipe each value in so it never appears in a command line, a shell history or this transcript:

```bash
set -a; . ./.env; set +a
printf '%s' "$SUPABASE_URL" | gh secret set SUPABASE_URL
printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | gh secret set SUPABASE_SERVICE_ROLE_KEY
npx supabase secrets set --env-file ./.env.supabase   # GH_DISPATCH_TOKEN, GH_REPO
```

Expected: `gh secret list` names both, and `npx supabase secrets list` names both — values never printed.

- [ ] **Step 3: Push the database and the function**

```bash
npx supabase link --project-ref "$PROJECT_REF"
npx supabase db push
npx supabase functions deploy dispatch-job
```
Expected: every migration applies; any SQL error here is a Task 2–4 failure to fix there.

- [ ] **Step 4: Write the real URL and anon key into `config.js`, enable Pages, deploy**

- [ ] **Step 5: Verify RLS from an anonymous client**

Write `test/rls-anon.test.mjs`, run against the live project with the anon key and no session:
```js
test('every table returns zero rows without a session', () => { /* for each table */ });
test('every write is refused without a session', () => { /* for each table */ });
test('every view returns zero rows without a session', () => { /* for each view */ });
test('dispatch-job rejects a request with no JWT', () => { assert.equal(res.status, 401); });
```
Expected: PASS.

- [ ] **Step 6: End-to-end**

Sign in on the phone URL; Today renders; log a test session done-as-prescribed, then delete it; create a `checkin` job and watch it reach `done`; then `gh run view --log` and confirm the log contains no training number, no body metric and no instruction text.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: point the app at the live project"
```

---

## Phase 6 — migration from Notion

Notion stays read-only until Task 28 passes.

### Task 25: Export

**Files:**
- Create: `migrate/out/raw/*.json` (gitignored), `migrate/out/sources.local.json` (gitignored), `migrate/README.md`

**Interfaces:**
- Produces: `migrate/out/raw/{gym_log,lift_tracker,monthly_plans,body_metrics,manual,decision_log}.json`, each row carrying its properties and its page body

- [ ] **Step 1: Write `sources.local.json`**

Page ids, data-source ids and expected row counts, taken from the owner's brief in the session. Gitignored; confirm with `git check-ignore -v migrate/out/sources.local.json`.

- [ ] **Step 2: Export via the Notion MCP server**

Read-only calls only. If the MCP server is unavailable, ask the owner for an internal-integration token and use the REST API instead.

- [ ] **Step 3: Verify the counts**

Each file's row count equals the expected count in `sources.local.json`; report any difference before going on.

- [ ] **Step 4: Commit `migrate/README.md` only**

```bash
git add migrate/README.md && git commit -m "docs: how to run the one-off Notion import"
```

### Task 26: Normalize

**Files:**
- Create: `migrate/normalize.mjs`
- Test: `test/normalize.test.mjs`

**Interfaces:**
- Produces: `parseSets(text) -> {sets, rep_min, rep_max, weight, unit, per_hand, note}[]`; CLI writing `migrate/out/rows.json` and `migrate/out/review.md`

- [ ] **Step 1: Write the failing tests**

Fabricated inputs only:
```js
test('"3x8-10" yields three sets and a rep range', () => { /* … */ });
test('"4x12" yields a single rep target', () => { /* … */ });
test('"13 lb/hand" is per hand', () => { assert.equal(r.per_hand, true); });
test('"12.5 lb/hand (weight not restated, prescribed assumed)" carries the note', () => { /* … */ });
test('a trailing date in parentheses is parsed as the date, not a rep count', () => { /* … */ });
test('an unparseable line goes to review rather than guessing', () => {
  assert.equal(r.review.length, 1);
  assert.equal(r.rows.length, 0);
});
test('a rest row becomes kind rest', () => { /* … */ });
test('a legacy session type imports with no block day', () => { assert.equal(row.day_index, null); });
```

- [ ] **Step 2: Run to verify failure** → FAIL

- [ ] **Step 3: Implement `normalize.mjs`**

Reads `migrate/out/raw/`, writes `rows.json` and `review.md`. Ambiguity always goes to `review.md`.

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Run it and read the review file**

Run: `node migrate/normalize.mjs && wc -l migrate/out/review.md`
Expected: every question in `review.md` answered by the owner before Task 27.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: normalise the Notion export into rows"
```

### Task 27: Load

**Files:**
- Create: `migrate/load.mjs`

**Interfaces:**
- Consumes: `migrate/out/rows.json`, `migrate/out/documents.json`, a gitignored `.env`
- Produces: rows in every table; prints only counts

- [ ] **Step 1: Derive the documents**

The manual becomes `documents.manual` v1 verbatim. Its rules become `documents.rules` v1 — written to `migrate/out/documents.json` first and validated with `node coach/validate.mjs --rules migrate/out/documents.json` before any insert. The active monthly plan becomes an `active` block; the lift tracker becomes `exercises` with flag text and `active = false` for removed rows, and its "next target" text is **not** imported; the decision log becomes `decisions`.

- [ ] **Step 2: Load idempotently**

Upsert sessions and body metrics on `notion_page_id`, exercises on name. Insert documents only when no version exists.

- [ ] **Step 3: Verify idempotence**

Run: `node migrate/load.mjs && node migrate/load.mjs`
Expected: identical counts both times, and no duplicate rows.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: idempotent Notion loader"
```

### Task 28: Verify

**Files:**
- Create: `migrate/verify.mjs`

**Interfaces:**
- Produces: `migrate/out/report.md`

- [ ] **Step 1: Implement the three comparisons**

Row counts against `sources.local.json`. For every lift-tracker row, Notion's last weight, reps and date against `lift_state`, listing every mismatch with both values. Today's plan for the next rotation day, printed beside the old "next target" text.

- [ ] **Step 2: Run it**

Run: `node migrate/verify.mjs && cat migrate/out/report.md`
Expected: zero count differences; every lift-state mismatch either explained or fixed.

- [ ] **Step 3: Show the owner the report and resolve every mismatch**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: migration verification report"
```

---

## Phase 7 — finish

### Task 29: README, repo rules and Claude project instructions

**Files:**
- Create: `README.md`, `docs/claude-project-instructions.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: documentation a stranger can self-host from

- [ ] **Step 1: Write `README.md`**

What it is; a mermaid architecture diagram; self-hosting with the reader's own Supabase project and their own Claude token, step by step; the not-medical-advice disclaimer; MIT licence. Generic — no personal data, no owner-specific values.

- [ ] **Step 2: Finish `CLAUDE.md`**

The Global Constraints of this plan, as the rules for future sessions.

- [ ] **Step 3: Write `docs/claude-project-instructions.md`**

A replacement for the owner's Claude Project instructions pointing at Supabase through the MCP server, read-only by default, in place of Notion. Generic enough to commit.

- [ ] **Step 4: Check the whole repository for personal data**

Run: `git grep -nIE "[0-9]{2,3} ?(lb|kg)|@[a-z0-9.-]+\.(com|org)|[0-9a-f]{32}" -- . ':!docs/spec.md'`
Expected: no match outside fabricated example files, and every match inside them is obviously fabricated.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: README, repo rules and project instructions"
```

- [ ] **Step 6: Report to the owner**

The live URL, anything left undone, and every open question in `migrate/out/review.md`.
