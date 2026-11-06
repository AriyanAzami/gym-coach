# Project rules

## Git

- One branch: `main`. Commit directly to it.
- Commit messages: one short imperative line under 60 characters. No body, no
  bullet lists, no markdown.
- **No trailers of any kind**: no `Co-Authored-By`, no "Generated with", no tool
  attribution. The repo owner is the only author.
- Commit when a piece works, not per edit.

## This repository is public and holds no personal data

Never commit: training numbers, body metrics, injuries, diet details, operating
manual text, Notion ids, email addresses, or anything else about the owner. All
of that lives in Supabase behind row-level security.

Every example, seed and fixture file uses clearly fabricated values. When you
need a number in a test, invent one; never copy a real one out of the database.

## Secrets

- The Supabase project URL and anon key in `app/js/config.js` are public
  identifiers, like a Firebase web config. Data access is enforced by RLS. They
  may be committed.
- The service-role key, `CLAUDE_CODE_OAUTH_TOKEN` and the GitHub PAT live only
  in GitHub Secrets and Supabase secrets. They never enter the repository, a
  command line, or a workflow log.

## Rules as data

Every coaching number — rep ranges, increments, rest, caps, the stall rule,
deload triggers, volume targets, muscle priority, banned movements, nutrition
targets — is read from the `rules` document in `documents`. A coaching constant
in `app/js/engine.js`, `coach/validate.mjs` or a migration is a bug. Unit
conversion factors are not coaching numbers.

Changes to the rules shape go in `coach/schema/rules.schema.json`, and
`app/schema/rules.schema.json` is a byte-identical copy the browser fetches;
`test/rules-schema.test.mjs` fails if they drift.

## Never print data in Actions

Workflow logs on a public repository are world-readable.

- `coach/*.mjs` print only a job id, a status word, or a short error string.
- Nothing under `work/` is ever `cat`ed, `tee`d, echoed or uploaded as an
  artifact, including in `if: failure()` steps.
- `coach.yml` triggers only on `repository_dispatch` and `workflow_dispatch`.
  Never add `pull_request_target`, `issue_comment` or `schedule`.
- Errors travel in the `ai_jobs` row, which is behind RLS.

## Code

- `app/` is vanilla HTML/CSS/JS with no build step and no framework. `engine.js`
  and the screens are ES modules so the same files run in the browser and under
  `node --test`. Vendored libraries go in `app/vendor/`.
- `app/js/engine.js` is pure: plain data in, plain data out. No Supabase, no
  DOM, no `Date.now()` — the caller injects today's date.
- Derived state is a database view, never a hand-maintained column.
- Bump `VERSION` in `app/sw.js` whenever the app changes.
- Comments only where the code is not self-explanatory. No section banners, no
  restating what a line does.

## Invariants that are easy to break by accident

- **One rules validator.** `app/js/rules-check.js` has no dependencies and no
  node built-ins, because the browser and the Action both run it. `ajv` is not
  in that path: it is the oracle in `test/rules-check.test.mjs`, which runs both
  over a corpus and fails if they disagree. Adding a schema keyword means adding
  it to the checker too.
- **One volume calculation.** `plannedWeeklyVolume` in `app/js/engine.js` is
  used by both the Block screen's table and `coach/validate.mjs`. If they
  diverged, the validator could pass a block the screen shows as short.
- **Chart colours are validated, not chosen.** The `--accent`, `--warn` and
  `--bad` tokens in `app/css/app.css` passed the dataviz palette validator
  against both surfaces for lightness band, chroma, colour-vision separation and
  contrast. Do not nudge them by eye; re-run the validator.
- **Chart marks are styled by CSS class**, never inline fills, so dark mode is
  one token swap. `test/charts.test.mjs` fails if an SVG uses a class that has
  no rule — such a mark renders invisible.
- **Every `app/js/*.js` file must be in the `sw.js` precache list**, or it 404s
  only when the phone is offline. There is a test.
- A CLI entry point compares `import.meta.url` with
  `pathToFileURL(process.argv[1]).href`. String-building `file://...` silently
  never matches on Windows, and the script exits 0 having done nothing.

## Tests

`npm test` runs `node --test`. New behaviour gets a test that failed first.
Screens are string builders, so they are tested by rendering against a stubbed
`store.state` — including every empty state and an HTML-escaping case.
