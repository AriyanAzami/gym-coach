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

## Step 0 — prerequisites

Notion check (`notion-fetch` with `id: "self"`) → read config → stop with the appropriate message if either fails.

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

**Use `programming.md` §1. Show the arithmetic in the block.**

```
Actual mean logged duration      47 min = 2820 s
Warm-up                              - 300 s  ->  2520 s
Compound set   45 + 90 = 135 s
Isolation set  45 + 60 = 105 s
3 compounds x 3 sets =  9 x 135 = 1215 s
4 isolation x 3 sets = 12 x 105 = 1260 s
                       total    = 2475 s = 41.3 min + warm-up = 46.3 min   FITS
```

> **Do not carry the previous block's count forward. If the mean duration fell, the
> count falls.** Recompute from zero every time.

Use the **actual mean logged duration**, not the stated budget. If someone said 60
minutes and averages 42, build for 42 — and say that you did, and why.

---

## Step 4 — order every session, lagging muscle first

- **The lagging priority muscle goes first in every session it appears in.** Not second.
- Then compounds, then isolation.
- **Core and mobility go in the warm-up, never at the end.** Whatever is last does not
  get done — that is why they vanish for months in real logs.
- Mark the **top three exercises non-negotiable** in every session, and say to cut from
  the bottom.

Respect everything in the operating manual: removed exercises stay removed, banned
patterns stay banned, flagged movements stay capped, equipment gaps stay substituted
(`exercise-library.md` §7 and §9).

---

## Step 5 — compute weekly set volume and print the table

**Programmed sets per muscle per week.** Compound secondaries at 0.5, marked as such.

```
Muscle              Sets/wk   Target   Status
Side delts   (P1)      10.5     >=10     OK
Rear delts   (P2)       9.0     >=10     DEFECT
Lats         (P3)       7.5     >=10     DEFECT
Upper traps  (P4)       9.0     >=10     DEFECT
Chest                   3.0   maintain   -
...
```

> ## 🚨 The publication gate
>
> **Any stated priority muscle under 10 sets/week is a plan defect. It blocks
> publication.**
>
> Not a warning. Not a footnote. Not "something to watch". The block does not ship.

When the gate fires:

1. **Name the muscle and the count.**
2. **Fix it** — add sets, add an exposure on another day, reorder so it stops getting
   cut, or supersets a non-competing pair to buy the time (`programming.md` §8 — never
   on primary compounds).
3. **State the cost.** More sets means more minutes; show the recomputed session
   duration against the actual mean. If it no longer fits, something has to come out —
   say what and why.
4. **Reprint the table.** The shipped block contains the *fixed* table.

Non-priority muscles under 10 are allowed, but must appear in **deliberate omissions
with the reason and the count**.

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

**And no conditional holds.** "Hold 85 lb until 3×12 is clean" is banned — nobody
re-reads the trigger, and the observed cost was 11 lifts stalled for 3 weeks.

Schedule the deload: **~6 weeks in, one week at ~60% of the set count, same weights**,
with a date.

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

Write this to the block's `Adjustments` property **and** to the page body, and update
the operating manual with anything durable: newly removed exercises, new flags, a
changed priority ranking.

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
- **The volume gate is hard.** A priority muscle under 10 blocks publication.
- **Zero weights in the block.** Verify before writing.
- **No conditional holds.**
- Lagging muscle first, core and mobility in the warm-up, top three non-negotiable.
- Every adjustment traces to a logged number.
- When the previous block failed because it did not fit in the available time, **say the
  plan was the problem** — do not imply a discipline failure.
