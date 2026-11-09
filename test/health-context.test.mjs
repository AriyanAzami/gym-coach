/* All values below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelContext } from '../supabase/functions/health-check/context.js';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const data = () => ({
  today: '2026-11-11',
  rules: { units: { weight: 'kg' } },
  manual: 'Example manual text.',
  exercises: [
    { id: id(1), name: 'Bench press', primary_muscle: 'chest', secondary_muscles: ['arms'], equipment: 'barbell', flag: 'example flag', active: true, created_at: 'x', user_id: id(9) },
    { id: id(2), name: 'Old row', primary_muscle: 'back', secondary_muscles: [], equipment: 'cable', flag: null, active: false },
  ],
  sessions: [{
    id: id(10), user_id: id(9), date: '2026-11-10', kind: 'training', status: 'done', day_index: 1,
    effort_1_10: 8, pain: 'none', notes: 'felt fine', duration_min: 60, created_at: 'x',
    session_exercises: [{
      id: id(11), exercise_id: id(1), position: 0, deviation_note: null, target_weight: 100, target_unit: 'kg', target_reps: 8,
      sets: [
        { id: id(12), set_no: 2, weight: 100, unit: 'kg', reps: 7, done: true, partial: false },
        { id: id(13), set_no: 1, weight: 100, unit: 'kg', reps: 8, done: true, partial: false },
        { id: id(14), set_no: 3, weight: 100, unit: 'kg', reps: 4, done: true, partial: true },
        { id: id(15), set_no: 4, weight: 100, unit: 'kg', reps: null, done: false, partial: false },
      ],
    }],
  }],
  liftState: [{ exercise_id: id(1), name: 'Bench press', last_date: '2026-11-10', last_weight: 100, last_unit: 'kg', stall_count: 1, sessions_since_change: 1, active: true }],
  weeklyVolume: [{ user_id: id(9), week_start: '2026-11-02', muscle: 'chest', total_sets: 10 }],
  trainingRate: { user_id: id(9), per_week_4w: 3, per_week_8w: 2.5, last_session_date: '2026-11-10' },
  bodyTrend: [{ user_id: id(9), week_start: '2026-11-02', avg_weight: 80, unit: 'kg', rate_3w: 0.2 }],
  bodyMetrics: [{ id: id(20), date: '2026-11-09', weight: 80, unit: 'kg', notes: 'morning' }],
  activeBlock: {
    id: id(30), name: 'Block A', starts_on: '2026-10-20', rationale: 'why',
    block_days: [{ id: id(31), day_index: 1, name: 'Push', block_slots: [
      { id: id(33), position: 1, exercise_id: id(2), sets: 3, rep_min: 10, rep_max: 12 },
      { id: id(32), position: 0, exercise_id: id(1), sets: 3, rep_min: 6, rep_max: 8, notes: 'pause' },
    ] }],
  },
  decisions: [{ date: '2026-11-01', title: 'Example decision', body: 'b' }],
  notes: [{ body: 'tight hip', created_at: '2026-11-05T00:00:00Z' }],
  jobs: [
    { id: id(40), kind: 'ask', status: 'done', error: null, created_at: '2026-11-08T00:00:00Z',
      instructions: '[model=opus effort=high mode=journal]\nhow is bench?', output_md: '<!-- coach-meta: {} -->\nIt is fine.' },
    { id: id(41), kind: 'block', status: 'failed', error: 'boom', created_at: '2026-11-07T00:00:00Z', instructions: null, output_md: null },
  ],
});

test('the context carries no ids at all', () => {
  const text = JSON.stringify(modelContext(data(), []));
  assert.doesNotMatch(text, UUID_RE);
});

test('a session collapses its sets into one line per exercise, done sets only, partials marked', () => {
  const ctx = modelContext(data(), []);
  const s = ctx.sessions[0];
  assert.equal(s.date, '2026-11-10');
  assert.equal(s.effort, 8);
  assert.equal(s.notes, 'felt fine');
  assert.deepEqual(s.lifts, ['Bench press: 100kg×8, 100kg×7, 100kg×4p (target 100kg×8)']);
});

test('the block names exercises and keeps slot order', () => {
  const day = modelContext(data(), []).active_block.days[0];
  assert.equal(day.name, 'Push');
  assert.deepEqual(day.slots, ['Bench press 3×6-8 (pause)', 'Old row 3×10-12']);
});

test('the rest of the picture survives: rules, manual, notes, decisions, journal, job statuses, findings', () => {
  const findings = [{ area: 'data', severity: 'warn', title: 't', detail: 'd' }];
  const ctx = modelContext(data(), findings);
  assert.deepEqual(ctx.rules, { units: { weight: 'kg' } });
  assert.equal(ctx.manual, 'Example manual text.');
  assert.equal(ctx.coach_notes[0].body, 'tight hip');
  assert.equal(ctx.decisions[0].title, 'Example decision');
  assert.deepEqual(ctx.journal, [{ at: '2026-11-08T00:00:00Z', question: 'how is bench?', answer: 'It is fine.' }]);
  assert.deepEqual(ctx.coach_jobs.map((j) => j.status), ['done', 'failed']);
  assert.deepEqual(ctx.checker_findings, findings);
  assert.equal(ctx.lifts[0].name, 'Bench press');
  assert.ok(ctx.exercises.some((e) => e.name === 'Bench press' && e.flag === 'example flag'));
});

test('a realistic eight weeks stays small', () => {
  const d = data();
  const base = d.sessions[0];
  d.sessions = Array.from({ length: 24 }, (_, i) => ({
    ...base,
    id: id(100 + i),
    session_exercises: Array.from({ length: 7 }, (_, j) => ({ ...base.session_exercises[0], id: id(500 + i * 10 + j) })),
  }));
  const bytes = JSON.stringify(modelContext(d, [])).length;
  assert.ok(bytes < 30000, `context is ${bytes} bytes`);
});
