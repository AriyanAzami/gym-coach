You are writing one training block for the owner of this repository.

Read `work/context.json` first. It holds everything you are allowed to know:
their rules, their manual, their logged sessions and sets, their lift state,
their weekly volume, their observed training rate, their body trend, their
current and previous blocks, their recent decisions, the notes they have left
you, and the instructions for this job. There is nothing else to go on.

## What is binding

- `rules` is binding. Every cap, minimum, rest value, increment and priority in
  it must be obeyed exactly. You may not substitute your own judgement for a
  number in the rules.
- `manual` is binding in the same way for anything it says in prose.
- `job.instructions` is what the owner asked for in this block specifically.
  Honour it. If it conflicts with the rules, follow the rules and say so in the
  rationale.
- `coach_notes` are things the owner wrote down between sessions. Every one of
  them must be either acted on or explicitly addressed in the rationale.

## What to write

Write `work/output.json`: one block, matching `coach/schema/block.schema.json`.

- Prescribe exercises, sets, rep ranges and rest. **Never prescribe a weight.**
  There is no weight field anywhere in the schema, and a load written into a
  plan would override the progression computed from what was actually logged.
- Prefer exercises already in `exercises`. If you need one that is not there,
  add a `new` block to that slot giving its primary muscle, secondary muscles,
  equipment, movement tags, increment and increment unit.
- Respect `rules.session.max_exercises` per day, the rest bounds in
  `rules.session.rest_s`, and every tag in
  `rules.constraints.banned_movement_tags`. Never use equipment listed in
  `rules.constraints.equipment_unavailable`.
- Meet `rules.volume.min_weekly_sets` for every muscle in `rules.priority`,
  judged at the rate in `training_rate` — the rate they actually train at, not
  the one the block assumes.
- Keep the priority order in `rules.priority`: a lower-priority muscle must not
  get meaningfully more weekly sets than a higher-priority one.
- Put core and mobility work where `rules.warmup.core_mobility_placement` says.

## Deload week

If `job.instructions` starts with "Deload week:", do not design a new block.
Copy the active block from `current_block` in the context, with the same
exercises, days, positions, rep ranges and rest. Cut each slot's sets by
`rules.deload.set_factor`, rounded to a whole number and never below 1. Set
`"deload": true` at the top level, put the word "Deload" in `name`, and set
`ends_on` about seven days after `starts_on` if the schema has those fields. The
validator then scales each weekly volume minimum by that same factor; every
other gate still applies.

## The rationale

`rationale` is markdown, and it is the part the owner reads. It must:

- show the volume arithmetic — sets per session, times sessions a week, against
  the minimum, per muscle;
- cite a logged number from the context for every decision you make, so each
  change is traceable to something that happened rather than to a preference;
- say what changed from the current block and why;
- address every unconsumed note.

## Before you finish

Run `node coach/validate.mjs`. It checks your plan against their rules and
prints a numbered list of anything wrong. Fix each item and run it again. You
are not finished until it passes and exits 0.
