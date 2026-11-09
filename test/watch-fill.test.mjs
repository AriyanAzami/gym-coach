/* All values below are fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../app/js/store.js';
import { finishSheet, planWatchFill, readPanelHtml } from '../app/js/screens-workout.js';
import { dayDetailSheet } from '../app/js/screens-progress.js';

const box = (value, guess = false) => ({ value: String(value ?? ''), guess });
const empty = () => ({
  duration_min: box(''), calories: box(''), total_calories: box(''), avg_hr: box(''),
  peak_hr: box(''), effort_1_10: box(''), hr_zones: box(''),
});
const READ = { duration_min: 37, calories: 367, total_calories: 437, avg_hr: 130, peak_hr: 174, effort_1_10: 9, hr_zones: 'z1:27 z2:5 z3:3 z4:1', workout_date: '2026-11-06' };

test('empty boxes are filled, and each filled value is listed by name', () => {
  const plan = planWatchFill(empty(), READ);
  assert.deepEqual(plan.fill.map((f) => [f.id, f.value]), [
    ['duration_min', 37], ['calories', 367], ['total_calories', 437], ['avg_hr', 130],
    ['peak_hr', 174], ['effort_1_10', 9], ['hr_zones', 'z1:27 z2:5 z3:3 z4:1'],
  ]);
  assert.equal(plan.fill.find((f) => f.id === 'total_calories').label, 'Total calories');
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.missing, []);
});

test('a box the owner already filled is never overwritten; a different reading is offered instead', () => {
  const current = { ...empty(), calories: box(350), avg_hr: box(130) };
  const plan = planWatchFill(current, READ);
  assert.ok(!plan.fill.some((f) => f.id === 'calories'));
  assert.ok(!plan.fill.some((f) => f.id === 'avg_hr'), 'the same value is neither filled nor a conflict');
  assert.deepEqual(plan.conflicts, [{ id: 'calories', label: 'Active calories', current: '350', watch: 367 }]);
});

test('the duration the sheet guessed from the clock counts as empty', () => {
  const plan = planWatchFill({ ...empty(), duration_min: box(52, true) }, READ);
  assert.ok(plan.fill.some((f) => f.id === 'duration_min' && f.value === 37));
});

test('fields the screenshot did not show are listed as missing', () => {
  const plan = planWatchFill(empty(), { ...READ, total_calories: null, hr_zones: null });
  assert.deepEqual(plan.missing, ['Total calories', 'HR zones']);
});

test('the panel shows each stage as it happens', () => {
  assert.match(readPanelHtml({ phase: 'uploading', label: '2 screenshots' }), /Uploading 2 screenshots/);
  const reading = readPanelHtml({ phase: 'reading', label: '2 screenshots' });
  assert.match(reading, /✓[\s\S]*Uploaded/);
  assert.match(reading, /Reading the numbers/);
});

test('when done, the panel lists what was filled, what differs and what was not found', () => {
  const plan = planWatchFill({ ...empty(), calories: box(350) }, { ...READ, hr_zones: null });
  const html = readPanelHtml({ phase: 'done', label: '2 screenshots', model: 'nvidia/nemotron-3.5-super-vl-120b-a12b', seconds: 4, plan });
  assert.match(html, /Total calories[\s\S]*437/);
  assert.match(html, /Effort[\s\S]*9/);
  assert.match(html, /Watch says 367/);
  assert.match(html, /data-action="use-watch-value" data-id="calories" data-value="367"/);
  assert.match(html, /Not on the screenshot: HR zones/);
  assert.match(html, /nemotron-3.5-super-vl/);
  assert.match(html, /check them, then Save/i);
});

test('a screenshot from another day is called out', () => {
  const html = readPanelHtml({ phase: 'done', label: '2 screenshots', plan: planWatchFill(empty(), READ), workoutDate: '2026-11-06', sessionDate: '2026-11-08' });
  assert.match(html, /2026-11-06/);
  assert.match(html, /this session is 2026-11-08/);
  const same = readPanelHtml({ phase: 'done', label: 'x', plan: planWatchFill(empty(), READ), workoutDate: '2026-11-08', sessionDate: '2026-11-08' });
  assert.doesNotMatch(same, /this session is/);
});

test('when nothing was read, the panel shows what the model said, escaped', () => {
  const html = readPanelHtml({ phase: 'done', label: '1 screenshot', plan: planWatchFill(empty(), {}), said: '<b>blurry</b>' });
  assert.match(html, /No numbers found/);
  assert.match(html, /&lt;b&gt;blurry/);
  const err = readPanelHtml({ phase: 'error', label: '1 screenshot', error: 'model returned <503>' });
  assert.match(err, /model returned &lt;503&gt;/);
});

test('the finish sheet has active and total calories, a live panel, and marks a clock guess', () => {
  const html = finishSheet({ id: 's', date: '2026-11-08', created_at: new Date(Date.now() - 30 * 60000).toISOString() });
  assert.match(html, /Active calories<input id="f-calories"/);
  assert.match(html, /id="f-total_calories"/);
  assert.match(html, /id="f-read-panel"/);
  assert.match(html, /id="f-duration_min"[^>]*data-guess="1"/);
  assert.doesNotMatch(finishSheet({ id: 's', duration_min: 40 }), /data-guess/);
  assert.match(finishSheet({ id: 's', total_calories: 437 }), /id="f-total_calories"[^>]*value="437"/);
});

beforeEach(() => {
  Object.assign(state, { user: { id: 'u' }, loaded: true, days: [], exercises: [] });
});

test('a day on Progress shows the Apple Watch summary', () => {
  const html = dayDetailSheet({
    id: 's1', date: '2026-11-08', kind: 'training', status: 'done',
    duration_min: 37, calories: 367, total_calories: 437, avg_hr: 130, peak_hr: 174, effort_1_10: 9,
    hr_zones: { raw: 'z1:27 z2:5 z3:3' },
  }, { exercises: [], sets: [] });
  assert.match(html, /Apple Watch/);
  for (const v of ['Minutes', '367', '437', '130', '174', '9/10', 'Z1 27m', 'Z2 5m', 'Z3 3m']) {
    assert.ok(html.includes(v), `missing ${v}`);
  }
  assert.match(html, /Active/);
  assert.match(html, /Total/);
});

test('a day with no Watch data offers to add it', () => {
  const html = dayDetailSheet({ id: 's1', date: '2026-11-08', kind: 'training', status: 'done' }, { exercises: [], sets: [] });
  assert.match(html, /No Apple Watch data/);
  assert.match(html, /data-action="add-watch-data" data-id="s1"/);
});
