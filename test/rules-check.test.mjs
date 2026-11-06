/* The rules editor validates in the browser, where ajv and node:fs do not
   exist, so the checker is a dependency-free module both sides share. ajv is
   kept as the oracle: this test asserts the two agree on every case, so the
   checker cannot quietly drift from the schema's real meaning. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { checkAgainstSchema } from '../app/js/rules-check.js';

const schema = JSON.parse(readFileSync('coach/schema/rules.schema.json', 'utf8'));
const valid = JSON.parse(readFileSync('supabase/seed/rules.example.json', 'utf8'));
const ajvValidate = new Ajv({ allErrors: true, strict: true }).compile(schema);

const clone = () => structuredClone(valid);
const mutate = (fn) => { const r = clone(); fn(r); return r; };

const CASES = [
  ['the example as shipped', clone()],
  ['a missing section', mutate((r) => { delete r.volume; })],
  ['a missing nested key', mutate((r) => { delete r.volume.indirect_factor; })],
  ['an unknown top-level section', mutate((r) => { r.cardio = {}; })],
  ['an unknown nested key', mutate((r) => { r.volume.extra = 1; })],
  ['a number above its maximum', mutate((r) => { r.volume.indirect_factor = 1.5; })],
  ['a number below its minimum', mutate((r) => { r.volume.indirect_factor = -0.1; })],
  ['an exclusiveMinimum violation', mutate((r) => { r.progression.increments.barbell = 0; })],
  ['a negative increment', mutate((r) => { r.progression.increments.barbell = -5; })],
  ['an empty increments map', mutate((r) => { r.progression.increments = {}; })],
  ['a wrong type for a number', mutate((r) => { r.volume.indirect_factor = 'half'; })],
  ['a wrong type for a string', mutate((r) => { r.warmup.note = 7; })],
  ['a wrong type for an array', mutate((r) => { r.priority = 'back'; })],
  ['a wrong type for an object', mutate((r) => { r.volume = []; })],
  ['a bad enum value', mutate((r) => { r.units.weight = 'stone'; })],
  ['a bad const value', mutate((r) => { r.progression.scheme = 'linear'; })],
  ['a const boolean flipped', mutate((r) => { r.progression.most_recent_entry_decides = false; })],
  ['an empty required array', mutate((r) => { r.priority = []; })],
  ['duplicate array items', mutate((r) => { r.stall.interventions = ['a', 'a']; })],
  ['an array item of the wrong type', mutate((r) => { r.priority = ['back', 7]; })],
  ['an empty string where minLength applies', mutate((r) => { r.opener.label = ''; })],
  ['too few array items', mutate((r) => { r.nutrition.gain_band_kg_per_week = [0.1]; })],
  ['too many array items', mutate((r) => { r.nutrition.gain_band_kg_per_week = [0.1, 0.2, 0.3]; })],
  ['a non-integer where an integer is required', mutate((r) => { r.session.max_exercises = 7.5; })],
  ['an integer below minimum', mutate((r) => { r.stall.sessions_to_trigger = 0; })],
  ['a deeply nested violation', mutate((r) => { r.deload.triggers.effort_above = 99; })],
  ['a null where an object belongs', mutate((r) => { r.rotation = null; })],
  ['an extra key in a nested object', mutate((r) => { r.session.rest_s.supersets = 1; })],
  ['a free-form map value of the wrong type', mutate((r) => { r.volume.min_weekly_sets.by_muscle.chest = 'ten'; })],
  ['several faults at once', mutate((r) => {
    delete r.priority;
    r.units.weight = 'stone';
    r.volume.indirect_factor = 9;
  })],
];

for (const [name, doc] of CASES) {
  test(`the checker agrees with ajv on ${name}`, () => {
    const ajvOk = ajvValidate(doc);
    const mine = checkAgainstSchema(doc, schema);
    assert.equal(
      mine.length === 0,
      ajvOk,
      `ajv says ${ajvOk ? 'valid' : 'invalid'} but the checker returned ${JSON.stringify(mine)}`,
    );
  });
}

test('a non-object document is rejected without throwing', () => {
  for (const bad of [null, 'rules', 7, [], undefined]) {
    assert.ok(checkAgainstSchema(bad, schema).length > 0);
  }
});

test('error messages name the path that failed', () => {
  const errors = checkAgainstSchema(mutate((r) => { r.volume.indirect_factor = 9; }), schema);
  assert.match(errors.join('\n'), /indirect_factor/);
});

test('the checker reports every fault, not just the first', () => {
  const errors = checkAgainstSchema(mutate((r) => {
    r.units.weight = 'stone';
    r.volume.indirect_factor = 9;
  }), schema);
  assert.ok(errors.length >= 2, `expected at least two errors, got ${JSON.stringify(errors)}`);
});

test('the checker needs no node built-ins, so it runs in a browser', () => {
  const source = readFileSync('app/js/rules-check.js', 'utf8');
  assert.doesNotMatch(source, /require\(|from 'node:|from "node:/);
  assert.doesNotMatch(source, /from 'ajv|from "ajv/);
});
