# One-off Notion Import

This directory turns a Notion training workspace export into rows in Supabase.
Every intermediate and output file lives under `migrate/out/`, which is
gitignored so personal data never enters the repository.

## Pipeline

1. **Export (`migrate/out/raw/*.json`)**
   - Put the Notion page and database identifiers plus expected row counts into
     `migrate/out/sources.local.json`.
   - Export `gym_log`, `lift_tracker`, `monthly_plans`, `body_metrics`,
     `manual`, and `decision_log` into `migrate/out/raw/<name>.json`.

2. **Build rows (`migrate/build.mjs`)**
   ```bash
   node migrate/build.mjs
   ```
   Reads `migrate/out/raw/*.json`, normalises the session logs, lift tracker,
   body metrics, and active block into `migrate/out/rows.json`, and writes any
   ambiguous lines or missing metadata to `migrate/out/review.md`.

3. **Assemble documents (`migrate/derive-documents.mjs`)**
   ```bash
   node migrate/derive-documents.mjs
   ```
   Validates `migrate/out/rules.derived.json` against
   `coach/schema/rules.schema.json`, pairs it with the exported manual and
   decision log, and writes `migrate/out/documents.json`.

4. **Load (`migrate/load.mjs`)**
   ```bash
   node migrate/load.mjs
   ```
   Reads `migrate/out/rows.json` and `migrate/out/documents.json` (plus optional
   `migrate/out/overrides.local.json` for answers to `review.md`), validates the
   rules document again, and upserts everything idempotently into Supabase using
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`. Re-running it
   produces identical row counts and no duplicates.

5. **Verify (`migrate/verify.mjs`)**
   ```bash
   node migrate/verify.mjs
   ```
   Compares database row counts against `migrate/out/sources.local.json`, checks
   every Lift Tracker row's last weight, reps, and date against the live
   `lift_state` view, and prints Today's computed targets beside Notion's old
   "Next Session Target" column in `migrate/out/report.md`.
