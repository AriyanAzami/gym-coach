/* All values below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WATCH_PROMPT, parseWatchReply, ownedPath } from '../supabase/functions/read-watch-shots/watch.js';

test('the prompt asks for exactly the finish-session fields', () => {
  for (const k of ['duration_min', 'calories', 'total_calories', 'avg_hr', 'peak_hr', 'effort_1_10', 'hr_zones', 'workout_date']) {
    assert.match(WATCH_PROMPT, new RegExp(k));
  }
});

test('a clean reply comes through as numbers', () => {
  const out = parseWatchReply('{"duration_min": 52, "calories": 312, "avg_hr": 128, "peak_hr": 161, "effort_1_10": 7, "hr_zones": "z1:14 z2:22 z3:11 z4:5"}');
  assert.deepEqual(out, { duration_min: 52, calories: 312, total_calories: null, avg_hr: 128, peak_hr: 161, effort_1_10: 7, hr_zones: 'z1:14 z2:22 z3:11 z4:5', workout_date: null });
});

test('fences, thinking and surrounding prose are ignored', () => {
  const out = parseWatchReply('<think>hmm</think>Here you go:\n```json\n{"duration_min": "52", "calories": 312.4}\n```');
  assert.equal(out.duration_min, 52);
  assert.equal(out.calories, 312);
});

test('values outside a plausible range, or not numbers, are dropped rather than guessed', () => {
  const out = parseWatchReply('{"duration_min": 0, "calories": -5, "avg_hr": 900, "peak_hr": "high", "effort_1_10": 11, "hr_zones": "lots"}');
  for (const k of ['duration_min', 'calories', 'total_calories', 'avg_hr', 'peak_hr', 'effort_1_10', 'hr_zones', 'workout_date']) {
    assert.equal(out[k], null, k);
  }
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

test('the prompt also asks for total calories and the workout date', () => {
  assert.match(WATCH_PROMPT, /total_calories/);
  assert.match(WATCH_PROMPT, /workout_date/);
  assert.match(WATCH_PROMPT, /0:36:49 is 37/);
});

test('numbers written with units or as clock times still count', () => {
  const out = parseWatchReply(JSON.stringify({
    duration_min: '0:36:49', calories: '367 kcal', total_calories: '437CAL',
    avg_hr: '130 BPM', peak_hr: '174bpm', effort_1_10: '9 All Out', workout_date: '2026-11-06',
  }));
  assert.equal(out.duration_min, 37);
  assert.equal(out.calories, 367);
  assert.equal(out.total_calories, 437);
  assert.equal(out.avg_hr, 130);
  assert.equal(out.peak_hr, 174);
  assert.equal(out.effort_1_10, 9);
  assert.equal(out.workout_date, '2026-11-06');
  assert.equal(parseWatchReply('{"duration_min": "36:49"}').duration_min, 37);
  assert.equal(parseWatchReply('{"duration_min": 36.8}').duration_min, 37);
});

test('zones written as clock times are rounded to minutes', () => {
  const out = parseWatchReply('{"hr_zones": "Zone 1 27:23, Zone 2 05:29, Zone 3 03:10, Zone 4 00:39, Zone 5 00:00"}');
  assert.equal(out.hr_zones, 'z1:27 z2:5 z3:3 z4:1');
  assert.equal(parseWatchReply('{"hr_zones": {"z1": 27, "z2": "5:29"}}').hr_zones, 'z1:27 z2:5');
});

test('a date that is not a real date is dropped', () => {
  assert.equal(parseWatchReply('{"workout_date": "November 6"}').workout_date, null);
  assert.equal(parseWatchReply('{"workout_date": "2026-13-40"}').workout_date, null);
});

test('when nothing at all was read, the reply text comes back to show the owner', () => {
  const out = parseWatchReply('{"duration_min": "unknown"} I could not see the numbers');
  assert.equal(out.duration_min, null);
  assert.match(out.said, /could not see/);
  assert.equal(parseWatchReply('{"duration_min": 5}').said, undefined);
});
