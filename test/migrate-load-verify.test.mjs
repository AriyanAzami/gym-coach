/* Tests for the Notion loader and verification report builder.
   All exercise names, dates and numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareLoadPayload, preflight } from '../migrate/load.mjs';
import { buildVerifyReport } from '../migrate/verify.mjs';

const exampleRules = JSON.parse(readFileSync('supabase/seed/rules.example.json', 'utf8'));

const FABRICATED_ROWS = {
  exercises: [
    {
      name: 'Bench Press',
      primary_muscle: 'chest',
      secondary_muscles: ['shoulders', 'arms'],
      equipment: 'barbell',
      increment: null,
      unit: null,
      load_mode: 'total',
      movement_tags: ['horizontal_press'],
      cues: 'Arch and leg drive',
      flag: null,
      active: true,
    },
    {
      name: 'Old Mystery Lift',
      primary_muscle: null,
      secondary_muscles: [],
      equipment: null,
      increment: null,
      unit: null,
      load_mode: 'total',
      movement_tags: [],
      cues: null,
      flag: null,
      active: false,
    },
  ],
  sessions: [
    {
      notion_page_id: 'page-session-1',
      date: '2026-10-01',
      kind: 'training',
      day_index: 0,
      status: 'done',
      duration_min: 45,
      calories: 250,
      avg_hr: 120,
      peak_hr: 155,
      effort_1_10: 8,
      hr_zones: { raw: 'z1:30 z2:15' },
      pain: 'none',
      notes: 'Session 1',
      source: 'notion_import',
      exercises: [
        {
          exercise: 'Bench Press',
          sets: 3,
          reps: 8,
          rep_min: 8,
          rep_max: 8,
          weight: 135,
          unit: 'lb',
          per_hand: false,
          note: 'Moved well',
          skipped: false,
        },
        {
          exercise: 'Old Mystery Lift',
          sets: null,
          reps: null,
          rep_min: null,
          rep_max: null,
          weight: null,
          unit: null,
          per_hand: false,
          note: 'Skipped',
          skipped: true,
        },
      ],
    },
  ],
  body_metrics: [
    {
      notion_page_id: 'page-bm-1',
      date: '2026-10-01',
      weight: 75,
      unit: 'kg',
      arm_cm: 36,
      waist_note: 'Comfortable',
      notes: null,
    },
  ],
  block: {
    name: 'October Block',
    status: 'active',
    starts_on: '2026-10-01',
    ends_on: null,
    rationale: 'Focus on pressing.',
    days: [
      {
        day_index: 0,
        name: 'Upper A',
        warmup_note: 'Rotator cuff',
        slots: [
          {
            position: 0,
            exercise_name: 'Bench Press',
            sets: 3,
            rep_min: 8,
            rep_max: 10,
            rest_s: 120,
            notes: 'Top priority',
          },
        ],
      },
    ],
  },
};

const FABRICATED_DOCS = {
  manual: '# Coaching Manual\n\nKeep reps clean.',
  rules: exampleRules,
  decisions: [
    { title: '2026-10-01 — Start block', body: 'Kept bench first.' },
  ],
};

test('prepareLoadPayload validates rules and builds non-null exercise rows', () => {
  const out = prepareLoadPayload({
    rowsData: FABRICATED_ROWS,
    docsData: FABRICATED_DOCS,
    userId: '00000000-0000-0000-0000-000000000001',
  });

  assert.equal(out.exercises.length, 2);
  for (const ex of out.exercises) {
    assert.ok(ex.primary_muscle, `${ex.name} must have a non-null primary_muscle for the DB constraint`);
    assert.ok(ex.equipment, `${ex.name} must have a non-null equipment for the DB constraint`);
  }
});

test('prepareLoadPayload expands logged exercise entries into individual sets and skips skipped ones', () => {
  const out = prepareLoadPayload({
    rowsData: FABRICATED_ROWS,
    docsData: FABRICATED_DOCS,
    userId: '00000000-0000-0000-0000-000000000001',
  });

  assert.equal(out.sessions.length, 1);
  assert.equal(out.sessions[0].exercises.length, 2);
  assert.equal(out.sessions[0].exercises[0].sets.length, 3);
  assert.deepEqual(
    out.sessions[0].exercises[0].sets.map((s) => s.set_no),
    [1, 2, 3],
  );
  assert.equal(out.sessions[0].exercises[1].sets.length, 0, 'skipped exercise produces no done sets');
});

test('prepareLoadPayload rejects invalid rules before any database write', () => {
  const badDocs = { ...FABRICATED_DOCS, rules: { ...exampleRules, volume: null } };
  assert.throws(
    () => prepareLoadPayload({
      rowsData: FABRICATED_ROWS,
      docsData: badDocs,
      userId: '00000000-0000-0000-0000-000000000001',
    }),
    /rules do not validate/i,
  );
});

test('buildVerifyReport checks counts, compares lift_state to Notion, and prints next targets', () => {
  const report = buildVerifyReport({
    sources: [
      { name: 'Gym Log', expected_rows: 1, actual_rows: 1 },
      { name: 'Lift Tracker', expected_rows: 'about 40', actual_rows: 1 },
      { name: 'Monthly Plans', expected_rows: '1 active plus others', actual_rows: 3 },
      { name: 'Body Metrics', expected_rows: 1, actual_rows: 1 },
      { name: 'Coach Operating Manual', expected_rows: 'n/a (page)', actual_rows: null },
    ],
    tracker: [
      {
        properties: {
          Exercise: 'Bench Press',
          Status: 'Active',
          'Last Weight': '135 lb',
          'Last Reps': '3x8 (Oct 1; felt strong)',
          'date:Last Date:start': '2026-10-01',
          'Next Target': '135 lb — aim for 3x9',
        },
      },
    ],
    dbCounts: {
      sessions: 1,
      Active_or_Tracked_Exercises: 1,
      body_metrics: 1,
      blocks: 1,
    },
    exercises: [
      {
        id: 'ex-1',
        name: 'Bench Press',
        primary_muscle: 'chest',
        secondary_muscles: ['shoulders', 'arms'],
        equipment: 'barbell',
        increment: null,
        unit: null,
        load_mode: 'total',
        flag: null,
        active: true,
      },
    ],
    liftState: [
      {
        exercise_id: 'ex-1',
        name: 'Bench Press',
        primary_muscle: 'chest',
        equipment: 'barbell',
        load_mode: 'total',
        last_date: '2026-10-01',
        last_weight: 135,
        last_unit: 'lb',
        last_reps: [8, 8, 8],
        last_full_reps: [8, 8, 8],
        last_sets: 3,
        stall_count: 0,
      },
    ],
    days: [{ id: 'day-1', block_id: 'bl-1', day_index: 0, name: 'Upper A', warmup_note: 'Rotator cuff' }],
    slots: [
      {
        id: 'slot-1',
        day_id: 'day-1',
        position: 0,
        exercise_id: 'ex-1',
        sets: 3,
        rep_min: 8,
        rep_max: 10,
        rest_s: 120,
        non_negotiable: true,
      },
    ],
    rotation: { day_index: 0, day_id: 'day-1', reason: 'first day of the block' },
    rules: exampleRules,
  });

  assert.match(report.markdown, /# Migration verification report/i);
  assert.match(report.markdown, /Bench Press/);
  assert.match(report.markdown, /3 × 9 @ 135 lb/);
  assert.match(report.markdown, /135 lb — aim for 3x9/);
  assert.equal(report.mismatches.length, 0);
  assert.equal(report.countDiffs, 0);
  assert.doesNotMatch(report.markdown, /MISMATCH/);
});

test('buildVerifyReport flags a weight or date mismatch between Notion and lift_state', () => {
  const report = buildVerifyReport({
    sources: [],
    tracker: [
      {
        properties: {
          Exercise: 'Bench Press',
          Status: 'Active',
          'Last Weight': '140 lb',
          'Last Reps': '3x8',
          'date:Last Date:start': '2026-10-05',
          'Next Target': '140 lb',
        },
      },
    ],
    dbCounts: {},
    exercises: [
      { id: 'ex-1', name: 'Bench Press', primary_muscle: 'chest', secondary_muscles: [], equipment: 'barbell', load_mode: 'total', active: true },
    ],
    liftState: [
      {
        exercise_id: 'ex-1',
        name: 'Bench Press',
        last_date: '2026-10-01',
        last_weight: 135,
        last_unit: 'lb',
        last_reps: [8, 8, 8],
        last_full_reps: [8, 8, 8],
        last_sets: 3,
      },
    ],
    days: [],
    slots: [],
    rotation: null,
    rules: exampleRules,
  });

  assert.equal(report.mismatches.length, 1);
  assert.match(report.mismatches[0].exercise, /Bench Press/);
});

/* Notion records session duration as a float (48.68 minutes); sessions.duration_min
   is an integer column, and Postgres rejects the float outright rather than
   coercing it. The live load died on this after 23 of 52 sessions. Rounding to
   the nearest minute loses under a minute and matches what the column means. */
test('a fractional session duration is rounded to fit the integer column', () => {
  const payload = prepareLoadPayload({
    rowsData: {
      exercises: [],
      sessions: [{ notion_page_id: 'p1', date: '2026-09-01', kind: 'training', status: 'done', duration_min: 48.68, exercises: [] }],
      body_metrics: [],
      block: null,
    },
    docsData: { manual: 'm', rules: exampleRules, decisions: [] },
    userId: 'u1',
  });
  assert.equal(payload.sessions[0].row.duration_min, 49);
  assert.ok(Number.isInteger(payload.sessions[0].row.duration_min));
});

test('every integer column in a session row receives an integer or null', () => {
  const payload = prepareLoadPayload({
    rowsData: {
      exercises: [],
      sessions: [{
        notion_page_id: 'p1', date: '2026-09-01', kind: 'training', status: 'done',
        duration_min: 51.72, calories: 430, avg_hr: 118, peak_hr: 151, effort_1_10: 7,
        exercises: [],
      }],
      body_metrics: [],
      block: null,
    },
    docsData: { manual: 'm', rules: exampleRules, decisions: [] },
    userId: 'u1',
  });
  const row = payload.sessions[0].row;
  for (const col of ['duration_min', 'calories', 'avg_hr', 'peak_hr', 'effort_1_10', 'day_index']) {
    const v = row[col];
    assert.ok(v === null || Number.isInteger(v), `${col} is ${v}, which Postgres would reject`);
  }
});

/* The pre-flight exists because two live loads aborted part-way on a row the
   schema rejected, after hundreds of rows were already written. These assert it
   actually catches the two that bit us, and that it passes a clean payload. */
const minimalPayload = (over = {}) => ({
  exercises: [{
    name: 'Sled Push', primary_muscle: 'quads', secondary_muscles: [], equipment: 'machine',
    increment: null, unit: null, load_mode: 'total', movement_tags: [], cues: null,
    flag: null, active: true,
  }],
  sessions: [],
  bodyMetrics: [],
  block: null,
  documents: { manual: 'a manual', rules: exampleRules },
  decisions: [],
  ...over,
});

const sessionWith = (row, exercises = []) => ({
  row: {
    date: '2026-09-01', kind: 'training', status: 'done', source: 'notion_import',
    duration_min: null, calories: null, avg_hr: null, peak_hr: null,
    effort_1_10: null, day_index: null, ...row,
  },
  exercises,
});

test('the pre-flight passes a clean payload', () => {
  assert.deepEqual(preflight(minimalPayload()), []);
});

test('the pre-flight catches a float in an integer column', () => {
  const problems = preflight(minimalPayload({ sessions: [sessionWith({ duration_min: 48.68 })] }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /duration_min/);
});

test('the pre-flight catches a zero where the schema demands a positive integer', () => {
  const problems = preflight(minimalPayload({
    sessions: [sessionWith({}, [{ position: 0, exercise_name: 'Sled Push', target_sets: 0, target_reps: 9, target_weight: null, target_unit: null, deviation_note: null, sets: [] }])],
  }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /target_sets/);
});

test('the pre-flight catches a weight with no unit', () => {
  const problems = preflight(minimalPayload({
    sessions: [sessionWith({}, [{ position: 0, exercise_name: 'Sled Push', target_sets: 3, target_reps: 9, target_weight: 47, target_unit: null, deviation_note: null, sets: [] }])],
  }));
  assert.match(problems.join('\n'), /target_unit/);
});

test('the pre-flight catches an effort outside 1 to 10', () => {
  const problems = preflight(minimalPayload({ sessions: [sessionWith({ effort_1_10: 11 })] }));
  assert.match(problems[0], /effort_1_10/);
});

test('the pre-flight catches an exercise with no muscle or equipment', () => {
  const payload = minimalPayload();
  payload.exercises[0].primary_muscle = null;
  payload.exercises[0].equipment = null;
  const problems = preflight(payload);
  assert.equal(problems.length, 2);
});

test('the pre-flight reports every problem at once, not just the first', () => {
  const problems = preflight(minimalPayload({
    sessions: [sessionWith({ duration_min: 1.5, effort_1_10: 99, avg_hr: 0 })],
  }));
  assert.ok(problems.length >= 3, `expected several problems, got ${problems.length}`);
});
