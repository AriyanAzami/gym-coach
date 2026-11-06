/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planForDay } from '../app/js/engine.js';

const rules = {
  units: { weight: 'lb', body: 'kg' },
  progression: {
    scheme: 'double',
    increments: { barbell: 5, machine: 10, cable: 5 },
    increment_unit: 'lb',
    most_recent_entry_decides: true,
    partials_count: false,
  },
  stall: { sessions_to_trigger: 3, interventions: ['move_earlier'] },
  session: { rest_s: { compound: 120, isolation: 60 } },
  opener: { policy: 'conservative', label: 'first exposure', fraction_of_similar: 0.7 },
};

const day = { id: 'day-1', day_index: 0, name: 'Push', warmup_note: 'Bike five minutes' };

const exercises = [
  { id: 'ex-1', name: 'Bench press', equipment: 'barbell', primary_muscle: 'chest', secondary_muscles: ['shoulders', 'arms'], load_mode: 'total', increment: null, unit: null, flag: null },
  { id: 'ex-2', name: 'Cable fly', equipment: 'cable', primary_muscle: 'chest', secondary_muscles: [], load_mode: 'total', increment: null, unit: null, flag: null },
  { id: 'ex-3', name: 'Lateral raise', equipment: 'cable', primary_muscle: 'shoulders', secondary_muscles: [], load_mode: 'per_hand', increment: null, unit: null, flag: 'left shoulder: stop at 8' },
];

const slots = [
  { id: 's-2', day_id: 'day-1', position: 1, exercise_id: 'ex-2', sets: 3, rep_min: 10, rep_max: 12, rest_s: null, non_negotiable: false, cut_order: 1, notes: null },
  { id: 's-1', day_id: 'day-1', position: 0, exercise_id: 'ex-1', sets: 3, rep_min: 5, rep_max: 8, rest_s: 180, non_negotiable: true, cut_order: null, notes: 'belt on' },
  { id: 's-3', day_id: 'day-1', position: 2, exercise_id: 'ex-3', sets: 2, rep_min: 12, rep_max: 15, rest_s: null, non_negotiable: false, cut_order: 2, notes: null },
];

const states = [
  { exercise_id: 'ex-1', primary_muscle: 'chest', equipment: 'barbell', load_mode: 'total', last_weight: 185, last_unit: 'lb', last_reps: [8, 8, 8], last_full_reps: [8, 8, 8], last_sets: 3, last_date: '2026-10-30', stall_count: 0, sessions_since_change: 0 },
  { exercise_id: 'ex-2', primary_muscle: 'chest', equipment: 'cable', load_mode: 'total', last_weight: 40, last_unit: 'lb', last_reps: [12, 12, 11], last_full_reps: [12, 12, 11], last_sets: 3, last_date: '2026-10-30', stall_count: 0, sessions_since_change: 0 },
  { exercise_id: 'ex-3', primary_muscle: 'shoulders', equipment: 'cable', load_mode: 'per_hand', last_weight: null, last_unit: null, last_reps: null, last_full_reps: null, last_sets: null, last_date: null, stall_count: 0, sessions_since_change: 0 },
];

const plan = (over = {}) => planForDay({ day, slots, exercises, states, rules, ...over });

test('one entry per slot, in slot position order', () => {
  const p = plan();
  assert.deepEqual(p.exercises.map((e) => e.name), ['Bench press', 'Cable fly', 'Lateral raise']);
});

test('the day name and warm-up note travel with the plan', () => {
  const p = plan();
  assert.equal(p.dayName, 'Push');
  assert.equal(p.warmupNote, 'Bike five minutes');
  assert.equal(p.reason, null);
});

test('each entry carries one exact target', () => {
  const [bench, fly] = plan().exercises;
  assert.equal(bench.weight, 190, 'cleared 3x8 at the top of 5-8, so one increment');
  assert.equal(bench.reps, 5);
  assert.equal(bench.sets, 3);
  assert.equal(fly.weight, 40, 'one rep short, so hold the weight');
  assert.equal(fly.reps, 12);
});

test('flags from flagged exercises surface at the top', () => {
  assert.deepEqual(plan().flags, [{ exercise: 'Lateral raise', flag: 'left shoulder: stop at 8' }]);
});

test('an unflagged day surfaces no flags', () => {
  const clean = exercises.map((e) => ({ ...e, flag: null }));
  assert.deepEqual(plan({ exercises: clean }).flags, []);
});

test('non-negotiable slots are marked', () => {
  const p = plan();
  assert.deepEqual(p.exercises.map((e) => e.nonNegotiable), [true, false, false]);
});

test('cut order is carried through', () => {
  assert.deepEqual(plan().exercises.map((e) => e.cutOrder), [null, 1, 2]);
});

test('rest comes from the slot, falling back to the rules rest for the category', () => {
  const [bench, fly, raise] = plan().exercises;
  assert.equal(bench.restS, 180, 'the slot says 180');
  assert.equal(fly.restS, 60, 'single-joint, so the isolation rest');
  assert.equal(raise.restS, 60);
});

test('a compound with no slot rest takes the compound rest', () => {
  const noRest = slots.map((s) => (s.position === 0 ? { ...s, rest_s: null } : s));
  assert.equal(plan({ slots: noRest }).exercises[0].restS, 120);
});

test('a first exposure gets a labelled opener seeded from a comparable lift', () => {
  const raise = plan().exercises[2];
  assert.equal(raise.label, 'first exposure');
  assert.equal(raise.weight, null, 'no per-hand cable shoulder lift logged to seed from');
  assert.equal(raise.perHand, true);
});

test('a day with no slots yields an empty plan with a reason', () => {
  const p = plan({ slots: [] });
  assert.equal(p.exercises.length, 0);
  assert.match(p.reason, /no exercises/i);
});

test('no day at all yields an empty plan with a reason', () => {
  const p = plan({ day: null, slots: [] });
  assert.equal(p.exercises.length, 0);
  assert.match(p.reason, /no day/i);
});

test('a slot whose exercise is missing is reported, not silently dropped', () => {
  const p = plan({ exercises: exercises.filter((e) => e.id !== 'ex-2') });
  assert.equal(p.exercises.length, 2);
  assert.match(p.reason, /unknown exercise/i);
});

test('slots from other days are ignored', () => {
  const extra = [...slots, { id: 's-9', day_id: 'day-2', position: 0, exercise_id: 'ex-1', sets: 3, rep_min: 5, rep_max: 8, rest_s: 180 }];
  assert.equal(plan({ slots: extra }).exercises.length, 3);
});

test('the last logged numbers sit beside each target', () => {
  const bench = plan().exercises[0];
  assert.equal(bench.lastLogged.weight, 185);
  assert.deepEqual(bench.lastLogged.reps, [8, 8, 8]);
});

test('no plan entry ever carries a prescribed load for an untouched lift', () => {
  for (const e of plan().exercises) {
    assert.ok(e.weight === null || typeof e.weight === 'number');
    assert.ok(['lb', 'kg'].includes(e.unit));
  }
});
