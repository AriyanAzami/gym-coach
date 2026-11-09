# Health check

A scheduled and on-demand check of the whole system, shown on its own Health
tab. Deterministic checks first, then a second opinion from a free NVIDIA model.

## What it checks

| Area | Examples | Source |
|---|---|---|
| training | weekly sets short of the rules minimum, stalled lifts, deload due, rotation gap, body-weight rate outside the gain band, no active block | `checks.js` over views + rules |
| data | done sets with no reps, loads that jump or drop like a unit slip, two training sessions on one day, sessions left `planned` in the past, done sessions with no sets, weigh-ins overdue | `checks.js` over rows |
| plumbing | `ai_jobs` stuck in queued/running, recent failed jobs, rules document missing or invalid | `checks.js` + `rules-check.js` |
| repo | latest `test` workflow run failed, recent `coach` runs failing | GitHub API from the edge function |

Every threshold comes from the `rules` document. Operational limits (how long a
job may sit queued) follow the workflow's own timeout and are not coaching
numbers.

## Data

- `health_settings`, one row per user, all four RLS policies: `enabled`,
  `cadence` (`daily`/`weekly`/`fortnightly`/`monthly`), `run_weekday` (0 = Monday),
  `run_hour`, `timezone`, `primary_model`, `fallback_model`.
- `health_runs`, select-only for the app: `trigger`, `status`
  (`queued`/`running`/`done`/`failed`), `findings` jsonb, `ai_summary_md`,
  `ai_model`, `ai_error`, `error`, timestamps. Published for realtime.
- `health_due` view: settings whose next slot (cadence + weekday + hour in
  their timezone, after the last scheduled run) has passed.

## Flow

1. `pg_cron` runs hourly: inserts a queued `schedule` run for every row of
   `health_due`.
2. "Run now" calls `request_health_run()` (security definer, own user only,
   refused if a run started in the last 5 minutes): inserts a queued `manual` run.
3. An insert trigger on `health_runs` calls the `health-check` edge function via
   `pg_net` with only the run id.
4. The function claims the row atomically (`queued` → `running`); a replayed or
   guessed id finds nothing to claim. `verify_jwt` is off because the caller is
   the database; the claim is the guard. It answers at once and works in the
   background.
5. Deterministic findings are saved first. Then the model call: everything
   relevant (rules, manual, exercises, 8 weeks of sessions and sets, views,
   active block, decisions, notes, findings). Primary
   `nvidia/nemotron-3-ultra-550b-a55b`, fallback
   `mistralai/mistral-large-4-1t-a52b`, both editable on the tab. The model
   returns JSON `{summary_md, findings[]}`; AI findings are tagged `source: ai`.
6. If the model fails, the run is still `done` with `ai_error` set.

No secret is shared between the database and the function. The NVIDIA key lives
only in Supabase secrets as `NVIDIA_API_KEY`. Nothing runs in GitHub Actions,
so nothing reaches a public log. `test.yml` gets a weekly schedule (it holds no
secrets) so the repo finding stays fresh.

## Code layout

- `supabase/functions/health-check/checks.js` — pure, tested with `node --test`.
- `engine.js`, `rules-check.js` and `rules.schema.json` in that folder are
  byte-identical copies of the app's; a test fails if they drift.
- The deployed `index.ts` imports those shared files from jsDelivr pinned to a
  commit, so a change to them reaches the function only when it is redeployed.
- `app/js/screens-health.js` — the tab: latest run by area and severity, AI
  summary, history, Run now, schedule and model settings.

## Privacy note

The owner chose to send free text (injury notes, manual, journal-free notes) to
NVIDIA's trial API, whose data handling is unpublished. The tab states this.
