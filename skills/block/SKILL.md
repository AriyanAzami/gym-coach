---
name: block
description: Build a new training block. Use when the user says new block, new plan, or the current block is ending. Runs a full analysis of logged history.
argument-hint: "[start-date] [weeks]"
allowed-tools: Read Write Edit Bash
effort: high
---

# Gym Coach — block

**The heavy one.** Run it on Opus, in a fresh chat.

Load `${CLAUDE_PLUGIN_ROOT}/references/safety.md`,
`${CLAUDE_PLUGIN_ROOT}/references/programming.md`,
`${CLAUDE_PLUGIN_ROOT}/references/exercise-library.md`, and
`${CLAUDE_PLUGIN_ROOT}/references/storage-notion.md`.

**All example numbers, athletes and training histories below are fabricated.**

## Step 0 — prerequisites

Notion check (`notion-fetch` with `id: "self"`) → read config → stop with the appropriate message if either fails.

**Read `config.goalMode` and load `${CLAUDE_PLUGIN_ROOT}/references/goals/<mode>.md`.**
No `goalMode` means `hypertrophy` — read it that way, silently, and produce exactly what
this skill produced before profiles existed. `block` writes, so it rewrites a version-1
config as version 2 while it is there (`storage-notion.md` §2.1), without announcing it.

**Read `config.equipmentTier`** (missing means `full-gym`) and select exercises from
that tier only (`exercise-library.md` §10).

**The profile supplies:** `volume_rule`, `publication_gate`, `rep_ranges`,
`intensity_cue`, `rest_defaults`, `session_arithmetic`, `ordering_rule`,
`deload_policy`. **`programming.md` supplies the mechanics.** Where the two appear to
disagree, the profile decides the methodology and `programming.md` decides the
arithmetic.

---

## Step 1 — read everything since the last block

- The **profile** and the **Coach Operating Manual** — priority ranking, removed
  exercises, flagged movements, declined interventions, equipment gaps.
- **Every log entry** since the last block started.
- The **current block**, for what was programmed.
- Recent **Body Metrics**.

`block` and `audit` are the only skills that read the full history. Take the time.

---

## Step 2 — compute the trailing-4-week facts

Numbers, not impressions. Compute all of these before designing anything:

| Metric | How |
|---|---|
| **Sessions per week** | Count, per week. The real number, including the bad weeks |
| **Actual mean session duration** | From the `Duration (min)` property. **This, not the stated budget, is what the plan is built for** |
| **Completion rate per exercise** | Completed ÷ programmed, per exercise |
| **Which exercises are repeatedly dropped, and why** | With the skip category. `time` and `equipment` mean opposite things |
| **Progression trend per lift** | Progressed · flat · regressed, with the numbers |
| **Pain events** | Movement, load, date, whether it recurred |

Print these. The athlete should be able to see where every decision below comes from.

---

## Step 3 — derive the exercise count arithmetically

**Use `programming.md` §1, with the active profile's `rest_defaults`. Show the
arithmetic in the block.**

```
Actual mean logged duration      47 min = 2820 s
Warm-up                              - 300 s  ->  2520 s
Compound set   45 + 90 = 135 s
Isolation set  45 + 60 = 105 s
3 compounds x 3 sets =  9 x 135 = 1215 s
4 isolation x 3 sets = 12 x 105 = 1260 s
                       total    = 2475 s = 41.3 min + warm-up = 46.3 min   FITS
```

> ### The rest defaults are what change the answer
>
> **This is the step where the goal mode is felt, and it is the step people argue
> with.** Same athlete, same 47 minutes:
>
> ```
> hypertrophy   90 s / 60 s   ->  21 sets  ->  7 exercises
> strength      240 s main, 120 s secondary, 90 s accessory
>               1 main x 4 sets = 4 x 285 = 1140 s   (19 min on one lift)
>               1 secondary x 3 = 3 x 165 =  495 s
>               2 accessory x 3 = 6 x 135 =  810 s
>                                   total = 2445 s = 40.8 min + warm-up = 45.8 min
>               ->  4 exercises
> ```
>
> **Show this side by side the first time a strength block is built.** Four exercises
> in the time that held seven is the single most-doubted output this skill produces,
> and the arithmetic is the entire answer.

In `strength` mode, **budget the main lift's ramp-up separately** (3–4 minutes) and say
you did — it is not a working set but it is real time.

> **Do not carry the previous block's count forward. If the mean duration fell, the
> count falls.** Recompute from zero every time.

Use the **actual mean logged duration**, not the stated budget. If someone said 60
minutes and averages 42, build for 42 — and say that you did, and why.

---

## Step 4 — order every session, per the profile's `ordering_rule`

**Slot 1 comes from the profile. Say which rule you applied, and why.**

| Mode | Slot 1 |
|---|---|
| `hypertrophy` · `fat-loss` | The lagging priority muscle, in every session it appears in. Not second |
| `strength` | **The main lift. Always** — this overrides lagging-muscle-first |
| `general-fitness` | The hardest compound in the session |
| `endurance-hybrid` | Decided **across the week, not within the session** — the goal-limiting quality gets the freshest day |

> **In `strength` mode, state the override out loud in the block:**
>
> *"Main lift first, ahead of the lagging muscle. In strength mode the ranked unit is
> the lift, not the muscle — a main lift trained tired is not a main lift. This is the
> profile's ordering rule overriding hypertrophy's, deliberately."*
>
> A reader comparing two blocks from this repo must be able to see that the two modes
> disagree on purpose. Left unexplained, it reads as a bug.

In `endurance-hybrid`, **name the quality being protected** in the block header, then
place the lifting around the endurance plan the athlete already has.

Then, in every mode:

- Compounds, then isolation.
- **Core and mobility go in the warm-up, never at the end.** Whatever is last does not
  get done — that is why they vanish for months in real logs.
- Mark the **top three exercises non-negotiable** in every session, and say to cut from
  the bottom.

Respect everything in the operating manual: removed exercises stay removed, banned
patterns stay banned, flagged movements stay capped, equipment gaps stay substituted
(`exercise-library.md` §7, §9 and §10). **Select only from the athlete's equipment
tier.**

---

## Step 5 — compute the gate, and print its table

**This is the step the whole skill exists for. The structure is fixed. The check is the
mode's.**

Compute → print the table → name the defect → fix → state the cost → reprint → ship.
That sequence is mode-independent. What is being computed is not.

| Mode | The table | The gate |
|---|---|---|
| `hypertrophy` | Programmed direct sets per muscle per week | **Any priority muscle < 10 sets/week** |
| `strength` | Exposures/week and heavy sets/week per priority lift, plus its slot | **Any priority lift < 2 exposures or < 4 heavy sets/week, or in any slot but 1** |
| `fat-loss` | Sets per muscle per week, plus total vs the pre-deficit block | **Any priority muscle < 8 sets/week; total < 80% of pre-deficit; nutrition below the `safety.md` §6 floors** |
| `general-fitness` | The eight movement patterns, by weekly frequency | **Any movement pattern missing from the week.** Volume < 6 sets is a warning, not a block |
| `endurance-hybrid` | Sets per priority muscle, plus the week's schedule | **Any conflict with the 24 h interference rule**; any priority muscle < 6 sets/week |

Compound secondaries count 0.5 and are marked as such, in every mode.

> ## 🚨 The publication gate is hard, in all five modes
>
> **A plan that fails its mode's gate does not ship.** Not a warning. Not a footnote.
> Not "something to watch".

### Example — `hypertrophy`

```
Muscle              Sets/wk   Target   Status
Side delts   (P1)      10.5     >=10     OK
Rear delts   (P2)       9.0     >=10     DEFECT
Lats         (P3)       7.5     >=10     DEFECT
Upper traps  (P4)       9.0     >=10     DEFECT
Chest                   3.0   maintain   -
```

### Example — `strength`

```
Lift              Exposures/wk   Heavy sets/wk   Slot   Status
Back Squat              2              6          1      OK
Bench Press             2              4          1      OK
Deadlift                1              3          1      DEFECT

Deadlift gets one exposure and three sets at or above 80% e1RM. The gate needs
two and four. This plan does not ship.
```

**Name the lift.** "A priority lift is short" is not the finding; *"the deadlift gets
one exposure a week"* is.

### Example — `general-fitness`

```
Pattern            Sessions/wk   Status
Squat                   2          OK
Hinge                   1          OK
Horizontal push         2          OK
Horizontal pull         2          OK
Vertical push           1          OK
Vertical pull           0          DEFECT
Carry                   1          OK
Core                    2          OK  (warm-up)

No vertical pull anywhere in the week. This plan does not ship.
```

**Name the pattern.** And fix it by adding the pattern, not by adding a session — a
2-day full-body week has room for all eight.

### When the gate fires

1. **Name the defect and the number.** The muscle, the lift, the pattern, the conflict —
   whichever the mode gates on.
2. **Fix it** — add sets, add an exposure on another day, reorder so it stops getting
   cut, swap in the missing pattern, move a session out of the interference window, or
   superset a non-competing pair to buy the time (`programming.md` §7 — never on primary
   compounds, and never on a main lift).
3. **State the cost.** More sets means more minutes; show the recomputed session
   duration against the actual mean. If it no longer fits, something has to come out —
   say what and why.
4. **Reprint the table.** The shipped block contains the *fixed* table.

Non-priority muscles under the mode's target are allowed, but must appear in
**deliberate omissions with the reason and the count**.

### When the gate cannot be satisfied

Sometimes no amount of reordering fixes it. Weekly capacity is
`sessions_per_week × sets_per_session`, and if the priority list needs more direct sets
than that, the arithmetic is simply short.

```
Observed pace        172 s/set  (from the logs, not the plan)
Capacity per session (2700 - 300) / 172 = 14 sets
2 sessions/week      28 sets/week
4 priority muscles at 10 direct sets each = 40 needed
                     SHORT BY 12. No ordering fixes this.
```

**Do not ship a compromised plan quietly, and do not refuse and stop.** Put the
trade-off to the athlete and let them choose:

```
At 45 minutes and 2 sessions a week, you have 28 working sets. Four priority
muscles at 10 sets each needs 40. I can't fix that by reordering — the time
isn't there.

Three options, and they're all legitimate:

  1. Add a third day. 42 sets/week covers all four. You said 3 days is
     realistic in a bad week, and Block 1 only used 2.
  2. Cut the priority list to two. Side delts and rear delts get 10+ each,
     lats and traps drop to maintenance, and I'll say so explicitly.
  3. Longer sessions. 60 min gives 19 sets/session — but your logged mean
     is 45, so I'd be building for a number you've never hit.

I'd take option 1. Which do you want?
```

**Say which you would pick and why.** Then build what they choose, and record the
decision in the operating manual so the next block does not re-open it.

If they do not answer, ship **nothing** — an unresolved gate is not a plan.

> **This branch is mode-independent.** The arithmetic that runs short differs — sets
> against a volume target, exposures against a schedule, patterns against a two-day
> week, a lifting day that cannot escape the interference window — but the response is
> always the same three moves: name what is short, offer real options, say which one you
> would take. Never a quiet compromise, never a bare refusal.
>
> **One option is always on the table and is often the right one: change the goal
> mode.** Someone asking for four priority muscles, a heavy squat and a marathon in
> three 45-minute sessions has a mode problem, not a scheduling problem. Say so, and
> point at `/gym-coach:setup` → *change your training goal*.

---

## Step 6 — drop what is not being done

**Any exercise skipped ≥3 times for a reason other than equipment failure gets dropped.**

- `time` or `fatigue` → it is at the bottom of an over-booked session. Drop it or move
  it up. If the count is already at the arithmetic ceiling, drop it.
- `choice` or dislike → drop it permanently, add it to the operating manual's
  removed list with the reason, and never program it again.
- `crowding` → keep it but add a substitution, or move it to a less busy slot.
- `equipment` → **not the exercise's fault.** Substitute permanently from
  `exercise-library.md` §7.

**Say which you did and where the volume went.** A silently dropped exercise is
silently dropped sets, and that is exactly how a priority muscle ends up at 4/week.

Apply the same treatment to any lift the athlete cannot feel: two sessions on the fix
from `exercise-library.md` §8, then substitute.

---

## Step 7 — write no weights

> **The block contains zero weights.** Structure and rules only: exercise, sets, reps,
> rest, order, notes.
>
> Targets are computed per session by `today`, from the last logged entry for that exact
> lift. That is what makes a stale plan impossible.

**Before writing, check the block file for any weight and remove it.** No weight column
in the day tables. No "start at X". No "work up to Y".

**And no conditional holds.** "Hold 41 kg until 3×12 is clean" is banned — nobody
re-reads the trigger, and the observed cost was 11 lifts stalled for 3 weeks.

> **In the `bodyweight` and `minimal` tiers this rule extends to rep counts.** A block
> that freezes "3×12 push-ups" is storing a target exactly as surely as one that freezes
> a load. The block holds the exercise, the set count and the rep *range*; the
> progression variable — reps, tempo, leverage step — is computed by `today` from the
> last logged entry, the same way a weight is (`exercise-library.md` §10).

**Schedule the deload per the profile's `deload_policy`**, with a date:

| Mode | Deload |
|---|---|
| `hypertrophy` · `fat-loss` | ~6 weeks in, one week at ~60% of the set count, same weights |
| `strength` | Every 4–6 weeks, or immediately after a 10% reset. Cut volume, keep one moderate top set |
| `general-fitness` | **None scheduled.** Missed weeks are the deload — say so plainly rather than inventing one |
| `endurance-hybrid` | Every 4 weeks. Cut lifting volume; leave the endurance plan alone |

`fat-loss` also schedules a **maintenance-calorie diet break every 8–12 weeks**, with a
date, at the same time.

---

## Step 8 — archive and activate

1. Query for the block with `Status = Active`.
2. Set it to `Archived`. **Never delete a block** — history is the product.
3. Create the new block page from `${CLAUDE_PLUGIN_ROOT}/templates/block.md`, with
   `Status = Active` and a `Start Date` range covering the block plus deload.

Exactly one block is Active at any moment. Use `Planned` to draft a future block without
competing with the live one.

---

## Step 9 — the Adjustments section

**Every change traces to a number.** No exceptions, and no vague entries.

| Change | Evidence |
|---|---|
| Exercise count 8 → 7 | Mean logged duration 47 min, not the 50 assumed. Exercise 8 completed 3/11 sessions |
| Rear delt work moved to slot 1 | Rear delts averaged 2.5 completed sets/week against 6 programmed — always in slot 6-7 |
| Straight-arm pulldown removed | "Can't feel it" fix tried twice, still missed. Volume to pulldown and row |

If a change has no number behind it, either find the number or do not make the change.

**Whenever the goal mode changed since the last block, the table gains a row for it** —
and it goes first, because everything else in the block follows from it:

| Change | Evidence |
|---|---|
| Goal mode hypertrophy → strength | Set 2026-09-27 via `/gym-coach:setup`. Slot 1 now goes to the main lift, rests to 240 s, and the count from 7 exercises to 4. Prior blocks are not comparable on sets/week |
| Equipment tier full-gym → dumbbell-home | Set 2026-09-27. Cable and machine work substituted per `exercise-library.md` §10 |

Write this to the block's `Adjustments` property **and** to the page body, and update
the operating manual with anything durable: newly removed exercises, new flags, a
changed priority ranking, a changed mode or tier.

---

## Step 10 — hand off

Print the volume table, the session shape arithmetic, and the deload date. Then:

```
Block 3 is active. Run /gym-coach:today before your next session.
Check in on Sep 7 and Sep 21. Deload week starts Oct 5.
```

---

## Rules for this skill

- **Recompute the exercise count. Never inherit it.**
- **The gate is the active profile's, and it is hard.** A plan that fails it does not
  ship, in any mode.
- **Zero weights in the block.** Verify before writing. In bodyweight and minimal
  tiers, zero frozen rep counts either.
- **No conditional holds.**
- **Say which ordering rule you applied and why**, especially where a mode overrides
  another mode's.
- Core and mobility in the warm-up, top three non-negotiable — in every mode.
- Every adjustment traces to a logged number.
- **Check the plan against the athlete's targets** (`storage-notion.md` §8). A block
  that does not serve a stated target is a finding worth one line, not a silent gap.
- **A goal-mode change gets a row in Adjustments**, and prior blocks are not compared
  across it.
- When the previous block failed because it did not fit in the available time, **say the
  plan was the problem** — do not imply a discipline failure.
