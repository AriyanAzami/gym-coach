---
name: checkin
description: Short training check-in. Use when the user says check in, how am I doing, or roughly every two weeks.
allowed-tools: Read Bash
effort: medium
---

# Gym Coach — check-in

**Five lines, your target progress, then one recommendation.**

> **This is not a rebuild. Resist the urge to redesign the program.** A check-in that
> reaches for the block file has stopped being a check-in. If the plan genuinely needs
> rebuilding, say so in one sentence and point at `/gym-coach:block`.

Load `${CLAUDE_PLUGIN_ROOT}/references/safety.md`,
`${CLAUDE_PLUGIN_ROOT}/references/programming.md`, and
`${CLAUDE_PLUGIN_ROOT}/references/nutrition.md`.

## Step 0 — prerequisites

Notion check (`notion-fetch` with `id: "self"`) → read config → stop with the appropriate message if either fails.

**Read `config.goalMode` and load `${CLAUDE_PLUGIN_ROOT}/references/goals/<mode>.md`.**
No `goalMode` means `hypertrophy` — read it that way, silently, and print exactly what
this skill printed before profiles existed. If `checkin` writes `targetsReviewedAt` at
the end of the run, it rewrites a version-1 config as version 2 in the same write
(`storage-notion.md` §2.1) — silently. **If there are no targets, it writes nothing and
leaves a v1 config alone.**

Read the **active block**, the **trailing ~4 weeks** of the Gym Log, recent **Body
Metrics**, and the **Targets** section of the operating manual
(`storage-notion.md` §8). Nothing older.

---

## The lines, and where they come from

**The structure below is the shape. The thresholds and the *language* come from the
profile's `progress_report`**, which also decides the order — and the order matters,
because the first line is the one people read.

| Mode | Line 1 leads with |
|---|---|
| `hypertrophy` | What progressed |
| `strength` | **e1RM per priority lift** |
| `fat-loss` | **Bodyweight — 3-week average and rate** |
| `general-fitness` | **Sessions completed per week** |
| `endurance-hybrid` | **Weekly endurance volume** |

Follow the profile's list. What follows is the hypertrophy shape, which is also the
default.

---

## The five lines

### 1. What progressed

**Name the lifts and the numbers.** Not "good progress on back day".

```
Progressed: lat pulldown 39 → 43 kg · seated row 41 → 45 kg · rear delt fly 14 → 16 kg
```

> **`general-fitness` leads with sessions completed instead**, and load progression
> moves down to line 3 as a bonus rather than a scoreboard:
>
> ```
> Sessions: 2.0/week over 4 weeks against a planned 2. Every week hit.
>           That is the number that matters in this mode, and it is good.
> Patterns: all eight trained every week except vertical pull in week 3.
> ```
>
> **`strength` leads with e1RM per priority lift**; **`fat-loss` leads with the 3-week
> bodyweight average**; **`endurance-hybrid` leads with weekly endurance volume.** See
> the profile's `progress_report`.

### 2. What stalled

Same weight *and* same reps across sessions. Give the count. **Use the mode's stall
trigger** — 3 sessions in `hypertrophy`, 2 missed sessions on a main lift in `strength`,
4 in `general-fitness`.

```
Stalled: cable shrug 45 kg × 4 sessions · leg press 120 kg × 3 sessions
```

Before calling something stalled, check it is not a logging gap, a safety-capped lift,
or a lift whose smallest available increment is a large relative jump. Say which if so.

> **`fat-loss`: the word is `retained`, not `stalled`**, whenever the 3-week weight
> average is falling on schedule. Only a *falling* load counts against the plan, and
> the line says so (`goals/fat-loss.md` §7):
>
> ```
> Retained: seated row 43 kg · cable shrug 45 kg · chest-supported row 32 kg
>           Weight down 0.62%/week, inside the band. Holding these is the job.
> Declining: none
> ```
>
> **`endurance-hybrid`: a held lift during a rising endurance block is
> "held through a build block"**, not a stall, and is not intervened on.

### 3. What got skipped twice or more — **and why**

Use the categories from `log` §3. **The category is the whole point of this line.**

```
Skipped 2+: prone Y-raise ×3 (time) · leg-press calf raise ×2 (crowding)
```

`time` means the plan is too long and the exercise count comes down. `equipment` means
the plan was fine. Reporting a raw skip count without the reason produces the wrong fix.

### 4. Weekly volume against the mode's target — **with the counts shown**

**Completed sets, not programmed sets.** A table, with numbers, and the target from the
profile's `volume_rule`:

| Mode | The table, and the target |
|---|---|
| `hypertrophy` | Sets per muscle vs **≥10** |
| `fat-loss` | Sets per muscle vs **≥8**, plus total vs 80% of the pre-deficit block |
| `strength` | Exposures and heavy sets per priority lift vs **≥2 / ≥4**; supporting muscles vs **≥6** |
| `general-fitness` | The eight **movement patterns** trained, then sets vs **≥6** as a warning |
| `endurance-hybrid` | Sets per priority muscle vs **≥6**, plus interference-rule conflicts by date |

```
Side delts   (P1)   11.5  ✅
Rear delts   (P2)    6.0  🚨  programmed 12 — slot 6 and 7 are being cut
Lats         (P3)   10.5  ✅
Upper traps  (P4)    9.0  ⚠️
```

Mark priority muscles. **A priority muscle below the mode's target is the finding**, and
it usually explains everything else on the page.

### 5. Body-metrics trend

The **3-week rolling weight average**, the rate as a % of bodyweight per week against
the mode's `nutrition_stance` band, and photo compliance. Per `nutrition.md` §4 and
`${CLAUDE_PLUGIN_ROOT}/templates/body-metrics.md`.

```
Weight: 79.2 → 79.9 kg over 4 weeks = +0.18 kg/wk (0.22% BW) — inside target
Weigh-ins: 14 of 28 days. Photos: none since Jul 19.
```

| Mode | Band |
|---|---|
| `hypertrophy` | +0.2–0.25% BW/week |
| `strength` | Maintenance to slight surplus |
| `fat-loss` | −0.5–0.75% BW/week, hard ceiling 1% |
| `general-fitness` | Maintenance. **Print nothing here unless they are weighing themselves and want it** |
| `endurance-hybrid` | Maintenance to slight surplus |

**With fewer than 3 weeks of data, compute nothing** and say you need another week.
Report compliance as a fact, once, without chasing it.

### 6. Target progress

**Only if the operating manual has targets.** If it says "no target set", print one line
offering to set one, and only at the first check-in after setup — then leave it.

```
TARGET — Squat e1RM 140 kg by Mar 15
  Start 112 kg (Aug 30) → now 121 kg → target 140 kg     47% there
  Observed rate 2.2 kg/week over 4 weeks → projected 138 kg by Mar 15
  Slightly behind. One more heavy exposure a week closes it.
```

**Update `current_value` in the operating manual** for every `log` and `body-metrics`
target, with the date of the reading it came from. Then set `targetsReviewedAt` in the
config. That is the one write `checkin` makes.

#### Rules for this line — all six are load-bearing

1. **Projection needs at least 3 data points spanning 3 weeks.** Below that, print
   exactly this and nothing else:

   ```
   TARGET — Squat e1RM 140 kg by Mar 15
     Start 112 kg (Aug 30) → now 116 kg
     Not enough data to project yet — need 2 more weeks.
   ```

   **Never extrapolate from two readings.** Two points always make a straight line, and
   it is always the wrong one.

2. **State the observed rate and the window it was measured over, always.** "2.2 kg/week
   over 4 weeks" — never a bare rate, and never a projection without its window.

3. **On/off-track is a statement about the rate, never about the athlete.** *"Slightly
   behind the rate this needs"*, not *"you're behind"*.

4. **If a target is missed, say it plainly, once, and offer a revised date.** Do not
   quietly drop it, do not restate it as a smaller target, and do not raise it again
   after the athlete answers.

   ```
   TARGET — Squat e1RM 140 kg by Mar 15     MISSED
     Reached 132 kg by Mar 15. Observed rate over the block was 1.4 kg/week,
     which puts 140 kg around May 20. Want to move the date, or change the target?
   ```

5. **A `manual` target is labelled self-reported, every time it appears.** With no
   update in 4 weeks it gets **one** reminder, then goes quiet.

6. **The projection is linear, and that is a convention** (`evidence.md`). Progress
   decelerates near a ceiling. Print the rate and the window so a reader can discount
   it; do not present it as a prediction of what will happen.

---

## Then exactly one recommendation

One. Not a list. The highest-return change available, traced to a number on the page
above.

```
Recommendation: move the rear delt fly to slot 1 on Day 2 and Day 3. It's programmed
for 12 sets and delivering 6 — it's being cut every time it lands in slot 6. Nothing
else needs to change.
```

> **If nothing needs changing, say that.** A check-in that always finds a problem is a
> check-in nobody trusts, and it teaches people that the coach will invent work.

```
Recommendation: none. Volume is on target, three lifts progressed, nothing has stalled
past two sessions. Keep going and check in again in two weeks.
```

---

## Nutrition adjustment — branches on the profile's `nutrition_stance`

> ### `general-fitness`: print nothing at all.
>
> No calorie line, no rate line, no "just so you know". **Unless the athlete asked**,
> in which case run the maintenance stance and answer the question they asked.

For every other mode, run `nutrition.md` §4 in the stance the profile names, and apply
**exactly one** change:

| Stance | Modes | 3-week average | Change |
|---|---|---|---|
| **Surplus** | `hypertrophy` | Flat or falling | **+300 kcal/day** |
| | | Rising faster than 0.35% BW/week | **−200 kcal/day** |
| | | Inside 0.2–0.25%/week | **Nothing.** Say so |
| **Deficit** | `fat-loss` | Flat or rising | **−200 kcal/day** |
| | | Falling faster than 1% BW/week | **+200 kcal/day.** Not optional — this is a floor, not a preference |
| | | Inside 0.5–0.75%/week | **Nothing.** Say so |
| **Maintenance** | `strength` · `endurance-hybrid` · `general-fitness` (on request) | Drifting >0.3% BW/week either way | **±200 kcal/day** |
| | | Stable | **Nothing.** Say so |
| **Any** | | Under 3 weeks of data | **Nothing.** Say you need another week |

**One adjustment per check-in**, and it counts as the one recommendation — do not give
a training recommendation and a nutrition recommendation in the same check-in.

Enforce the `nutrition.md` §8 floors. They are not negotiable at a check-in either, and
**they are identical in all five modes** (`safety.md` §8). In `fat-loss` mode they are
the first thing checked, not the last.

---

## Escalate anything that warrants it

Scan the trailing weeks' `Pain Status` entries. If a pattern meets the `safety.md` §1
criteria — the same movement twice, a worsening trajectory, anything sharp or radiating
— **escalate, and let that be the check-in**. It outranks the five lines and the
recommendation.

---

## Rules for this skill

- **Five lines, the target line, one recommendation. Then stop.**
- **The lines, their order and their language come from the profile's
  `progress_report`.** Do not print the hypertrophy shape in another mode.
- **Never project a target from fewer than 3 points spanning 3 weeks**, and always state
  the observed rate with its window.
- **Nearly read-only.** `checkin` writes only: `current_value` on `log` and
  `body-metrics` targets, `targetsReviewedAt` in the config, and optionally a flagged
  movement or a nutrition target into the operating manual.
- Never redesign the block. Point at `/gym-coach:block` instead.
- Grade adherence honestly and separately: if someone trained 3×/week for four weeks,
  say so plainly, even when the volume table is bad. **Their consistency is not the
  problem, and telling them it is fine when it is fine matters.**
- When the plan is the problem, say the plan is the problem.
