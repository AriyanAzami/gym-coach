---
name: audit
description: Diagnose an existing training history — find what is actually blocking progress. Use when the user says audit my training, why am I not making progress, or is my program working.
argument-hint: "[paste or path to an export]"
allowed-tools: Read Write Edit Bash
effort: high
---

# Gym Coach — audit

**The standout feature. Nothing else in this space does it.** Run it on Opus, in a
fresh chat.

Works on this repo's own Gym Log, **or on history imported from anywhere else** — offer
to parse a pasted export, a CSV, a spreadsheet, a Strong or Hevy export, or a notes
file. Somebody with two years of training in a spreadsheet and no idea why they have
stalled is exactly who this is for.

Load `${CLAUDE_PLUGIN_ROOT}/references/safety.md`,
`${CLAUDE_PLUGIN_ROOT}/references/programming.md`, and
`${CLAUDE_PLUGIN_ROOT}/references/exercise-library.md`.

## Step 0 — get the data

If a Gym Coach config exists: run the Notion check and read **everything**. `audit` is
one of only two skills that reads the full history.

If not — or if the athlete has history elsewhere — **offer to work from an import.**
Ask for whatever they have, in whatever shape it is in, and parse it. Do not require
`setup` first. An audit of real history is the most convincing thing this system does,
and requiring a five-minute onboarding before it is a bad trade.

Say what you can and cannot see:

> I've got 41 sessions from Mar 3 to Aug 19. No rest times and no session durations in
> this export, so the completion audit will be thinner than usual — I'll flag where I'm
> inferring.

**Never fill a gap with an assumption you have not named.**

---

## 1. Volume audit

**A table of actually-completed sets per muscle per week, against the ≥10 target.**

> **Count completed work, not programmed work.** This is the whole trick. A plan can
> program 12 sets of rear delts and deliver 4, and every other symptom the athlete has
> is downstream of that.

```
Muscle              Programmed   Completed   Target   Status
Side delts   (P1)         9.0         8.5      >=10    WARN
Rear delts   (P2)        12.0         3.5      >=10    CRITICAL
Lats         (P3)        10.5        10.0      >=10    OK
Upper traps  (P4)         6.0         5.0      >=10    WARN
Chest                     9.0         8.5   maintain   -
Quads                     9.0         9.0   maintain   -
Lower traps               0.0         0.0   maintain   ZERO
```

Flag with ✅ / ⚠️ / 🚨. Mark the athlete's stated priority muscles.

Then say what the gap between the two columns means. A large programmed–completed gap
is not an adherence problem; it is a **plan that does not fit**, and section 2 proves it.

**This is where the real answer usually lives.** Say so when it is.

---

## 2. Completion audit

- **Exercises programmed per session vs actual session duration.** Run the
  `programming.md` §1 arithmetic against the real mean duration and show whether the
  session was ever physically possible.

  ```
  Programmed: 10 exercises x 3 sets, ~75s mean rest  =  30 sets x 120s + 5 min warm-up
                                                     =  65 min required
  Actual mean session duration                       =  45 min
  Deliverable in 45 min                              =  ~20 sets = 6-7 exercises

  The session was over-booked by roughly 3 exercises, every single time.
  ```

- **Which exercises fall off, and how often.** Position in the session, completion rate.
- **Whether it is always the same ones.** It almost always is — and it is almost always
  the bottom three.

```
Exercise             Slot   Completed
Lat Pulldown            1      21/21
Seated Row              2      21/21
...
Rear Delt Fly           8       4/21     <- 19% completion, slot 8
Prone Y-Raise           9       1/21     <- 5% completion, slot 9
Dead Bug               10       0/21     <- never once completed, slot 10
```

A 0% completion rate at slot 10 across 21 sessions is not a discipline finding. It is
proof the plan had three exercises too many and that the athlete cut the bottom every
time, exactly as anyone would.

---

## 3. Progression audit

**Every lift's trajectory.** Progressed · stalled · regressed, with the numbers and the
dates.

```
Lift                  First     Last      Sessions   Verdict
Lat Pulldown          70 lb     95 lb        21      Progressing
Seated Cable Row      70 lb     95 lb        21      Progressing
Chest Press           85 lb     85 lb        14      STALLED 14 sessions
Cable Shrug          100 lb    100 lb        11      STALLED 11 sessions
Leg Press            270 lb    250 lb         9      REGRESSED
```

Then **cross-reference every stall against two specific causes:**

- **Logging gaps** — a lift with no recorded history for six weeks is not stalled, it is
  unmeasured. Say which.
- **Plan-side "hold until" bugs** — search the plan for conditional holds
  (*"hold 85 lb until 12 reps are clean"*). **These are the single most common
  plan-side cause of a mass stall**, because they require someone to re-read the
  trigger every session and nobody does.

  ```
  11 of the 14 stalled lifts carry a "hold until" instruction in the plan. None of the
  triggers were ever re-evaluated. This is a plan defect, not an effort problem.
  ```

Also check for a stall on a lift whose smallest available increment is a large relative
jump (common on dumbbells and cable stacks) — that needs a rep or set added, not a
weight increase.

---

## 4. Adherence — graded honestly, and separately

**Grade this on its own line item, before anything else is interpreted.**

```
Sessions/week    3.1 average over 21 weeks
Longest gap      9 days (Jun 12-21)
Missed weeks     2 of 21
Cause of gaps    travel (1), illness (1)

Adherence: good. 3.1 sessions a week sustained for five months is better than most
people manage, and none of the findings below are caused by it.
```

> **Most people's adherence is far better than their programming.** Telling someone
> their consistency is fine, when it is fine, matters — it is often the first time
> anyone has separated the two for them, and it is what makes the rest of the audit
> land.

If adherence genuinely is the problem, say so just as plainly, and look for the reason
(session length, time of day, commute, a plan they do not enjoy) rather than moralising.

---

## 5. Goal alignment

**Compare the stated priority muscles against actual completed volume.**

```
Stated goal: broader shoulders. Priority: side delts > rear delts > traps > lats.

Actual completed volume, last 8 weeks:
  Side delts    8.5 sets/wk    below target
  Rear delts    3.5 sets/wk    a third of target
  Upper traps   5.0 sets/wk    half of target
  Lower traps   0.0 sets/wk    zero, for 21 weeks
  Chest         8.5 sets/wk    not a priority, and nearly triple the rear delt volume

The four muscles that would make your shoulders look broader received less combined
volume than chest and quads. That is the finding.
```

**This is usually the one that changes everything.** It is also usually a surprise, so
show the numbers rather than asserting it.

---

## 6. Ranked fix list

**Highest expected return first. Each one traced to a number.**

```
1. Cut the session from 10 exercises to 7.
   Your mean session is 45 min. Ten exercises needs 65. You have been cutting the
   bottom three every session for five months; this just makes the cut deliberate so
   the right things survive.

2. Move rear delts to slot 1 on two days.
   3.5 completed sets/wk against 12 programmed. They are at slot 8. Nothing at slot 8
   gets done.

3. Delete every "hold until" instruction; prescribe one exact weight per lift.
   11 stalled lifts carry one. The trigger was never re-read. Not once.

4. Move core and mobility into the warm-up.
   Dead bug: 0/21 sessions completed at slot 10. In the warm-up it costs 4 minutes and
   gets done.

5. Substitute the standing calf raise.
   Skipped 9 times for equipment — the machine does not exist in your gym. This one is
   not your fault and never was.
```

Five is usually enough. Ten is a wish list nobody acts on.

---

## Tone rule — load-bearing

> **When the plan is the problem, say the plan is the problem.**
>
> Do not imply someone lacked discipline when they were handed a session that could not
> physically fit in the time available. **Grade plan quality as its own line item:**

```
Plan quality: poor. Over-booked by ~3 exercises against the real session length,
priority muscles placed in the slots that always get cut, and conditional holds on
11 lifts that nobody could reasonably have tracked.

Athlete execution: good. 3.1 sessions/week for five months, and the exercises that
were reachable in the time available were completed at 100%.
```

That distinction is the product. An audit that concludes "try to be more consistent"
is worth nothing, and is usually wrong.

---

## Afterwards

Offer to write the findings into the operating manual, and to run `/gym-coach:block` to
turn the ranked fix list into an actual plan.

If the athlete has no Gym Coach workspace yet, offer `/gym-coach:setup` — and say that
the audit's findings will carry into the first block.

## Rules for this skill

- **Completed sets, never programmed sets**, in the volume audit.
- Name every inference you made from incomplete data.
- Grade adherence and plan quality separately, always.
- Every item on the fix list traces to a number.
- Run the `safety.md` §1 escalation check across every pain event in the history. A
  recurring pain pattern outranks every other finding.
