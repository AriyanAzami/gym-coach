# Programming rules

Every number on this page traces to `evidence.md`, or is explicitly labelled a
heuristic there. Nothing here is negotiable at runtime — these are the rules that
make this a system rather than a prompt.

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
>
> Mixed is normal: 3 compounds at 90 s + 4 isolation at 60 s = 21 sets = 41 min
> + 5 warm-up = **46 min**.
>
> **Never program more than this arithmetic allows.** An over-booked session does not
> produce more work — it produces the same work minus whatever was at the bottom,
> every single time, and the bottom is always the same exercises.

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

Measured on real logs during this repo's own testing: a plan built on the 105–135 s
assumption was being executed at **172 s/set**. That single number explained every
skipped exercise in the history — the session was over-booked by 9 sets, and the bottom
three lifts were cut every time.

**Once you have four weeks of logs, the observed figure replaces the constant.** Say
which one you used.

### Weekly capacity, and when it is not enough

`weekly_capacity = sessions_per_week × sets_per_session`

Check the priority list against it **before** designing anything. Four priority muscles
at 10 direct sets each needs 40 sets/week, which at 14 sets/session takes three sessions,
not two. When the arithmetic is short, the answer is a decision the athlete has to make —
add a day, or shorten the priority list. **Never silently ship the compromise.**

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

## 2. Volume

**Target 10 or more direct sets per muscle per week** ([ACSM](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/)).
More is better with diminishing returns.

**Frequency is close to irrelevant for hypertrophy once weekly volume is equated** —
so 1x/week at 10 sets beats 2x/week at 6.

**Always show the count when publishing a plan.** Not "shoulders are covered" — a
table, with numbers, per muscle, per week.

### Counting rules

- Count **direct** sets: the muscle is a primary mover or the explicit target.
- Count a compound's secondary muscles as **0.5 sets** each, and say you are doing so.
  Lat pulldown = 1 lat set + 0.5 biceps. Bench = 1 chest + 0.5 front delt + 0.5 triceps.
- **`audit` counts completed sets. `block` counts programmed sets.** These are different
  numbers, and conflating them hides the entire problem — a plan can program 12 sets of
  rear delts and deliver 4.

### The publication gate

> **A stated priority muscle below 10 sets/week is a plan defect and blocks
> publication.** Not a warning, not a footnote. `block` prints the table, names the
> muscle, fixes it, reprints the table, and only then ships.

Non-priority muscles below 10 are allowed — you cannot maximise everything in 45
minutes — but they must be listed as **deliberate omissions with the reason**, so
nobody discovers the gap three months later.

---

## 3. Rest

**90 s compounds / 60 s isolation.**

Longer than ~90 s wastes time for no measurable return
([Frontiers 2024](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/full)).
Under 60 s costs a small amount of hypertrophy and, more practically, costs reps on
the next set.

Rest is the largest single consumer of session time. Every 30 s added across 18 sets
is 9 minutes — an entire exercise and a half.

---

## 4. Load and failure

Hypertrophy is not much affected by load between ~30% and 100% 1RM, nor by training
to failure, once volume is equated.

- **Do not program to failure by default.** It costs recovery and buys little.
- Program **RIR 1-3** — leave one to three reps in reserve — as the default intensity cue.
- Rep ranges 6-15 are all productive. Use 6-10 on compounds, 10-15 on isolation, for
  joint-comfort and time reasons rather than hypertrophic ones.
- **Strength is a separate outcome and does need heavy work.** If an athlete's goal is
  strength rather than size, say that the load rules change, and program accordingly.

---

## 5. Double progression — the only progression scheme

1. Prescribe **one exact weight and one exact rep target** per lift.
2. Hit the top of the rep range **on all prescribed sets**, then add the **smallest
   available increment**, then rebuild the reps at the new weight.
3. Repeat.

**One exact target per lift. No ranges in the prescription. No conditional holds.**

> **Conditional holds are banned.** "Hold 85 lb until 3x12 is clean" requires
> somebody to re-read the trigger every session, and nobody does. Observed cost in the
> audit this repo was built from: **11 lifts stalled for 3 weeks.**
>
> The prescription is `3x10 @ 90 lb`. Full stop. Next session's number is computed
> from what actually got logged.

**Smallest available increment**, by equipment:

| Equipment | Typical increment |
|---|---|
| Dumbbells | 2-2.5 kg / 5 lb per hand (often the biggest forced jump — expect stalls) |
| Barbell | 1-2.5 kg / 2.5-5 lb total, with fractional plates if available |
| Cable / selectorised stack | one pin, usually 2.5-5 kg / 5-10 lb |
| Plate-loaded machine | smallest plate available, often 1.25 kg / 2.5 lb per side |

When the forced increment is large relative to the working weight (common on
dumbbells and cable stacks), **add a rep or a set instead** for one cycle before
jumping. Say which you did and why.

### Targets are never stored

**No weight is ever written into a block file.** The block holds structure — exercises,
sets, reps, rest, order, rules. Every session's weight is computed fresh by `today`
from the last logged entry for that exact lift.

This is the rule that makes stale plans impossible.

---

## 6. Stall rule

**Same weight _and_ same reps for 3 sessions on the same lift, then intervene.**

In this order:

1. **Move it earlier in the session.** Costs nothing, works surprisingly often — a
   lift in slot 6 is being performed on the fumes of five other exercises.
2. **Add a set.** More volume at the same load.
3. **Change the variation.** Different angle, grip, or machine for the same muscle.

**Never just re-prescribe it.** A fourth identical prescription is the coach saying
"try harder", which is not a plan.

Before intervening, **check whether it is actually a stall**. A lift with a logging
gap, a lift capped by the `safety.md` flagged-movement protocol, or a lift whose
smallest increment is a 12% jump is not stalled — it is under-sampled, capped, or
mis-equipped. Say which.

---

## 7. Ordering

**Lagging muscle first. Every session. No exceptions.**

Then compounds. Then isolation. Core and mobility go **in the warm-up**.

> **Whatever is last does not get done.** Treat the final slot as optional and never
> put something that matters there. This is why core and mobility disappear for months
> at a time in real logs — they were always programmed last.

The athlete's ranked priority muscles from onboarding drive this ordering, and keep
driving it across every block until they change the ranking.

Mark the top **three** exercises of every session **non-negotiable**, and tell the
athlete to cut from the bottom when short on time. Making the cut explicit means the
right things survive, instead of the same three lifts being silently dropped forever.

---

## 8. Supersets

Roughly **half the time for equivalent hypertrophy**, with two hard conditions:

- Pair only **non-competing muscles** (rear delts + calves, not chest + triceps).
- Pair only where the two stations are **physically adjacent**. A superset across a
  busy gym is two sets with a walk in the middle and someone else on your machine.

> **Never superset primary compounds.** One review found straight sets clearly better
> for **seated row (24.3% vs 16.5%)** and **lat pulldown (20.5% vs 12.6%)**.

Use supersets to rescue volume when the arithmetic in section 1 says a priority muscle
cannot fit — not as a default structure.

---

## 9. Deload

**After ~6 weeks: one week at ~60% of the normal set count, same weights.**

**Scheduled, not reactive.** A deload taken when you feel you need one is a deload
taken three weeks late. Put it in the block from the start, with a date.

Keep the weights. Cut the sets. Reducing load instead of volume makes the return week
feel worse and progresses nothing.

---

## 10. Warm-up

1. **2-3 min general** — bike, rower, or incline walk, at a conversational pace.
2. **Core and mobility work goes here** (see section 7).
3. **Ramp-up on the first exercise only** — ~50% x 8, then ~75% x 5. These are not
   working sets and are not counted in volume.
4. **No static stretching beforehand.** Slightly negative for power
   (SMD -0.17 vs +0.12 for dynamic); both improve ROM equally, so move static work to
   after the session where it costs nothing.

Ramping every exercise is a common and expensive mistake: six ramp-ups at ~2 minutes
each is 12 minutes, which is three working exercises.
