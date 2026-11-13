import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staleJobs, STALE_AFTER_MINUTES } from '../coach/lib/stale.mjs';

const now = '2030-01-01T12:00:00Z';
const ago = (m) => new Date(Date.parse(now) - m * 60_000).toISOString();

test('staleJobs picks queued and running jobs older than the limit', () => {
  const jobs = [
    { id: 'a', status: 'queued', created_at: ago(90) },
    { id: 'b', status: 'running', created_at: ago(41) },
    { id: 'c', status: 'running', created_at: ago(10) },
    { id: 'd', status: 'done', created_at: ago(500) },
    { id: 'e', status: 'failed', created_at: ago(500) },
  ];
  assert.deepEqual(staleJobs(jobs, now, 40), ['a', 'b']);
});

test('staleJobs skips the current job and handles an empty list', () => {
  const jobs = [{ id: 'me', status: 'running', created_at: ago(120) }];
  assert.deepEqual(staleJobs(jobs, now, 40, 'me'), []);
  assert.deepEqual(staleJobs([], now, 40), []);
});

test('the stale threshold outlasts the 25 minute workflow timeout', () => {
  assert.ok(STALE_AFTER_MINUTES > 25);
});
