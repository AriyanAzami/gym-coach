import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const strip = (y) => y.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const coach = strip(readFileSync('.github/workflows/coach.yml', 'utf8').replace(/\r/g, ''));
const pages = strip(readFileSync('.github/workflows/pages.yml', 'utf8').replace(/\r/g, ''));

const steps = coach.slice(coach.indexOf('    steps:')).split(/\n      - /).slice(1);
const step = (name) => {
  const s = steps.find((x) => x.includes(`name: ${name}`));
  assert.ok(s, `no step named ${name}`);
  return s;
};

test('service-role secrets are not in job-level env', () => {
  const header = coach.slice(0, coach.indexOf('    steps:'));
  assert.doesNotMatch(header, /SUPABASE_/);
});

test('only the steps that talk to Supabase hold its secrets', () => {
  for (const s of steps) {
    const has = /SUPABASE_SERVICE_ROLE_KEY/.test(s);
    const wanted = /name: (Build the context|Save the result|Close the job out on failure)/.test(s);
    assert.equal(has, wanted, `unexpected secret exposure in: ${s.split('\n')[0]}`);
  }
});

test('the claude step has only the Claude token as a secret', () => {
  const s = step('Run the coach');
  assert.deepEqual([...s.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ['CLAUDE_CODE_OAUTH_TOKEN']);
});

test('the model may edit only under work/', () => {
  const rules = coach.match(/--allowedTools ([^\n]*)/)[1];
  assert.doesNotMatch(rules, /"(Write|Edit)"/, 'bare Write/Edit reaches the validator');
  assert.doesNotMatch(rules, /"Write\b/);
  assert.match(rules, /"Edit\(work\/\*\*\)"/);
  assert.match(rules, /"Read"/);
});

test('the checkout is restored between the model and the secrets', () => {
  const names = steps.map((s) => s.match(/name: ([^\n]*)/)?.[1]);
  const run = names.indexOf('Run the coach');
  const restore = names.indexOf('Restore the checkout');
  const save = names.indexOf('Save the result');
  assert.ok(run < restore && restore < save);
  const s = steps[restore];
  assert.match(s, /git checkout -- \./);
  assert.match(s, /git clean -ffdx -e work\//);
  assert.match(s, /npm ci --ignore-scripts/);
  assert.match(s, /NPM_CONFIG_USERCONFIG: \/dev\/null/);
});

test('concurrency is per job id so a pending run is never replaced', () => {
  assert.match(coach, /group: coach-\$\{\{[^}]*job_id[^}]*\}\}/);
});

test('the failure step also runs on cancel and timeout', () => {
  assert.match(step('Close the job out on failure'), /if: failure\(\) \|\| cancelled\(\)/);
});

test('the Claude Code CLI is pinned to an exact version', () => {
  assert.match(coach, /npm i -g @anthropic-ai\/claude-code@\d+\.\d+\.\d+\s*(\n|$)/);
});

test('pages deploy waits for the tests', () => {
  assert.match(pages, /\n  test:/);
  assert.match(pages, /run: npm test/);
  assert.match(pages, /run: npm ci/);
  assert.match(pages, /deploy:\s*\n\s*needs: test/);
});
