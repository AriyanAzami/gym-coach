/* All values below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WATCH_PROMPT, parseWatchReply, ownedPath } from '../supabase/functions/read-watch-shots/watch.js';

test('the prompt asks for exactly the finish-session fields', () => {
  for (const k of ['duration_min', 'calories', 'avg_hr', 'peak_hr', 'effort_1_10', 'hr_zones']) {
    assert.match(WATCH_PROMPT, new RegExp(k));
  }
});

test('a clean reply comes through as numbers', () => {
  const out = parseWatchReply('{"duration_min": 52, "calories": 312, "avg_hr": 128, "peak_hr": 161, "effort_1_10": 7, "hr_zones": "z1:14 z2:22 z3:11 z4:5"}');
  assert.deepEqual(out, { duration_min: 52, calories: 312, avg_hr: 128, peak_hr: 161, effort_1_10: 7, hr_zones: 'z1:14 z2:22 z3:11 z4:5' });
});

test('fences, thinking and surrounding prose are ignored', () => {
  const out = parseWatchReply('<think>hmm</think>Here you go:\n```json\n{"duration_min": "52", "calories": 312.4}\n```');
  assert.equal(out.duration_min, 52);
  assert.equal(out.calories, 312);
});

test('values outside a plausible range, or not numbers, are dropped rather than guessed', () => {
  const out = parseWatchReply('{"duration_min": 0, "calories": -5, "avg_hr": 900, "peak_hr": "high", "effort_1_10": 11, "hr_zones": "lots"}');
  assert.deepEqual(out, { duration_min: null, calories: null, avg_hr: null, peak_hr: null, effort_1_10: null, hr_zones: null });
});

test('zones are normalised to the z1:12 form and junk zones dropped', () => {
  assert.equal(parseWatchReply('{"hr_zones": "Z1: 14, z2:22 z9:3 z3:0"}').hr_zones, 'z1:14 z2:22');
});

test('a reply with no JSON is an error', () => {
  assert.throws(() => parseWatchReply('I cannot read this image.'), /no JSON/);
});

test('only paths in the caller\'s own folder are accepted', () => {
  const uid = '00000000-0000-4000-8000-000000000001';
  assert.equal(ownedPath(`${uid}/s1/watch-1.jpg`, uid), true);
  assert.equal(ownedPath(`00000000-0000-4000-8000-000000000002/s1/watch-1.jpg`, uid), false);
  assert.equal(ownedPath(`${uid}/../other/x.jpg`, uid), false);
  assert.equal(ownedPath(`${uid}`, uid), false);
});

test('screenshots are scaled so the long side fits, never enlarged', async () => {
  const { scaledSize } = await import('../app/js/ui.js');
  assert.deepEqual(scaledSize(1179, 2556, 1600), { width: 738, height: 1600 });
  assert.deepEqual(scaledSize(2556, 1179, 1600), { width: 1600, height: 738 });
  assert.deepEqual(scaledSize(800, 600, 1600), { width: 800, height: 600 });
});
