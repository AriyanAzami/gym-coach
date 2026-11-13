/* All numbers below are fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../app/js/store.js';
import { render, deloadInstructions } from '../app/js/screens-today.js';
import rulesExample from '../supabase/seed/rules.example.json' with { type: 'json' };
import { ymd } from '../app/js/engine.js';

const EXERCISES = [
  { id: 'ex-1', name: 'Bench press', equipment: 'barbell', primary_muscle: 'chest', secondary_muscles: ['shoulders'], load_mode: 'total', increment: null, unit: null, flag: null, active: true },
  { id: 'ex-2', name: 'Cable fly', equipment: 'cable', primary_muscle: 'chest', secondary_muscles: [], load_mode: 'total', increment: null, unit: null, flag: 'left shoulder: stop at 8', active: true },
];

const DAYS = [{ id: 'day-1', block_id: 'bl-1', day_index: 0, name: 'Push', warmup_note: 'Bike five minutes' }];

const SLOTS = [
  { id: 's-1', day_id: 'day-1', position: 0, exercise_id: 'ex-1', sets: 3, rep_min: 5, rep_max: 8, rest_s: 180, non_negotiable: true, cut_order: null, notes: null },
  { id: 's-2', day_id: 'day-1', position: 1, exercise_id: 'ex-2', sets: 3, rep_min: 10, rep_max: 12, rest_s: 60, non_negotiable: false, cut_order: 1, notes: null },
];

const LIFT_STATE = [
  { exercise_id: 'ex-1', primary_muscle: 'chest', equipment: 'barbell', load_mode: 'total', last_weight: 185, last_unit: 'lb', last_reps: [8, 8, 8], last_full_reps: [8, 8, 8], last_sets: 3, last_date: '2026-10-30', stall_count: 0, sessions_since_change: 0 },
  { exercise_id: 'ex-2', primary_muscle: 'chest', equipment: 'cable', load_mode: 'total', last_weight: 40, last_unit: 'lb', last_reps: [12, 12, 11], last_full_reps: [12, 12, 11], last_sets: 3, last_date: '2026-10-30', stall_count: 0, sessions_since_change: 0 },
];

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1' },
    loaded: true,
    online: true,
    pendingWrites: 0,
    rules: structuredClone(rulesExample),
    activeBlock: { id: 'bl-1', name: 'Autumn block', status: 'active' },
    blocks: [{ id: 'bl-1', name: 'Autumn block', status: 'active' }],
    days: DAYS,
    slots: SLOTS,
    exercises: EXERCISES,
    liftState: LIFT_STATE,
    rotation: { block_id: 'bl-1', day_index: 0, day_id: 'day-1', day_name: 'Push', warmup_note: 'Bike five minutes', reason: 'first day of the block' },
    weeklyVolume: [{ week_start: '2026-11-02', muscle: 'chest', total_sets: 6, direct_sets: 6, indirect_sets: 0 }],
    trainingRate: { per_week_4w: 3, per_week_8w: 3 },
    bodyTrend: [],
    bodyMetrics: [{ date: '2026-11-01', weight: 70, unit: 'kg' }],
    sessions: [],
    jobs: [],
    notes: [],
    ...over,
  });
}

beforeEach(() => reset());

test('the day name and warm-up note are shown', () => {
  const html = render();
  assert.match(html, /Push/);
  assert.match(html, /Bike five minutes/);
});

test('one row per slot, each with an exact target', () => {
  const html = render();
  assert.match(html, /Bench press/);
  assert.match(html, /Cable fly/);
  assert.match(html, /3 &times; 5/, 'cleared the range, so three sets at the bottom');
  assert.match(html, /190 lb/, '185 plus one barbell increment');
  assert.match(html, /40 lb/, 'one rep short, so the weight holds');
});

test('the last logged numbers sit beside each target', () => {
  assert.match(render(), /185 lb/);
});

test('rest is shown per exercise', () => {
  const html = render();
  assert.match(html, /3 min/);
  assert.match(html, /60s/);
});

test('flags are surfaced at the top of the card', () => {
  const html = render();
  const flagAt = html.indexOf('left shoulder: stop at 8');
  const firstRow = html.indexOf('Bench press');
  assert.ok(flagAt > -1, 'the flag text is missing');
  assert.ok(flagAt < firstRow, 'the flag must come before the exercise rows');
});

test('non-negotiable slots are named as such', () => {
  assert.match(render(), /non-negotiable/i);
});

test('the cut order is shown', () => {
  assert.match(render(), /cut 1/i);
});

test('a start button offers to begin the session', () => {
  assert.match(render(), /data-action="start-session"/);
});

test('the weekly volume shortfall is summarised', () => {
  const html = render();
  assert.match(html, /chest/i);
  assert.match(html, /short/i, 'chest logged 6 against a minimum of 10');
});

test('the last body weight is shown with its unit', () => {
  const html = render();
  assert.match(html, /70 kg/);
  assert.match(html, /data-action="log-weight"/);
});

test('no active block explains itself and offers the fix', () => {
  reset({ activeBlock: null, blocks: [], days: [], slots: [], rotation: null });
  const html = render();
  assert.match(html, /no active block/i);
  assert.match(html, /data-action="go-tab" data-tab="block"/);
});

test('no rules document explains itself and offers the fix', () => {
  reset({ rules: null });
  const html = render();
  assert.match(html, /rules/i);
  assert.match(html, /data-tab="settings"/);
});

test('a block with no days says so rather than showing an empty plan', () => {
  reset({ days: [], slots: [], rotation: { block_id: 'bl-1', day_index: null, day_id: null, reason: 'block has no days' } });
  assert.match(render(), /no days/i);
});

test('a day with no slots says so', () => {
  reset({ slots: [] });
  assert.match(render(), /no exercises/i);
});

test('an unresolvable rotation falls back to the first day', () => {
  reset({ rotation: null });
  const html = render();
  assert.match(html, /Push/, 'with days present, fall back to day 0 rather than showing nothing');
});

test('a session already logged today offers to resume instead of starting again', () => {
  // ymd(), not toISOString(): the screen matches on the LOCAL calendar date, and
  // east of UTC after ~20:30 those are different days. Using the UTC date here
  // made this test fail at night — the exact bug ymd() exists to prevent.
  reset({ sessions: [{ id: 'se-1', date: ymd(new Date()), status: 'planned', kind: 'training', block_id: 'bl-1', day_index: 0 }] });
  const html = render();
  assert.match(html, /data-action="resume-session"/);
  assert.doesNotMatch(html, /data-action="start-session"/);
});

test('a hostile exercise name cannot inject markup', () => {
  const nasty = structuredClone(EXERCISES);
  nasty[0].name = '<img src=x onerror=alert(1)>';
  reset({ exercises: nasty });
  const html = render();
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test('rendering never throws on a completely empty database', () => {
  reset({
    rules: null, activeBlock: null, blocks: [], days: [], slots: [], exercises: [],
    liftState: [], rotation: null, weeklyVolume: [], trainingRate: null,
    bodyTrend: [], bodyMetrics: [], sessions: [],
  });
  assert.doesNotThrow(() => render());
});

test('a workout left unfinished on an earlier day is called out above the plan', () => {
  reset({ sessions: [
    { id: 'old-1', date: '2026-01-02', kind: 'training', status: 'planned' },
    { id: 'old-2', date: '2026-01-05', kind: 'training', status: 'planned' },
    { id: 'done-1', date: '2026-01-06', kind: 'training', status: 'done' },
  ] });
  const html = render();
  assert.match(html, /Unfinished workout/);
  assert.match(html, /data-action="finish-unfinished" data-id="old-2"/, 'the most recent one is offered');
  assert.ok(html.indexOf('Unfinished workout') < html.indexOf('Next up'));
});

test('no unfinished banner when every earlier session was finished', () => {
  reset({ sessions: [{ id: 'done-1', date: '2026-01-06', kind: 'training', status: 'done' }] });
  assert.doesNotMatch(render(), /Unfinished workout/);
});

test('today\'s own open session is not called unfinished', () => {
  reset({ sessions: [{ id: 'now', date: ymd(new Date()), kind: 'training', status: 'planned' }] });
  assert.doesNotMatch(render(), /Unfinished workout/);
});

const STALLED = ['ex-1', 'ex-2', 'ex-3'].map((id, i) => ({ ...LIFT_STATE[0], exercise_id: id, name: `Lift ${i}`, stall_count: 4 }));
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const deloadJob = (over = {}) => ({
  id: 'j-1', kind: 'block', status: 'done', created_at: daysAgo(2),
  instructions: '[model=opus effort=high]\nDeload week: write one.', ...over,
});

test('a deload banner shows above the plan with one line per reason', () => {
  reset({
    liftState: STALLED,
    sessions: [{ id: 'h1', date: ymd(new Date()), kind: 'training', status: 'done', effort_1_10: 10 }],
  });
  const html = render();
  assert.match(html, /Deload due/);
  assert.match(html, /3 lifts stalled/);
  assert.match(html, /Effort 10\/10/);
  assert.match(html, /data-action="ask-deload"/);
  assert.ok(html.indexOf('Deload due') < html.indexOf('Next up'));
});

test('no deload banner when nothing is due', () => {
  assert.doesNotMatch(render(), /Deload due|ask-deload/);
});

test('a recent, non-failed deload job hides the banner', () => {
  for (const status of ['queued', 'running', 'done']) {
    reset({ liftState: STALLED, jobs: [deloadJob({ status })] });
    assert.doesNotMatch(render(), /ask-deload/, status);
  }
});

test('a failed or week-old deload job does not hide the banner', () => {
  reset({ liftState: STALLED, jobs: [deloadJob({ status: 'failed' })] });
  assert.match(render(), /ask-deload/);
  reset({ liftState: STALLED, jobs: [deloadJob({ created_at: daysAgo(8) })] });
  assert.match(render(), /ask-deload/);
  reset({ liftState: STALLED, jobs: [deloadJob({ instructions: 'something else' })] });
  assert.match(render(), /ask-deload/);
});

test('the banner stays hidden while the active block is a deload', () => {
  reset({ liftState: STALLED, activeBlock: { id: 'bl-1', name: 'Autumn DELOAD week', status: 'active' } });
  assert.doesNotMatch(render(), /ask-deload/);
});

test('the backstop reason uses the block start date', () => {
  reset({ activeBlock: { id: 'bl-1', name: 'Autumn block', status: 'active', starts_on: '2000-01-03' } });
  assert.match(render(), /weeks ago; the rules backstop/);
});

test('deload reasons are HTML-escaped', () => {
  reset({ sessions: [{ id: 'h1', date: '<img src=x onerror=alert(1)>', kind: 'training', status: 'done', effort_1_10: 10 }] });
  const html = render();
  assert.match(html, /ask-deload/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test('the deload job instructions carry the marker, the factor and the reasons', () => {
  const text = deloadInstructions([{ code: 'stalls', text: '3 lifts stalled.' }], rulesExample);
  assert.match(text, /^\[model=opus effort=high\]\nDeload week:/);
  assert.match(text, new RegExp(`${rulesExample.deload.set_factor}`));
  assert.match(text, /3 lifts stalled\./);
});
