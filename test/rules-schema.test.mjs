/* The rules document is the single source of every coaching number, so its
   shape is checked harder than anything else in the repo. Values here are
   fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRules, rulesSchema } from '../coach/lib/rules.mjs';

const example = JSON.parse(readFileSync('supabase/seed/rules.example.json', 'utf8'));
const clone = () => structuredClone(example);

test('the example rules validate', () => {
  assert.deepEqual(validateRules(example), []);
});

test('the schema declares draft 2020-12 and forbids extra sections', () => {
  assert.equal(rulesSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(rulesSchema.additionalProperties, false);
});

test('every section is required', () => {
  const sections = Object.keys(rulesSchema.properties);
  assert.deepEqual([...rulesSchema.required].sort(), sections.sort());
  for (const s of sections) {
    const r = clone();
    delete r[s];
    assert.ok(validateRules(r).length > 0, `deleting ${s} was accepted`);
  }
});

test('an unknown key fails', () => {
  const r = clone();
  r.volume.extra = 1;
  assert.match(validateRules(r).join('\n'), /volume/);
});

test('an unknown top-level section fails', () => {
  const r = clone();
  r.cardio = {};
  assert.ok(validateRules(r).length > 0);
});

test('indirect_factor outside zero to one fails', () => {
  for (const bad of [-0.1, 1.5]) {
    const r = clone();
    r.volume.indirect_factor = bad;
    assert.match(validateRules(r).join('\n'), /indirect_factor/);
  }
});

test('complete_fraction outside zero to one fails', () => {
  const r = clone();
  r.rotation.complete_fraction = 2;
  assert.match(validateRules(r).join('\n'), /complete_fraction/);
});

test('a negative or zero increment fails', () => {
  for (const bad of [-5, 0]) {
    const r = clone();
    r.progression.increments.barbell = bad;
    assert.match(validateRules(r).join('\n'), /increments/);
  }
});

test('an empty increments map fails', () => {
  const r = clone();
  r.progression.increments = {};
  assert.ok(validateRules(r).length > 0);
});

test('a gain band with the low above the high fails', () => {
  const r = clone();
  r.nutrition.gain_band_kg_per_week = [0.4, 0.1];
  assert.match(validateRules(r).join('\n'), /gain_band_kg_per_week/);
});

test('a gain band that is not two numbers fails', () => {
  const r = clone();
  r.nutrition.gain_band_kg_per_week = [0.1];
  assert.ok(validateRules(r).length > 0);
});

test('sessions_to_trigger below one fails', () => {
  const r = clone();
  r.stall.sessions_to_trigger = 0;
  assert.match(validateRules(r).join('\n'), /sessions_to_trigger/);
});

test('an empty interventions list fails', () => {
  const r = clone();
  r.stall.interventions = [];
  assert.match(validateRules(r).join('\n'), /interventions/);
});

test('duplicate interventions fail', () => {
  const r = clone();
  r.stall.interventions = ['add_set', 'add_set'];
  assert.match(validateRules(r).join('\n'), /interventions/);
});

test('an empty priority list fails', () => {
  const r = clone();
  r.priority = [];
  assert.match(validateRules(r).join('\n'), /priority/);
});

test('a muscle named in min_weekly_sets.by_muscle must be in priority', () => {
  const r = clone();
  r.volume.min_weekly_sets.by_muscle.forearms = 6;
  assert.match(validateRules(r).join('\n'), /forearms/);
});

test('an unknown unit fails', () => {
  const r = clone();
  r.units.weight = 'stone';
  assert.match(validateRules(r).join('\n'), /weight/);
});

test('a non-object document fails without throwing', () => {
  for (const bad of [null, 'rules', 7, []]) {
    assert.ok(validateRules(bad).length > 0);
  }
});

test('the browser copy of the schema is byte-identical', () => {
  const a = readFileSync('coach/schema/rules.schema.json');
  const b = readFileSync('app/schema/rules.schema.json');
  assert.ok(a.equals(b), 'app/schema/rules.schema.json has drifted from coach/schema/');
});

test('the example holds no real training numbers', () => {
  // Fabricated placeholders only: nothing that reads as a logged load.
  const text = readFileSync('supabase/seed/rules.example.json', 'utf8');
  assert.doesNotMatch(text, /\blb\/hand\b/);
  assert.doesNotMatch(text, /@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(text, /[0-9a-f]{32}/i);
});
