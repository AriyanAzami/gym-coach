/* All content below is fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state } from '../app/js/store.js';
import { render, exerciseSheet, exerciseRowFromForm } from '../app/js/screens-settings.js';

const schema = JSON.parse(readFileSync('coach/schema/rules.schema.json', 'utf8'));
const rules = JSON.parse(readFileSync('supabase/seed/rules.example.json', 'utf8'));

const DOCS = [
  { id: 'd-3', key: 'rules', version: 2, body_json: rules, body_md: null, created_at: '2026-11-01T09:00:00Z' },
  { id: 'd-2', key: 'rules', version: 1, body_json: rules, body_md: null, created_at: '2026-09-01T09:00:00Z' },
  { id: 'd-1', key: 'manual', version: 1, body_json: null, body_md: '# Manual\n\nTrain hard.', created_at: '2026-09-01T09:00:00Z' },
];

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1', email: 'owner@example.invalid' },
    loaded: true,
    online: true,
    pendingWrites: 0,
    rules: structuredClone(rules),
    rulesVersion: 2,
    manual: '# Manual\n\nTrain hard.',
    manualVersion: 1,
    documents: DOCS,
    rulesSchema: schema,
    exercises: [
      { id: 'ex-1', name: 'Bench press', primary_muscle: 'chest', secondary_muscles: ['arms'], equipment: 'barbell', increment: 5, unit: 'lb', load_mode: 'total', movement_tags: ['horizontal_press'], cues: 'Elbows tucked.', flag: null, active: true },
      { id: 'ex-2', name: 'Overhead press', primary_muscle: 'shoulders', secondary_muscles: [], equipment: 'barbell', increment: 5, unit: 'lb', load_mode: 'total', movement_tags: ['overhead_press'], cues: null, flag: 'shoulder', active: false },
    ],
    ...over,
  });
}

beforeEach(() => reset());

test('the rules editor is loaded with the current version', () => {
  const html = render({});
  assert.match(html, /id="rules-json"/);
  assert.match(html, /indirect_factor/);
  assert.match(html, /version 2/i);
});

test('saving rules is offered', () => {
  assert.match(render({}), /data-action="save-rules"/);
});

test('every stored rules version is listed with a rollback', () => {
  const html = render({});
  assert.match(html, /data-action="rollback-rules" data-version="1"/);
});

test('the current version is not offered a rollback to itself', () => {
  assert.doesNotMatch(render({}), /data-action="rollback-rules" data-version="2"/);
});

test('the manual editor is loaded with the current manual', () => {
  const html = render({});
  assert.match(html, /id="manual-md"/);
  assert.match(html, /Train hard/);
});

test('exercises are listed with their muscle and equipment', () => {
  const html = render({});
  assert.match(html, /Bench press/);
  assert.match(html, /chest/);
  assert.match(html, /barbell/);
});

test('an inactive exercise is marked', () => {
  assert.match(render({}), /inactive/i);
});

test('a flagged exercise shows its flag', () => {
  assert.match(render({}), /shoulder/);
});

test('each exercise can be edited', () => {
  assert.match(render({}), /data-action="edit-exercise" data-id="ex-1"/);
});

test('sign out is offered', () => {
  assert.match(render({}), /data-action="sign-out"/);
});

test('the signed-in account is shown', () => {
  assert.match(render({}), /owner@example\.invalid/);
});

test('with no rules document the editor offers the example to start from', () => {
  reset({ rules: null, rulesVersion: null, documents: [] });
  const html = render({});
  assert.match(html, /id="rules-json"/);
  assert.match(html, /no rules/i);
});

test('the exercise sheet exposes every editable field', () => {
  const html = exerciseSheet(state.exercises[0]);
  for (const field of ['name', 'primary_muscle', 'secondary_muscles', 'equipment', 'increment', 'unit', 'load_mode', 'movement_tags', 'cues', 'flag', 'active']) {
    assert.match(html, new RegExp(`id="ex-${field}"`), `the sheet has no ${field} field`);
  }
});

test('a blank exercise increment saves null for both increment and unit so rules default applies', () => {
  const row = exerciseRowFromForm({
    name: 'Cable row',
    primary_muscle: 'back',
    secondary_muscles: 'arms',
    equipment: 'cable',
    increment: '',
    unit: 'lb',
    load_mode: 'total',
    movement_tags: 'horizontal_pull',
    cues: '',
    flag: '',
    active: true,
  });
  assert.equal(row.increment, null);
  assert.equal(row.unit, null);
});

test('a positive exercise increment keeps its value and unit', () => {
  const row = exerciseRowFromForm({
    name: 'Bench press',
    primary_muscle: 'chest',
    secondary_muscles: 'arms, shoulders',
    equipment: 'barbell',
    increment: '2.5',
    unit: 'kg',
    load_mode: 'total',
    movement_tags: 'horizontal_press',
    cues: 'Pause',
    flag: '',
    active: true,
  });
  assert.equal(row.increment, 2.5);
  assert.equal(row.unit, 'kg');
});

test('a hostile exercise name cannot inject markup', () => {
  reset({ exercises: [{ ...state.exercises[0], name: '<img src=x onerror=alert(1)>' }] });
  const html = render({});
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test('a hostile rules document cannot inject markup into the editor', () => {
  reset({ rules: { note: '</textarea><script>alert(1)</script>' } });
  const html = render({});
  assert.doesNotMatch(html, /<\/textarea><script>/);
});

test('rendering never throws on an empty database', () => {
  reset({ rules: null, rulesVersion: null, manual: null, documents: [], exercises: [], user: null });
  assert.doesNotThrow(() => render({}));
});
