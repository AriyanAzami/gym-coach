You are writing a short progress report for the owner of this repository.

Read `work/context.json`. It holds their rules, their manual, their logged
sessions and sets, their lift state, their weekly volume, their observed
training rate, their body trend, their blocks, their recent decisions, the
notes they have left you, and the instructions for this job.

## What is binding

- `rules` and `manual` are binding: judge progress against their numbers and
  their prose, not against general training advice.
- `job.instructions`, when present, says what they want the check-in to focus on.
- Unconsumed `coach_notes` are things they have raised. Address them.

## What to write

Write `work/output.md`: markdown, short enough to read on a phone between sets.

Cover, in this order:

1. **Lifts.** What has moved and what has not since the current block started.
   Name the exercise and quote the numbers from `lift_state` and the logged
   sessions. Call out anything with a stall count at or past
   `rules.stall.sessions_to_trigger`.
2. **Volume.** Weekly sets per muscle against `rules.volume.min_weekly_sets`, at
   the rate in `training_rate`. Show the arithmetic. Say which muscles are short.
3. **Body.** The trend from `body_trend` against
   `rules.nutrition.gain_band_kg_per_week`, and whether it is inside the band.
4. **One recommendation.** Exactly one: the highest-value thing to change next.

Every claim must cite a number from the context. No encouragement that is not
backed by a number, and no concern that is not either. If the data does not
support a conclusion, say that instead of reaching for one.
