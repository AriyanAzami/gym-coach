import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeightReply, ownedPath, weightPrompt } from '../supabase/functions/read-weight-shots/weight.js';
import { newWeighIns } from '../app/js/engine.js';

const TODAY = '2026-11-22';

test('readings come back sorted, one per date', () => {
  const r = parseWeightReply('{"entries":[{"date":"2026-11-12","weight":91.4,"unit":"kg"},{"date":"2026-11-11","weight":"91.9 kg","unit":"KG"},{"date":"2026-11-12","weight":99,"unit":"kg"}]}', TODAY);
  assert.deepEqual(r.entries, [
    { date: '2026-11-11', weight: 91.9, unit: 'kg' },
    { date: '2026-11-12', weight: 91.4, unit: 'kg' },
  ]);
});

test('unreadable, future, implausible and unit-less entries are dropped', () => {
  const r = parseWeightReply(JSON.stringify({ entries: [
    { date: '2026-11-23', weight: 90, unit: 'kg' },
    { date: '2026-02-30', weight: 90, unit: 'kg' },
    { date: '2026-11-10', weight: 9, unit: 'kg' },
    { date: '2026-11-09', weight: 90, unit: null },
    { date: '2020-01-01', weight: 90, unit: 'kg' },
    { date: '2026-11-08', weight: 200, unit: 'lb' },
  ] }), TODAY);
  assert.deepEqual(r.entries, [{ date: '2026-11-08', weight: 200, unit: 'lb' }]);
});

test('a reply with no readings keeps what the model said', () => {
  const r = parseWeightReply('{"entries":[], "note":"x"}', TODAY);
  assert.deepEqual(r.entries, []);
  assert.ok(typeof r.said === 'string');
});

test('a reply with no JSON throws', () => {
  assert.throws(() => parseWeightReply('sorry', TODAY));
});

test('the prompt names today so a missing year can be filled', () => {
  assert.match(weightPrompt(TODAY), /2026-11-22/);
});

test('paths must sit in the caller\'s own folder', () => {
  assert.equal(ownedPath('u1/weight/a.jpg', 'u1'), true);
  assert.equal(ownedPath('u2/weight/a.jpg', 'u1'), false);
  assert.equal(ownedPath('u1/../u2/a.jpg', 'u1'), false);
});

test('only dates with no weigh-in are logged', () => {
  const existing = [{ date: '2026-11-10', weight: '91.80', unit: 'kg' }];
  const read = [
    { date: '2026-11-10', weight: 91.8, unit: 'kg' },
    { date: '2026-11-11', weight: 91.5, unit: 'kg' },
    { date: '2026-11-12', weight: 91.2, unit: 'kg' },
  ];
  const r = newWeighIns(read, existing);
  assert.deepEqual(r.add.map((x) => x.date), ['2026-11-11', '2026-11-12']);
  assert.equal(r.alreadyLogged.length, 1);
  assert.deepEqual(r.disagree, []);
});

test('a stored date that disagrees is reported and not overwritten', () => {
  const r = newWeighIns([{ date: '2026-11-10', weight: 92.4, unit: 'kg' }], [{ date: '2026-11-10', weight: '91.80', unit: 'kg' }]);
  assert.equal(r.add.length, 0);
  assert.deepEqual(r.disagree, [{ date: '2026-11-10', stored: 91.8, read: 92.4, unit: 'kg' }]);
});
