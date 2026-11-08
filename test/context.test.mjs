/* All content below is fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildContext } from '../coach/context.mjs';

const rules = JSON.parse(readFileSync('supabase/seed/rules.example.json', 'utf8'));

const rows = (over = {}) => ({
  documents: [
    { key: 'rules', version: 2, body_json: rules, body_md: null },
    { key: 'manual', version: 1, body_json: null, body_md: '# Manual\n\nTrain hard.' },
  ],
  exercises: [{ id: 'ex-1', name: 'Row', primary_muscle: 'back', secondary_muscles: ['arms'], equipment: 'barbell', movement_tags: ['horizontal_pull'], increment: 5, unit: 'lb', load_mode: 'total', flag: null, active: true }],
  sessions: [{ id: 'se-1', date: '2026-11-01', kind: 'training', status: 'done', effort_1_10: 7, pain: 'none', block_id: 'bl-1', day_index: 0 }],
  sets: [{ id: 'st-1', session_exercise_id: 'sx-1', set_no: 1, weight: 185, unit: 'lb', reps: 8, partial: false, done: true }],
  sessionExercises: [{ id: 'sx-1', session_id: 'se-1', exercise_id: 'ex-1', position: 0, target_weight: 185, target_unit: 'lb', target_reps: 8, target_sets: 3 }],
  liftState: [{ exercise_id: 'ex-1', last_weight: 185, last_unit: 'lb', last_date: '2026-11-01', stall_count: 0 }],
  weeklyVolume: [{ week_start: '2026-10-26', muscle: 'back', total_sets: 12, direct_sets: 12, indirect_sets: 0 }],
  trainingRate: { per_week_4w: 3, per_week_8w: 2.5 },
  bodyTrend: [{ week_start: '2026-11-02', avg_weight: 70.4, unit: 'kg', rate_3w: 0.13 }],
  blocks: [
    { id: 'bl-1', name: 'Autumn', status: 'active', rationale: 'Back first.' },
    { id: 'bl-0', name: 'Summer', status: 'archived', rationale: 'Base.' },
    { id: 'bl-2', name: 'Draft', status: 'draft', rationale: 'Proposal.' },
  ],
  days: [{ id: 'd-1', block_id: 'bl-1', day_index: 0, name: 'Pull', warmup_note: 'Bike' }],
  slots: [{ id: 's-1', day_id: 'd-1', position: 0, exercise_id: 'ex-1', sets: 4, rep_min: 8, rep_max: 12, rest_s: 120, non_negotiable: false, cut_order: null, notes: null }],
  decisions: [{ id: 'de-1', date: '2026-10-01', title: 'Dropped overhead press', body: 'Shoulder.' }],
  notes: [
    { id: 'n-1', body: 'more lats', consumed_by_job: null, created_at: '2026-11-05T09:00:00Z' },
    { id: 'n-2', body: 'already used', consumed_by_job: 'job-0', created_at: '2026-10-01T09:00:00Z' },
  ],
  ...over,
});

const job = (over = {}) => ({
  id: 'job-1', kind: 'block', instructions: 'four days, more upper back',
  target_block_id: null, status: 'running', ...over,
});

test('the context carries the rules and the manual', () => {
  const ctx = buildContext(rows(), job());
  assert.deepEqual(ctx.rules, rules);
  assert.match(ctx.manual, /Train hard/);
});

test('the context carries the job kind and instructions', () => {
  const ctx = buildContext(rows(), job());
  assert.equal(ctx.job.kind, 'block');
  assert.equal(ctx.job.instructions, 'four days, more upper back');
});

test('only unconsumed notes are included', () => {
  const ctx = buildContext(rows(), job());
  assert.deepEqual(ctx.coach_notes.map((n) => n.body), ['more lats']);
});

test('the ids of the notes it consumed are recorded so save.mjs can mark them', () => {
  const ctx = buildContext(rows(), job());
  assert.deepEqual(ctx.consumed_note_ids, ['n-1']);
});

test('the active block is given with its days and slots', () => {
  const ctx = buildContext(rows(), job());
  assert.equal(ctx.current_block.name, 'Autumn');
  assert.equal(ctx.current_block.days[0].name, 'Pull');
  assert.equal(ctx.current_block.days[0].slots[0].sets, 4);
});

test('the previous block is given for comparison', () => {
  const ctx = buildContext(rows(), job());
  assert.equal(ctx.previous_block.name, 'Summer');
});

test('a revise job carries the draft being revised', () => {
  const ctx = buildContext(rows(), job({ kind: 'revise_block', target_block_id: 'bl-2' }));
  assert.equal(ctx.draft_block.name, 'Draft');
});

test('a plain block job carries no draft', () => {
  assert.equal(buildContext(rows(), job()).draft_block, null);
});

test('lift state, volume, rate and body trend are all present', () => {
  const ctx = buildContext(rows(), job());
  assert.equal(ctx.lift_state.length, 1);
  assert.equal(ctx.weekly_muscle_volume.length, 1);
  assert.equal(ctx.training_rate.per_week_4w, 3);
  assert.equal(ctx.body_trend.length, 1);
});

test('sessions carry their logged sets, so every claim can cite a number', () => {
  const ctx = buildContext(rows(), job());
  const session = ctx.sessions[0];
  assert.equal(session.exercises[0].sets[0].weight, 185);
});

test('the exercise library is included so the coach knows what exists', () => {
  assert.equal(buildContext(rows(), job()).exercises[0].name, 'Row');
});

test('recent decisions are included', () => {
  assert.equal(buildContext(rows(), job()).decisions.length, 1);
});

test('the context never carries a user id or any auth material', () => {
  const text = JSON.stringify(buildContext(rows(), job()));
  assert.doesNotMatch(text, /user_id/);
  assert.doesNotMatch(text, /service_role|anon_key|access_token|password/i);
});

test('an empty database still produces a usable context', () => {
  const empty = {
    documents: [], exercises: [], sessions: [], sets: [], sessionExercises: [],
    liftState: [], weeklyVolume: [], trainingRate: null, bodyTrend: [],
    blocks: [], days: [], slots: [], decisions: [], notes: [],
  };
  const ctx = buildContext(empty, job());
  assert.equal(ctx.rules, null);
  assert.equal(ctx.current_block, null);
  assert.deepEqual(ctx.coach_notes, []);
});

// ---- log safety: this runs in a public repository's Action ----

test('no script under coach/ prints a row, a plan or the context', () => {
  for (const file of readdirSync('coach').filter((f) => f.endsWith('.mjs'))) {
    const source = readFileSync(`coach/${file}`, 'utf8');
    for (const m of source.matchAll(/console\.(log|error|info|warn)\(([^\n]*)/g)) {
      // Strip string and template literals: a literal message is fine, a
      // variable called `context` is not.
      const args = m[2]
        .replace(/'[^']*'/g, "''")
        .replace(/"[^"]*"/g, '""')
        .replace(/`[^`]*`/g, '``');
      assert.doesNotMatch(args, /JSON\.stringify/, `${file} stringifies into a log line`);
      assert.doesNotMatch(args, /\b(context|rows|plan|output|doc|record)\b/,
        `${file} logs a variable that may carry data: ${m[0].slice(0, 80)}`);
    }
  }
});

test('no script under coach/ writes data to stdout another way', () => {
  for (const file of readdirSync('coach').filter((f) => f.endsWith('.mjs'))) {
    const source = readFileSync(`coach/${file}`, 'utf8');
    assert.doesNotMatch(source, /process\.stdout\.write/, `${file} writes to stdout directly`);
  }
});

test('a skipped exercise is flagged so the coach can tell it from a missing log', () => {
  const data = rows();
  data.sessionExercises = [{ ...data.sessionExercises[0], deviation_note: 'skipped' }];
  const ex = buildContext(data, job()).sessions[0].exercises[0];
  assert.equal(ex.skipped, true);
});
