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

## 3. Do not break the six rules

These came out of auditing real training history, and they are the product:

1. **Volume is computed and shown before any plan ships**, and a priority muscle under
   10 sets/week blocks publication.
2. **Exercise count is arithmetic**, derived from the athlete's real session length and
   rest times.
3. **No weights in the block.** Targets are computed per session from the last log entry.
4. **"Done as prescribed" is a complete log.** Never demand numbers already confirmed.
5. **Subjective effort is never cross-checked against heart rate.**
6. **The lagging muscle goes first.** Core and mobility live in the warm-up.

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
| Coaching rules, evidence, exercises, nutrition, safety | `references/` |
| Command behaviour and orchestration | `skills/<name>/SKILL.md` |
| The shape of what gets written to Notion | `templates/` |

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
- `block` refuses to publish a plan starving a priority muscle, and says which one
- `block` writes **zero** weights
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

## Filing an issue

Useful issues include what you ran, what you expected, and what happened — with any
personal data removed. If it is a coaching disagreement rather than a bug, bring the
citation; that is a conversation this repo is glad to have.
