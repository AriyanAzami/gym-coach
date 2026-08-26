# Log entry — template

Written by `/gym-coach:log` as a new page in the **Gym Log** database. One page per
session. Never edited, never overwritten — a correction is a new entry with a note.

Format per `references/storage-notion.md` §5. All example values are **fabricated**.

---

## Properties

| Property | Type | Example | Notes |
|---|---|---|---|
| `Session` | Title | `2026-08-26 — Day 2 BACK` | **`YYYY-MM-DD — Day N NAME`.** The rotation day must be recoverable from the title |
| `Date` | Date | `2026-08-26` | ISO. Always |
| `Session Type` | Select | `Upper` | Upper · Lower · Full Body · Other |
| `Duration (min)` | Number | `46` | Actual, not planned |
| `Calories` | Number | `312` | Active calories if available. Blank is fine |
| `Avg HR` | Number | `118` | Blank is fine |
| `Peak HR` | Number | *(blank)* | **Blank unless explicitly labelled.** A chart axis maximum is not a peak |
| `Effort (1-10)` | Number | `7` | As reported. **Never cross-checked against HR** |
| `Pain Status` | Rich text | `Left shoulder: none today` | `None` if nothing to report — not blank |
| `Coach Notes` | Rich text | `Z1 22m / Z2 19m / Z3 5m` | Zone distribution, context, anything that does not belong elsewhere |

---

## Page body

### Example A — a normal session with deviations

```markdown
| Exercise | Sets | Reps | Weight | Notes |
|---|---|---|---|---|
| Cable Rear Delt Fly | 4 | 15 | 16 kg | ↑ from 14 |
| Lat Pulldown (wide) | 4 | 10 | 41 kg | ↑ from 39 |
| Seated Cable Row (neutral) | 3 | 10,10,8 | 43 kg | last set short |
| Cable Shrug | 3 | 12 | 45 kg | |
| Chest-Supported Row (horizontal grip) | 3 | 12 | 30 kg | |
| Prone Y-Raise (incline bench) | 3 | 15 | 4 kg | |

**Progressed:** rear delt fly 14→16 kg, lat pulldown 39→41 kg
**Stalled:** seated cable row — 43 kg x 3 sessions, reps not building
**Skipped:** none
**Micro-goal:** 3x10 clean on the seated row at 43 kg next Day 2
```

### Example B — "done as prescribed"

The athlete said exactly that and nothing else. **This is a complete log.** Expand it
against the prescribed targets and write those. **Do not ask for numbers.**

```markdown
| Exercise | Sets | Reps | Weight | Notes |
|---|---|---|---|---|
| Cable Rear Delt Fly | 4 | 15 | 16 kg | as prescribed |
| Lat Pulldown (wide) | 4 | 10 | 41 kg | as prescribed |
| Seated Cable Row (neutral) | 3 | 10 | 43 kg | as prescribed |
| Cable Shrug | 3 | 12 | 45 kg | as prescribed |
| Chest-Supported Row (horizontal grip) | 3 | 12 | 30 kg | as prescribed |
| Prone Y-Raise (incline bench) | 3 | 15 | 4 kg | as prescribed |

**Progressed:** all lifts hit prescribed targets — increments applied next session
**Stalled:** none
**Skipped:** none
**Micro-goal:** same, one increment up on the rear delt fly

*Logged from "done as prescribed" — targets expanded, not measured.*
```

That last italic line is required on an expanded entry, so `audit` can tell a
prescribed-and-confirmed number from a measured one.

### Example C — a session cut short, with pain

```markdown
| Exercise | Sets | Reps | Weight | Notes |
|---|---|---|---|---|
| Cable Rear Delt Fly | 4 | 15 | 16 kg | |
| Lat Pulldown (wide) | 4 | 10 | 41 kg | |
| Seated Cable Row (neutral) | 2 | 10 | 43 kg | stopped — see pain note |

**Progressed:** none
**Stalled:** none
**Skipped:** cable shrug, chest-supported row, prone Y-raise, hammer curl — pain (not time)
**Micro-goal:** none — see coach note

**Pain:** left shoulder, sharp, on the second set of the seated row at 43 kg. Rated 6/10.
Had not occurred on this movement before. Still present 2 h after the session.
```

**A pain entry with `sharp` and `still present` triggers the `safety.md` escalation
check.** The log records it; the coach's reply escalates.

---

## Invariants

- **Every weight carries its unit.** `41 kg`, never `41`.
- **Exercise names are copied character-for-character from the block.**
  `Lat Pulldown (wide)` and `Lat Pulldown` are different lifts to the history lookup,
  and the mismatch fails silently.
- **Per-set variation goes in the reps column**, comma-separated: `10,10,8`.
- **All four summary lines are mandatory**, even when the value is `none`. `checkin`
  and `audit` read them first.
- **Skip reasons are categorised** — exactly one of:

  | Category | Means | Programming implication |
  |---|---|---|
  | `time` | Ran out of session | **The plan is too long.** Cut the exercise count |
  | `crowding` | Station occupied | Add a substitution to the block, or move the exercise |
  | `equipment` | Machine broken or absent | Substitute permanently. **Never counted against the exercise** |
  | `fatigue` | Could not complete it | Volume or ordering problem |
  | `pain` | Stopped for pain | **Safety.** Flag the movement |
  | `choice` | Chose not to | Ask why once. If it is dislike, remove it permanently |

  Conflating these makes wrong changes. `time` says cut the plan; `equipment` says the
  plan was fine and the gym was not.
