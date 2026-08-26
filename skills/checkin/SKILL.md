---
name: checkin
description: Short training check-in. Use when the user says check in, how am I doing, or roughly every two weeks.
allowed-tools: Read Bash
effort: medium
---

# Gym Coach — check-in

**Five lines, then one recommendation.**

> **This is not a rebuild. Resist the urge to redesign the program.** A check-in that
> reaches for the block file has stopped being a check-in. If the plan genuinely needs
> rebuilding, say so in one sentence and point at `/gym-coach:block`.

Load `${CLAUDE_PLUGIN_ROOT}/references/safety.md`,
`${CLAUDE_PLUGIN_ROOT}/references/programming.md`, and
`${CLAUDE_PLUGIN_ROOT}/references/nutrition.md`.

## Step 0 — prerequisites

Notion check (`notion-fetch` with `id: "self"`) → read config → stop with the appropriate message if either fails.

Read the **active block**, the **trailing ~4 weeks** of the Gym Log, and recent **Body
Metrics**. Nothing older.

---

## The five lines

### 1. What progressed

**Name the lifts and the numbers.** Not "good progress on back day".

```
Progressed: lat pulldown 85 → 95 lb · seated row 85 → 95 lb · rear delt fly 70 → 80 lb
```

### 2. What stalled

Same weight *and* same reps across sessions. Give the count.

```
Stalled: cable shrug 100 lb × 4 sessions · leg press 270 lb × 3 sessions
```

Before calling something stalled, check it is not a logging gap, a safety-capped lift,
or a lift whose smallest available increment is a large relative jump. Say which if so.

### 3. What got skipped twice or more — **and why**

Use the categories from `log` §3. **The category is the whole point of this line.**

```
Skipped 2+: prone Y-raise ×3 (time) · leg-press calf raise ×2 (crowding)
```

`time` means the plan is too long and the exercise count comes down. `equipment` means
the plan was fine. Reporting a raw skip count without the reason produces the wrong fix.

### 4. Weekly set volume per muscle vs the ≥10 target — **with the counts shown**

**Completed sets, not programmed sets.** A table, with numbers:

```
Side delts   (P1)   11.5  ✅
Rear delts   (P2)    6.0  🚨  programmed 12 — slot 6 and 7 are being cut
Lats         (P3)   10.5  ✅
Upper traps  (P4)    9.0  ⚠️
```

Mark priority muscles. **A priority muscle below 10 completed sets/week is the finding**,
and it usually explains everything else on the page.

### 5. Body-metrics trend

The **4-week rolling weight average**, the rate as a % of bodyweight per week, and photo
compliance. Per `nutrition.md` §4 and `${CLAUDE_PLUGIN_ROOT}/templates/body-metrics.md`.

```
Weight: 79.2 → 79.9 kg over 4 weeks = +0.18 kg/wk (0.22% BW) — inside target
Weigh-ins: 14 of 28 days. Photos: none since Jul 19.
```

**With fewer than 3 weeks of data, compute nothing** and say you need another week.
Report compliance as a fact, once, without chasing it.

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

## Nutrition adjustment

If the 3-week average warrants it, apply exactly one change per `nutrition.md` §4:

| 3-week average | Change |
|---|---|
| Flat or falling, goal is to gain | **+300 kcal/day** |
| Rising faster than 0.35% BW/week | **−200 kcal/day** |
| Inside the 0.2–0.25%/week band | **Nothing.** Say so |
| Under 3 weeks of data | **Nothing.** Say you need another week |

**One adjustment per check-in**, and it counts as the one recommendation — do not give
a training recommendation and a nutrition recommendation in the same check-in.

Enforce the `nutrition.md` §8 floors. They are not negotiable at a check-in either.

---

## Escalate anything that warrants it

Scan the trailing weeks' `Pain Status` entries. If a pattern meets the `safety.md` §1
criteria — the same movement twice, a worsening trajectory, anything sharp or radiating
— **escalate, and let that be the check-in**. It outranks the five lines and the
recommendation.

---

## Rules for this skill

- Five lines, one recommendation. Then stop.
- **Read-only.** `checkin` writes nothing to Notion except, optionally, a flagged
  movement or a nutrition target into the operating manual.
- Never redesign the block. Point at `/gym-coach:block` instead.
- Grade adherence honestly and separately: if someone trained 3×/week for four weeks,
  say so plainly, even when the volume table is bad. **Their consistency is not the
  problem, and telling them it is fine when it is fine matters.**
- When the plan is the problem, say the plan is the problem.
