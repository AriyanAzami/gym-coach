# Contributing

Contributions welcome. There are a few rules, and they are not negotiable, because they
are what makes this repo different from a prompt.

---

## 1. Every quantitative claim needs a citation

If you add a number — sets, reps, rest seconds, grams per kilogram, a percentage, an
effect size — it needs an entry in [`references/evidence.md`](references/evidence.md)
in the house format:

**claim → number → source → one-line caveat.**

Prefer meta-analyses, systematic reviews, and position stands. A single small trial is
usually not enough to change a rule that people will follow for months.

**If there is no citation, label it a convention.** `evidence.md` has a section for
exactly this, listing the things the repo does on judgement — the 45-second working-set
constant, the 3-session stall threshold, lagging-muscle-first ordering. Adding to that
list is a perfectly good contribution. Quietly presenting an opinion as a finding is not.

**Write the caveat honestly.** Most of this literature is short-duration studies on
small, mostly untrained samples. Say so. A caveat that admits the limitation is worth
more than one that oversells the result.

---

## 2. Safety changes get extra scrutiny

[`references/safety.md`](references/safety.md) is loaded by every skill. Changes to it
affect everyone who installs this.

- **Do not weaken an escalation criterion.** Adding one is fine; removing one needs a
  strong argument in the PR description.
- **Do not weaken the nutrition floors** — `BMR × 1.2`, BMI 18.5, 1% bodyweight per
  week. They exist to bound the system's output, and they stay bounded regardless of
  what the evidence would permit for a supervised athlete.
- **Nothing gets a diagnostic voice.** The coach describes, notes the pattern, and
  refers out. A PR that adds "this is probably X" to any output will be declined.
- **Do not add anything the coach cannot actually know.** It cannot see the athlete
  move, and any feature that implies otherwise is a safety problem, not a feature.

---

## 3. Do not break the core rules

These came out of auditing real training history, and they are the product. They hold
in **all five goal modes** — what a mode changes is the methodology inside them, never
the rules themselves:

1. **Volume is computed and shown before any plan ships**, and the active mode's
   `publication_gate` is **hard** — a plan that fails it does not ship. In the default
   `hypertrophy` mode that gate is a priority muscle under 10 sets/week.
2. **Exercise count is arithmetic**, derived from the athlete's real session length and
   the active mode's rest times.
3. **No weights in the block.** Targets are computed per session from the last log entry
   — and in the bodyweight and minimal equipment tiers, no frozen rep counts either.
4. **"Done as prescribed" is a complete log.** Never demand numbers already confirmed.
5. **Subjective effort is never cross-checked against heart rate.**
6. **Slot 1 is decided by the mode, and whatever is last does not get done.** Core and
   mobility live in the warm-up, in every mode.
7. **Goal modes change programming. They never change safety** (`safety.md` §8).

A PR that adds a weight column to a block template, or makes `log` ask for numbers when
the athlete said "done as prescribed", is a regression even if it looks like a feature.

---

## 4. No personal data

**Every example in this repo is fabricated and labelled as fabricated.**

Do not commit real Notion page or database IDs, real training logs, real names, ages,
weights, injury history, real gym chain names as defaults, or screenshots containing
personal health data.

`.gitignore` covers `*.local.json` and `gym-coach.config.json`. Check your diff anyway.

---

## 5. Where things go

| Kind of change | Where |
|---|---|
| **Methodology that differs by goal** — volume targets, rep ranges, progression, slot 1, deload, nutrition stance | `references/goals/<mode>.md` (§8) |
| **Mechanics shared by every mode** — session arithmetic, set counting, increments, stall and ordering mechanics, warm-up | `references/programming.md` |
| Evidence, exercises, nutrition, safety, storage | `references/` |
| Command behaviour and orchestration | `skills/<name>/SKILL.md` |
| The shape of what gets written to Notion | `templates/` |

**`programming.md` §0 is the authority on that first split.** A rule stated in both
places will drift; put it in one.

**Reference content belongs in `references/`, loaded via
`${CLAUDE_PLUGIN_ROOT}/references/<file>.md`.** Do not copy reference content into a
`SKILL.md` — the whole point of the shared library is that there is one copy of each
rule and it is readable on its own.

Keep `SKILL.md` files about *what this command does*, and reference files about *what
the coach believes*.

---

## 6. Testing a change

There is no test suite — the product is a set of instructions, so testing means running
it.

1. `claude plugin validate .` — checks the manifests.
2. `claude plugin marketplace add "./"` then
   `claude plugin install gym-coach@gym-coach-marketplace` — installs your working copy.
3. Run the affected command against a **scratch Notion page** with a fictional athlete.
   Never test against your real workspace.
4. For a change to `block` or `audit`, plant a deliberate flaw — a starved priority
   muscle, a lift stalled for three sessions — and confirm the command still catches it.
5. Delete the scratch workspace afterwards.

The acceptance criteria the repo was built against are in the build spec, and are the
right checklist for a substantial change:

- `today` returns a session with a `last:` value on **every** line
- `log` accepts "done as prescribed" without asking for numbers
- a logged increase appears in the **next** `today`
- `block` refuses to publish a plan that fails its mode's gate, and **names the
  specific defect**
- `block` writes **zero** weights
- a `version: 1` config produces **identical** output in every skill — the silent
  migration is the thing most easily broken by accident
- every number in `references/goals/` is cited in `evidence.md` or listed there as a
  convention
- `audit` finds a planted volume gap and a planted 3-session stall
- with Notion absent, **every** skill stops cleanly with the connection message — no
  crash, no partial provisioning

---

## 7. Style

- Direct. Numbers over adjectives.
- Tables where a table is clearer than prose. This is a reference, not an essay.
- No motivational language anywhere in the coach's output.
- When the plan is the problem, the text says the plan is the problem. Never imply a
  discipline failure for a session that could not fit in the available time.

---

## 8. Adding a goal profile

**This is the repo's extension story.** A sixth mode — `powerlifting-peaking.md`,
`calisthenics.md`, `postpartum-return.md`, whatever you need — is **one new file** in
`references/goals/` plus its numbers in `evidence.md`. No skill changes. That is the
whole point of the contract in
[`references/goals/README.md`](references/goals/README.md).

### 8.1 Fill all thirteen fields. All of them.

| # | Field | What it must answer |
|---|---|---|
| 1 | `primary_outcome` | What "progress" means, in one sentence |
| 2 | `unit_of_progress` | The number that must go up, or hold |
| 3 | `volume_rule` | The weekly-volume definition and its target |
| 4 | `publication_gate` | The hard check that blocks a block from shipping |
| 5 | `rep_ranges` | Per movement class |
| 6 | `intensity_cue` | RIR / RPE / %e1RM, and whether failure is allowed |
| 7 | `progression_scheme` | How the next session's number comes from the last |
| 8 | `rest_defaults` | Seconds, by movement class |
| 9 | `session_arithmetic` | Set-duration constant and any mode-specific adjustment |
| 10 | `ordering_rule` | What goes in slot 1, and why |
| 11 | `stall_rule` | Trigger, and the ordered intervention list |
| 12 | `deload_policy` | Cadence and shape |
| 13 | `nutrition_stance` | Surplus / deficit / maintenance, and the rate band |

Plus the two prose sections: **`progress_report`** (the exact lines `checkin` prints in
this mode, in order) and **`will_not_do`** (what the mode refuses, so the athlete knows
the edges before they hit them).

> **A partial profile is a broken mode, not a draft.**
>
> A skill that reads a missing field has nowhere else to look, and it will invent
> something — which is the exact failure the contract exists to prevent. "I'll fill in
> the deload policy later" ships a mode that silently makes one up. If a field genuinely
> does not apply, **say so explicitly in the field** — `general-fitness`'s
> `deload_policy` is the word "none" and a sentence explaining why, not an empty
> heading.

**`will_not_do` is not optional either.** It is copied verbatim into the athlete's
operating manual, where it survives the plugin being uninstalled, and it is the only
place the athlete is told in advance what their coach will refuse.

### 8.2 Every number is cited or admitted

Rule 1 applies with no exceptions and one addition: **conventions are grouped by mode**
in `evidence.md`, under *"What is not in here"*.

Add a subsection for your mode. List every uncited number in it with an honest one-line
justification. Then end your profile with a **Conventions in this mode** list pointing
at it.

> **Do not invent a citation. Ever.**
>
> You are not being asked to do a literature review to add a mode. You are being asked
> to be honest about which bucket each number sits in. **If in doubt, it is a
> convention.** A long conventions list is the most credible thing in this repo, and a
> single fabricated citation is the least.

Expect your list to be long. `strength` mode has eight entries; `endurance-hybrid` has
six. That is not a defect in those modes — it is what a reader needs in order to decide
how much of their programming is judgement.

### 8.3 Safety is not yours to change

`references/safety.md` §8 says goal modes never modify safety, and it means it. A
profile may not restate, soften, or condition:

- Any escalation criterion, or the escalation script
- The flagged-movement protocol
- Any scope boundary
- The nutrition floors — `BMR × 1.2`, BMI 18.5, 1% bodyweight per week

**A profile that appears to relax any of these will be declined.** If your mode needs a
*stricter* rule, that is fine and welcome — `fat-loss` makes the nutrition floors its
primary publication gate rather than a footnote. Stricter is a contribution. Looser is
not.

If your mode touches bodyweight at all, reference `safety.md` §8.1 rather than writing
your own version of it.

### 8.4 Do not change a skill to add a mode

If your profile cannot be expressed in the thirteen fields, **say so in the PR** rather
than special-casing a skill. Either the contract needs a fourteenth field — which is a
change affecting all five existing modes and needs to be argued on its own — or the
mode is really two modes.

A `SKILL.md` that grows an `if mode == "yours"` branch has broken the abstraction for
everyone.

### 8.5 The two tests a new profile must pass before merge

Both run against a **scratch Notion page with a fictional athlete**. Never your real
workspace.

**Test 1 — the gate actually blocks.**

Build a block in your mode that deliberately violates your `publication_gate`. Run
`/gym-coach:block`. It must:

1. Print the table your mode defines.
2. **Name the specific defect** — the muscle, the lift, the pattern, the conflict. Not
   "a priority is short".
3. Refuse to ship, fix it, and reprint the fixed table.
4. When the gate cannot be satisfied at all, put the trade-off to the athlete with real
   options and a recommendation — and ship nothing if unanswered.

A gate that warns instead of blocking is not a gate.

**Test 2 — the other four modes are unchanged.**

Run `/gym-coach:today` and `/gym-coach:checkin` in **`hypertrophy` mode** against a
fabricated history, before and after your change. **The output must be identical.**

This is the regression that matters. Every mode added so far has been added without
altering the default, and a profile that changes what an existing user sees has leaked
out of its file.

### 8.6 Checklist

- [ ] All thirteen fields filled, none left implicit
- [ ] `progress_report` and `will_not_do` written
- [ ] Every number cited in `evidence.md`, or listed in a **conventions subsection for
      your mode** with a justification
- [ ] **No invented citations**
- [ ] Nothing in `safety.md` restated, softened, or conditioned
- [ ] No `SKILL.md` changed
- [ ] Mode added to the tables in `references/goals/README.md` §1,
      `references/programming.md` §2, and the README's "Pick your goal" table
- [ ] Test 1 passes: the gate blocks and names the defect
- [ ] Test 2 passes: hypertrophy output byte-identical
- [ ] Scratch Notion workspace deleted

---

## Filing an issue

Useful issues include what you ran, what you expected, and what happened — with any
personal data removed. If it is a coaching disagreement rather than a bug, bring the
citation; that is a conversation this repo is glad to have.
