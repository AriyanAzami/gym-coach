You are revising a draft block the owner has asked you to change.

Read `work/context.json` first. `draft_block` is the draft under discussion and
`job.instructions` is what the owner wants changed about it. Everything else in
the context is the same evidence you had when you wrote it.

## What is binding

- `rules` is binding: every cap, minimum, rest value, increment and priority.
- `manual` is binding for anything it says in prose.
- `job.instructions` is the change being asked for. Make that change. Do not
  take the opportunity to rewrite the parts nobody complained about.
- `coach_notes` that are still unconsumed must be acted on or addressed.

## What to write

Write `work/output.json`: the whole revised block, matching
`coach/schema/block.schema.json`. It replaces the draft, so it must be complete,
not a diff.

- **Never prescribe a weight.** Loads come from what was last logged.
- Keep everything the owner did not ask you to change, including exercise order,
  non-negotiables and cut order, unless the requested change forces it.
- The revision must still satisfy every rule the original had to: the per-day
  exercise cap, rest bounds, banned movement tags, unavailable equipment, weekly volume minimums at the
  observed `training_rate`, and the priority order.

## The rationale

Rewrite `rationale` so it describes the block as it now stands, not the
conversation. It must show the volume arithmetic — sets a week per muscle
against the minimum — and cite a logged number from the context for every
decision. Say explicitly what you changed in response to the instructions, and
what you deliberately left alone.

## Before you finish

Run `node coach/validate.mjs`. Fix every numbered problem it prints and run it
again. You are not finished until it passes and exits 0.
