# Goal profiles — the contract

A **goal profile** is the methodology. The skills are the engine. This file is the
interface between them.

Everything that differs between a bodybuilder, a powerlifter, someone in a deficit,
someone who wants to be healthy, and someone training for a half marathon lives in
exactly one file per mode. Nothing else in the repo branches on the goal.

```
config.goalMode  →  ${CLAUDE_PLUGIN_ROOT}/references/goals/<mode>.md  →  apply its fields
```

**Default mode is `hypertrophy`.** A config with no `goalMode` is read as
`hypertrophy` and behaves exactly as this repo did before profiles existed. That is a
hard requirement, not a nicety — see `storage-notion.md` §2.1.

---

## 1. The five modes

| `goalMode` | File | For |
|---|---|---|
| `hypertrophy` | [`hypertrophy.md`](hypertrophy.md) | Muscle size in ranked priority muscles. The default |
| `strength` | [`strength.md`](strength.md) | Load on ranked priority lifts |
| `fat-loss` | [`fat-loss.md`](fat-loss.md) | Fat loss with muscle and strength retained |
| `general-fitness` | [`general-fitness.md`](general-fitness.md) | Health, capability, consistency. Most people belong here |
| `endurance-hybrid` | [`endurance-hybrid.md`](endurance-hybrid.md) | Lifting alongside running, cycling, swimming, or a sport |

---

## 2. The thirteen fields

**Every profile fills all thirteen.** A profile missing a field is a broken mode, not
a draft — the skill that reads it has nowhere else to look, and it will fall back to
inventing something, which is the failure this whole structure exists to prevent.

| # | Field | Controls | Read by |
|---|---|---|---|
| 1 | `primary_outcome` | What "progress" means, in one sentence | all |
| 2 | `unit_of_progress` | The number that must go up, or hold — weekly sets, e1RM, bodyweight rate, sessions completed | `checkin` `audit` |
| 3 | `volume_rule` | The weekly-volume definition and its target | `block` `checkin` `audit` |
| 4 | `publication_gate` | The hard check that blocks a block from shipping | `block` |
| 5 | `rep_ranges` | Per movement class | `block` |
| 6 | `intensity_cue` | RIR / RPE / %e1RM, and whether failure is allowed | `block` `today` |
| 7 | `progression_scheme` | How the next session's number is computed from the last | `today` |
| 8 | `rest_defaults` | Seconds, by movement class | `block` `today` |
| 9 | `session_arithmetic` | Set-duration constant and any mode-specific adjustment | `block` |
| 10 | `ordering_rule` | What goes in slot 1, and why | `block` `today` |
| 11 | `stall_rule` | Trigger, and the ordered intervention list | `today` `checkin` |
| 12 | `deload_policy` | Cadence and shape | `block` |
| 13 | `nutrition_stance` | Surplus / deficit / maintenance, and the rate band | `setup` `checkin` |

### Plus two prose sections

| Section | What it is | Read by |
|---|---|---|
| `progress_report` | The exact lines `checkin` prints in this mode, in order | `checkin` |
| `will_not_do` | What this mode explicitly refuses, so the athlete knows the edges before they hit them | `setup` `block` `today` |

`will_not_do` is copied into the athlete's Coach Operating Manual at setup, so it
survives the plugin being uninstalled.

---

## 3. What a profile may not change

A goal profile changes **programming**. It never changes **safety**.

The escalation criteria, the flagged-movement protocol, the scope boundaries, and the
nutrition floors in `safety.md` are identical in all five modes, and no profile may
restate, soften, or condition them. See `safety.md` §8.

A profile also may not change:

- **Targets are never stored in a block.** Every session weight is computed fresh from
  the last logged entry for that exact lift, in all five modes.
- **"Done as prescribed" is a complete log.**
- **Never invent a starting weight.** No history means
  `no logged history — start conservative and record it`.
- **Exercise count is arithmetic**, not a guess and not inherited from the last block.
- **Subjective effort is never cross-checked against heart rate.**
- **Every publication gate is hard.** A plan that fails its mode's gate does not ship.
- **Notion is the only backend.**
- **Nothing is ever deleted.** Archive only.

---

## 4. Where a rule belongs

| Kind of rule | File |
|---|---|
| Mode-independent mechanics — session arithmetic, set counting, increments, warm-up structure, "targets are never stored", observed-pace override, ordering *mechanics* | `references/programming.md` |
| Mode-dependent methodology — volume targets, rep ranges, intensity cue, progression scheme, rest defaults, what goes in slot 1, stall trigger, deload cadence, nutrition stance | `references/goals/<mode>.md` |
| Safety, in every mode | `references/safety.md` |
| Numbers, and whether they are cited or conventions | `references/evidence.md` |

See `programming.md` §0 for the same split stated from the other side.

---

## 5. Evidence discipline

**Do not invent a citation. Ever.**

A number may appear in a profile only if it is already cited in `evidence.md`, **or**
it is listed there under *"What is not in here → conventions, not findings"*, in that
mode's subsection, with an honest one-line justification.

If in doubt, it is a convention. Each profile ends with a **Conventions in this mode**
list pointing at `evidence.md`, so a reader can see exactly how much of their mode is
judgement rather than evidence. Those lists are long on purpose.

---

## 6. Adding a sixth profile

Fill all thirteen fields plus the two prose sections, add every uncited number to
`evidence.md`, and pass the two tests in `CONTRIBUTING.md` §8. Nothing else in the repo
needs to change — that is the point of the contract.
