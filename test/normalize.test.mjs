/* Every string below is a fabricated example of the notation the Notion log
   used, taken from the format description, not from anyone's actual log. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSets, parseExerciseLine, classifySession } from '../migrate/normalize.mjs';

// ---- set notation ----

test('"3x8-10" is three sets across a rep range', () => {
  const r = parseSets('3x8-10');
  assert.equal(r.sets, 3);
  assert.equal(r.rep_min, 8);
  assert.equal(r.rep_max, 10);
  assert.equal(r.weight, null);
});

test('"4x12" is four sets at a single rep target', () => {
  const r = parseSets('4x12');
  assert.equal(r.sets, 4);
  assert.equal(r.rep_min, 12);
  assert.equal(r.rep_max, 12);
});

test('the multiplication sign is accepted as well as the letter x', () => {
  assert.equal(parseSets('3×8').sets, 3);
});

test('spacing around the notation does not matter', () => {
  const r = parseSets('  3 x 8 - 10  ');
  assert.equal(r.sets, 3);
  assert.equal(r.rep_max, 10);
});

test('a weight in pounds is read with its unit', () => {
  const r = parseSets('3x8 @ 135 lb');
  assert.equal(r.weight, 135);
  assert.equal(r.unit, 'lb');
  assert.equal(r.per_hand, false);
});

test('a weight in kilograms is read with its unit', () => {
  const r = parseSets('3x8 @ 60 kg');
  assert.equal(r.weight, 60);
  assert.equal(r.unit, 'kg');
});

test('"13 lb/hand" is a per-hand load', () => {
  const r = parseSets('3x10 @ 13 lb/hand');
  assert.equal(r.weight, 13);
  assert.equal(r.unit, 'lb');
  assert.equal(r.per_hand, true);
});

test('a decimal per-hand load keeps its decimal', () => {
  assert.equal(parseSets('3x10 @ 12.5 lb/hand').weight, 12.5);
});

test('a parenthesised remark is kept as a note, not parsed as data', () => {
  const r = parseSets('3x10 @ 12.5 lb/hand (weight not restated, prescribed assumed)');
  assert.equal(r.weight, 12.5);
  assert.equal(r.per_hand, true);
  assert.match(r.note, /prescribed assumed/);
});

test('a trailing date in parentheses is a date, not a rep count', () => {
  const r = parseSets('3x8-10 (Oct 21)');
  assert.equal(r.sets, 3);
  assert.equal(r.rep_max, 10);
  assert.equal(r.date_hint, 'Oct 21');
  assert.equal(r.note, null, 'a bare date is not a remark');
});

test('a line with no set notation is not guessed at', () => {
  const r = parseSets('felt strong today');
  assert.equal(r.ok, false);
  assert.match(r.reason, /no set notation/i);
});

test('an empty line is not guessed at', () => {
  assert.equal(parseSets('').ok, false);
});

test('a line with two different set notations is sent to review rather than picked between', () => {
  const r = parseSets('3x8 then 2x12');
  assert.equal(r.ok, false);
  assert.match(r.reason, /more than one/i);
});

test('an implausible set count is sent to review', () => {
  const r = parseSets('40x8');
  assert.equal(r.ok, false);
});

// ---- exercise lines ----

test('an exercise line splits into a name and its sets', () => {
  const r = parseExerciseLine('Bench press - 3x8-10 @ 135 lb');
  assert.equal(r.ok, true);
  assert.equal(r.exercise, 'Bench press');
  assert.equal(r.sets, 3);
  assert.equal(r.weight, 135);
});

test('an en dash separates the name as well as a hyphen', () => {
  assert.equal(parseExerciseLine('Bench press – 3x8').exercise, 'Bench press');
});

test('a colon separates the name too', () => {
  assert.equal(parseExerciseLine('Bench press: 3x8').exercise, 'Bench press');
});

test('an exercise name containing a hyphen survives', () => {
  const r = parseExerciseLine('Pull-up - 3x8');
  assert.equal(r.exercise, 'Pull-up');
});

test('a line with a name but no parseable sets goes to review with its text', () => {
  const r = parseExerciseLine('Bench press - felt heavy');
  assert.equal(r.ok, false);
  assert.match(r.text, /Bench press/);
});

// ---- session classification ----

test('a rest day becomes a rest session', () => {
  assert.equal(classifySession({ Type: 'Rest' }).kind, 'rest');
});

test('rest is recognised whatever the case', () => {
  assert.equal(classifySession({ Type: 'rest day' }).kind, 'rest');
});

test('a block day session carries its day index', () => {
  const r = classifySession({ Type: 'Day 2' });
  assert.equal(r.kind, 'training');
  assert.equal(r.day_index, 1, 'Day 2 is index 1');
});

test('a legacy session type imports as training with no block day', () => {
  for (const type of ['Monday', 'Upper', 'Lower', 'Other']) {
    const r = classifySession({ Type: type });
    assert.equal(r.kind, 'training', `${type} should be a training session`);
    assert.equal(r.day_index, null, `${type} predates the block structure`);
  }
});

test('an unrecognised type is training with no day, and says it needs review', () => {
  const r = classifySession({ Type: 'Something new' });
  assert.equal(r.kind, 'training');
  assert.equal(r.day_index, null);
  assert.equal(r.needs_review, true);
});

test('a missing type is training with no day and needs review', () => {
  assert.equal(classifySession({}).needs_review, true);
});
