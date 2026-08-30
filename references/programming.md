# Programming rules

Every number on this page traces to `evidence.md`, or is explicitly labelled a
heuristic there. Nothing here is negotiable at runtime — these are the rules that
make this a system rather than a prompt.

---

## 0. What is on this page, and what is not

**This page holds the mode-independent mechanics. The methodology lives in
`references/goals/<mode>.md`.**

The split exists so that five goal profiles can share one engine without five copies of
the arithmetic drifting apart. If you are adding a rule, this table decides which file
it belongs in.

| On this page — the same in all five modes | In the goal profile — differs by mode |
|---|---|
| Session-length → exercise-count arithmetic (§1) | The rest defaults it runs on |
| The observed-pace override (§1) | — |
| Direct vs secondary set **counting** (§2) | The weekly volume **target** and the publication gate |
| Increment table, "targets are never stored", no conditional holds (§4) | Which progression scheme applies |
| Stall **mechanics** — check it is a real stall before intervening (§5) | The stall **trigger**, and the intervention order |
| Ordering **mechanics** — slot 1 matters, the last slot does not get done, top three non-negotiable, core in the warm-up (§6) | **What goes in slot 1**, and why |
| Supersets (§7) | — |
| Warm-up structure (§8) | — |
| — | Rep ranges, intensity cue, deload cadence, nutrition stance |

**Every skill reads `config.goalMode`, loads
`${CLAUDE_PLUGIN_ROOT}/references/goals/<mode>.md`, and applies its fields.** A config
with no `goalMode` is `hypertrophy`, and behaves exactly as this file did before the
split.

A rule that is stated in both places is a bug: it will drift. Put it in one.

---

## 1. Session length to exercise count

**This is arithmetic, not judgement. Compute it. Never guess it.**

> A working set takes ~45 seconds. Session capacity is:
>
> `total_minutes = warmup(5) + sum(sets × (45s + rest_seconds))`
>
> | Rest | Sets that fit in 45 min | Exercises at 3 sets |
> |---|---|---|
> | 60 s | 21 | **7** |
> | 90 s | 18 | **6** |
> | 120 s | 15 | **5** |
> | 240 s | 8 | **2–3** |
>
> Mixed is normal: 3 compounds at 90 s + 4 isolation at 60 s = 21 sets = 41 min
> + 5 warm-up = **46 min**.
>
> **Never program more than this arithmetic allows.** An over-booked session does not
> produce more work — it produces the same work minus whatever was at the bottom,
> every single time, and the bottom is always the same exercises.

**The rest figures come from the active goal profile's `rest_defaults`, not from this
page.** That is the whole reason a strength session holds four exercises and a
hypertrophy session holds seven in the same 45 minutes — the arithmetic is identical
and the inputs are not. See the 240 s row above, and `goals/strength.md` §9.

### Worked example — how to actually run this

Athlete reports: **45-minute sessions**, **90 s on compounds**, **60 s on isolation**.

```
Budget                      45 min = 2700 s
Warm-up                            - 300 s   -> 2400 s available
Compound set   45 + 90  =  135 s
Isolation set  45 + 60  =  105 s

3 compounds x 3 sets =  9 sets x 135 s = 1215 s
4 isolation x 3 sets = 12 sets x 105 s = 1260 s
                              total    = 2475 s = 41.3 min
                              + warm-up          = 46.3 min   FITS
```

Show this arithmetic in the block. It is the difference between a plan someone
trusts and a plan someone quietly edits.

### Use the athlete's observed pace, not the planning constants

The 45-second working set is a planning constant, and real athletes miss it — by a lot.
Once there are logs, compute the athlete's **actual seconds per set**:

```
observed_seconds_per_set = (mean_session_seconds - warmup) / mean_completed_sets
```

Measured on fabricated test data during this repo's own end-to-end testing: a plan
built on the 105–135 s assumption was being executed at **172 s/set**. That single
number explained every skipped exercise in the history — the session was over-booked by
9 sets, and the bottom three lifts were cut every time.

**Once you have four weeks of logs, the observed figure replaces the constant.** Say
which one you used.

### Weekly capacity, and when it is not enough

`weekly_capacity = sessions_per_week × sets_per_session`

Check the priority list against it **before** designing anything, using the active
profile's volume target. Four priority muscles at 10 direct sets each needs 40
sets/week, which at 14 sets/session takes three sessions, not two. When the arithmetic
is short, the answer is a decision the athlete has to make — add a day, or shorten the
priority list. **Never silently ship the compromise.**

### Rules that follow

- **Use the _bad week_ number, not the good week number.** Onboarding asks for the
  days per week they will hit in a bad week. Program that. Extra sessions are a bonus,
  never a dependency.
- **Use the _actual mean_ logged duration, not the stated budget**, once there are
  four weeks of logs. If someone says 60 minutes and averages 42, the plan is built
  for 42. `block` recomputes this every time and the count is allowed to fall.
- **Do not carry the previous block's exercise count forward.** Recompute from scratch.
- The count is a **ceiling**. Coming in under it is fine. Going over is a defect.

---

## 2. Volume — how sets are counted

**The target is in the goal profile. The counting is here, and it is the same in every
mode.**

| Mode | Weekly volume rule | Where |
|---|---|---|
| `hypertrophy` | ≥10 direct sets/muscle | `goals/hypertrophy.md` §3 |
| `strength` | ≥2 exposures + ≥4 heavy sets per priority lift; ≥6 direct sets supporting | `goals/strength.md` §3 |
| `fat-loss` | ≥8 direct sets/muscle, and ≥80% of pre-deficit total | `goals/fat-loss.md` §3 |
| `general-fitness` | All eight movement patterns weekly; ≥6 direct sets/muscle | `goals/general-fitness.md` §3 |
| `endurance-hybrid` | ≥6 direct sets/priority muscle, lower body capped | `goals/endurance-hybrid.md` §3 |

**Always show the count when publishing a plan.** Not "shoulders are covered" — a
table, with numbers, per muscle (or per lift, or per pattern, as the mode defines),
per week.

### Counting rules — identical in all five modes

- Count **direct** sets: the muscle is a primary mover or the explicit target.
- Count a compound's secondary muscles as **0.5 sets** each, and say you are doing so.
  Lat pulldown = 1 lat set + 0.5 biceps. Bench = 1 chest + 0.5 front delt + 0.5 triceps.
- **`audit` counts completed sets. `block` counts programmed sets.** These are different
  numbers, and conflating them hides the entire problem — a plan can program 12 sets of
  rear delts and deliver 4.
- **Frequency is close to irrelevant for hypertrophy once weekly volume is equated** —
  so 1×/week at 10 sets beats 2×/week at 6. This does not carry over to `strength`
  mode, where exposures are themselves the unit.

### The publication gate is mode-specific, and it is always hard

> **A plan that fails its mode's `publication_gate` does not ship.** Not a warning, not
> a footnote. `block` prints the table, names the defect, fixes it, reprints the table,
> and only then ships.

What the gate checks comes from the profile. That the gate is hard does not.

Non-priority muscles below the mode's target are allowed — you cannot maximise
everything in 45 minutes — but they must be listed as **deliberate omissions with the
reason**, so nobody discovers the gap three months later.

---

## 3. Rest

**Rest defaults come from the active goal profile's `rest_defaults`.** They range from
60 s on isolation work to 300 s on a heavy single-digit main lift, and the difference
is what makes two modes produce completely different sessions from the same 45 minutes.

What is true in every mode:

- **Rest is the largest single consumer of session time.** Every 30 s added across 18
  sets is 9 minutes — an entire exercise and a half. It is the first place to look when
  the arithmetic will not fit.
- For hypertrophy, longer than ~90 s wastes time for no measurable return
  ([Frontiers 2024](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/full)).
  Under 60 s costs a small amount of hypertrophy and, more practically, costs reps on
  the next set. **That citation is about hypertrophy, and does not license shortening
  rest on heavy strength work** — see `evidence.md`.
- Whatever the profile says, **the rest number used in the plan is the number used in
  the arithmetic.** A plan that prescribes 240 s and budgets 90 s is not a plan.

---

## 4. Progression

**Which scheme applies comes from the active profile's `progression_scheme`** — double
progression in `hypertrophy`, `fat-loss` and `general-fitness`; linear load progression
on main lifts in `strength`, with double progression on accessories; double progression
on lifts in `endurance-hybrid`.

Everything below is mechanics, and applies to all of them.

### One exact target per lift

1. Prescribe **one exact weight and one exact rep target** per lift.
2. **No ranges in the prescription. No conditional holds.**

> **Conditional holds are banned.** "Hold 41 kg until 3x12 is clean" requires
> somebody to re-read the trigger every session, and nobody does. Observed cost in the
> audit this repo was built from: **11 lifts stalled for 3 weeks.**
>
> The prescription is `3x10 @ 41 kg`. Full stop. Next session's number is computed
> from what actually got logged.

### Smallest available increment, by equipment

| Equipment | Typical increment |
|---|---|
| Dumbbells | 2-2.5 kg / 5 lb per hand (often the biggest forced jump — expect stalls) |
| Barbell | 1-2.5 kg / 2.5-5 lb total, with fractional plates if available |
| Cable / selectorised stack | one pin, usually 2.5-5 kg / 5-10 lb |
| Plate-loaded machine | smallest plate available, often 1.25 kg / 2.5 lb per side |
| **Bodyweight / bands** | **No load increment exists.** Progress reps → tempo → leverage → unilateral, per `exercise-library.md` §10 |

When the forced increment is large relative to the working weight (common on
dumbbells and cable stacks), **add a rep or a set instead** for one cycle before
jumping. Say which you did and why.

In the `bodyweight` and `minimal` equipment tiers there is no weight column at all —
the progression variable is reps, tempo, leverage or a unilateral step, and the same
double-progression logic applies to it. **`today` prints the progression variable, never
an empty column.**

### Targets are never stored

**No weight is ever written into a block file.** The block holds structure — exercises,
sets, reps, rest, order, rules. Every session's weight is computed fresh by `today`
from the last logged entry for that exact lift.

This is the rule that makes stale plans impossible, and it holds in all five modes.

---

## 5. Stall mechanics

**The trigger and the intervention order come from the active profile's `stall_rule`.**
They differ: 3 sessions of held load in `hypertrophy`, 2 missed sessions in `strength`,
3 sessions of *declining* load in `fat-loss`, 4 sessions in `general-fitness`, and in
`endurance-hybrid` a held lift during a build is not a stall at all.

What is true in every mode:

- **Never just re-prescribe it unchanged.** An identical fourth prescription is the
  coach saying "try harder", which is not a plan.
- **Check whether it is actually a stall, before intervening.** A lift with a logging
  gap, a lift capped by the `safety.md` §3 flagged-movement protocol, or a lift whose
  smallest increment is a 12% jump is not stalled — it is under-sampled, capped, or
  mis-equipped. **Say which.**
- **Say which intervention you applied, and why.** Write it into the block's
  `Adjustments` or the operating manual so it survives the chat.

---

## 6. Ordering mechanics

**What goes in slot 1 comes from the active profile's `ordering_rule`** — the lagging
priority muscle in `hypertrophy` and `fat-loss`, the main lift in `strength`, the
hardest compound in `general-fitness`, and in `endurance-hybrid` the decision is made
across the week rather than within the session.

The mechanics below are the same in all five, and they are the reason slot 1 is worth
arguing about:

> **Whatever is last does not get done.** Treat the final slot as optional and never
> put something that matters there. This is why core and mobility disappear for months
> at a time in real logs — they were always programmed last.

- **Slot 1 is the only slot with a guaranteed occupant.** Everything after it is
  progressively less likely to happen.
- **Core and mobility go in the warm-up**, never at the end. In every mode.
- Mark the top **three** exercises of every session **non-negotiable**, and tell the
  athlete to cut from the bottom when short on time. Making the cut explicit means the
  right things survive, instead of the same three lifts being silently dropped forever.
- **Say which ordering rule you applied and why**, in the block. Two modes disagree
  here on purpose, and a reader comparing them should be able to see that it was a
  decision rather than an inconsistency.

---

## 7. Supersets

Roughly **half the time for equivalent hypertrophy**, with two hard conditions:

- Pair only **non-competing muscles** (rear delts + calves, not chest + triceps).
- Pair only where the two stations are **physically adjacent**. A superset across a
  busy gym is two sets with a walk in the middle and someone else on your machine.

> **Never superset primary compounds.** One review found straight sets clearly better
> for **seated row (24.3% vs 16.5%)** and **lat pulldown (20.5% vs 12.6%)**.
>
> **Never superset a main lift in `strength` mode**, for the same reason and more so —
> the whole point of a 240-second rest is that the next set is fresh.

Use supersets to rescue volume when the arithmetic in section 1 says a priority muscle
cannot fit — not as a default structure.

---

## 8. Warm-up

1. **2-3 min general** — bike, rower, or incline walk, at a conversational pace.
2. **Core and mobility work goes here** (see section 6).
3. **Ramp-up on the first exercise only** — ~50% x 8, then ~75% x 5. These are not
   working sets and are not counted in volume. In `strength` mode the main lift's ramp
   is longer and **is** budgeted for in the arithmetic (`goals/strength.md` §9).
4. **No static stretching beforehand.** Slightly negative for power
   (SMD -0.17 vs +0.12 for dynamic); both improve ROM equally, so move static work to
   after the session where it costs nothing.

Ramping every exercise is a common and expensive mistake: six ramp-ups at ~2 minutes
each is 12 minutes, which is three working exercises.

---

## 9. Deload

**Cadence and shape come from the active profile's `deload_policy`** — ~6 weeks in
`hypertrophy` and `fat-loss`, 4–6 in `strength`, 4 in `endurance-hybrid`, and none
scheduled in `general-fitness`.

What is true wherever one is scheduled:

- **Scheduled, not reactive.** A deload taken when you feel you need one is a deload
  taken three weeks late. Put it in the block from the start, with a date.
- **Keep the weights. Cut the sets.** Reducing load instead of volume makes the return
  week feel worse and progresses nothing. (`strength` mode keeps one moderate top set
  for the same reason.)
