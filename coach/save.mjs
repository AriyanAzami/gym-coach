#!/usr/bin/env node
/* Writes the coach's output to the database, after validating it again from
   scratch. The model saying it passed the validator is not evidence: this is the
   gate that actually decides what gets stored.

   A block lands as a draft. Nothing the coach writes becomes active without the
   owner pressing Activate.

   Prints the job id and a status word. Never the plan, never the output. */

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { serviceClient, rows, getJob, setJobStatus, shortError } from './lib/db.mjs';
import { validateBlock } from './validate.mjs';

const BLOCK_KINDS = ['block', 'revise_block'];
const norm = (s) => String(s ?? '').trim().toLowerCase();

/* Pure: turns a validated plan into the rows that will be inserted. Slots keep
   their exercise name because a new exercise has no id until it is inserted. */
export function rowsForBlock(plan, { jobId, library }) {
  const newExercises = [];
  const days = [];
  const slots = [];

  for (const day of plan.days) {
    days.push({
      day_index: day.day_index,
      name: day.name,
      warmup_note: day.warmup_note ?? null,
    });

    for (const slot of [...day.slots].sort((a, b) => a.position - b.position)) {
      const name = String(slot.exercise).trim();
      const existing = library.get(norm(name)) ?? null;

      if (!existing && slot.new && !newExercises.some((e) => norm(e.name) === norm(name))) {
        newExercises.push({
          name,
          primary_muscle: slot.new.primary_muscle,
          secondary_muscles: slot.new.secondary_muscles ?? [],
          equipment: slot.new.equipment,
          movement_tags: slot.new.movement_tags ?? [],
          increment: slot.new.increment,
          unit: slot.new.increment_unit,
          load_mode: slot.new.load_mode ?? 'total',
          cues: slot.new.cues ?? null,
          active: true,
        });
      }

      slots.push({
        day_index: day.day_index,
        position: slot.position,
        exercise_name: name,
        exercise_id: existing,
        sets: slot.sets,
        rep_min: slot.rep_min,
        rep_max: slot.rep_max,
        rest_s: slot.rest_s,
        non_negotiable: slot.non_negotiable ?? false,
        cut_order: slot.cut_order ?? null,
        notes: slot.notes ?? null,
      });
    }
  }

  return {
    block: {
      name: plan.name,
      status: 'draft',
      starts_on: plan.starts_on ?? null,
      ends_on: plan.ends_on ?? null,
      rationale: plan.rationale,
      source_job_id: jobId,
    },
    days,
    slots,
    newExercises,
    decision: {
      title: `Draft block: ${plan.name}`,
      body: plan.rationale,
    },
  };
}

async function saveBlock(client, job, context) {
  const plan = JSON.parse(readFileSync('work/output.json', 'utf8'));

  const failures = validateBlock(plan, context);
  if (failures.length > 0) {
    throw new Error(`the plan failed ${failures.length} check(s); first: ${failures[0]}`);
  }

  const library = new Map((context.exercises ?? []).map((e) => [norm(e.name), e.id]));
  const built = rowsForBlock(plan, { jobId: job.id, library });

  const userId = job.user_id;

  // New exercises first: the slots reference them.
  for (const exercise of built.newExercises) {
    const [created] = await client.from('exercises')
      .insert({ ...exercise, user_id: userId }).select().then(rows);
    library.set(norm(created.name), created.id);
  }

  const [block] = await client.from('blocks')
    .insert({ ...built.block, user_id: userId }).select().then(rows);

  const dayRows = await client.from('block_days')
    .insert(built.days.map((d) => ({ ...d, block_id: block.id, user_id: userId })))
    .select().then(rows);
  const dayIdByIndex = new Map(dayRows.map((d) => [d.day_index, d.id]));

  await client.from('block_slots').insert(built.slots.map((s) => ({
    day_id: dayIdByIndex.get(s.day_index),
    position: s.position,
    exercise_id: s.exercise_id ?? library.get(norm(s.exercise_name)),
    sets: s.sets,
    rep_min: s.rep_min,
    rep_max: s.rep_max,
    rest_s: s.rest_s,
    non_negotiable: s.non_negotiable,
    cut_order: s.cut_order,
    notes: s.notes,
    user_id: userId,
  }))).then(rows);

  await client.from('decisions')
    .insert({ ...built.decision, block_id: block.id, user_id: userId }).then(rows);

  return { output_md: null };
}

function readMarkdown() {
  if (!existsSync('work/output.md')) throw new Error('work/output.md was not written');
  const text = readFileSync('work/output.md', 'utf8').trim();
  if (!text) throw new Error('work/output.md is empty');
  return { output_md: text };
}

async function main(jobId) {
  if (!jobId) {
    console.error('usage: node coach/save.mjs <job_id>');
    return 1;
  }

  const client = serviceClient();
  try {
    const job = await getJob(client, jobId);
    const context = JSON.parse(readFileSync('work/context.json', 'utf8'));

    const result = BLOCK_KINDS.includes(job.kind)
      ? await saveBlock(client, job, context)
      : readMarkdown();

    // Notes that went into this job are spent, whatever the job produced.
    const consumed = context.consumed_note_ids ?? [];
    if (consumed.length > 0) {
      await client.from('coach_notes').update({ consumed_by_job: jobId }).in('id', consumed);
    }

    await setJobStatus(client, jobId, {
      status: 'done',
      output_md: result.output_md,
      error: null,
      finished_at: new Date().toISOString(),
    });

    console.log(`job ${jobId} done`);
    return 0;
  } catch (err) {
    await setJobStatus(client, jobId, {
      status: 'failed', error: shortError(err), finished_at: new Date().toISOString(),
    }).catch(() => {});
    console.error(`job ${jobId} failed`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv[2]));
}
