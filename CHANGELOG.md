# Changelog

All notable changes to Gym Coach. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow
[semver](https://semver.org/).

---

## [0.2.0] — 2026-08-30

**Gym Coach stops being a hypertrophy coach and becomes a coach with five
methodologies behind one engine.**

> ### Hypertrophy behaviour is unchanged, by design.
>
> If you already use Gym Coach, this release does nothing to you. Your config is read
> as `hypertrophy` mode and `full-gym` equipment, your rules are byte-identical — 10
> direct sets per muscle per week, 6–15 reps, RIR 1–3, double progression, 90/60 rest,
> lagging muscle first, 3-session stall, ~6-week deload, 0.2–0.25% BW/week — and the
> config is quietly rewritten to version 2 the next time something writes to it. There
> is no prompt, no migration notice, and nothing to do.
>
> Goal modes were extracted from what the repo already did. If a hypertrophy user's
> output had changed, the extraction would have been wrong.

### Added

- **Five goal profiles**, in `references/goals/`: `hypertrophy` (the default),
  `strength`, `fat-loss`, `general-fitness`, `endurance-hybrid`. Each fills a
  thirteen-field contract plus a `progress_report` and a `will_not_do` list, and each
  is a single file — adding a sixth mode changes no skill.
- **`references/goals/README.md`** — the contract itself: what each field controls,
  which skill reads it, what a profile may never change, and how to add one.
- **Targets.** One to three measurable outcomes with a date, captured at setup and
  revisable. `checkin` gains a sixth line reporting start → now → target, the
  percentage there, and the observed rate with the window it was measured over. It
  **refuses to project from fewer than three readings spanning three weeks**, says a
  missed target plainly once and offers a revised date, and labels a self-reported
  target as self-reported everywhere it appears. Targets live in a section of the Coach
  Operating Manual — **not a fourth database**.
- **Equipment tiers.** `full-gym` · `barbell-home` · `dumbbell-home` · `minimal` ·
  `bodyweight`, with per-muscle coverage and the honest gap for each in
  `exercise-library.md` §10. In the two lowest tiers progression moves from load to
  reps, tempo, leverage and unilateral work, and `today` prints that variable where a
  weight would go — never an empty column.
- **Substitutions for home tiers** (`exercise-library.md` §7.1), by movement rather
  than by missing machine.
- **`safety.md` §8** — goal modes never modify safety — and **§8.1**, the canonical
  disordered-eating boundary that `fat-loss` mode references rather than restates.
- **`programming.md` §0** — which rules belong on that page and which belong in a goal
  profile, so a future contributor knows where to put one.
- **`CONTRIBUTING.md` §8** — how to add a goal profile, including the two tests a new
  profile must pass: its gate must actually block and name the defect, and hypertrophy
  output must be unchanged.
- **`Endurance` session type**, logged as context that does not advance the lifting
  rotation. An existing database that lacks the option gets it added rather than
  failing.
- **This changelog.**

### Changed

- **`references/programming.md` is now the mode-independent mechanics only.** The
  session arithmetic, set counting, increment table, "targets are never stored",
  observed-pace override, stall and ordering *mechanics*, supersets and warm-up stay.
  The 10-set target, 6–15 rep ranges, double-progression-as-the-only-scheme, the
  3-session stall trigger, 90/60 rests, the ~6-week deload and lagging-muscle-first all
  moved into the profiles — every one of them landing in all five.
- **Config schema → version 2**, adding `goalMode`, `equipmentTier`, `goalModeSetAt`
  and `targetsReviewedAt`. **Migration from version 1 is silent** (`storage-notion.md`
  §2.1).
- **`block`** takes its ordering rule, rest defaults, deload and **publication gate**
  from the active profile. The gate's structure is unchanged — compute, print the
  table, name the defect, fix, reprint, ship — and it is still hard in every mode. Step
  3 now shows hypertrophy and strength arithmetic side by side, because four exercises
  in the time that held seven is the output people refuse to believe.
- **`today`** puts the mode in its header line, applies the profile's progression and
  stall rules, and gains a strength-mode output variant with a top-set target and e1RM
  beside `last:`.
- **`log`** reports a held load in `fat-loss` mode as **`retained`, not `stalled`**,
  while the 3-week weight average is falling on schedule — one word, and it decides
  whether people keep logging. In `strength` mode it records the top set separately and
  stores its Epley e1RM in the body.
- **`checkin`** takes its line order and its language from the profile's
  `progress_report`. **General fitness leads with sessions completed.** The nutrition
  section branches on `nutrition_stance` and prints nothing at all in general-fitness
  mode unless asked.
- **`audit`** audits against the mode's rules, and **splits a history that spans a
  goal-mode change** rather than averaging a volume number across a boundary the
  athlete deliberately crossed. Section 5 gains target alignment.
- **`setup`** asks the goal mode before the priority ranking, confirms the mapping out
  loud, ranks whatever the mode ranks (muscles, lifts, nothing, or a protected
  quality), asks the equipment tier before the missing-machine questions, and captures
  targets. Its idempotency branch gains a fourth option — **change your training goal**
  — which keeps every log entry and every ID, dates the change, never reinterprets past
  history, and requires a block rebuild it offers to run immediately.
- **`nutrition.md` §3–§4** restructured into surplus, deficit and maintenance stances
  selected by the profile. Adds a deficit rate table and a deficit reading of the
  three-signal test.
- **`nutrition.md` §2** notes that for anyone the Mifflin-St Jeor sex binary does not
  describe, either equation is a usable starting estimate — the difference is smaller
  than the individual variation, and the scale corrects it within three weeks.
- **`evidence.md`** gains a conventions list **grouped by mode**, plus subsections for
  targets/projections and equipment tiers. Every number in `references/goals/` is
  either cited there or admitted there. **No citation was invented** — the honest
  answer is that most of four new modes is convention, and the list says so.
- **Every example is now fabricated and labelled fabricated**, using two fictional
  athletes: Sam (hypertrophy) and Rae (strength). The original athlete's real training
  loads — the recurring `85 lb` / `100 lb` / `90 lb` sequences — are gone from the
  skills, the references and the README.
- Plugin description and keywords are goal-agnostic.

### Notes

- **Storage is still Notion-only.** No local-file backend, no Google Sheets, no
  degraded mode. With the connector absent, every skill still stops cleanly with the
  `storage-notion.md` §1 message and creates nothing.
- **Nothing is ever deleted.** A goal-mode change archives nothing and rewrites no
  history; it is dated, and `audit` reads across the boundary by naming it.

---

## [0.1.0] — 2026-08-21

Initial release. A Notion-backed hypertrophy coach: onboarding interview, three
databases and a coaching manual provisioned automatically, per-session weights computed
from logged history, weekly volume verification that blocks publication, and an `audit`
that diagnoses a training history imported from anywhere.
