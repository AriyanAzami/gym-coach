/* The validator is run from the command line inside the Action, by the model and
   then by save.mjs. A module that loads but whose main() never fires would exit
   0 and gate nothing, so the entry point is tested as a real subprocess. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rules = JSON.parse(readFileSync('supabase/seed/rules.example.json', 'utf8'));

function run(args) {
  try {
    const stdout = execFileSync('node', ['coach/validate.mjs', ...args], { encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

const dir = mkdtempSync(join(tmpdir(), 'gym-coach-validate-'));
const write = (name, value) => {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
};

test.after(() => rmSync(dir, { recursive: true, force: true }));

test('valid rules print ok and exit 0', () => {
  const result = run(['--rules', write('rules.json', rules)]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^ok$/m, 'the CLI must actually run, not just load');
});

test('invalid rules exit non-zero and list the problems', () => {
  const broken = structuredClone(rules);
  broken.volume.indirect_factor = 9;
  const result = run(['--rules', write('broken.json', broken)]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /indirect_factor/);
  assert.match(result.stderr, /^1\./m, 'failures are numbered');
});

test('a missing file exits non-zero rather than passing', () => {
  const result = run(['--rules', join(dir, 'nope.json')]);
  assert.notEqual(result.code, 0);
});

test('a valid plan exits 0', () => {
  const plan = {
    name: 'Block', rationale: 'because', starts_on: null, ends_on: null,
    days: [{
      day_index: 0,
      name: 'Full',
      warmup_note: null,
      slots: [
        { position: 0, exercise: 'Row', sets: 6, rep_min: 8, rep_max: 12, rest_s: 120 },
        { position: 1, exercise: 'Press', sets: 6, rep_min: 8, rep_max: 12, rest_s: 120 },
        { position: 2, exercise: 'Squat', sets: 6, rep_min: 8, rep_max: 12, rest_s: 120 },
        { position: 3, exercise: 'Curl', sets: 6, rep_min: 8, rep_max: 12, rest_s: 60 },
        { position: 4, exercise: 'Raise', sets: 6, rep_min: 8, rep_max: 12, rest_s: 60 },
      ],
    }],
  };
  const ctx = {
    rules,
    training_rate: { per_week_4w: 3 },
    exercises: [
      { id: '1', name: 'Row', primary_muscle: 'back', secondary_muscles: [], equipment: 'barbell', movement_tags: [] },
      { id: '2', name: 'Press', primary_muscle: 'chest', secondary_muscles: [], equipment: 'barbell', movement_tags: [] },
      { id: '3', name: 'Squat', primary_muscle: 'legs', secondary_muscles: [], equipment: 'barbell', movement_tags: [] },
      { id: '4', name: 'Curl', primary_muscle: 'arms', secondary_muscles: [], equipment: 'dumbbell', movement_tags: [] },
      { id: '5', name: 'Raise', primary_muscle: 'shoulders', secondary_muscles: [], equipment: 'cable', movement_tags: [] },
    ],
  };
  const result = run(['--plan', write('plan.json', plan), '--context', write('ctx.json', ctx)]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^ok$/m);
});

test('a plan carrying a weight exits non-zero', () => {
  const plan = {
    name: 'Block', rationale: 'because', starts_on: null, ends_on: null,
    days: [{ day_index: 0, name: 'Full', warmup_note: null, slots: [
      { position: 0, exercise: 'Row', sets: 3, rep_min: 8, rep_max: 12, rest_s: 120, weight: 185 },
    ] }],
  };
  const ctx = { rules, training_rate: null, exercises: [{ id: '1', name: 'Row', primary_muscle: 'back', secondary_muscles: [], equipment: 'barbell', movement_tags: [] }] };
  const result = run(['--plan', write('weighted.json', plan), '--context', write('ctx2.json', ctx)]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /weight/i);
});

test('the CLI never prints the plan or the context back out', () => {
  const plan = {
    name: 'Secret block name', rationale: 'private reasoning', starts_on: null, ends_on: null,
    days: [{ day_index: 0, name: 'Full', warmup_note: null, slots: [
      { position: 0, exercise: 'Row', sets: 3, rep_min: 8, rep_max: 12, rest_s: 120, weight: 185 },
    ] }],
  };
  const ctx = { rules, training_rate: null, exercises: [{ id: '1', name: 'Row', primary_muscle: 'back', secondary_muscles: [], equipment: 'barbell', movement_tags: [] }] };
  const result = run(['--plan', write('secret.json', plan), '--context', write('ctx3.json', ctx)]);
  const output = result.stdout + result.stderr;
  assert.doesNotMatch(output, /private reasoning/, 'the rationale must never reach a public Action log');
  assert.doesNotMatch(output, /185/, 'logged numbers must never reach a public Action log');
});
