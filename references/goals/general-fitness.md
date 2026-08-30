# Goal profile — `general-fitness`

**Deliberately the lowest bar in the repo. Most people who install this belong here.**

The gate is coverage, not quantity. The unit of progress is sessions completed. And the
single most important instruction in the file is that a person training twice a week,
consistently, is **succeeding** — not compromising.

Load with `safety.md` and `programming.md`. Safety is identical in every mode
(`safety.md` §8).

---

## 1. `primary_outcome`

Health, capability, and consistency. **Not a physique outcome.**

If the athlete wants a physique outcome, that is `hypertrophy` or `fat-loss` — offer
the mode rather than quietly grading them against it here.

## 2. `unit_of_progress`

**Sessions completed per week.**

> This leads every report in this mode, above any load. A week with two sessions
> completed and no load increases is a good week. Say so in those words.

Load progression is reported second, and it is reported as a bonus rather than as the
scoreboard.

## 3. `volume_rule`

Two parts, and the first one is the one that matters:

**1. Every major movement pattern trained at least once a week:**

| Pattern | Examples |
|---|---|
| Squat | Goblet squat · leg press · back squat · split squat |
| Hinge | Romanian deadlift · hip thrust · back extension · kettlebell swing |
| Horizontal push | Bench press · push-up · machine chest press |
| Horizontal pull | Seated row · chest-supported row · inverted row |
| Vertical push | Overhead press · landmine press · incline press |
| Vertical pull | Lat pulldown · pull-up · assisted pull-up |
| Carry | Farmer carry · suitcase carry · front-rack carry |
| Core | Dead bug · plank · Pallof press · bird dog (warm-up placement) |

**2. ≥6 direct sets per major muscle group per week.**

Counting rules unchanged: direct sets, compound secondaries at 0.5.

## 4. `publication_gate`

> **Any movement pattern missing from the week blocks publication.** Name the pattern.
>
> **Volume below 6 sets is a warning, not a block.** The gate here is coverage, not
> quantity.

```
Pattern            Sessions/wk   Status
Squat                   2          OK
Hinge                   1          OK
Horizontal push         2          OK
Horizontal pull         2          OK
Vertical push           1          OK
Vertical pull           0          DEFECT — no vertical pull in the week
Carry                   1          OK
Core                    2          OK  (warm-up)
```

When the gate fires, fix it by **adding the pattern**, not by adding a session. A
2-day/week full-body plan can cover all eight patterns; if it cannot, something else
in the plan is over-booked and should come out first.

## 5. `rep_ranges`

**8–15 throughout.** No split by movement class. Simpler is better here, and the
difference is not worth the extra rule.

## 6. `intensity_cue`

**RIR 2–3. Never to failure.**

Failure training in this mode buys nothing and costs the next session, which is the
only thing that actually matters.

## 7. `progression_scheme`

**Double progression with the smallest available increment.** Top of the range on all
sets → smallest increment → rebuild reps.

> **Do not push progression when adherence is the binding constraint.**
>
> If someone is training twice a week and hitting it, the correct coaching action is
> usually nothing. Adding load to a plan that is already being completed is fine.
> Adding load, sets, or a third day to a plan that is being completed *sometimes* is
> how the plan stops being completed at all.

State which constraint is binding — adherence or load — and act on that one only.

## 8. `rest_defaults`

**60–90 s throughout.** 90 s on the harder compounds, 60 s on everything else.

## 9. `session_arithmetic`

**45 s working set.** Run `programming.md` §1 as written.

**Default to full-body sessions.** They cover every pattern at low frequency, which is
exactly what makes 2 days/week work. A body-part split at 2 days/week leaves half the
patterns untrained, and that is the gate failing by construction.

```
45 min budget                    = 2700 s
Warm-up                          -  300 s  ->  2400 s
Compound set   45 + 90 = 135 s
Other set      45 + 60 = 105 s

3 compounds x 3 sets =  9 x 135 = 1215 s
3 others    x 3 sets =  9 x 105 =  945 s
                       total    = 2160 s = 36 min + warm-up = 41 min
```

Six exercises, full body, covering squat / hinge / push / pull / vertical / carry. Two
of those a week covers all eight patterns.

## 10. `ordering_rule`

**Hardest compound first**, then the rest of the patterns, then isolation. Core and
mobility in the warm-up.

"Hardest" means the most technically demanding or most fatiguing movement in the
session — usually the squat or hinge pattern. There is no lagging-muscle ranking in
this mode because there is no muscle ranking.

Mark the top three non-negotiable, cut from the bottom.

## 11. `stall_rule`

**Trigger: same weight *and* same reps for 4 sessions** — looser than `hypertrophy`'s
3, because a 2-day/week athlete reaches 4 sessions in a fortnight and noise dominates
below that. (A **convention** — `evidence.md`.)

**Intervene by changing the variation first, not by adding volume.**

1. **Change the variation.** A different movement in the same pattern is usually a
   fresher stimulus and does not cost a minute of extra session time.
2. **Move it earlier.**
3. **Add a set** — last, and only if session time genuinely allows.

Adding volume first is the `hypertrophy` reflex, and in this mode it makes the session
longer, which makes it less likely to happen, which is the actual problem.

## 12. `deload_policy`

**None scheduled.**

> Missed weeks are the deload. Say this plainly rather than pretending a 2-day/week
> program accumulates the kind of fatigue that needs a planned week off.

If an athlete in this mode is training 4+ days a week and reports accumulating fatigue,
that is a signal they may be in `hypertrophy` or `strength` territory — offer the mode
change rather than importing a deload here.

## 13. `nutrition_stance`

**Maintenance.**

**Protein floor (1.6 g/kg/day) and nothing else, unless the athlete asks for a calorie
target.**

> **Do not volunteer a calorie prescription in this mode.** Not at setup, not at a
> check-in, not as "just so you know". The person who signed up to be healthier and
> consistent did not ask to start counting, and handing them a number they did not
> request is the fastest way to make training feel like a diet.

If they do ask, run `nutrition.md` §2–§4 in the maintenance stance and enforce the
`safety.md` §6 floors.

---

## `progress_report`

The lines `checkin` prints in this mode, in order:

1. **Sessions completed per week**, against the plan, over the window. *This leads,
   always, and it leads even when it is the only good line on the page.*
2. **Movement-pattern coverage** — which of the eight were trained, which were missed.
3. **What progressed**, named, as a bonus rather than as the scoreboard.
4. **Skipped 2+**, with the category.
5. **Weekly sets per major muscle vs ≥6**, as a warning line only.

**No nutrition section unless the athlete asked for one.** No body-metrics line unless
they are weighing themselves and want it.

Then exactly one recommendation — and *"none, keep going"* is the right answer more
often in this mode than in any other.

---

## `will_not_do`

- **Grade the athlete against a bodybuilding template.** Sets per muscle per week is
  not the unit here and printing it as a verdict is a category error.
- **Imply that 2 sessions/week is a compromise.** It is the plan. It works. Anyone who
  sustains it for a year is ahead of most people who bought a 5-day split.
- **Produce a physique projection.** No "you could look like X by Y".
- **Volunteer a calorie target.**
- **Add a training day to fix a problem.** Fix it inside the days that exist.
- **Schedule a deload.**

---

## Conventions in this mode

Listed in `evidence.md` under *"What is not in here"*. Not findings:

- **The eight-pattern coverage list**, and coverage-as-the-gate.
- **≥6 direct sets/week** per major muscle group.
- **The 4-session stall trigger.**
- **Change-the-variation-first** as the intervention order.
- **No scheduled deload.**
- Everything `hypertrophy` mode lists, where this profile reuses it.
