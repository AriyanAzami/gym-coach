/* All content below is fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsForBlock } from '../coach/save.mjs';

const plan = () => ({
  name: 'Winter block',
  starts_on: '2026-11-10',
  ends_on: '2026-12-21',
  rationale: 'Back leads on volume because rows stalled at 185 lb for three sessions.',
  days: [
    {
      day_index: 0,
      name: 'Pull',
      warmup_note: 'Bike, then plank.',
      slots: [
        { position: 0, exercise: 'Barbell row', sets: 5, rep_min: 5, rep_max: 8, rest_s: 180, non_negotiable: true, cut_order: null, notes: 'straps off' },
        {
          position: 1,
          exercise: 'Seal row',
          sets: 4,
          rep_min: 8,
          rep_max: 12,
          rest_s: 120,
          new: {
            primary_muscle: 'back', secondary_muscles: ['arms'], equipment: 'barbell',
            movement_tags: ['horizontal_pull'], increment: 5, increment_unit: 'lb',
            load_mode: 'total', cues: 'Chest on the bench.',
          },
        },
      ],
    },
  ],
});

const library = new Map([['barbell row', 'ex-1']]);
const build = (p = plan()) => rowsForBlock(p, { jobId: 'job-1', library });

test('the block is created as a draft, never active', () => {
  assert.equal(build().block.status, 'draft');
});

test('the block records the job that wrote it', () => {
  assert.equal(build().block.source_job_id, 'job-1');
});

test('the block carries its name, dates and rationale', () => {
  const { block } = build();
  assert.equal(block.name, 'Winter block');
  assert.equal(block.starts_on, '2026-11-10');
  assert.equal(block.ends_on, '2026-12-21');
  assert.match(block.rationale, /Back leads/);
});

test('no slot carries a weight of any kind', () => {
  for (const slot of build().slots) {
    for (const key of Object.keys(slot)) {
      assert.doesNotMatch(key, /weight/i, `slot row has a ${key} column`);
    }
  }
});

test('a decisions entry records the rationale alongside the block', () => {
  const { decision } = build();
  assert.match(decision.title, /Winter block/);
  assert.match(decision.body, /Back leads/);
});

test('new exercises are collected so they can be inserted before the slots', () => {
  const { newExercises } = build();
  assert.equal(newExercises.length, 1);
  assert.equal(newExercises[0].name, 'Seal row');
  assert.equal(newExercises[0].primary_muscle, 'back');
  assert.equal(newExercises[0].equipment, 'barbell');
  assert.deepEqual(newExercises[0].movement_tags, ['horizontal_pull']);
  assert.equal(newExercises[0].increment, 5);
  assert.equal(newExercises[0].unit, 'lb', 'increment_unit becomes the exercise unit column');
  assert.equal(newExercises[0].active, true);
});

test('an exercise already in the library is not recreated', () => {
  assert.deepEqual(build().newExercises.map((e) => e.name), ['Seal row']);
});

test('slots name their exercise so ids can be resolved after the inserts', () => {
  const { slots } = build();
  assert.deepEqual(slots.map((s) => s.exercise_name), ['Barbell row', 'Seal row']);
});

test('a known exercise already has its id resolved', () => {
  assert.equal(build().slots[0].exercise_id, 'ex-1');
});

test('a new exercise has no id yet', () => {
  assert.equal(build().slots[1].exercise_id, null);
});

test('slots keep their day and position so they can be attached after the days', () => {
  const { slots } = build();
  assert.deepEqual(slots.map((s) => [s.day_index, s.position]), [[0, 0], [0, 1]]);
});

test('days carry their index, name and warm-up note', () => {
  const { days } = build();
  assert.equal(days[0].day_index, 0);
    assert.equal(days[0].name, 'Pull');
  assert.match(days[0].warmup_note, /Bike/);
});

test('slot fields survive intact', () => {
  const slot = build().slots[0];
  assert.equal(slot.sets, 5);
  assert.equal(slot.rep_min, 5);
  assert.equal(slot.rep_max, 8);
  assert.equal(slot.rest_s, 180);
  assert.equal(slot.non_negotiable, true);
  assert.equal(slot.notes, 'straps off');
});

test('optional slot fields default rather than arriving undefined', () => {
  const slot = build().slots[1];
  assert.equal(slot.non_negotiable, false);
  assert.equal(slot.cut_order, null);
  assert.equal(slot.notes, null);
});

test('a plan with no dates still produces a block', () => {
  const p = plan();
  delete p.starts_on;
  delete p.ends_on;
  const { block } = rowsForBlock(p, { jobId: 'job-1', library });
  assert.equal(block.starts_on, null);
  assert.equal(block.ends_on, null);
});

test('the library match ignores case and surrounding space', () => {
  const p = plan();
  p.days[0].slots[0].exercise = '  BARBELL ROW ';
  const { slots, newExercises } = rowsForBlock(p, { jobId: 'job-1', library });
  assert.equal(slots[0].exercise_id, 'ex-1');
  assert.equal(newExercises.length, 1, 'a case difference must not create a duplicate exercise');
});
