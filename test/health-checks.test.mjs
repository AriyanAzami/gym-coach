/* All values below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runChecks, repoFindings } from '../supabase/functions/health-check/checks.js';
import rulesExample from '../supabase/seed/rules.example.json' with { type: 'json' };

const schema = JSON.parse(readFileSync('app/schema/rules.schema.json', 'utf8'));
const TODAY = '2026-11-11';
const NOW = '2026-11-11T12:00:00Z';

const base = (over = {}) => ({
  today: TODAY,
  now: NOW,
  rules: structuredClone(rulesExample),
  schema,
  exercises: [{ id: 'ex-1', name: 'Bench press', equipment: 'barbell', active: true }],
  sessions: [],
  sessionExercises: [],
  sets: [],
  liftState: [],
  weeklyVolume: [],
  trainingRate: { last_session_date: '2026-11-10' },
  bodyTrend: [],
  bodyMetrics: [{ date: '2026-11-09', weight: 80, unit: 'kg' }],
  activeBlock: { id: 'b-1', starts_on: '2026-10-20' },
  jobs: [],
  ...over,
});

const codes = (findings) => findings.map((f) => f.code).sort();
const find = (findings, code) => findings.find((f) => f.code === code);

const fullVolume = (week) => ['back', 'chest', 'shoulders', 'legs', 'arms', 'core']
  .map((muscle) => ({ week_start: week, muscle, total_sets: 12 }));

test('a healthy picture produces no findings', () => {
  const findings = runChecks(base({ weeklyVolume: fullVolume('2026-11-02') }));
  assert.deepEqual(findings, []);
});

test('every finding has an area, a severity, a code, a title and a detail', () => {
  const findings = runChecks(base({ rules: null }));
  assert.ok(findings.length > 0);
  for (const f of findings) {
    assert.ok(['training', 'data', 'plumbing', 'repo'].includes(f.area), f.area);
    assert.ok(['warn', 'bad'].includes(f.severity), f.severity);
    for (const k of ['code', 'title', 'detail']) assert.equal(typeof f[k], 'string');
  }
});

test('a missing rules document is a plumbing problem and skips the training checks', () => {
  const findings = runChecks(base({ rules: null }));
  assert.equal(find(findings, 'rules_missing').severity, 'bad');
  assert.ok(findings.every((f) => f.area !== 'training'));
});

test('a rules document that fails the schema is reported', () => {
  const rules = structuredClone(rulesExample);
  delete rules.stall;
  const f = find(runChecks(base({ rules })), 'rules_invalid');
  assert.equal(f.area, 'plumbing');
  assert.equal(f.severity, 'bad');
});

test('no active block is a training warning', () => {
  const f = find(runChecks(base({ activeBlock: null, weeklyVolume: fullVolume('2026-11-02') })), 'no_active_block');
  assert.equal(f.severity, 'warn');
});

test('last complete week short of the minimum names the muscles', () => {
  const volume = fullVolume('2026-11-02').map((r) => (r.muscle === 'chest' ? { ...r, total_sets: 4 } : r));
  const f = find(runChecks(base({ weeklyVolume: volume })), 'volume_short');
  assert.equal(f.area, 'training');
  assert.match(f.detail, /chest 4\/10/);
  assert.doesNotMatch(f.detail, /back/);
});

test('the current, unfinished week does not count as short', () => {
  const volume = [...fullVolume('2026-11-02'), { week_start: '2026-11-09', muscle: 'chest', total_sets: 1 }];
  assert.equal(find(runChecks(base({ weeklyVolume: volume })), 'volume_short'), undefined);
});

test('stalls use the rules trigger and ignore inactive lifts', () => {
  const liftState = [
    { exercise_id: 'ex-1', name: 'Bench press', active: true, stall_count: 3 },
    { exercise_id: 'ex-2', name: 'Old curl', active: false, stall_count: 9 },
    { exercise_id: 'ex-3', name: 'Row', active: true, stall_count: 2 },
  ];
  const f = find(runChecks(base({ liftState, weeklyVolume: fullVolume('2026-11-02') })), 'stalled');
  assert.match(f.detail, /Bench press/);
  assert.doesNotMatch(f.detail, /Old curl|Row/);
});

test('enough stalled lifts make a deload due', () => {
  const liftState = ['A', 'B', 'C'].map((name, i) => ({ exercise_id: `x${i}`, name, active: true, stall_count: 3 }));
  const f = find(runChecks(base({ liftState, weeklyVolume: fullVolume('2026-11-02') })), 'deload_stalls');
  assert.equal(f.severity, 'bad');
});

test('a hard last session triggers the effort deload warning', () => {
  const sessions = [{ id: 's1', date: '2026-11-10', kind: 'training', status: 'done', effort_1_10: 10 }];
  const sets = [{ id: 't1', session_exercise_id: 'se1', done: true, reps: 5, weight: 100, unit: 'kg' }];
  const sessionExercises = [{ id: 'se1', session_id: 's1', exercise_id: 'ex-1' }];
  const f = find(runChecks(base({ sessions, sets, sessionExercises, weeklyVolume: fullVolume('2026-11-02') })), 'deload_effort');
  assert.equal(f.severity, 'warn');
});

test('a block older than the backstop asks for a deload', () => {
  const f = find(runChecks(base({ activeBlock: { id: 'b', starts_on: '2026-08-01' }, weeklyVolume: fullVolume('2026-11-02') })), 'deload_backstop');
  assert.equal(f.area, 'training');
});

test('a gap since the last session longer than the rules allow is flagged', () => {
  const f = find(runChecks(base({ trainingRate: { last_session_date: '2026-10-25' }, weeklyVolume: fullVolume('2026-11-02') })), 'rotation_gap');
  assert.match(f.detail, /17 days/);
});

test('a body-weight rate outside the gain band is flagged, in kg whatever the log unit', () => {
  const bodyTrend = [
    { week_start: '2026-11-09', rate_3w: null, unit: 'lb' },
    { week_start: '2026-11-02', rate_3w: 1.5, unit: 'lb' },
  ];
  const f = find(runChecks(base({ bodyTrend, weeklyVolume: fullVolume('2026-11-02') })), 'body_rate');
  assert.match(f.detail, /0\.68 kg\/week/);
  const inBand = [{ week_start: '2026-11-02', rate_3w: 0.4, unit: 'lb' }];
  assert.equal(find(runChecks(base({ bodyTrend: inBand, weeklyVolume: fullVolume('2026-11-02') })), 'body_rate'), undefined);
});

test('an overdue weigh-in follows the rules cadence', () => {
  const f = find(runChecks(base({ bodyMetrics: [{ date: '2026-10-30', weight: 80, unit: 'kg' }], weeklyVolume: fullVolume('2026-11-02') })), 'weigh_in_overdue');
  assert.equal(f.area, 'data');
  const none = find(runChecks(base({ bodyMetrics: [], weeklyVolume: fullVolume('2026-11-02') })), 'weigh_in_overdue');
  assert.match(none.detail, /No weigh-in/);
});

function logged(rows) {
  const sessions = [];
  const sessionExercises = [];
  const sets = [];
  rows.forEach(([date, weight, unit, reps], i) => {
    sessions.push({ id: `s${i}`, date, kind: 'training', status: 'done' });
    sessionExercises.push({ id: `se${i}`, session_id: `s${i}`, exercise_id: 'ex-1' });
    sets.push({ id: `t${i}`, session_exercise_id: `se${i}`, done: true, weight, unit, reps });
  });
  return { sessions, sessionExercises, sets };
}

test('a load that jumps by the lb/kg factor looks like a unit slip', () => {
  const data = logged([['2026-11-03', 100, 'kg', 5], ['2026-11-06', 100, 'lb', 5]]);
  const f = find(runChecks(base({ ...data, weeklyVolume: fullVolume('2026-11-02') })), 'unit_slip');
  assert.match(f.detail, /Bench press/);
  assert.match(f.detail, /2026-11-06/);
});

test('an ordinary load increase is not a unit slip', () => {
  const data = logged([['2026-11-03', 100, 'kg', 5], ['2026-11-06', 102.5, 'kg', 5]]);
  assert.equal(find(runChecks(base({ ...data, weeklyVolume: fullVolume('2026-11-02') })), 'unit_slip'), undefined);
});

test('a done set with no reps is flagged', () => {
  const data = logged([['2026-11-03', 100, 'kg', null]]);
  const f = find(runChecks(base({ ...data, weeklyVolume: fullVolume('2026-11-02') })), 'set_no_reps');
  assert.match(f.detail, /1 set/);
});

test('two trained sessions on one day are flagged', () => {
  const data = logged([['2026-11-03', 100, 'kg', 5], ['2026-11-03', 100, 'kg', 5]]);
  assert.ok(find(runChecks(base({ ...data, weeklyVolume: fullVolume('2026-11-02') })), 'duplicate_sessions'));
});

test('a past session still planned, and a done one with no sets, are flagged', () => {
  const sessions = [
    { id: 'p', date: '2026-11-05', kind: 'training', status: 'planned' },
    { id: 'today', date: TODAY, kind: 'training', status: 'planned' },
    { id: 'e', date: '2026-11-06', kind: 'training', status: 'done' },
    { id: 'r', date: '2026-11-07', kind: 'rest', status: 'done' },
  ];
  const findings = runChecks(base({ sessions, weeklyVolume: fullVolume('2026-11-02') }));
  assert.match(find(findings, 'stale_planned').detail, /2026-11-05/);
  assert.doesNotMatch(find(findings, 'stale_planned').detail, new RegExp(TODAY));
  assert.match(find(findings, 'empty_session').detail, /2026-11-06/);
  assert.doesNotMatch(find(findings, 'empty_session').detail, /2026-11-07/);
});

test('a job queued longer than a run can take is stuck', () => {
  const jobs = [
    { id: 'j1', kind: 'ask', status: 'running', created_at: '2026-11-11T10:00:00Z' },
    { id: 'j2', kind: 'ask', status: 'queued', created_at: '2026-11-11T11:55:00Z' },
  ];
  const f = find(runChecks(base({ jobs, weeklyVolume: fullVolume('2026-11-02') })), 'job_stuck');
  assert.equal(f.severity, 'bad');
  assert.match(f.detail, /1 job/);
});

test('recent failed jobs are counted with the latest reason', () => {
  const jobs = [
    { id: 'j1', kind: 'block', status: 'failed', error: 'old reason', created_at: '2026-11-08T10:00:00Z' },
    { id: 'j2', kind: 'ask', status: 'failed', error: 'new <reason>', created_at: '2026-11-10T10:00:00Z' },
    { id: 'j3', kind: 'ask', status: 'failed', error: 'ancient', created_at: '2026-10-01T10:00:00Z' },
  ];
  const f = find(runChecks(base({ jobs, weeklyVolume: fullVolume('2026-11-02') })), 'jobs_failed');
  assert.match(f.detail, /2 failed/);
  assert.match(f.detail, /new <reason>/);
});

test('repo findings: a failing test run is bad, failing coach runs warn, unreadable is a warning', () => {
  assert.deepEqual(codes(repoFindings({ test: { conclusion: 'success' }, coach: [] })), []);
  assert.deepEqual(codes(repoFindings({ test: { conclusion: 'failure', html_url: 'u' }, coach: [] })), ['tests_failing']);
  const coach = [{ conclusion: 'failure' }, { conclusion: 'success' }, { conclusion: 'failure' }];
  assert.equal(find(repoFindings({ test: null, coach }), 'coach_runs_failing').severity, 'warn');
  assert.equal(find(repoFindings({ error: 'GitHub returned 403' }), 'repo_unreadable').area, 'repo');
});
