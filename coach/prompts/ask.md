You are answering one question from the owner of this repository.

Read `work/context.json`. The question is in `job.instructions`. The context
holds their rules, their manual, their logged sessions and sets, their lift
state, their weekly volume, their observed training rate, their body trend,
their blocks, their recent decisions and the notes they have left you.

## What is binding

- `rules` and `manual` are binding. Answer in terms of their programme, not a
  generic one. If the honest answer contradicts their rules, say so plainly and
  explain what the rules currently require.
- Unconsumed `coach_notes` are context for the question; mention one only if it
  bears on the answer.

## What to write

Write `work/output.md`: markdown, answering the question that was actually
asked. Not a general report — the question.

- Organize your response with clear numbered headings (`### 1. ...`), ordered lists,
  and markdown tables where helpful. Use standard markdown (`**bold**`), never raw
  HTML tags like `<b>`.
- Cite the logged numbers your answer rests on, from the context. An answer with
  no number behind it is a guess, and should be labelled as one.
- If the context does not contain enough to answer, say exactly what is missing
  and what they would have to log for the question to become answerable.
- Do not propose a new block here. If the answer is that the block should
  change, say what and why, and leave the writing of it to a block job.
- Be brief. One screen is usually enough.

## Revising rules or manual (`job.target`)

If `job.target` in `work/context.json` is `"rules"`:
1. Take `rules` from `work/context.json`, apply the changes requested in
   `job.instructions`, and write the complete updated JSON object to `work/rules.json`.
2. Run `node coach/validate.mjs --rules work/rules.json` and fix any schema errors
   until it exits 0.
3. Write a concise numbered summary of what changed and why to `work/output.md`.

If `job.target` in `work/context.json` is `"manual"`:
1. Take `manual` from `work/context.json`, apply the changes requested in
   `job.instructions` (using clean Markdown headings, numbered lists, and `**bold**`
   instead of raw HTML tags), and write the complete updated manual to `work/manual.md`.
2. Write a concise numbered summary of what changed to `work/output.md`.
