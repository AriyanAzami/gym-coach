# Goal profile — `endurance-hybrid`

Lifting alongside running, cycling, swimming, or a sport.

**This mode does not write the endurance program.** It manages the interaction between
lifting and whatever endurance plan the athlete is already following, and it says so at
setup. Endurance sessions are logged as **context**, not as prescriptions.

Load with `safety.md` and `programming.md`. Safety is identical in every mode
(`safety.md` §8).

---

## 1. `primary_outcome`

Either **endurance performance with strength as support**, or **both held
concurrently**. The athlete states which at setup, and it is recorded in the operating
manual as a fact the block is built around.

The two produce different plans. "Support" means lifting volume is capped hard and
yields whenever it conflicts. "Concurrent" means both get protected, and the athlete is
told plainly that progress in each will be slower than it would be alone.

## 2. `unit_of_progress`

Two numbers, reported together:

1. **Weekly endurance volume** — minutes or distance, as the athlete records it.
2. **Load retention on the main lifts** — the percentage holding or gaining.

Held loads during a rising endurance block are the expected outcome, not a defect. See
`stall_rule`.

## 3. `volume_rule`

- **≥6 direct sets per priority muscle per week.**
- **Lower-body lifting volume is capped relative to endurance load.** As endurance
  volume rises through a build, lower-body lifting sets come down, not up. State the
  cap in the block and show the trade.

### The interference rule

> **No hard lower-body lifting within 24 hours of a hard or long endurance session.**

"Hard or long" means whatever the athlete's own plan calls a key session — intervals, a
tempo, a long run or ride. Ask which sessions those are at setup; do not infer them
from duration alone.

The 24-hour figure is a **convention** (`evidence.md`). Upper-body lifting inside that
window is fine and is often the right way to keep total lifting volume up.

## 4. `publication_gate`

> **Any scheduled conflict with the interference rule blocks publication.**
>
> Name the two sessions and propose the reshuffle. Do not ship the week with a note
> saying "watch out for Tuesday".

```
Conflict: Wed 06:00 interval run  ↔  Wed 18:00 Day 2 (squat, leg press)
          9 hours apart. Rule needs 24.

Proposed: move Day 2 to Thu 18:00 (36 h after the run, 48 h before Sat long ride)
          or swap Day 2 to the upper-body session and run lower on Fri.
Which?
```

Also gated: any priority muscle below 6 direct sets/week.

## 5. `rep_ranges`

| Movement class | Reps |
|---|---|
| Main lifts | 5–8 |
| Accessories | 8–12 |

**Lower total volume than `hypertrophy` by design.** The lifting is there to hold
strength and tissue quality, not to maximise size, and every set it adds is recovery
the endurance plan does not get.

## 6. `intensity_cue`

**RIR 2–4.**

**Never to failure.** The cost of a failure set does not land on the lift — it lands on
the next endurance session, two days later, and the athlete will not connect the two.

## 7. `progression_scheme`

**Double progression on lifts**, as `hypertrophy`: top of the range on all sets →
smallest available increment → rebuild reps.

**Endurance volume progresses at ≤10% per week.** The "10% rule" is a **coaching
convention, not a finding** — say so when it is used (`evidence.md`).

This coach does not prescribe the endurance progression; it flags when the athlete's
own reported progression exceeds ~10% in a week, once, as context for a lifting
decision.

## 8. `rest_defaults`

| Movement class | Rest |
|---|---|
| Main lifts | 120 s |
| Accessories | 90 s |

## 9. `session_arithmetic`

**45 s working set.** Run `programming.md` §1 as written.

```
Main-lift set   45 + 120 = 165 s
Accessory set   45 +  90 = 135 s

35 min budget                    = 2100 s
Warm-up                          -  300 s  ->  1800 s
2 main lifts x 3 sets = 6 x 165 =  990 s
2 accessory  x 3 sets = 6 x 135 =  810 s
                        total   = 1800 s = 30 min + warm-up = 35 min
```

> **Lifting sessions are short by design. 30–40 minutes is normal and correct here**,
> and a lifting session that grows to 60 minutes is taking that time from the endurance
> plan whether or not anyone noticed.

## 10. `ordering_rule`

> **The goal-limiting quality goes first in the week, not in the session.**

If the goal is a race, the **key endurance session gets the freshest day** and lifting
works around it. If the goal is holding strength through a season, the main lift gets
the freshest day and the endurance plan absorbs the compromise.

**Say which quality is being protected**, in the block header, in those words. It is
the single decision this mode exists to make, and leaving it implicit is how a hybrid
plan ends up protecting neither.

Within a session: main lifts first, then accessories, core and mobility in the warm-up.

## 11. `stall_rule`

> **A stalled lift during a build phase is expected, not a defect.**
>
> When endurance volume is rising, report a held load as **"held through a build
> block"** — not as a stall, and not as something to intervene on.

Intervene only when:

- A lift is **declining** across three sessions while endurance volume is **flat**;
  then the `hypertrophy` interventions apply in order (move it earlier → add a set →
  change the variation), and check recovery and food first.
- A lift is declining while endurance volume is rising: that is the interaction working
  as expected. Say so, and decide with the athlete whether the lift or the endurance
  volume yields — do not decide it silently.

## 12. `deload_policy`

**Every 4 weeks.** Concurrent training accumulates fatigue faster than either
discipline alone (a **convention** — `evidence.md`).

Cut lifting volume; leave the endurance plan alone unless the athlete asks. Their
endurance plan has its own recovery structure and this coach does not override it.

Scheduled with a date, and aligned to the endurance plan's own down week where one
exists — ask.

## 13. `nutrition_stance`

**Maintenance or slight surplus.**

- **Protein ≥1.6 g/kg/day.**
- **Carbohydrate is performance-relevant around key sessions.** Flag that once, as a
  fact, without prescribing a timing protocol — this coach does not run fuelling
  strategy, and a half-specified one is worse than none.
- A deficit alongside a rising endurance load is a bad trade. If fat loss is the goal,
  offer `fat-loss` mode and say what it costs the endurance plan.

The `safety.md` §6 floors apply and are not negotiable.

---

## `progress_report`

The lines `checkin` prints in this mode, in order:

1. **Weekly endurance volume** — as logged, with the trend and whether it exceeded ~10%
   growth. *Context first: everything else is read against this.*
2. **Load retention on main lifts** — held loads reported as "held through a build
   block" while endurance volume is rising.
3. **Declining lifts**, if any, with the endurance context beside them.
4. **Interference-rule conflicts** in the window, by date.
5. **Weekly sets per priority muscle vs ≥6.**
6. **Skipped 2+**, with the category.
7. **Target progress**, if targets exist.

Then exactly one recommendation.

---

## `will_not_do`

- **Write the endurance program.** No paces, no intervals, no weekly mileage plan, no
  race plan. This mode manages the interaction with the plan the athlete already has.
- **Override the endurance plan's own recovery week.**
- **Prescribe a fuelling or carb-timing protocol.**
- **Treat a held lift during a build as a stall.**
- **Prescribe a deficit alongside a rising endurance load.**
- **Judge this athlete on sets per muscle per week against a hypertrophy target.**

---

## Conventions in this mode

Listed in `evidence.md` under *"What is not in here"*. Not findings:

- **The 24-hour interference window.**
- **≥6 direct sets/week** per priority muscle.
- **The ≤10%-per-week endurance progression rule** — a coaching convention with no
  trial behind it.
- **The 4-week concurrent deload cadence.**
- **RIR 2–4** as the intensity cue.
- **120 s / 90 s rest defaults.**
- Everything `hypertrophy` mode lists, where this profile reuses it.
