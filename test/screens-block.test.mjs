/* All numbers below are fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../app/js/store.js';
import { render, generateSheet, reviseSheet } from '../app/js/screens-block.js';
import rulesExample from '../supabase/seed/rules.example.json' with { type: 'json' };

const EXERCISES = [
  { id: 'ex-1', name: 'Bench press', primary_muscle: 'chest', secondary_muscles: ['arms'], equipment: 'barbell', load_mode: 'total' },
  { id: 'ex-2', name: 'Row', primary_muscle: 'back', secondary_muscles: ['arms'], equipment: 'barbell', load_mode: 'total' },
];

const ACTIVE = { id: 'bl-1', name: 'Autumn block', status: 'active', starts_on: '2026-10-05', ends_on: '2026-11-30', rationale: 'Chest volume up, **back held**.' };
const DRAFT = { id: 'bl-2', name: 'Winter block', status: 'draft', starts_on: null, ends_on: null, rationale: 'Adds a second chest day.', source_job_id: 'job-1' };

const detail = (blockId) => ({
  days: [{ id: `${blockId}-d1`, block_id: blockId, day_index: 0, name: 'Push', warmup_note: 'Bike' }],
  slots: [{ id: `${blockId}-s1`, day_id: `${blockId}-d1`, position: 0, exercise_id: 'ex-1', sets: 4, rep_min: 5, rep_max: 8, rest_s: 180, non_negotiable: true, cut_order: null, notes: null }],
});

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1' },
    loaded: true,
    online: true,
    pendingWrites: 0,
    rules: structuredClone(rulesExample),
    exercises: EXERCISES,
    activeBlock: ACTIVE,
    blocks: [ACTIVE, DRAFT],
    days: detail('bl-1').days,
    slots: detail('bl-1').slots,
    blockDetails: { 'bl-1': detail('bl-1'), 'bl-2': detail('bl-2') },
    trainingRate: { per_week_4w: 3 },
    jobs: [],
    ...over,
  });
}

beforeEach(() => reset());

test('the active block shows its days and exercises', () => {
  const html = render();
  assert.match(html, /Autumn block/);
  assert.match(html, /Push/);
  assert.match(html, /Bench press/);
  assert.match(html, /4 &times; 5-8/);
});

test('the active block renders its rationale as markdown', () => {
  assert.match(render(), /<strong>back held<\/strong>/);
});

test('a non-negotiable slot is marked in the block view', () => {
  assert.match(render(), /non-negotiable/i);
});

test('a draft is shown with its rationale', () => {
  const html = render();
  assert.match(html, /Winter block/);
  assert.match(html, /Adds a second chest day/);
});

test('a draft shows its projected volume against the minimums', () => {
  const html = render();
  assert.match(html, /chest/i);
  assert.match(html, /short/i, 'four chest sets a cycle cannot reach a minimum of ten');
});

test('a draft offers activate, request changes and discard', () => {
  const html = render();
  assert.match(html, /data-action="activate-block" data-id="bl-2"/);
  assert.match(html, /data-action="request-changes" data-id="bl-2"/);
  assert.match(html, /data-action="discard-block" data-id="bl-2"/);
});

test('the active block is not offered an activate button', () => {
  assert.doesNotMatch(render(), /data-action="activate-block" data-id="bl-1"/);
});

test('generating a block is always offered', () => {
  assert.match(render(), /data-action="generate-block"/);
});

test('no blocks at all explains itself and offers to generate one', () => {
  reset({ activeBlock: null, blocks: [], days: [], slots: [], blockDetails: {} });
  const html = render();
  assert.match(html, /no block/i);
  assert.match(html, /data-action="generate-block"/);
});

test('a queued job is shown as waiting', () => {
  reset({ jobs: [{ id: 'job-1', kind: 'block', status: 'queued', created_at: '2026-11-06T10:00:00Z' }] });
  assert.match(render(), /queued/i);
});

test('a running job is shown as running', () => {
  reset({ jobs: [{ id: 'job-1', kind: 'block', status: 'running', created_at: '2026-11-06T10:00:00Z' }] });
  assert.match(render(), /running/i);
});

test('a failed job shows its error', () => {
  reset({ jobs: [{ id: 'job-1', kind: 'block', status: 'failed', error: 'volume gate failed for chest', created_at: '2026-11-06T10:00:00Z' }] });
  assert.match(render(), /volume gate failed for chest/);
});

test('a check-in job is not shown on the block screen', () => {
  reset({ jobs: [{ id: 'job-9', kind: 'checkin', status: 'running', created_at: '2026-11-06T10:00:00Z' }] });
  assert.doesNotMatch(render(), /running/i);
});

test('while a block job is in flight, generate is disabled', () => {
  reset({ jobs: [{ id: 'job-1', kind: 'block', status: 'running', created_at: '2026-11-06T10:00:00Z' }] });
  assert.match(render(), /data-action="generate-block"[^>]*disabled|disabled[^>]*data-action="generate-block"/);
});

test('the generate sheet asks for this block\'s instructions in free text', () => {
  const html = generateSheet();
  assert.match(html, /id="job-instructions"/);
  assert.match(html, /<textarea/);
  assert.match(html, /data-action="submit-generate"/);
});

test('the revise sheet carries the draft id and asks for a comment', () => {
  const html = reviseSheet(DRAFT);
  assert.match(html, /Winter block/);
  assert.match(html, /id="job-instructions"/);
  assert.match(html, /data-action="submit-revise" data-id="bl-2"/);
});

test('a hostile block name cannot inject markup', () => {
  reset({ blocks: [{ ...DRAFT, name: '<img src=x onerror=alert(1)>' }], activeBlock: null, days: [], slots: [] });
  const html = render();
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test('a rationale cannot smuggle markup through the markdown renderer', () => {
  reset({ blocks: [{ ...DRAFT, rationale: '<script>alert(1)</script>' }], activeBlock: null, days: [], slots: [] });
  assert.doesNotMatch(render(), /<script>alert/);
});

test('rendering never throws with no rules and no details loaded', () => {
  reset({ rules: null, blockDetails: {}, trainingRate: null });
  assert.doesNotThrow(() => render());
});

test('activationRow sets active status and the start date', async () => {
  const { activationRow } = await import('../app/js/screens-block.js');
  assert.deepEqual(activationRow('2026-11-02'), { status: 'active', starts_on: '2026-11-02' });
});
