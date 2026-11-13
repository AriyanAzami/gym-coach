/* Every plan and number below is fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBlock } from '../coach/validate.mjs';

const rules = JSON.parse(readFileSync('supabase/seed/rules.example.json', 'utf8'));

const EXERCISES = [
  { id: 'ex-1', name: 'Barbell row', primary_muscle: 'back', secondary_muscles: ['arms'], equipment: 'barbell', movement_tags: ['horizontal_pull'] },
  { id: 'ex-2', name: 'Lat pulldown', primary_muscle: 'back', secondary_muscles: ['arms'], equipment: 'cable', movement_tags: ['vertical_pull'] },
  { id: 'ex-3', name: 'Bench press', primary_muscle: 'chest', secondary_muscles: ['shoulders', 'arms'], equipment: 'barbell', movement_tags: ['horizontal_press'] },
  { id: 'ex-4', name: 'Incline press', primary_muscle: 'chest', secondary_muscles: ['shoulders'], equipment: 'barbell', movement_tags: ['horizontal_press'] },
  { id: 'ex-5', name: 'Lateral raise', primary_muscle: 'shoulders', secondary_muscles: [], equipment: 'cable', movement_tags: [] },
  { id: 'ex-6', name: 'Leg press', primary_muscle: 'legs', secondary_muscles: [], equipment: 'machine', movement_tags: [] },
  { id: 'ex-7', name: 'Leg curl', primary_muscle: 'legs', secondary_muscles: [], equipment: 'machine', movement_tags: [] },
  { id: 'ex-8', name: 'Plank', primary_muscle: 'core', secondary_muscles: [], equipment: 'bodyweight', movement_tags: ['mobility'] },
];

const context = (over = {}) => ({
  rules: structuredClone(rules),
  exercises: EXERCISES,
  training_rate: { per_week_4w: 3 },
  ...over,
});

const slot = (position, exercise, over = {}) => ({
  position, exercise, sets: 4, rep_min: 8, rep_max: 12, rest_s: 120,
  non_negotiable: false, cut_order: null, notes: null, ...over,
});

/* A plan that clears every gate: two days, enough sets per week at three
   sessions to meet every minimum, core in the warm-up. */
const validPlan = () => ({
  name: 'Winter block',
  starts_on: '2026-11-10',
  ends_on: '2026-12-21',
  rationale: 'Back leads on volume, chest second.',
  days: [
    {
      day_index: 0,
      name: 'Pull',
      warmup_note: 'Bike, then plank.',
      slots: [
        slot(0, 'Barbell row', { sets: 5 }),
        slot(1, 'Lat pulldown', { sets: 5 }),
        slot(2, 'Lateral raise', { sets: 4, rest_s: 60 }),
      ],
    },
    {
      day_index: 1,
      name: 'Push',
      warmup_note: 'Bike.',
      slots: [
        slot(0, 'Bench press', { sets: 4 }),
        slot(1, 'Incline press', { sets: 4 }),
        slot(2, 'Leg press', { sets: 4 }),
        slot(3, 'Leg curl', { sets: 4 }),
      ],
    },
  ],
});

const mutate = (fn) => { const p = validPlan(); fn(p); return p; };
const errorsOf = (plan, ctx = context()) => validateBlock(plan, ctx);
const joined = (plan, ctx) => errorsOf(plan, ctx).join('\n');

test('a valid plan returns no failures', () => {
  assert.deepEqual(errorsOf(validPlan()), []);
});

// ---- schema ----

test('a plan that is not an object fails without throwing', () => {
  for (const bad of [null, 'plan', 7, []]) {
    assert.ok(errorsOf(bad).length > 0);
  }
});

test('a missing name fails with the schema path', () => {
  assert.match(joined(mutate((p) => { delete p.name; })), /name/);
});

test('a day with no slots fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots = []; })), /slots/);
});

test('a plan with no days fails', () => {
  assert.match(joined(mutate((p) => { p.days = []; })), /days/);
});

test('a rep range with min above max fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[0].rep_min = 12; p.days[0].slots[0].rep_max = 8; })), /rep/);
});

test('an unknown key anywhere in the plan fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[0].tempo = '3-1-1'; })), /tempo/);
});

test('duplicate day_index values fail', () => {
  assert.match(joined(mutate((p) => { p.days[1].day_index = 0; })), /day_index/);
});

test('duplicate slot positions within a day fail', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[1].position = 0; })), /position/);
});

// ---- the no-weights gate ----

test('any weight anywhere in the plan fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[0].weight = 185; })), /weight/i);
});

test('a weight hidden in the notes of a slot fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[0].target_weight = 185; })), /weight/i);
});

test('a weight nested inside a new-exercise block fails', () => {
  assert.match(joined(mutate((p) => {
    p.days[0].slots[0].new = { primary_muscle: 'back', secondary_muscles: [], equipment: 'barbell', movement_tags: [], weight: 100 };
  })), /weight/i);
});

// ---- exercises per day ----

test('too many exercises in a day fails against max_exercises', () => {
  const plan = mutate((p) => {
    p.days[1].slots = EXERCISES.slice(0, 8).map((e, i) => slot(i, e.name));
    p.days[1].slots.push(slot(8, 'Plank'));
  });
  assert.match(joined(plan), /max_exercises/);
});

test('exactly max_exercises in a day passes that gate', () => {
  const ctx = context();
  ctx.rules.session.max_exercises = 4; // the busiest day has exactly four
  assert.doesNotMatch(joined(validPlan(), ctx), /max_exercises/);
});

test('one exercise over max_exercises fails', () => {
  const ctx = context();
  ctx.rules.session.max_exercises = 3;
  assert.match(joined(validPlan(), ctx), /max_exercises/);
});

// ---- banned movement tags ----

test('a banned movement tag fails and names the exercise', () => {
  const ctx = context();
  ctx.rules.constraints.banned_movement_tags = ['vertical_pull'];
  const out = joined(validPlan(), ctx);
  assert.match(out, /vertical_pull/);
  assert.match(out, /Lat pulldown/);
});

test('a banned tag on a new exercise is caught too', () => {
  const ctx = context();
  ctx.rules.constraints.banned_movement_tags = ['overhead_press'];
  const plan = mutate((p) => {
    p.days[1].slots[0] = slot(0, 'Push press', {
      new: { primary_muscle: 'shoulders', secondary_muscles: ['arms'], equipment: 'barbell', movement_tags: ['overhead_press'], increment: 5, increment_unit: 'lb' },
    });
  });
  assert.match(joined(plan, ctx), /overhead_press/);
});

// ---- unknown exercises ----

test('an unknown exercise with no new block fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[0].exercise = 'Seal row'; })), /Seal row/);
});

test('an unknown exercise with a complete new block passes', () => {
  const plan = mutate((p) => {
    p.days[0].slots[0] = slot(0, 'Seal row', {
      sets: 5,
      new: { primary_muscle: 'back', secondary_muscles: ['arms'], equipment: 'barbell', movement_tags: ['horizontal_pull'], increment: 5, increment_unit: 'lb' },
    });
  });
  assert.deepEqual(errorsOf(plan), []);
});

test('a new block missing its muscle fails', () => {
  const plan = mutate((p) => {
    p.days[0].slots[0] = slot(0, 'Seal row', {
      sets: 5,
      new: { secondary_muscles: [], equipment: 'barbell', movement_tags: [], increment: 5, increment_unit: 'lb' },
    });
  });
  assert.match(joined(plan), /primary_muscle/);
});

test('a known exercise marked new fails, so the library cannot be duplicated', () => {
  const plan = mutate((p) => {
    p.days[0].slots[0].new = { primary_muscle: 'back', secondary_muscles: [], equipment: 'barbell', movement_tags: [], increment: 5, increment_unit: 'lb' };
  });
  assert.match(joined(plan), /Barbell row/);
});

// ---- rest ----

test('rest below the isolation rest fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[0].rest_s = 15; })), /rest/);
});

test('rest far above the compound rest fails', () => {
  assert.match(joined(mutate((p) => { p.days[0].slots[0].rest_s = 900; })), /rest/);
});

// ---- volume ----

test('a priority muscle under its weekly minimum fails and shows the arithmetic', () => {
  const plan = mutate((p) => { p.days[0].slots[0].sets = 1; p.days[0].slots[1].sets = 1; });
  const out = joined(plan);
  assert.match(out, /back/);
  assert.match(out, /\d/, 'the failure must carry the numbers, not just a verdict');
  assert.match(out, /a week|per week|weekly/i);
});

test('the volume gate is judged at the observed training rate', () => {
  const ctx = context({ training_rate: { per_week_4w: 1 } });
  assert.match(joined(validPlan(), ctx), /back|chest/);
});

test('a muscle the block never trains fails the volume gate', () => {
  const ctx = context();
  ctx.rules.volume.min_weekly_sets.by_muscle.calves = 6;
  ctx.rules.priority.push('calves');
  assert.match(joined(validPlan(), ctx), /calves/);
});

// ---- priority order ----

test('priority order inverted beyond the tolerance fails', () => {
  const plan = mutate((p) => {
    p.days[0].slots[0].sets = 2;
    p.days[0].slots[1].sets = 2;
    p.days[1].slots[0].sets = 10;
    p.days[1].slots[1].sets = 10;
  });
  const out = joined(plan);
  assert.match(out, /priority/i);
});

test('a small inversion inside the tolerance passes the priority gate', () => {
  const ctx = context();
  ctx.rules.volume.priority_tolerance = 1;
  assert.doesNotMatch(joined(validPlan(), ctx), /priority/i);
});

// ---- warm-up placement ----

test('core placed last instead of in the warm-up fails', () => {
  const plan = mutate((p) => { p.days[0].slots.push(slot(3, 'Plank', { rest_s: 60 })); });
  assert.match(joined(plan), /Plank|core/i);
});

test('core placed last passes when the rules allow it anywhere', () => {
  const ctx = context();
  ctx.rules.warmup.core_mobility_placement = 'anywhere';
  const plan = mutate((p) => { p.days[0].slots.push(slot(3, 'Plank', { rest_s: 60 })); });
  assert.doesNotMatch(joined(plan, ctx), /Plank/);
});

// ---- failure reporting ----

test('failures are numbered so the model can work through them', () => {
  const out = errorsOf(mutate((p) => { delete p.name; p.days[0].slots[0].weight = 100; }));
  assert.ok(out.length >= 2);
});

test('a context with no rules fails rather than passing everything', () => {
  assert.ok(errorsOf(validPlan(), { exercises: EXERCISES, training_rate: null }).length > 0);
});

// ---- unavailable equipment ----

test('equipment the rules mark unavailable fails and names the rule', () => {
  const ctx = context();
  ctx.rules.constraints.equipment_unavailable = ['cable'];
  const out = joined(validPlan(), ctx);
  assert.match(out, /Lat pulldown/);
  assert.match(out, /equipment_unavailable/);
});

test('unavailable equipment on a new exercise is caught too', () => {
  const ctx = context();
  ctx.rules.constraints.equipment_unavailable = ['kettlebell'];
  const plan = mutate((p) => {
    p.days[1].slots[0] = slot(0, 'Kettlebell swing', {
      new: { primary_muscle: 'legs', secondary_muscles: [], equipment: 'kettlebell', movement_tags: [], increment: 5, increment_unit: 'lb' },
    });
  });
  assert.match(joined(plan, ctx), /equipment_unavailable/);
});

test('an empty equipment_unavailable list fails nothing', () => {
  const ctx = context();
  ctx.rules.constraints.equipment_unavailable = [];
  assert.doesNotMatch(joined(validPlan(), ctx), /equipment_unavailable/);
});

// ---- deload weeks ----

const deloadPlan = (factor = rules.deload.set_factor) => mutate((p) => {
  p.name = 'Winter block Deload';
  for (const d of p.days) for (const s of d.slots) s.sets = Math.max(1, Math.round(s.sets * factor));
});

test('a deload plan that meets min times set_factor passes with deload true', () => {
  const plan = { ...deloadPlan(), deload: true };
  assert.deepEqual(errorsOf(plan), []);
});

test('the same plan without deload true fails the volume gate', () => {
  assert.match(joined(deloadPlan()), /Volume/);
});

test('a deload plan below min times set_factor still fails, and says it is scaled', () => {
  const plan = { ...deloadPlan(), deload: true };
  for (const d of plan.days) for (const s of d.slots) s.sets = 1;
  const out = joined(plan);
  assert.match(out, /Volume/);
  assert.match(out, /deload/i);
});

test('deload must be a boolean', () => {
  assert.match(joined({ ...validPlan(), deload: 'yes' }), /deload/);
});

test('deload false leaves the full minimums in force', () => {
  assert.match(joined({ ...deloadPlan(), deload: false }), /Volume/);
});
