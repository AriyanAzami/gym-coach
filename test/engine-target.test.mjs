/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTarget } from '../app/js/engine.js';

const rules = {
  units: { weight: 'lb', body: 'kg' },
  progression: {
    scheme: 'double',
    increments: { barbell: 5, dumbbell: 5, machine: 10, cable: 5 },
    increment_unit: 'lb',
    most_recent_entry_decides: true,
    partials_count: false,
  },
  stall: {
    sessions_to_trigger: 3,
    interventions: ['move_earlier', 'lengthen_rest', 'add_set', 'change_variation'],
  },
  session: { rest_s: { compound: 120, isolation: 60 } },
  opener: { policy: 'conservative', label: 'first exposure', fraction_of_similar: 0.7 },
};

const slot = { position: 0, sets: 3, rep_min: 8, rep_max: 10, rest_s: 120 };
const press = {
  id: 'ex-press', name: 'Chest press', equipment: 'machine',
  increment: null, unit: null, load_mode: 'total', primary_muscle: 'chest',
};

const exposure = (weight, fullReps, extra = {}) => ({
  exercise_id: press.id,
  last_weight: weight,
  last_unit: 'lb',
  last_reps: fullReps,
  last_full_reps: fullReps,
  last_sets: fullReps.length,
  last_date: '2026-10-28',
  sessions_since_change: 0,
  stall_count: 0,
  ...extra,
});

const target = (opts) => nextTarget({ slot, exercise: press, similar: [], rules, ...opts });

test('clearing the top of the range adds one increment and drops to rep_min', () => {
  const t = target({ state: exposure(100, [10, 10, 10]) });
  assert.equal(t.weight, 110);
  assert.equal(t.unit, 'lb');
  assert.equal(t.reps, 8);
  assert.equal(t.sets, 3);
});

test('inside the range keeps the weight and aims one rep higher', () => {
  const t = target({ state: exposure(100, [8, 8, 8]) });
  assert.equal(t.weight, 100);
  assert.equal(t.reps, 9);
});

test('one rep short on a single set does not progress', () => {
  const t = target({ state: exposure(100, [10, 10, 9]) });
  assert.equal(t.weight, 100);
  assert.equal(t.reps, 10);
});

test('partial reps do not count toward clearing the range', () => {
  const state = exposure(100, [10, 10]);
  state.last_reps = [10, 10, 10];
  const t = target({ state });
  assert.equal(t.weight, 100, 'a partial third set must not earn an increment');
  assert.equal(t.reps, 10);
});

test('partials count when the rules say they do', () => {
  const state = exposure(100, [10, 10]);
  state.last_reps = [10, 10, 10];
  const loose = structuredClone(rules);
  loose.progression.partials_count = true;
  const t = nextTarget({ slot, exercise: press, state, similar: [], rules: loose });
  assert.equal(t.weight, 110);
  assert.equal(t.reps, 8);
});

test('fewer logged sets than the slot asks for does not progress', () => {
  const t = target({ state: exposure(100, [10, 10]) });
  assert.equal(t.weight, 100);
});

test('an exposure of only partial sets keeps the weight and opens at rep_min', () => {
  const state = exposure(100, []);
  state.last_reps = [9, 9, 9];
  const t = target({ state });
  assert.equal(t.weight, 100);
  assert.equal(t.reps, 8);
});

test('a stall at the trigger carries the first intervention', () => {
  const t = target({ state: exposure(100, [8, 8, 8], { stall_count: 3 }) });
  assert.equal(t.label, 'move_earlier');
});

test('a longer stall carries the next intervention in order', () => {
  const t = target({ state: exposure(100, [8, 8, 8], { stall_count: 4 }) });
  assert.equal(t.label, 'lengthen_rest');
});

test('a stall past the last intervention stays on the last one', () => {
  const t = target({ state: exposure(100, [8, 8, 8], { stall_count: 99 }) });
  assert.equal(t.label, 'change_variation');
});

test('a stall below the trigger carries no label', () => {
  const t = target({ state: exposure(100, [8, 8, 8], { stall_count: 2 }) });
  assert.equal(t.label, null);
});

test('no history yields a labelled conservative opener from a similar lift', () => {
  const similar = [{
    exercise_id: 'ex-other', primary_muscle: 'chest', equipment: 'machine',
    load_mode: 'total', last_weight: 100, last_unit: 'lb', last_date: '2026-10-20',
  }];
  const t = nextTarget({ slot, exercise: press, state: null, similar, rules });
  assert.equal(t.weight, 70);
  assert.equal(t.unit, 'lb');
  assert.equal(t.reps, 8);
  assert.equal(t.label, 'first exposure');
});

test('the opener uses the most recent similar lift', () => {
  const similar = [
    { exercise_id: 'a', primary_muscle: 'chest', equipment: 'machine', load_mode: 'total', last_weight: 200, last_unit: 'lb', last_date: '2026-09-01' },
    { exercise_id: 'b', primary_muscle: 'chest', equipment: 'machine', load_mode: 'total', last_weight: 100, last_unit: 'lb', last_date: '2026-10-20' },
  ];
  const t = nextTarget({ slot, exercise: press, state: null, similar, rules });
  assert.equal(t.weight, 70);
});

test('the opener ignores a different muscle or different equipment', () => {
  const similar = [
    { exercise_id: 'a', primary_muscle: 'back', equipment: 'machine', load_mode: 'total', last_weight: 100, last_unit: 'lb', last_date: '2026-10-20' },
    { exercise_id: 'b', primary_muscle: 'chest', equipment: 'barbell', load_mode: 'total', last_weight: 100, last_unit: 'lb', last_date: '2026-10-21' },
  ];
  const t = nextTarget({ slot, exercise: press, state: null, similar, rules });
  assert.equal(t.weight, null);
  assert.equal(t.label, 'first exposure');
});

test('a per-hand exposure is never compared with a total-load exposure', () => {
  const dumbbell = { ...press, id: 'ex-db', equipment: 'dumbbell', load_mode: 'per_hand' };
  const similar = [{
    exercise_id: 'a', primary_muscle: 'chest', equipment: 'dumbbell',
    load_mode: 'total', last_weight: 100, last_unit: 'lb', last_date: '2026-10-20',
  }];
  const t = nextTarget({ slot, exercise: dumbbell, state: null, similar, rules });
  assert.equal(t.weight, null, 'a total-load lift must not seed a per-hand opener');
});

test('no history and nothing similar yields no weight, still labelled', () => {
  const t = nextTarget({ slot, exercise: press, state: null, similar: [], rules });
  assert.equal(t.weight, null);
  assert.equal(t.unit, 'lb');
  assert.equal(t.label, 'first exposure');
});

test('a lift_state row with no logged history is treated as no history', () => {
  const empty = {
    exercise_id: press.id, last_weight: null, last_unit: null, last_reps: null,
    last_full_reps: null, last_date: null, stall_count: 0, sessions_since_change: 0,
  };
  const t = target({ state: empty });
  assert.equal(t.label, 'first exposure');
  assert.equal(t.weight, null);
});

test('a per-hand target reports itself as per hand', () => {
  const dumbbell = { ...press, id: 'ex-db', equipment: 'dumbbell', load_mode: 'per_hand' };
  const state = { ...exposure(30, [10, 10, 10]), exercise_id: dumbbell.id };
  const t = nextTarget({ slot, exercise: dumbbell, state, similar: [], rules });
  assert.equal(t.perHand, true);
  assert.equal(t.weight, 35, 'the increment applies to the per-hand load');
});

test('a total-load target reports perHand false', () => {
  assert.equal(target({ state: exposure(100, [10, 10, 10]) }).perHand, false);
});

test('reps never exceed rep_max', () => {
  const t = target({ state: exposure(100, [10, 10, 9]) });
  assert.ok(t.reps <= slot.rep_max);
});

test('a cleared bodyweight exposure holds at the top of the range', () => {
  const bw = { ...press, id: 'ex-bw', equipment: 'bodyweight', load_mode: 'total' };
  const state = { ...exposure(null, [10, 10, 10]), exercise_id: bw.id, last_unit: 'lb' };
  const t = nextTarget({ slot, exercise: bw, state, similar: [], rules });
  assert.equal(t.weight, null);
  assert.equal(t.reps, 10, 'with no load to add, do not drop back to rep_min');
});

test('the last logged numbers travel with the target', () => {
  const t = target({ state: exposure(100, [10, 10, 10]) });
  assert.deepEqual(t.lastLogged, {
    weight: 100, unit: 'lb', reps: [10, 10, 10], date: '2026-10-28', sets: 3,
  });
});

test('no history reports no last logged numbers', () => {
  assert.equal(nextTarget({ slot, exercise: press, state: null, similar: [], rules }).lastLogged, null);
});

test('the slot rest and flags travel with the target', () => {
  const flagged = { ...press, flag: 'shoulder: stop at 8' };
  const t = nextTarget({
    slot: { ...slot, non_negotiable: true, cut_order: 2, notes: 'slow eccentric' },
    exercise: flagged, state: exposure(100, [8, 8, 8]), similar: [], rules,
  });
  assert.equal(t.restS, 120);
  assert.equal(t.nonNegotiable, true);
  assert.equal(t.cutOrder, 2);
  assert.equal(t.notes, 'slow eccentric');
  assert.equal(t.flag, 'shoulder: stop at 8');
});
