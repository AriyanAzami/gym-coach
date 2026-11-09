/* All content below is fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../app/js/store.js';
import { render, summarize, describeSchedule } from '../app/js/screens-health.js';

const f = (area, severity, title, extra = {}) => ({ area, severity, code: 'x', title, detail: `${title} detail`, source: 'checker', ...extra });

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1' },
    loaded: true,
    online: true,
    pendingWrites: 0,
    healthRuns: [],
    healthSettings: null,
    ...over,
  });
}

beforeEach(() => reset());

test('with no runs and no settings it explains itself and offers a run and a schedule', () => {
  const html = render();
  assert.match(html, /<h1>Health<\/h1>/);
  assert.match(html, /No checks yet/);
  assert.match(html, /data-action="health-run"/);
  assert.match(html, /data-action="health-save"/);
  assert.match(html, /<option value="weekly" selected>/);
  assert.match(html, /<option value="6" selected>Sunday/);
  assert.match(html, /<option value="19" selected>19:00/);
});

test('a finished run groups findings by area and says which areas are clear', () => {
  reset({
    healthRuns: [{
      id: 'r1', trigger: 'manual', status: 'done', created_at: '2026-11-08T18:00:00Z', finished_at: '2026-11-08T18:01:00Z',
      findings: [f('training', 'warn', 'Last week was short'), f('plumbing', 'bad', 'Coach jobs stuck')],
      ai_summary_md: '- Squat is **moving**', ai_model: 'nvidia/nemotron-3-ultra-550b-a55b',
    }],
  });
  const html = render();
  assert.match(html, /Last week was short/);
  assert.match(html, /Coach jobs stuck/);
  assert.match(html, /Data[\s\S]*?All clear/);
  assert.match(html, /<strong>moving<\/strong>/);
  assert.match(html, /nemotron-3-ultra/);
});

test('findings and summaries are escaped', () => {
  reset({
    healthRuns: [{
      id: 'r1', trigger: 'schedule', status: 'done', created_at: '2026-11-08T18:00:00Z',
      findings: [f('data', 'warn', '<img src=x onerror=alert(1)>')],
      ai_error: '<b>boom</b>',
    }],
  });
  const html = render();
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /<b>boom<\/b>/);
});

test('a model failure is shown without hiding the checker findings', () => {
  reset({
    healthRuns: [{
      id: 'r1', trigger: 'schedule', status: 'done', created_at: '2026-11-08T18:00:00Z',
      findings: [f('training', 'warn', 'Stalled lifts')], ai_error: 'model returned 429',
    }],
  });
  const html = render();
  assert.match(html, /Stalled lifts/);
  assert.match(html, /AI review skipped[\s\S]*model returned 429/);
});

test('a run in progress disables the button', () => {
  reset({ healthRuns: [{ id: 'r1', trigger: 'manual', status: 'running', created_at: new Date().toISOString(), findings: [] }] });
  const html = render();
  assert.match(html, /Checking/);
  assert.match(html, /data-action="health-run" disabled/);
});

test('a run that never finished is reported, and does not block a new one', () => {
  reset({ healthRuns: [{ id: 'r1', trigger: 'manual', status: 'running', created_at: '2026-01-01T00:00:00Z', findings: [] }] });
  const html = render();
  assert.match(html, /did not finish/);
  assert.doesNotMatch(html, /data-action="health-run" disabled/);
});

test('a failed run shows its reason', () => {
  reset({ healthRuns: [{ id: 'r1', trigger: 'manual', status: 'failed', error: 'could not read data', created_at: '2026-11-08T18:00:00Z', findings: [] }] });
  assert.match(render(), /could not read data/);
});

test('saved settings are shown as selected', () => {
  reset({
    healthSettings: {
      enabled: false, cadence: 'fortnightly', run_weekday: 2, run_hour: 7, timezone: 'Europe/Berlin',
      primary_model: 'moonshotai/kimi-k2.6', fallback_model: null,
    },
  });
  const html = render();
  assert.match(html, /<option value="fortnightly" selected>/);
  assert.match(html, /<option value="2" selected>Wednesday/);
  assert.match(html, /<option value="7" selected>07:00/);
  assert.match(html, /value="Europe\/Berlin"/);
  assert.match(html, /value="moonshotai\/kimi-k2.6"/);
  assert.doesNotMatch(html, /id="health-enabled" checked/);
  assert.match(html, /Paused/);
});

test('history lists earlier runs with their counts', () => {
  reset({
    healthRuns: [
      { id: 'r2', trigger: 'manual', status: 'done', created_at: '2026-11-08T18:00:00Z', findings: [] },
      { id: 'r1', trigger: 'schedule', status: 'done', created_at: '2026-11-01T18:00:00Z', findings: [f('data', 'bad', 'a'), f('data', 'warn', 'b')] },
    ],
  });
  const html = render();
  assert.match(html, /History/);
  assert.match(html, /1 problem · 1 warning/);
});

test('summarize counts by severity and picks the worst', () => {
  assert.deepEqual(summarize([]), { bad: 0, warn: 0, worst: 'ok' });
  assert.deepEqual(summarize([f('data', 'warn', 'a'), f('repo', 'bad', 'b')]), { bad: 1, warn: 1, worst: 'bad' });
});

test('the schedule reads as a sentence', () => {
  assert.equal(describeSchedule({ enabled: true, cadence: 'weekly', run_weekday: 6, run_hour: 19, timezone: 'UTC' }), 'Weekly on Sunday at 19:00 (UTC)');
  assert.equal(describeSchedule({ enabled: true, cadence: 'daily', run_weekday: 0, run_hour: 7, timezone: 'UTC' }), 'Daily at 07:00 (UTC)');
  assert.equal(describeSchedule({ enabled: false, cadence: 'weekly', run_weekday: 0, run_hour: 7, timezone: 'UTC' }), 'Paused');
});
