# Goal profile — `strength`

The mode where the most rules invert. **Slot 1 belongs to the main lift, not to the
lagging muscle**, rests are two to four times longer, and a 45-minute session holds
four exercises rather than seven.

Load with `safety.md` and `programming.md`. Safety is identical in every mode
(`safety.md` §8).

---

## 1. `primary_outcome`

Load on the athlete's ranked priority **lifts** — not muscles. The ranking captured at
setup is a list of lifts (squat, bench, deadlift, overhead press, weighted pull-up,
whatever they name), and it drives ordering forever until they change it.

## 2. `unit_of_progress`

**Estimated 1RM per priority lift**, computed with **Epley** from the top logged set:

```
e1RM = weight × (1 + reps / 30)
```

Epley is a **convention**, not a finding (`evidence.md`). It is close enough to track a
trend in one person over time, and it is not a prediction of what the athlete can lift
on the day. Say so the first time it is printed in a block or a check-in, and never
treat an e1RM as a permission slip to attempt a single.

`log` stores the e1RM in the log body so `checkin` reads it rather than recomputing.

## 3. `volume_rule`

Per **priority lift**:

- **≥2 exposures per week** — the lift, or a close variation, trained at least twice.
- **≥4 working sets per week at or above ~80% of current e1RM.**

Supporting muscles get **≥6 direct sets/week** — enough to hold size, not to maximise
it. Accessory volume that crowds out heavy work is a defect in this mode, not a bonus.

Counting rules are unchanged from `programming.md`: direct sets, compound secondaries
at 0.5, `audit` counts completed and `block` counts programmed.

Both the 2-exposure figure and the 4-heavy-set figure are **conventions**
(`evidence.md`).

## 4. `publication_gate`

> **Any priority lift below 2 exposures/week, or below 4 heavy sets/week, blocks
> publication.**
>
> **A priority lift appearing anywhere but slot 1 of its session is also a defect**
> and blocks publication.

Same procedure as every other mode: compute, print the table, name the defect, fix it,
state the cost, reprint, ship. The gate is hard.

```
Lift              Exposures/wk   Heavy sets/wk   Slot   Status
Back Squat              2              6          1      OK
Bench Press             2              4          1      OK
Deadlift                1              3          1      DEFECT — 1 exposure, 3 heavy sets
```

## 5. `rep_ranges`

| Movement class | Reps |
|---|---|
| Main lifts | 1–5 (**3–5 as the working default**) |
| Secondary compounds | 5–8 |
| Accessories | 8–12 |

Singles and doubles are for a prepared athlete under supervision. This coach programs
3–5 unless there is a specific reason, and it never programs a max.

## 6. `intensity_cue`

**RPE 7–8 on main work. RIR 2–3 on accessories.**

> **Never program a max single.**
>
> If asked for one, refuse and explain: an unsupervised max attempt has no place in an
> app that cannot see the lift. Offer a top set at RPE 8 and an e1RM instead. Say it
> once, plainly, then get on with the session — do not repeat the refusal every week.

## 7. `progression_scheme`

**Linear load progression on main lifts.**

- Add the **smallest available increment each session**, while all prescribed reps are
  hit at or under the target RPE.
- On a miss, **repeat the load**.
- On **two consecutive misses at the same load**, **reduce that lift by ~10% and
  rebuild.** (The 10% reset is a convention — `evidence.md`.)

**Accessories use double progression**, exactly as in `hypertrophy` mode: top of the
range on all sets → smallest increment → rebuild reps.

Targets are still never stored in the block. Every session's load is computed fresh by
`today` from the last logged entry for that exact lift.

## 8. `rest_defaults`

| Movement class | Rest |
|---|---|
| Main lifts | 180–300 s (default 240 s) |
| Secondary compounds | 120 s |
| Accessories | 90 s |

**This is the field that changes the whole session**, and it is the one people refuse
to believe. See `session_arithmetic`.

## 9. `session_arithmetic`

**45 s working set, as everywhere.** What changes is the rest term, and it dominates.

```
Main-lift set        45 s work + 240 s rest = 285 s
Secondary set        45 s work + 120 s rest = 165 s
Accessory set        45 s work +  90 s rest = 135 s

45 min budget                            = 2700 s
Warm-up                                  -  300 s  ->  2400 s

1 main lift  x 4 sets =  4 x 285 = 1140 s   (19 min on one exercise)
1 secondary  x 3 sets =  3 x 165 =  495 s
2 accessory  x 3 sets =  6 x 135 =  810 s
                        total    = 2445 s = 40.8 min + warm-up = 45.8 min
```

> **A 45-minute strength session realistically holds one main lift and 3–4
> accessories.** Show this arithmetic in the block, every time. It is the number people
> argue with, and the argument ends the moment they see it written out.

Ramp-up sets on the main lift are not working sets and are not counted in volume, but
they **do** consume time — budget 3–4 minutes for the main lift's ramp and say so.

Once four weeks of logs exist, the observed seconds-per-set replaces the 45 s constant
(`programming.md` §1). The rest figures come from this profile, not from the logs.

## 10. `ordering_rule`

> **Main lift first. Always.**
>
> **This directly overrides `hypertrophy` mode's lagging-muscle-first rule.** It is not
> a bug and it is not an inconsistency — the two modes disagree because they optimise
> different things. A lagging muscle trained fresh is worth more than a lagging muscle
> trained tired; a main lift trained tired is not a main lift.

Then secondary compounds, then accessories. **Core and mobility go in the warm-up**,
same as every other mode. `block` states which ordering rule it applied and why.

Mark the main lift and the top two accessories non-negotiable; cut from the bottom.

## 11. `stall_rule`

| What stalled | Trigger | Intervention |
|---|---|---|
| **Main lift** | Two consecutive missed sessions at the same load | **Reduce ~10% and rebuild.** Then deload (see below) |
| **Accessory** | Same weight *and* reps for 3 sessions | The `hypertrophy` interventions, in order: move it earlier → add a set → change the variation |

Before calling a main lift stalled, check it is not a logging gap, a safety-capped
lift, or a session where the athlete reported a bad night's sleep and one missed rep.
Two consecutive misses means two, not one.

## 12. `deload_policy`

**Every 4–6 weeks, or immediately after a 10% reset.**

Cut volume, keep one moderate top set. A strength deload that removes the heavy work
entirely costs more than it saves on the return week.

Scheduled with a date from the start of the block, like every other mode.

## 13. `nutrition_stance`

**Maintenance to slight surplus.**

> **Never a deficit while chasing a heavy PR.** Say so plainly at setup and once more
> if the athlete asks for one: a deficit and a strength peak are opposite requests, and
> running them together gets a worse version of both.

If the athlete wants to lose fat, offer the `fat-loss` mode change rather than
half-running it here. Protein floor 1.6 g/kg/day. The `safety.md` §6 floors apply and
are not negotiable.

---

## `progress_report`

The lines `checkin` prints in this mode, in order:

1. **e1RM per priority lift** — start → now, with the date of the top set each came
   from, and Epley named as the method. *This leads the report in this mode.*
2. **Exposures and heavy sets per priority lift this week**, against ≥2 and ≥4.
3. **Missed sessions on main lifts**, with the load and whether a reset fired.
4. **Skipped 2+**, with the category.
5. **Supporting-muscle volume** against ≥6 direct sets/week.
6. **Body-metrics trend** — 3-week rolling average against the
   maintenance-to-slight-surplus band.
7. **Target progress**, if targets exist.

Then exactly one recommendation.

---

## `will_not_do`

- **Peak an athlete for a meet, or select attempts.** That needs a coach in the room
  who can see the bar move.
- **Program a max single**, in any context, for any reason.
- **Run a percentage-based program off a 1RM it cannot verify.** If the athlete
  supplies a tested 1RM, record it as self-reported and use e1RM from logged sets as
  the working number anyway.
- **Prescribe a deficit during a strength block.**
- **Judge this athlete on sets per muscle per week.** That is `hypertrophy`'s unit and
  it produces a confident wrong answer here.

---

## Conventions in this mode

Listed in `evidence.md` under *"What is not in here"*. Not findings:

- **Epley** (`e1RM = w × (1 + reps/30)`).
- **≥2 exposures per week** per priority lift.
- **≥4 working sets per week at ≥80% e1RM.**
- **≥6 direct sets/week** for supporting muscles.
- **The ~10% reset** after two consecutive missed sessions.
- **1–5 reps on main lifts, with 3–5 as the working default**, and 5–8 / 8–12 for
  secondary compounds and accessories. Strength is load-dependent — that much is cited
  — but the specific rep bands are convention.
- **RPE 7–8** as the main-lift intensity cue.
- **180–300 s rest on main lifts.**
- **The 4–6 week deload cadence.**
- Everything `hypertrophy` mode lists, where this profile reuses it — the 45 s working
  set, 0.5 secondary sets, double progression on accessories.
