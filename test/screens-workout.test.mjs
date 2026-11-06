/* All numbers below are fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../app/js/store.js';
import { render, statusFor, finishSheet } from '../app/js/screens-workout.js';
import rulesExample from '../supabase/seed/rules.example.json' with { type: 'json' };

const EXERCISES = [
  { id: 'ex-1', name: 'Bench press', equipment: 'barbell', primary_muscle: 'chest', secondary_muscles: ['shoulders'], load_mode: 'total' },
  { id: 'ex-2', name: 'Dumbbell curl', equipment: 'dumbbell', primary_muscle: 'arms', secondary_muscles: [], load_mode: 'per_hand' },
];

const SLOTS = [
  { id: 's-1', day_id: 'day-1', position: 0, exercise_id: 'ex-1', sets: 3, rep_min: 5, rep_max: 8, rest_s: 180 },
  { id: 's-2', day_id: 'day-1', position: 1, exercise_id: 'ex-2', sets: 3, rep_min: 10, rep_max: 12, rest_s: 60 },
];

const SESSION = { id: 'se-1', date: '2026-11-06', kind: 'training', status: 'planned', block_id: 'bl-1', day_index: 0, pain: 'none' };

const SESSION_EXERCISES = [
  { id: 'sx-1', session_id: 'se-1', slot_id: 's-1', exercise_id: 'ex-1', position: 0, target_weight: 190, target_unit: 'lb', target_reps: 5, target_sets: 3 },
  { id: 'sx-2', session_id: 'se-1', slot_id: 's-2', exercise_id: 'ex-2', position: 1, target_weight: 30, target_unit: 'lb', target_reps: 10, target_sets: 3 },
];

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1' },
    loaded: true,
    online: true,
    pendingWrites: 0,
    rules: structuredClone(rulesExample),
    activeBlock: { id: 'bl-1', status: 'active' },
    days: [{ id: 'day-1', block_id: 'bl-1', day_index: 0, name: 'Push' }],
    slots: SLOTS,
    exercises: EXERCISES,
    sessions: [SESSION],
    sessionDetail: {
      session: SESSION,
      exercises: structuredClone(SESSION_EXERCISES),
      sets: [],
    },
    ...over,
  });
}

beforeEach(() => reset());

test('no session selected points back to Today', () => {
  reset({ sessionDetail: null });
  const html = render({});
  assert.match(html, /data-action="go-tab" data-tab="today"/);
  assert.match(html, /no session/i);
});

test('each exercise shows its frozen target', () => {
  const html = render({ sessionId: 'se-1' });
  assert.match(html, /Bench press/);
  assert.match(html, /3 &times; 5/);
  assert.match(html, /190 lb/);
});

test('a per-hand target says so', () => {
  assert.match(render({ sessionId: 'se-1' }), /30 lb\/hand/);
});

test('done as prescribed is offered for the whole session', () => {
  assert.match(render({ sessionId: 'se-1' }), /data-action="done-all"/);
});

test('done as prescribed is offered per exercise', () => {
  assert.match(render({ sessionId: 'se-1' }), /data-action="done-exercise" data-id="sx-1"/);
});

test('each exercise opens its own set editor', () => {
  assert.match(render({ sessionId: 'se-1' }), /data-action="edit-sets" data-id="sx-1"/);
});

test('logged sets are shown with their actual numbers', () => {
  reset({
    sessionDetail: {
      session: SESSION,
      exercises: structuredClone(SESSION_EXERCISES),
      sets: [
        { id: 'st-1', session_exercise_id: 'sx-1', set_no: 1, weight: 190, unit: 'lb', reps: 5, partial: false, done: true },
        { id: 'st-2', session_exercise_id: 'sx-1', set_no: 2, weight: 190, unit: 'lb', reps: 4, partial: true, done: true },
      ],
    },
  });
  const html = render({ sessionId: 'se-1' });
  assert.match(html, /190 lb × 5/);
  assert.match(html, /190 lb × 4/);
  assert.match(html, /partial/i);
});

test('an exercise with every set logged is marked done', () => {
  reset({
    sessionDetail: {
      session: SESSION,
      exercises: structuredClone(SESSION_EXERCISES),
      sets: [1, 2, 3].map((n) => ({ id: `st-${n}`, session_exercise_id: 'sx-1', set_no: n, weight: 190, unit: 'lb', reps: 5, partial: false, done: true })),
    },
  });
  assert.match(render({ sessionId: 'se-1' }), /3 of 3/);
});

test('a finish button is offered', () => {
  assert.match(render({ sessionId: 'se-1' }), /data-action="finish-session"/);
});

test('a session with no exercises says so', () => {
  reset({ sessionDetail: { session: SESSION, exercises: [], sets: [] } });
  assert.match(render({ sessionId: 'se-1' }), /nothing to log/i);
});

test('a hostile exercise name cannot inject markup', () => {
  const nasty = structuredClone(EXERCISES);
  nasty[0].name = '<script>alert(1)</script>';
  reset({ exercises: nasty });
  const html = render({ sessionId: 'se-1' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

// ---- status on finish ----

const logged = (positions) => positions.map((p, i) => ({
  id: `st-${i}`,
  session_exercise_id: SESSION_EXERCISES[p].id,
  set_no: 1, weight: 100, unit: 'lb', reps: 8, partial: false, done: true,
}));

test('every slot logged finishes the session as done', () => {
  const detail = { session: SESSION, exercises: SESSION_EXERCISES, sets: logged([0, 1]) };
  assert.equal(statusFor(detail, SLOTS, state.rules), 'done');
});

test('skipping the first slot finishes as partial however much else was logged', () => {
  const detail = { session: SESSION, exercises: SESSION_EXERCISES, sets: logged([1]) };
  assert.equal(statusFor(detail, SLOTS, state.rules), 'partial');
});

test('logging nothing finishes as skipped', () => {
  const detail = { session: SESSION, exercises: SESSION_EXERCISES, sets: [] };
  assert.equal(statusFor(detail, SLOTS, state.rules), 'skipped');
});

test('a session whose exercises map to no slots is judged on its own exercises', () => {
  const free = [{ ...SESSION_EXERCISES[0], slot_id: null }];
  const detail = { session: SESSION, exercises: free, sets: logged([0]) };
  assert.equal(statusFor(detail, [], state.rules), 'done');
});

// ---- finish sheet ----

test('the finish sheet asks for every optional field and defaults pain to none', () => {
  const html = finishSheet(SESSION);
  for (const field of ['duration_min', 'calories', 'avg_hr', 'peak_hr', 'effort_1_10', 'pain', 'notes']) {
    assert.match(html, new RegExp(`id="f-${field}"`), `the sheet has no ${field} field`);
  }
  assert.match(html, /value="none"/, 'pain defaults to none');
});

test('the finish sheet marks every field but pain as optional', () => {
  assert.match(finishSheet(SESSION), /optional/i);
});
