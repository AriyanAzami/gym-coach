#!/usr/bin/env node
/* Builds work/context.json: everything the coach is allowed to see, and nothing
   else. Marks the job running on the way in.

   This runs in a public repository's Action, so it prints the job id and a
   status word and nothing else. The context goes to a file the workflow never
   reads back out. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { serviceClient, rows, getJob, setJobStatus, shortError } from './lib/db.mjs';

const WEEKS_OF_HISTORY = 8;

/* Pure: turns the fetched rows into the document the model reads. Separated from
   the fetching so it can be tested without a database. */
export function buildContext(data, job) {
  const latest = (key) => data.documents
    .filter((d) => d.key === key)
    .sort((a, b) => b.version - a.version)[0] ?? null;

  const rulesDoc = latest('rules');
  const manualDoc = latest('manual');

  const setsByExercise = new Map();
  for (const set of data.sets) {
    const list = setsByExercise.get(set.session_exercise_id) ?? [];
    list.push({
      set_no: set.set_no, weight: set.weight, unit: set.unit,
      reps: set.reps, partial: set.partial,
    });
    setsByExercise.set(set.session_exercise_id, list);
  }

  const exercisesBySession = new Map();
  for (const sx of data.sessionExercises) {
    const list = exercisesBySession.get(sx.session_id) ?? [];
    list.push({
      exercise_id: sx.exercise_id,
      position: sx.position,
      target_weight: sx.target_weight,
      target_unit: sx.target_unit,
      target_reps: sx.target_reps,
      target_sets: sx.target_sets,
      deviation_note: sx.deviation_note,
      sets: (setsByExercise.get(sx.id) ?? []).sort((a, b) => a.set_no - b.set_no),
    });
    exercisesBySession.set(sx.session_id, list);
  }

  const withDays = (block) => {
    if (!block) return null;
    const days = data.days
      .filter((d) => d.block_id === block.id)
      .sort((a, b) => a.day_index - b.day_index)
      .map((d) => ({
        day_index: d.day_index,
        name: d.name,
        warmup_note: d.warmup_note,
        slots: data.slots
          .filter((s) => s.day_id === d.id)
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            position: s.position,
            exercise_id: s.exercise_id,
            sets: s.sets,
            rep_min: s.rep_min,
            rep_max: s.rep_max,
            rest_s: s.rest_s,
            non_negotiable: s.non_negotiable,
            cut_order: s.cut_order,
            notes: s.notes,
          })),
      }));
    return {
      id: block.id, name: block.name, status: block.status,
      starts_on: block.starts_on, ends_on: block.ends_on,
      rationale: block.rationale, days,
    };
  };

  const archived = data.blocks
    .filter((b) => b.status === 'archived')
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

  const unconsumed = data.notes.filter((n) => !n.consumed_by_job);

  return {
    generated_for_job: job.id,
    job: { kind: job.kind, instructions: job.instructions ?? null },

    rules: rulesDoc?.body_json ?? null,
    rules_version: rulesDoc?.version ?? null,
    manual: manualDoc?.body_md ?? null,
    manual_version: manualDoc?.version ?? null,

    exercises: data.exercises.map((e) => ({
      id: e.id, name: e.name, primary_muscle: e.primary_muscle,
      secondary_muscles: e.secondary_muscles, equipment: e.equipment,
      movement_tags: e.movement_tags, increment: e.increment, unit: e.unit,
      load_mode: e.load_mode, cues: e.cues, flag: e.flag, active: e.active,
    })),

    sessions: data.sessions.map((s) => ({
      id: s.id, date: s.date, kind: s.kind, status: s.status,
      day_index: s.day_index, duration_min: s.duration_min,
      effort_1_10: s.effort_1_10, pain: s.pain, notes: s.notes,
      exercises: (exercisesBySession.get(s.id) ?? []).sort((a, b) => a.position - b.position),
    })),

    lift_state: data.liftState,
    weekly_muscle_volume: data.weeklyVolume,
    training_rate: data.trainingRate,
    body_trend: data.bodyTrend,

    current_block: withDays(data.blocks.find((b) => b.status === 'active') ?? null),
    previous_block: withDays(archived[0] ?? null),
    draft_block: job.kind === 'revise_block' && job.target_block_id
      ? withDays(data.blocks.find((b) => b.id === job.target_block_id) ?? null)
      : null,

    decisions: data.decisions.map((d) => ({ date: d.date, title: d.title, body: d.body })),
    coach_notes: unconsumed.map((n) => ({ body: n.body, created_at: n.created_at })),
    consumed_note_ids: unconsumed.map((n) => n.id),
  };
}

async function fetchAll(client, job) {
  const since = new Date();
  since.setDate(since.getDate() - WEEKS_OF_HISTORY * 7);
  const sinceYmd = since.toISOString().slice(0, 10);

  const [documents, exercises, sessions, liftState, weeklyVolume, trainingRate,
    bodyTrend, blocks, decisions, notes] = await Promise.all([
    client.from('documents').select('*').then(rows),
    client.from('exercises').select('*').order('name').then(rows),
    client.from('sessions').select('*').gte('date', sinceYmd).order('date').then(rows),
    client.from('lift_state').select('*').then(rows),
    client.from('weekly_muscle_volume').select('*').gte('week_start', sinceYmd).then(rows),
    client.from('training_rate').select('*').maybeSingle().then((r) => (r.error ? null : r.data)),
    client.from('body_trend').select('*').gte('week_start', sinceYmd).then(rows),
    client.from('blocks').select('*').neq('status', 'archived').then(rows),
    client.from('decisions').select('*').order('date', { ascending: false }).limit(25).then(rows),
    client.from('coach_notes').select('*').is('consumed_by_job', null).then(rows),
  ]);

  // The most recent archived block, for comparison, on top of the live ones.
  const archived = await client.from('blocks').select('*').eq('status', 'archived')
    .order('created_at', { ascending: false }).limit(1).then(rows);
  const allBlocks = [...blocks, ...archived];

  const blockIds = allBlocks.map((b) => b.id);
  const days = blockIds.length
    ? await client.from('block_days').select('*').in('block_id', blockIds).then(rows)
    : [];
  const slots = days.length
    ? await client.from('block_slots').select('*').in('day_id', days.map((d) => d.id)).then(rows)
    : [];

  const sessionIds = sessions.map((s) => s.id);
  const sessionExercises = sessionIds.length
    ? await client.from('session_exercises').select('*').in('session_id', sessionIds).then(rows)
    : [];
  const sets = sessionExercises.length
    ? await client.from('sets').select('*')
      .in('session_exercise_id', sessionExercises.map((x) => x.id)).then(rows)
    : [];

  return {
    documents, exercises, sessions, sets, sessionExercises, liftState,
    weeklyVolume, trainingRate, bodyTrend, blocks: allBlocks, days, slots,
    decisions, notes,
  };
}

async function main(jobId) {
  if (!jobId) {
    console.error('usage: node coach/context.mjs <job_id>');
    return 1;
  }

  const client = serviceClient();
  try {
    const job = await getJob(client, jobId);
    await setJobStatus(client, jobId, { status: 'running', started_at: new Date().toISOString() });

    const data = await fetchAll(client, job);
    mkdirSync('work', { recursive: true });
    writeFileSync('work/context.json', JSON.stringify(buildContext(data, job), null, 2));

    console.log(`job ${jobId} running`);
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
