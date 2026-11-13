/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deloadDue } from '../app/js/engine.js';

const rules = {
  stall: { sessions_to_trigger: 3 },
  deload: { triggers: { stalled_exercises: 2, effort_above: 8 }, backstop_weeks: 10, set_factor: 0.5 },
};
const today = '2026-11-13';
const lift = (name, stall_count, active = true) => ({ exercise_id: name, name, stall_count, active });
const call = (over = {}) => deloadDue({
  liftState: [], sessions: [], activeBlock: { id: 'b', starts_on: '2026-11-01' }, rules, today, ...over,
});

test('nothing fires on a quiet record', () => {
  const r = call();
  assert.equal(r.due, false);
  assert.deepEqual(r.reasons, []);
});

test('enough stalled active lifts give a stalls reason', () => {
  const r = call({ liftState: [lift('A', 3), lift('B', 4), lift('C', 9, false), lift('D', 1)] });
  assert.equal(r.due, true);
  assert.deepEqual(r.reasons.map((x) => x.code), ['stalls']);
  assert.match(r.reasons[0].text, /2 lifts stalled/);
});

test('one stall under the trigger count is not due', () => {
  assert.equal(call({ liftState: [lift('A', 3), lift('B', 2)] }).due, false);
});

test('the most recent trained session decides the effort reason', () => {
  const sessions = [
    { date: '2026-11-10', kind: 'training', status: 'done', effort_1_10: 9 },
    { date: '2026-11-05', kind: 'training', status: 'done', effort_1_10: 5 },
    { date: '2026-11-12', kind: 'training', status: 'planned', effort_1_10: 10 },
  ];
  const r = call({ sessions });
  assert.deepEqual(r.reasons.map((x) => x.code), ['effort']);
  assert.match(r.reasons[0].text, /9\/10 on 2026-11-10/);
  assert.equal(call({ sessions: [sessions[1], sessions[2]] }).due, false);
});

test('effort exactly at the threshold does not fire', () => {
  const sessions = [{ date: '2026-11-10', kind: 'training', status: 'partial', effort_1_10: 8 }];
  assert.equal(call({ sessions }).due, false);
});

test('whole weeks since the block start reach the backstop', () => {
  assert.equal(call({ activeBlock: { id: 'b', starts_on: '2026-09-05' } }).due, false, '9 weeks');
  const r = call({ activeBlock: { id: 'b', starts_on: '2026-09-04' } });
  assert.deepEqual(r.reasons.map((x) => x.code), ['backstop']);
  assert.match(r.reasons[0].text, /10 weeks ago/);
});

test('missing deload rules or block never throw', () => {
  assert.equal(deloadDue({ liftState: [lift('A', 9)], sessions: [], activeBlock: null, rules: { stall: rules.stall }, today }).due, false);
  assert.equal(deloadDue({ rules: {}, today }).due, false);
});
