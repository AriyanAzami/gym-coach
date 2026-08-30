# Goal profile — `hypertrophy`

**The default mode.** A config with no `goalMode` is read as this one, and its output
is identical to what this repo produced before goal profiles existed.

Every rule below is a faithful extraction of `programming.md` as it was. Nothing was
invented in the move, and nothing was lost. If a hypertrophy user's output changes,
the extraction is wrong — not the original.

Load with `safety.md` and `programming.md`. Safety is identical in every mode
(`safety.md` §8).

---

## 1. `primary_outcome`

Muscle size in the athlete's ranked priority muscles.

## 2. `unit_of_progress`

**Direct sets per muscle per week**, and load progression per lift. Both must move —
volume is the dose, load progression is the evidence the dose is being adapted to.

## 3. `volume_rule`

**≥10 direct sets per muscle per week** ([ACSM](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/),
see `evidence.md`). More is better with diminishing returns and rising recovery cost.

- Count **direct** sets: the muscle is a primary mover or the explicit target.
- Count a compound's secondary muscles as **0.5 sets** each, and say you are doing so.
  Lat pulldown = 1 lat set + 0.5 biceps. (An accounting convention — `evidence.md`.)
- **`audit` counts completed sets. `block` counts programmed sets.** These are different
  numbers and conflating them hides the entire problem.
- Frequency is close to irrelevant once weekly volume is equated: 1×/week at 10 sets
  beats 2×/week at 6.

## 4. `publication_gate`

> **Any stated priority muscle below 10 direct sets/week is a plan defect and blocks
> publication.**

Not a warning, not a footnote. `block` prints the table, names the muscle, fixes it,
reprints the table, and only then ships.

Non-priority muscles below 10 are permitted — nobody maximises everything in 45
minutes — but they must be listed as **deliberate omissions with the reason and the
count**.

## 5. `rep_ranges`

| Movement class | Reps |
|---|---|
| Compounds | 6–10 |
| Isolation | 10–15 |

6–15 is all productive. The split is for joint comfort and time, not for a
hypertrophic difference.

## 6. `intensity_cue`

**RIR 1–3.** Leave one to three reps in reserve.

**Not to failure by default.** It costs recovery and buys little once volume is
equated, and it degrades the quality of every subsequent set in the session.

## 7. `progression_scheme`

**Double progression.**

1. Prescribe **one exact weight and one exact rep target** per lift.
2. Hit the top of the rep range **on all prescribed sets** → add the **smallest
   available increment** → rebuild the reps at the new weight.
3. Repeat.

No ranges in the prescription. **No conditional holds** — "hold X until Y is clean"
requires somebody to re-read the trigger every session and nobody does.

Increments come from the `programming.md` §5 table. When the forced increment is large
relative to the working weight (common on dumbbells and cable stacks), add a rep or a
set for one cycle instead, and say which you did and why.

## 8. `rest_defaults`

| Movement class | Rest |
|---|---|
| Compound | 90 s |
| Isolation | 60 s |

Longer than ~90 s wastes time for no measurable return
([Frontiers 2024](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/full)).
Rest is the largest single consumer of session time.

## 9. `session_arithmetic`

**45 s working set.** No mode-specific adjustment. Run `programming.md` §1 as written:

```
compound set   45 + 90 = 135 s
isolation set  45 + 60 = 105 s
```

Once four weeks of logs exist, the athlete's **observed** seconds-per-set replaces the
constant (`programming.md` §1).

## 10. `ordering_rule`

**Lagging priority muscle first. Every session it appears in.**

Then compounds, then isolation. **Core and mobility go in the warm-up**, never at the
end — whatever is last does not get done.

Mark the top three exercises non-negotiable and tell the athlete to cut from the
bottom when short on time.

## 11. `stall_rule`

**Trigger:** same weight *and* same reps for **3 sessions** on the same lift.

**Interventions, in this order:**

1. **Move it earlier in the session.** Costs nothing, works surprisingly often.
2. **Add a set.** More volume at the same load.
3. **Change the variation.** Different angle, grip, or machine for the same muscle.

**Never just re-prescribe it unchanged.** A fourth identical prescription is the coach
saying "try harder", which is not a plan.

Before intervening, check it is a real stall and not a logging gap, a safety-capped
lift, or a lift whose smallest increment is a large relative jump.

## 12. `deload_policy`

**~6 weeks: one week at ~60% of the normal set count, same weights.**

Scheduled with a date from the start of the block, not taken reactively. Keep the
weights; cut the sets.

## 13. `nutrition_stance`

**Slight surplus.** Target rate of gain **0.2–0.25% of bodyweight per week**.

Adjustment rule per `nutrition.md` §4, surplus stance: 3-week average flat or falling
→ +300 kcal/day; rising faster than 0.35% BW/week → −200 kcal/day; inside the band →
nothing, and say so.

Protein floor 1.6 g/kg/day. The `safety.md` §6 floors apply and are not negotiable.

---

## `progress_report`

The lines `checkin` prints in this mode, in order:

1. **Progressed** — named lifts and numbers.
2. **Stalled** — same weight *and* reps across sessions, with the count.
3. **Skipped 2+** — with the category, which is the whole point of the line.
4. **Weekly completed sets per muscle vs ≥10**, priority muscles marked. *A priority
   muscle below 10 completed sets/week is the finding, and it usually explains
   everything else on the page.*
5. **Body-metrics trend** — 3-week rolling average, rate as %BW/week against the
   0.2–0.25% band.
6. **Target progress**, if targets exist (see `README.md` §6 of the repo and
   `checkin` line 6).

Then exactly one recommendation.

---

## `will_not_do`

- **Peak an athlete for a meet.** Attempt selection needs a human in the room.
- **Program to failure by default.**
- **Chase a weekly frequency target once volume is equated.** 1×/week at 10 sets is
  not worse than 2×/week at 6, and telling someone otherwise costs them sessions they
  do not have.
- **Program a max single.**
- **Prescribe a deficit.** If the athlete wants to lose fat, that is `fat-loss` mode —
  offer the mode change rather than half-running it here.

---

## Conventions in this mode

Listed in `evidence.md` under *"What is not in here"*. Not findings:

- The 45-second working-set constant.
- Lagging-muscle-first ordering.
- The 3-session stall threshold.
- RIR 1–3 as the default intensity cue.
- Counting a compound's secondary muscles as 0.5 sets.
- Deload timing at ~6 weeks.
- 0.2–0.25% BW/week as the target rate of gain.
- The ±300 / −200 kcal adjustment steps and the 3-week rolling average.
