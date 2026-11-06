/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannedWeeklyVolume } from '../app/js/engine.js';

const rules = {
  volume: {
    min_weekly_sets: { default: 8, by_muscle: { chest: 10 } },
    indirect_factor: 0.5,
    count_over: 'calendar_week_at_observed_rate',
  },
  priority: ['chest', 'back', 'arms'],
};

const exercises = [
  { id: 'ex-1', name: 'Bench press', primary_muscle: 'chest', secondary_muscles: ['arms'] },
  { id: 'ex-2', name: 'Row', primary_muscle: 'back', secondary_muscles: ['arms'] },
];

const days = [
  { id: 'd-1', day_index: 0 },
  { id: 'd-2', day_index: 1 },
];

const slots = [
  { id: 's-1', day_id: 'd-1', position: 0, exercise_id: 'ex-1', sets: 4 },
  { id: 's-2', day_id: 'd-2', position: 0, exercise_id: 'ex-2', sets: 3 },
];

const rows = (over = {}) => plannedWeeklyVolume({
  days, slots, exercises, rules, perWeekRate: 2, ...over,
});

const find = (list, muscle) => list.find((r) => r.muscle === muscle);

test('direct sets count fully against the primary muscle', () => {
  // 4 chest sets per cycle over 2 days = 2 per session, at 2 sessions a week = 4
  assert.equal(find(rows(), 'chest').sets, 4);
});

test('indirect sets count at the rules factor', () => {
  // arms is secondary on both: (4 + 3) * 0.5 = 3.5 per cycle / 2 days * 2 = 3.5
  assert.equal(find(rows(), 'arms').sets, 3.5);
});

test('the projection scales with the observed training rate', () => {
  assert.equal(find(rows({ perWeekRate: 4 }), 'chest').sets, 8);
  assert.equal(find(rows({ perWeekRate: 1 }), 'chest').sets, 2);
});

test('with no observed rate yet, one full cycle a week is assumed', () => {
  const list = rows({ perWeekRate: null });
  assert.equal(find(list, 'chest').sets, 4, 'all 4 chest sets land in the week');
  assert.equal(list.assumedRate ?? undefined, undefined, 'the rows are a plain list');
});

test('the shortfall is measured against the per-muscle minimum', () => {
  const chest = find(rows(), 'chest');
  assert.equal(chest.target, 10);
  assert.equal(chest.shortBy, 6);
});

test('a muscle the block never trains is still reported as short', () => {
  const back = find(rows({ slots: [slots[0]] }), 'back');
  assert.equal(back.sets, 0);
  assert.equal(back.shortBy, 8);
});

test('rows come back in priority order', () => {
  assert.deepEqual(rows().map((r) => r.muscle), ['chest', 'back', 'arms']);
});

test('a block with no days returns an empty list rather than dividing by zero', () => {
  assert.deepEqual(plannedWeeklyVolume({ days: [], slots: [], exercises, rules, perWeekRate: 2 }), []);
});

test('no rules document returns an empty list', () => {
  assert.deepEqual(plannedWeeklyVolume({ days, slots, exercises, rules: null, perWeekRate: 2 }), []);
});

test('a slot pointing at an unknown exercise is skipped, not counted as zero', () => {
  const extra = [...slots, { id: 's-9', day_id: 'd-1', position: 1, exercise_id: 'nope', sets: 5 }];
  assert.equal(find(rows({ slots: extra }), 'chest').sets, 4);
});

test('an inline new exercise from a draft plan is counted', () => {
  const draftSlots = [...slots, {
    id: 's-3', day_id: 'd-1', position: 1, exercise_id: null, sets: 3,
    exercise: { name: 'Pec deck', primary_muscle: 'chest', secondary_muscles: [] },
  }];
  assert.equal(find(rows({ slots: draftSlots }), 'chest').sets, 7, '(4 + 3) / 2 * 2');
});
