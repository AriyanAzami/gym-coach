/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionMetricPatches } from '../coach/save.mjs';

const blank = { duration_min: null, calories: null, avg_hr: null, peak_hr: null, effort_1_10: null, hr_zones: null };

const context = (sessions, shotIds = sessions.map((s) => s.id)) => ({
  sessions,
  session_screenshots: shotIds.map((id, i) => ({ session_id: id, date: '2026-10-01', file: `work/shots/x-${i}.png` })),
});

test('fills empty fields on a session whose screenshots were read', () => {
  const ctx = context([{ id: 'se-1', ...blank, hr_zones: { shots: ['u/se-1/a.png'] } }]);
  const out = sessionMetricPatches(
    [{ session_id: 'se-1', duration_min: 41, calories: 288, avg_hr: 131, peak_hr: 162, effort_1_10: 7, hr_zones: 'z2:14 z3:9' }],
    ctx,
  );
  assert.deepEqual(out, [{
    id: 'se-1',
    patch: {
      duration_min: 41, calories: 288, avg_hr: 131, peak_hr: 162, effort_1_10: 7,
      hr_zones: { shots: ['u/se-1/a.png'], raw: 'z2:14 z3:9' },
    },
  }]);
});

test('never overwrites a value the owner already entered', () => {
  const ctx = context([{ id: 'se-1', ...blank, duration_min: 52, avg_hr: 118, hr_zones: { raw: 'z2:30', shots: ['a.png'] } }]);
  const out = sessionMetricPatches(
    [{ session_id: 'se-1', duration_min: 41, calories: 288, avg_hr: 131, hr_zones: 'z2:14' }],
    ctx,
  );
  assert.deepEqual(out, [{ id: 'se-1', patch: { calories: 288 } }]);
});

test('ignores sessions the model was not shown screenshots for', () => {
  const ctx = context([{ id: 'se-1', ...blank }, { id: 'se-2', ...blank }], ['se-1']);
  const out = sessionMetricPatches(
    [{ session_id: 'se-2', calories: 300 }, { session_id: 'se-9', calories: 300 }],
    ctx,
  );
  assert.deepEqual(out, []);
});

test('drops values the database would reject', () => {
  const ctx = context([{ id: 'se-1', ...blank }]);
  const out = sessionMetricPatches(
    [{ session_id: 'se-1', effort_1_10: 11, avg_hr: 0, peak_hr: 140.5, calories: -4, duration_min: 0 }],
    ctx,
  );
  assert.deepEqual(out, [{ id: 'se-1', patch: { duration_min: 0 } }]);
});

test('a single object is accepted as well as an array', () => {
  const ctx = context([{ id: 'se-1', ...blank }]);
  assert.deepEqual(
    sessionMetricPatches({ session_id: 'se-1', effort_1_10: 6 }, ctx),
    [{ id: 'se-1', patch: { effort_1_10: 6 } }],
  );
});

test('malformed input yields no patches and does not throw', () => {
  const ctx = context([{ id: 'se-1', ...blank }]);
  for (const bad of [null, 'text', 42, [null, 'x', {}], [{ session_id: 'se-1' }]]) {
    assert.deepEqual(sessionMetricPatches(bad, ctx), []);
  }
  assert.deepEqual(sessionMetricPatches([{ session_id: 'se-1', calories: 200 }], {}), []);
});
