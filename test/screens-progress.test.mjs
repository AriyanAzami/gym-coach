/* All numbers below are fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../app/js/store.js';
import { render } from '../app/js/screens-progress.js';
import rulesExample from '../supabase/seed/rules.example.json' with { type: 'json' };
import { isoWeekStart, ymd } from '../app/js/engine.js';

// The volume card shows the current week, so the fixture has to be this week.
const THIS_WEEK = isoWeekStart(ymd(new Date()));

const EXERCISES = [
  { id: 'ex-1', name: 'Bench press', primary_muscle: 'chest', secondary_muscles: ['arms'], equipment: 'barbell', load_mode: 'total', active: true },
  { id: 'ex-2', name: 'Dumbbell curl', primary_muscle: 'arms', secondary_muscles: [], equipment: 'dumbbell', load_mode: 'per_hand', active: true },
];

const HISTORY = [
  { session_id: 's1', date: '2026-09-07', exercise_id: 'ex-1', set_no: 1, weight: 175, unit: 'lb', reps: 8, partial: false },
  { session_id: 's1', date: '2026-09-07', exercise_id: 'ex-1', set_no: 2, weight: 175, unit: 'lb', reps: 7, partial: false },
  { session_id: 's2', date: '2026-10-05', exercise_id: 'ex-1', set_no: 1, weight: 185, unit: 'lb', reps: 8, partial: false },
  { session_id: 's3', date: '2026-10-30', exercise_id: 'ex-1', set_no: 1, weight: 190, unit: 'lb', reps: 5, partial: false },
];

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1' },
    loaded: true,
    online: true,
    pendingWrites: 0,
    rules: structuredClone(rulesExample),
    exercises: EXERCISES,
    liftState: [
      { exercise_id: 'ex-1', last_date: '2026-10-30', last_weight: 190, last_unit: 'lb' },
      { exercise_id: 'ex-2', last_date: null, last_weight: null, last_unit: null },
    ],
    liftHistory: { 'ex-1': HISTORY },
    weeklyVolume: [
      { week_start: THIS_WEEK, muscle: 'chest', total_sets: 6, direct_sets: 6, indirect_sets: 0 },
      { week_start: THIS_WEEK, muscle: 'back', total_sets: 10, direct_sets: 10, indirect_sets: 0 },
    ],
    bodyTrend: [
      { week_start: '2026-11-02', avg_weight: 70.4, unit: 'kg', entries: 1, rate_3w: 0.13 },
      { week_start: '2026-10-12', avg_weight: 70.0, unit: 'kg', entries: 1, rate_3w: null },
    ],
    trainingRate: { per_week_4w: 3 },
    ...over,
  });
}

beforeEach(() => reset());

test('an exercise picker lists the lifts with history', () => {
  const html = render({});
  assert.match(html, /<select[^>]*data-action="pick-lift"/);
  assert.match(html, /Bench press/);
});

test('the picker does not offer a lift that has never been logged', () => {
  assert.doesNotMatch(render({}), /<option[^>]*>Dumbbell curl/);
});

test('the lift chart is drawn for the picked exercise', () => {
  const html = render({ exerciseId: 'ex-1' });
  assert.match(html, /<svg/);
  assert.match(html, /175 lb/, 'the first point is labelled');
  assert.match(html, /190 lb/, 'the last point is labelled');
});

test('one point per session, not one per set', () => {
  const html = render({ exerciseId: 'ex-1' });
  // Scope to the lift figure: the body-weight chart further down has dots too.
  const figure = html.match(/<figure class="chart-fig">[\s\S]*?<\/figure>/)[0];
  assert.match(figure, /Bench press/, 'the first figure should be the lift chart');
  assert.equal([...figure.matchAll(/class="dot"/g)].length, 3, 'two sets on one day are one exposure');
});

test('weekly volume is drawn as bars against the minimum', () => {
  const html = render({});
  assert.match(html, /class="bar-fill/);
  assert.match(html, /short 4/, 'chest logged 6 against a minimum of 10');
});

test('the body weight trend is drawn with its rate', () => {
  const html = render({});
  assert.match(html, /70\.4/);
  assert.match(html, /0\.13/);
});

test('a table view of the volume numbers is available', () => {
  assert.match(render({}), /<table/);
});

test('no lift history at all says so instead of drawing an empty chart', () => {
  reset({ liftHistory: {}, liftState: [{ exercise_id: 'ex-2', last_date: null, last_weight: null }] });
  const html = render({});
  assert.match(html, /nothing logged/i);
});

test('no body metrics says so', () => {
  reset({ bodyTrend: [] });
  assert.match(render({}), /no weigh-ins/i);
});

test('a hostile exercise name cannot inject markup', () => {
  const nasty = structuredClone(EXERCISES);
  nasty[0].name = '<img src=x onerror=alert(1)>';
  reset({ exercises: nasty });
  const html = render({ exerciseId: 'ex-1' });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test('rendering never throws on an empty database', () => {
  reset({
    rules: null, exercises: [], liftState: [], liftHistory: {},
    weeklyVolume: [], bodyTrend: [], trainingRate: null,
  });
  assert.doesNotThrow(() => render({}));
});
