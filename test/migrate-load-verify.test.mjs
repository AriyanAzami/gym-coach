/* Tests for the Notion loader and verification report builder.
   All exercise names, dates and numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareLoadPayload } from '../migrate/load.mjs';
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
    sources: {
      gym_log: { expected_count: 1 },
      lift_tracker: { expected_count: 1 },
      body_metrics: { expected_count: 1 },
      monthly_plans: { expected_count: 1 },
    },
    tracker: [
      {
        properties: {
          Exercise: 'Bench Press',
          Status: 'Active',
          'Last Weight': '135 lb',
          'Last Reps': '3x8',
          'date:Last Date:start': '2026-10-01',
          'Next Session Target': '135 lb — aim for 3x9',
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
});

test('buildVerifyReport flags a weight or date mismatch between Notion and lift_state', () => {
  const report = buildVerifyReport({
    sources: {},
    tracker: [
      {
        properties: {
          Exercise: 'Bench Press',
          Status: 'Active',
          'Last Weight': '140 lb',
          'Last Reps': '3x8',
          'date:Last Date:start': '2026-10-05',
          'Next Session Target': '140 lb',
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
