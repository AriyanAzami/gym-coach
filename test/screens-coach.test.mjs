/* All content below is fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../app/js/store.js';
import { render, askSheet } from '../app/js/screens-coach.js';
import rulesExample from '../supabase/seed/rules.example.json' with { type: 'json' };

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1' },
    loaded: true,
    online: true,
    pendingWrites: 0,
    rules: structuredClone(rulesExample),
    notes: [
      { id: 'n-1', body: 'more lats next block', consumed_by_job: null, created_at: '2026-11-05T09:00:00Z' },
      { id: 'n-2', body: 'knee twinge on leg press', consumed_by_job: 'job-0', created_at: '2026-10-20T09:00:00Z' },
    ],
    jobs: [
      { id: 'job-1', kind: 'checkin', status: 'done', output_md: '## Check-in\n\nBench is **up** 15 lb.', created_at: '2026-11-04T09:00:00Z' },
      { id: 'job-2', kind: 'ask', status: 'failed', error: 'context build failed', created_at: '2026-11-03T09:00:00Z' },
    ],
    decisions: [{ id: 'd-1', date: '2026-10-01', title: 'Dropped overhead press', body: 'Shoulder.' }],
    ...over,
  });
}

beforeEach(() => reset());

test('a note box is offered', () => {
  const html = render();
  assert.match(html, /id="note-body"/);
  assert.match(html, /data-action="add-note"/);
});

test('unconsumed notes are listed and marked as waiting', () => {
  const html = render();
  assert.match(html, /more lats next block/);
  assert.match(html, /waiting/i);
});

test('a note already used by a job is not shown as waiting', () => {
  const html = render();
  const idx = html.indexOf('knee twinge on leg press');
  assert.ok(idx > -1, 'consumed notes should still be visible in history');
  assert.doesNotMatch(html.slice(idx, idx + 200), /waiting/i);
});

test('check-in and ask are both offered', () => {
  const html = render();
  assert.match(html, /data-action="checkin"/);
  assert.match(html, /data-action="ask-coach"/);
});

test('a finished job renders its output as markdown', () => {
  const html = render();
  assert.match(html, /<h3>Check-in<\/h3>/);
  assert.match(html, /<strong>up<\/strong>/);
});

test('a failed job shows its error', () => {
  assert.match(render(), /context build failed/);
});

test('a running job is shown as running', () => {
  reset({ jobs: [{ id: 'job-3', kind: 'checkin', status: 'running', created_at: '2026-11-06T09:00:00Z' }] });
  assert.match(render(), /running/i);
});

test('block jobs are not repeated on the coach screen', () => {
  reset({ jobs: [{ id: 'job-4', kind: 'block', status: 'done', created_at: '2026-11-06T09:00:00Z' }] });
  assert.doesNotMatch(render(), /job-4/);
});

test('while a check-in is in flight the button is disabled', () => {
  reset({ jobs: [{ id: 'job-5', kind: 'checkin', status: 'queued', created_at: '2026-11-06T09:00:00Z' }] });
  assert.match(render(), /data-action="checkin"[^>]*disabled/);
});

test('recent decisions are listed', () => {
  assert.match(render(), /Dropped overhead press/);
});

test('the ask sheet asks for a question', () => {
  const html = askSheet();
  assert.match(html, /id="job-instructions"/);
  assert.match(html, /data-action="submit-ask"/);
});

test('no notes and no jobs still renders', () => {
  reset({ notes: [], jobs: [], decisions: [] });
  assert.doesNotThrow(() => render());
  assert.match(render(), /data-action="add-note"/);
});

test('a hostile note cannot inject markup', () => {
  reset({ notes: [{ id: 'n-9', body: '<img src=x onerror=alert(1)>', consumed_by_job: null, created_at: '2026-11-05T09:00:00Z' }] });
  const html = render();
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test('a hostile job output cannot inject markup through the markdown renderer', () => {
  reset({ jobs: [{ id: 'job-9', kind: 'ask', status: 'done', output_md: '<script>alert(1)</script>', created_at: '2026-11-05T09:00:00Z' }] });
  assert.doesNotMatch(render(), /<script>alert/);
});
