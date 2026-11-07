/* Parses a Gym Log page body into exercise rows.

   The shapes below mirror the real export's structure — a markdown table in
   most pages, prose in a few, empty in a few more — but every exercise name,
   weight and rep count here is invented. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGymLogBody } from '../migrate/normalize.mjs';

const table = (rows) => [
  '| Exercise | Sets | Reps | Weight | Notes |',
  '| --- | --- | --- | --- | --- |',
  ...rows,
].join('\n');

test('a table body yields one row per exercise', () => {
  const out = parseGymLogBody(table([
    '| Sled Push | 4 | 7 | 110 lb | Done as prescribed |',
    '| Jefferson Curl | 5 | 9 | 115 lb | Felt easy |',
  ]));
  assert.equal(out.rows.length, 2);
  assert.deepEqual(out.rows.map((r) => r.exercise), ['Sled Push', 'Jefferson Curl']);
  assert.deepEqual(out.review, []);
});

test('sets, reps and weight are read with the unit', () => {
  const [row] = parseGymLogBody(table(['| Sled Push | 4 | 7 | 110 lb | ok |'])).rows;
  assert.equal(row.sets, 4);
  assert.equal(row.reps, 7);
  assert.equal(row.weight, 110);
  assert.equal(row.unit, 'lb');
  assert.equal(row.per_hand, false);
});

test('a rep range keeps both ends', () => {
  const [row] = parseGymLogBody(table(['| Sled Push | 4 | 6-7 | 110 lb | ok |'])).rows;
  assert.equal(row.rep_min, 6);
  assert.equal(row.rep_max, 7);
});

test('a per-hand load stays per hand', () => {
  const [row] = parseGymLogBody(table(['| Calf Raise | 2 | 14 | 17.5 lb/hand | ok |'])).rows;
  assert.equal(row.weight, 17.5);
  assert.equal(row.per_hand, true);
});

test('a decimal load keeps its decimal', () => {
  const [row] = parseGymLogBody(table(['| Calf Raise | 2 | 14 | 42.5 lb | ok |'])).rows;
  assert.equal(row.weight, 42.5);
});

test('a weight cell with trailing description keeps the number and the description', () => {
  const [row] = parseGymLogBody(table(['| Goblet Squat | 5 | 9 | 55 lb, close stance, paused | ok |'])).rows;
  assert.equal(row.weight, 55);
  assert.equal(row.unit, 'lb');
  assert.match(row.weight_note, /close stance/);
});

test('an em-dash in sets, reps and weight marks the exercise skipped', () => {
  const [row] = parseGymLogBody(table(['| Sissy Squat | — | — | — | Skipped, machine taken |'])).rows;
  assert.equal(row.skipped, true);
  assert.equal(row.sets, null);
  assert.equal(row.weight, null);
});

test('a per-side set count is recorded as such', () => {
  const [row] = parseGymLogBody(table(['| Split Squat | 2/side | 10 | 63 lb | ok |'])).rows;
  assert.equal(row.sets, 2);
  assert.equal(row.per_side, true);
});

test('the note cell is kept, with the escaped tilde unescaped', () => {
  const [row] = parseGymLogBody(table(['| Curl | 4 | 7 | 26 lb | felt \\~4-5 effort |'])).rows;
  assert.match(row.note, /~4-5 effort/);
  assert.doesNotMatch(row.note, /\\~/);
});

test('an empty note cell becomes null, not an empty string', () => {
  const [row] = parseGymLogBody(table(['| Curl | 4 | 7 | 26 lb |  |'])).rows;
  assert.equal(row.note, null);
});

test('prose around the table is ignored', () => {
  const body = ['## Day 2 — Back', '', 'Felt good today.', '',
    table(['| Sled Push | 4 | 7 | 110 lb | ok |']), '', 'Coach Notes: strong session.'].join('\n');
  const out = parseGymLogBody(body);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].exercise, 'Sled Push');
});

test('an Apple Watch line is not mistaken for an exercise', () => {
  const body = [table(['| Sled Push | 4 | 7 | 110 lb | ok |']), '', '<b>Apple Watch data:</b> 38 min'].join('\n');
  assert.equal(parseGymLogBody(body).rows.length, 1);
});

test('the header and separator rows are never returned as exercises', () => {
  const out = parseGymLogBody(table(['| Sled Push | 4 | 7 | 110 lb | ok |']));
  assert.ok(!out.rows.some((r) => /^Exercise$/i.test(r.exercise)));
  assert.ok(!out.rows.some((r) => /^-+$/.test(r.exercise)));
});

// ---- prose bodies ----

test('a prose body in the bold form is parsed', () => {
  const out = parseGymLogBody('Sled Push: <b>4x7 @ 110 lb</b> — moved well.');
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].exercise, 'Sled Push');
  assert.equal(out.rows[0].sets, 4);
  assert.equal(out.rows[0].reps, 7);
  assert.equal(out.rows[0].weight, 110);
});

test('a prose line with a parenthesised load is parsed', () => {
  const out = parseGymLogBody('Calf Raise: two sets of fourteen (17.5 lb/hand, strict).');
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].weight, 17.5);
  assert.equal(out.rows[0].per_hand, true);
});

test('a prose line with a prior session set notation after an em-dash still reads today sets', () => {
  const out = parseGymLogBody('Sled Push: <b>6×9 @ 47 lb</b> — full target hit (up from 6×7 @ 47 lb last week).');
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].sets, 6);
  assert.equal(out.rows[0].reps, 9);
  assert.equal(out.rows[0].weight, 47);
});

test('a run-on prose paragraph with multiple exercises goes to review rather than corrupting the first exercise', () => {
  const out = parseGymLogBody('Sissy Squat: 3×11, bodyweight. Landmine Twist: 5×13, 31 lb.');
  assert.equal(out.rows.length, 0);
  assert.equal(out.review.length, 1);
});

test('a comparison or off-plan commentary line goes to review rather than becoming an exercise', () => {
  const out = parseGymLogBody([
    'Comparison to last week: Zercher Carry moved from 88 lb to 93 lb.',
    'Off-plan addition: Reverse Nordic, 4x6, 19 lb — extra work.',
  ].join('\n'));
  assert.equal(out.rows.length, 0);
  assert.equal(out.review.length, 2);
});

test('a prose line with no numbers at all goes to review, not to a row', () => {
  const out = parseGymLogBody('Felt tired, kept it light and went home.');
  assert.equal(out.rows.length, 0);
  assert.equal(out.review.length, 1);
  assert.match(out.review[0], /Felt tired/);
});

test('each unparseable prose line is reported separately', () => {
  const out = parseGymLogBody(['Something vague.', 'Another vague thing.'].join('\n'));
  assert.equal(out.review.length, 2);
});

// ---- empty and malformed ----

test('an empty body yields no rows and no review items', () => {
  for (const body of ['', '   ', null, undefined]) {
    const out = parseGymLogBody(body);
    assert.deepEqual(out.rows, []);
    assert.deepEqual(out.review, []);
  }
});

test('a table row with the wrong number of cells goes to review', () => {
  const out = parseGymLogBody(table(['| Sled Push | 3 |']));
  assert.equal(out.rows.length, 0);
  assert.equal(out.review.length, 1);
});

test('a table row whose sets cell is not a number goes to review', () => {
  const out = parseGymLogBody(table(['| Sled Push | lots | 10 | 110 lb | ok |']));
  assert.equal(out.rows.length, 0);
  assert.match(out.review[0], /lots/);
});

test('every returned row carries the source text, so a decision can be traced back', () => {
  const [row] = parseGymLogBody(table(['| Sled Push | 4 | 7 | 110 lb | ok |'])).rows;
  assert.match(row.source_text, /Sled Push/);
});

test('a body is classified so the report can say which form it took', () => {
  assert.equal(parseGymLogBody(table(['| Sled Push | 4 | 7 | 110 lb | ok |'])).form, 'table');
  assert.equal(parseGymLogBody('Sled Push: <b>4x7 @ 110 lb</b> — ok.').form, 'prose');
  assert.equal(parseGymLogBody('').form, 'empty');
});

/* A few logged rows record a different load or rep count per set — "Set 1:
   40 lb, Set 2-3: 45 lb", or reps "8, then 10, 12". Flattening those to one
   number puts a weight into lift_state that was never lifted for every set,
   and the next target is computed from it. They go to review instead. */
test('a weight cell that differs per set goes to review rather than being flattened', () => {
  const out = parseGymLogBody([
    '| Exercise | Sets | Reps | Weight | Notes |',
    '| --- | --- | --- | --- | --- |',
    '| Sled Push | 3 | 9 | Set 1: 47 lb, Set 2-3: 53 lb | ramped |',
  ].join('\n'));
  assert.equal(out.rows.length, 0);
  assert.equal(out.review.length, 1);
  assert.match(out.review[0], /per set/i);
});

test('a reps cell that differs per set goes to review', () => {
  const out = parseGymLogBody([
    '| Exercise | Sets | Reps | Weight | Notes |',
    '| --- | --- | --- | --- | --- |',
    '| Sled Push | 3 | 9, then 11, 13 | 47 lb | ramped |',
  ].join('\n'));
  assert.equal(out.rows.length, 0);
  assert.match(out.review[0], /per set/i);
});

test('a plain rep range is still not treated as per-set', () => {
  const out = parseGymLogBody([
    '| Exercise | Sets | Reps | Weight | Notes |',
    '| --- | --- | --- | --- | --- |',
    '| Sled Push | 3 | 9-11 | 47 lb | fine |',
  ].join('\n'));
  assert.equal(out.rows.length, 1);
  assert.equal(out.review.length, 0);
});

test('a per-hand load is still not treated as per-set', () => {
  const out = parseGymLogBody([
    '| Exercise | Sets | Reps | Weight | Notes |',
    '| --- | --- | --- | --- | --- |',
    '| Sled Push | 3 | 9 | 17.5 lb/hand | fine |',
  ].join('\n'));
  assert.equal(out.rows.length, 1);
  assert.equal(out.review.length, 0);
});

/* Some skipped exercises are logged as "0" sets rather than an em-dash. Zero
   sets performed is a skipped exercise; letting a 0 through produced a
   target_sets of 0, which the schema's "target_sets > 0" check rejects, and
   one such row aborted a 780-row load. */
test('zero sets means the exercise was skipped', () => {
  const out = parseGymLogBody([
    '| Exercise | Sets | Reps | Weight | Notes |',
    '| --- | --- | --- | --- | --- |',
    '| Sled Push | 0 | — | — | SKIPPED, gym was closed |',
  ].join('\n'));
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].skipped, true);
  assert.equal(out.rows[0].sets, null);
});

test('a skipped row still keeps its note and source text', () => {
  const out = parseGymLogBody([
    '| Exercise | Sets | Reps | Weight | Notes |',
    '| --- | --- | --- | --- | --- |',
    '| Sled Push | 0 | — | — | SKIPPED, gym was closed |',
  ].join('\n'));
  assert.match(out.rows[0].note, /gym was closed/);
  assert.match(out.rows[0].source_text, /Sled Push/);
});
