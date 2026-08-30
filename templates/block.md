# Training block — template

Written by `/gym-coach:block` into the **Training Blocks** database. Body of the page.

> **No weight column. No weights anywhere.** The block holds structure only. Every
> session's load is computed fresh by `today` from the last logged entry for that exact
> lift. If a weight appears in a block, the block is wrong.

All example values are **fabricated**, and both athletes below are fictional.

**Two worked examples follow.** Example A is `hypertrophy` (Sam). Example B is
`strength` (Rae). They use the same template and the same 45-ish minutes, and they look
almost nothing alike — which is the point. **The block header states the goal mode, and
the volume table's target column comes from that mode's `volume_rule`.**

---

# Example A — `hypertrophy` mode (Sam)

# Block 3 — Shoulder Width

| | |
|---|---|
| **Status** | Active |
| **Goal mode** | `hypertrophy` — ≥10 direct sets/muscle/week, lagging muscle in slot 1 |
| **Equipment tier** | `full-gym` |
| **Dates** | 2026-08-24 → 2026-10-04 (6 weeks + deload) |
| **Deload week** | 2026-10-05 → 2026-10-11 |
| **Days/week** | 3 (Mon · Wed · Sat) |
| **Rotation** | Day 1 SHOULDERS+ARMS → Day 2 BACK → Day 3 LOWER+CHEST |
| **Review** | `/gym-coach:checkin` on 2026-09-07 and 2026-09-21 |

**Priority order this block:** side delts → rear delts → lats → upper traps.

**Ordering rule applied:** lagging priority muscle first, then compounds, then
isolation. Core and mobility in the warm-up.

---

## Session shape — the arithmetic

Do not skip this section. It is what makes the plan checkable.

```
Actual mean logged duration, trailing 4 weeks   47 min = 2820 s
                    (stated budget was 45 min — the logs are the number used)
Warm-up                                             - 300 s  ->  2520 s

Compound set   45 s work + 90 s rest = 135 s
Isolation set  45 s work + 60 s rest = 105 s

3 compounds x 3 sets =  9 sets x 135 s = 1215 s
4 isolation x 3 sets = 12 sets x 105 s = 1260 s
                             total     = 2475 s = 41.3 min
                             + warm-up            = 46.3 min      FITS (47 available)
```

**7 exercises. 21 working sets. That is the ceiling for every session in this block.**

Last block was built for 8 exercises against a 50-minute assumption. Mean actual
duration was 47 minutes and exercise 8 completed 3 times out of 11. The count is down
to 7 because the logs say so, not because anything went wrong.

---

## Day 1 — SHOULDERS + ARMS

**Non-negotiable: Cable Lateral Raise · Reverse Pec Deck · Machine Lateral Raise**

**Warm-up (5 min):** 2–3 min bike · dead bug 2×10 · band pull-apart 2×15 ·
ramp-up on lift 1 only (~50% × 8, ~75% × 5)

| # | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| 1 | Cable Lateral Raise | 3 | 15 | 60 s | Priority muscle, goes first. Lean away, lead with the elbow |
| 2 | Reverse Pec Deck | 3 | 15 | 60 s | Priority 2 |
| 3 | Machine Shoulder Press | 3 | 10 | 90 s | Keep light while the left shoulder is flagged |
| 4 | Machine Lateral Raise | 3 | 20 | 60 s | High rep, last 2 sets close to failure |
| 5 | Cable Shrug | 3 | 12 | 60 s | Pause at the top. Priority 4 |
| 6 | Incline Dumbbell Curl | 3 | 10 | 60 s | |
| 7 | Overhead Cable Extension | 3 | 12 | 60 s | Optional slot — cut here first if short |

## Day 2 — BACK

**Non-negotiable: Lat Pulldown (wide) · Cable Rear Delt Fly · Cable Shrug**

**Warm-up (5 min):** 2–3 min rower · Pallof press 2×10/side · scapular pulldown 2×10 ·
ramp-up on lift 1 only

| # | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| 1 | Cable Rear Delt Fly | 3 | 15 | 60 s | Priority 2, goes before the compounds deliberately |
| 2 | Lat Pulldown (wide) | 3 | 10 | 90 s | **Straight sets only** — never supersetted |
| 3 | Seated Cable Row (neutral) | 3 | 10 | 90 s | **Straight sets only** |
| 4 | Cable Shrug | 3 | 12 | 60 s | |
| 5 | Chest-Supported Row (horizontal grip) | 3 | 12 | 60 s | Elbows wide, pull to upper chest — mid-trap bias |
| 6 | Prone Y-Raise (incline bench) | 3 | 15 | 60 s | Lower traps. Very light |
| 7 | Hammer Curl | 3 | 12 | 60 s | Optional slot |

## Day 3 — LOWER + CHEST

**Non-negotiable: Leg Press · Seated Leg Curl · Pec Deck**

**Warm-up (5 min):** 2–3 min incline walk · bird dog 2×10/side · 90/90 hip 2×5/side ·
ramp-up on lift 1 only

| # | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| 1 | Leg Press | 3 | 12 | 90 s | High narrow foot position |
| 2 | Seated Leg Curl | 3 | 12 | 60 s | Better stretch position than lying |
| 3 | Pec Deck | 3 | 12 | 60 s | Replaces cable fly while the shoulder is flagged |
| 4 | Hip Abduction Machine | 3 | 15 | 60 s | Replaces hip thrust — see removed exercises |
| 5 | Leg-Press Calf Raise | 3 | 15 | 60 s | Replaces standing calf raise — machine absent. 2 s pause at the bottom |
| 6 | Cable Rear Delt Fly | 3 | 15 | 60 s | Third rear delt exposure — this is what gets them to 9 sets |
| 7 | Leg Extension | 3 | 15 | 60 s | Optional slot |

---

## Weekly set volume — with counts

**Direct sets. Compound secondaries counted at 0.5 and marked.**

**Target column comes from the mode** — `hypertrophy` gates at ≥10 direct sets per
muscle per week.

| Muscle | Sets/week | Target | Status |
|---|---|---|---|
| **Side delts** *(priority 1)* | 6 direct + 4.5 indirect = **10.5** | ≥10 | ✅ |
| **Rear delts** *(priority 2)* | **9** | ≥10 | ⚠️ see below |
| **Lats** *(priority 3)* | 6 direct + 1.5 indirect = **7.5** | ≥10 | ⚠️ see below |
| **Upper traps** *(priority 4)* | 6 direct + 3 indirect = **9** | ≥10 | ⚠️ see below |
| Chest | 3 | maintain | — |
| Quads | 6 | maintain | — |
| Hamstrings | 3 | maintain | — |
| Glutes | 3 | maintain | — |
| Biceps | 6 direct + 4.5 indirect | maintain | — |
| Triceps | 3 direct + 1.5 indirect | maintain | — |
| Calves | 3 | maintain | — |
| Lower traps | 3 | maintain | — |
| Core | 6 (warm-up) | maintain | — |

> 🚨 **Three priority muscles sit below 10. This plan does not ship in this state.**
>
> **Fix applied:**
> - Rear delts 9 → **12**: Day 2 exercise 1 goes to 4 sets, Day 3 exercise 6 goes to 5 sets.
> - Lats 7.5 → **10.5**: Day 2 lat pulldown to 4 sets (the reallocated straight-arm
>   pulldown volume).
> - Upper traps 9 → **10.5**: Day 1 cable shrug to 4 sets.
>
> **Cost:** Day 2 goes from 21 to 23 sets = 49 min against a 47-minute mean. Day 2's
> optional slot (Hammer Curl) is removed to pay for it → 20 sets = 44 min. ✅

### Volume table after the fix — this is the one that ships

| Muscle | Sets/week | Target | Status |
|---|---|---|---|
| **Side delts** *(priority 1)* | **10.5** | ≥10 | ✅ |
| **Rear delts** *(priority 2)* | **12** | ≥10 | ✅ |
| **Lats** *(priority 3)* | **10.5** | ≥10 | ✅ |
| **Upper traps** *(priority 4)* | **10.5** | ≥10 | ✅ |

---

## Progression rules

- **Double progression.** Hit the top of the rep range on **all** sets → add the
  smallest available increment → rebuild reps.
- **`today` computes every weight from the last log entry.** Nothing is written here.
- **No conditional holds.**
- **Stall = same weight and same reps for 3 sessions** → move it earlier → add a set →
  change the variation.
- **Cable chest fly is flagged** (left shoulder). Not programmed this block; Pec Deck
  substitutes. Revisit at the next block if two clean sessions accumulate elsewhere.

---

## Deliberate omissions

Stated so nobody discovers a gap in three months.

| Not trained / under 10 | Sets/week | Why |
|---|---|---|
| Chest | 3 | Not a priority; shoulder is flagged; 45 min does not stretch further |
| Hamstrings, glutes, calves | 3 each | Maintenance only — the goal is upper-body width |
| Lower traps | 3 | Warm-up placement only. Enough to keep them non-zero, which is the goal |
| Direct abs | 0 loaded | Core is 6 warm-up sets/week. Sufficient for the stated goal |
| Cable chest fly | 0 | **Flagged movement.** Removed on safety grounds, not preference |

---

## Targets for this block

- Side delt volume held at ≥10 sets/week for all 6 weeks — **verified at every check-in**
- Rear delts non-zero in **every** session (the failure this block exists to fix)
- Lat pulldown and seated row each progressing at least twice
- Sessions completed: ≥3/week in 5 of 6 weeks
- Bodyweight +0.16 to +0.2 kg/week on the 3-week average

---

## Review cadence

| Date | Action |
|---|---|
| 2026-09-07 | `/gym-coach:checkin` |
| 2026-09-21 | `/gym-coach:checkin` |
| 2026-10-05 | Deload week begins — ~60% of set count, same weights |
| 2026-10-12 | `/gym-coach:block` for Block 4 |

---

## Adjustments from Block 2

**Every change traces to a number.**

| Change | Evidence |
|---|---|
| Exercise count 8 → 7 | Mean logged duration 47 min, not the 50 assumed. Exercise 8 completed 3/11 sessions |
| Rear delt work moved to slot 1 on Day 2 | Rear delts averaged 2.5 completed sets/week against a programmed 6 — they were in slot 6 and 7 and kept getting cut |
| Straight-arm pulldown removed | "Can't feel it" fix tried 2026-07-14 and 2026-07-21, still missed. Volume to lat pulldown and seated row |
| Walking lunge removed | Athlete declined 2026-08-21. Volume to leg press |
| Cable chest fly → pec deck | Left shoulder pain reported twice on the fly, 2026-06-30 and 2026-08-12 |
| Machine shoulder press kept light | Same flag |
| Standing calf raise → leg-press calf raise | Machine absent from this gym |

---
---

# Example B — `strength` mode (Rae)

**A second fictional athlete, so the two modes are not confusable.** Rae is 41,
183 cm, 88 kg, metric, trains three times a week for 45 minutes in a full gym, and
ranks **lifts, not muscles**. Same template. Almost nothing else looks the same.

# Block 2 — Squat and Bench Base

| | |
|---|---|
| **Status** | Active |
| **Goal mode** | `strength` — ≥2 exposures and ≥4 heavy sets per priority lift, main lift in slot 1 |
| **Equipment tier** | `full-gym` |
| **Dates** | 2026-09-28 → 2026-11-01 (5 weeks + deload) |
| **Deload week** | 2026-11-02 → 2026-11-08 |
| **Days/week** | 3 (Mon · Wed · Fri) |
| **Rotation** | Day 1 SQUAT → Day 2 BENCH → Day 3 DEADLIFT |
| **Review** | `/gym-coach:checkin` on 2026-10-12 and 2026-10-26 |

**Priority order this block:** back squat → bench press → deadlift.

> **Ordering rule applied: main lift first, always.** This **overrides**
> `hypertrophy`'s lagging-muscle-first rule, deliberately. In this mode the ranked unit
> is the lift, not the muscle — and a main lift performed on the fumes of three
> accessories is not a main lift. Anyone comparing this block to Example A should read
> the difference as a decision, not a bug.

---

## Session shape — the arithmetic

**This is the section people argue with, and it is why it is printed in full.**

```
Actual mean logged duration, trailing 4 weeks   46 min = 2760 s
Warm-up + main-lift ramp                            - 480 s  ->  2280 s
                    (ramp is 50% x 5, 70% x 3, 85% x 1 — not working sets,
                     but 3 min of real time, and it is budgeted)

Main-lift set        45 s work + 240 s rest = 285 s
Secondary set        45 s work + 120 s rest = 165 s
Accessory set        45 s work +  90 s rest = 135 s

1 main lift x 4 sets = 4 x 285 = 1140 s     19 minutes on one exercise
1 secondary x 3 sets = 3 x 165 =  495 s
2 accessory x 3 sets = 6 x 135 =  810 s
                       total   = 2445 s = 40.8 min + 8 min warm-up/ramp = 48.8 min
                                                              OVER by 2.8 min
Fix: accessory 2 drops from 3 sets to 2  ->  2310 s = 38.5 min + 8 = 46.5 min   FITS
```

**4 exercises. 12 working sets.** Sam's hypertrophy block holds 7 exercises and 21 sets
in almost the same 47 minutes. **Neither number is wrong.** The rests the goal demands
are what spend the time, and 240-second rests on a heavy squat are not optional.

---

## Day 1 — SQUAT

**Non-negotiable: Back Squat · Romanian Deadlift · Leg Press**

**Warm-up (8 min):** 2–3 min bike · dead bug 2×10 · 90/90 hip 2×5/side ·
ramp on the squat only (~50% × 5, ~70% × 3, ~85% × 1)

| # | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| 1 | Back Squat | 4 | 4 | 240 s | **Main lift, slot 1.** Top set at RPE 8; e1RM computed from it |
| 2 | Romanian Deadlift | 4 | 8 | 120 s | Secondary. Hinge volume without a second heavy spinal load |
| 3 | Leg Press | 3 | 10 | 90 s | Accessory. Quad volume with no bar on the back |

## Day 2 — BENCH

**Non-negotiable: Bench Press · Overhead Press · Chest-Supported Row**

| # | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| 1 | Bench Press | 4 | 4 | 240 s | **Main lift, slot 1.** Top set at RPE 8 |
| 2 | Overhead Press | 3 | 6 | 120 s | Secondary. Second heavy pressing exposure of the week |
| 3 | Chest-Supported Row | 3 | 10 | 90 s | Accessory. Balances the pressing volume |
| 4 | Cable Rear Delt Fly | 2 | 15 | 90 s | Accessory. Supporting-muscle floor, not a priority |

## Day 3 — DEADLIFT

**Non-negotiable: Deadlift · Snatch-Grip RDL · Lat Pulldown**

| # | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| 1 | Deadlift | 3 | 3 | 300 s | **Main lift, slot 1.** Three sets — 300 s rest is what fits |
| 2 | Snatch-Grip RDL | 3 | 5 | 120 s | Secondary. **Second hinge exposure of the week** — see the gate fix |
| 3 | Lat Pulldown (wide) | 3 | 10 | 90 s | Accessory |
| 4 | Hanging Knee Raise | 2 | 12 | 90 s | Accessory |

---

## The gate — exposures and heavy sets, not sets per muscle

**Target column comes from the mode** — `strength` gates at ≥2 exposures and ≥4 working
sets at or above ~80% of current e1RM, per priority lift, plus slot 1.

**Before the fix**, Day 1's exercise 2 was a 3-set RDL and Day 3's exercise 2 was a
front squat:

| Lift | Exposures/wk | Heavy sets/wk | Slot | Target | Status |
|---|---|---|---|---|---|
| **Back Squat** *(P1)* | 2 (Day 1 + front squat Day 3) | 7 | 1 | ≥2 / ≥4 | ✅ |
| **Bench Press** *(P2)* | 2 (Day 2 bench + OHP) | 7 | 1 | ≥2 / ≥4 | ✅ |
| **Deadlift** *(P3)* | 1 | 3 | 1 | ≥2 / ≥4 | 🚨 |

> 🚨 **The deadlift gets one exposure and three heavy sets. This plan does not ship in
> this state.**
>
> **Fix applied:** Day 3's front squat becomes a **snatch-grip RDL**, giving the hinge a
> second exposure, and Day 1's RDL goes from 3 sets to 4. Heavy hinge sets go 3 → 5.
>
> **Cost, stated in full — this is a real trade, not a free fix:**
>
> - Day 1 gains a set: 2445 s + 165 s = 2610 s = 43.5 min + 8 = 51.5 min against a
>   46-minute mean. **Over.** Day 1's calf raise (2 sets) comes out → 2340 s = 39 min
>   + 8 = 47 min. Close enough to the mean to ship, and calves are recorded as an
>   omission.
> - **The squat loses its second exposure**, which the front squat was providing.

**No reordering fixes that, so it goes to the athlete:**

```
Fixing the deadlift's exposure count costs the squat its second one. At 3 days a
week I can protect two of your three lifts properly, not three.

  1. Squat and bench get 2 exposures each; the deadlift runs at 1 and I say so
     in the omissions — squat volume carries part of the hinge anyway.
  2. Squat and deadlift get 2 each; the bench drops to 1.
  3. Add a fourth day. All three get 2 exposures with room to spare.

You said 3 days is the bad-week number, so I'd take option 1 — and revisit at
the next block if the fourth day becomes real. Which do you want?
```

### Volume table after the fix — this is the one that ships

*(Option 1 chosen 2026-09-27.)*

| Lift | Exposures/wk | Heavy sets/wk | Slot | Target | Status |
|---|---|---|---|---|---|
| **Back Squat** *(P1)* | 2 | 7 | 1 | ≥2 / ≥4 | ✅ |
| **Bench Press** *(P2)* | 2 | 7 | 1 | ≥2 / ≥4 | ✅ |
| **Deadlift** *(P3)* | 1 | 5 | 1 | ≥2 / ≥4 | ⚠️ deliberate — see omissions |

### Supporting-muscle floor — ≥6 direct sets/week

| Muscle | Sets/week | Target | Status |
|---|---|---|---|
| Quads | 9 direct + 3 indirect | ≥6 | ✅ |
| Hamstrings / glutes | 12 | ≥6 | ✅ |
| Chest | 6 direct + 1.5 indirect | ≥6 | ✅ |
| Lats / mid-back | 6 direct + 1.5 indirect | ≥6 | ✅ |
| Rear delts | 2 direct + 3 indirect | ≥6 | ⚠️ omission below |
| Calves | 0 | ≥6 | ⚠️ omission below |

---

## Deliberate omissions

| Not trained / under target | Sets/week | Why |
|---|---|---|
| Deadlift second exposure | 1 exposure | Chosen 2026-09-27 over dropping the bench to one. Squat volume carries part of the hinge pattern. Revisit if a fourth day becomes real |
| Rear delts | 3.5 | Below the ≥6 supporting floor. Three days and 240 s rests do not stretch further. First thing added on a fourth day |
| Calves | 0 | Removed to pay for the deadlift fix. Not a priority lift and not a supporting muscle for any of the three |
| Direct arm work | 0 | Covered indirectly at this pressing and pulling volume |

---

## Progression rules

- **Linear load progression on the main lifts.** Smallest available increment each
  session while all prescribed reps are hit at or under RPE 8. On a miss, repeat the
  load. **On two consecutive misses at the same load, reduce ~10% and rebuild**, then
  deload.
- **Accessories use double progression**, exactly as in hypertrophy mode.
- **`today` computes every weight from the last log entry. Nothing is written here.**
- **No conditional holds.**
- **e1RM is Epley** (`w × (1 + reps/30)`) from the top logged set. It is a **trend, not
  a max**, and it is never a reason to attempt a single.
- **No max singles.** Not for a test, not to calibrate percentages, not on request.

---

## Deload

**2026-11-02 → 2026-11-08.** Cut volume, keep one moderate top set per main lift. A
strength deload that removes the heavy work entirely costs more than it saves on the
return week.

---

## Adjustments from Block 1

| Change | Evidence |
|---|---|
| **Goal mode hypertrophy → strength** | Set 2026-09-27 via `/gym-coach:setup`. Slot 1 moves to the main lift, rests to 240 s, exercise count 7 → 4, and progress is measured as e1RM rather than sets/muscle/week. **Block 1 is not comparable to this one on sets per week** |
| Exercise count 7 → 4 | Mean logged duration 46 min, and the mode's rest defaults. 4 sets × 240 s on the squat is 19 min of the 46 |
| Front squat → snatch-grip RDL on Day 3 | Deadlift had 1 exposure and 3 heavy sets against a ≥2 / ≥4 gate |
| Calf raise removed from Day 1 | Paid for the deadlift exposure fix. Recorded as a deliberate omission |
