/* Workflow logs on a public repository are world-readable, and this is the
   workflow that handles training data and holds a Claude token. Every rule it
   must obey is asserted here rather than remembered. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const coachRaw = readFileSync('.github/workflows/coach.yml', 'utf8');

/* Comments explain these very rules, so they would match every check. The
   checks are about what the workflow DOES. */
const stripComments = (yaml) => yaml
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

const coach = stripComments(coachRaw);

test('coach.yml triggers on nothing but repository_dispatch and workflow_dispatch', () => {
  const on = coach.slice(coach.indexOf('on:'), coach.indexOf('permissions:'));
  assert.match(on, /repository_dispatch:/);
  assert.match(on, /workflow_dispatch:/);
  for (const forbidden of ['pull_request_target', 'pull_request', 'issue_comment', 'schedule', 'issues:', 'fork']) {
    assert.doesNotMatch(on, new RegExp(forbidden), `${forbidden} would let an outsider reach the secrets`);
  }
});

test('coach.yml listens for the event type the edge function sends', () => {
  assert.match(coach, /types:\s*\[\s*coach-job\s*\]/);
});

test('coach.yml asks for read-only repository permission', () => {
  assert.match(coach, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(coach, /contents:\s*write/);
});

test('coach.yml serialises runs and bounds their time', () => {
  assert.match(coach, /concurrency:/);
  assert.match(coach, /timeout-minutes:\s*\d+/);
});

test('coach.yml never prints anything under work/', () => {
  for (const line of coach.split('\n')) {
    if (!/work\//.test(line)) continue;
    for (const leak of [/\bcat\b/, /\btee\b/, /\bhead\b/, /\btail\b/, /\becho .*work\//, /upload-artifact/]) {
      assert.doesNotMatch(line, leak, `this line could print job data into a public log: ${line.trim()}`);
    }
  }
});

test('coach.yml uploads no artifacts at all', () => {
  assert.doesNotMatch(coach, /upload-artifact|upload-pages-artifact/);
});

test('the claude step restricts which tools exist, not only which are allowed', () => {
  assert.match(coach, /--tools /, '--allowedTools alone does not remove a tool from the model');
  assert.match(coach, /--allowedTools /);
});

test('the claude step allows only the validator to run as a command', () => {
  const match = coach.match(/--allowedTools ([^\n]*)/);
  assert.ok(match, 'no --allowedTools found');
  const bashRules = [...match[1].matchAll(/"Bash\(([^)]*)\)"/g)].map((m) => m[1]);
  assert.deepEqual(bashRules, ['node coach/validate.mjs:*'],
    `the model may run ${bashRules.join(', ')}`);
});

test('the claude step denies MCP tools', () => {
  assert.match(coach, /--disallowedTools[^\n]*mcp__\*/);
});

test('the claude output is redirected to a file, never to the log', () => {
  assert.match(coach, /> work\/claude\.log 2>&1/);
});

test('the claude step caps its turns', () => {
  assert.match(coach, /--max-turns \d+/);
});

test('the claude step defaults to opus and uses the subscription token', () => {
  assert.match(coach, /--model "\$MODEL"/);
  assert.doesNotMatch(coach, /--model opus/);
  assert.match(coach, /'sonnet' \? 'sonnet' : 'opus'/);
  assert.match(coach, /CLAUDE_CODE_OAUTH_TOKEN/);
});

test('the job id comes from the dispatch payload or the manual input, and nothing else', () => {
  assert.match(coach, /client_payload\.job_id/);
  assert.match(coach, /inputs\.job_id/);
});

test('a failure still closes the job out rather than leaving it running', () => {
  assert.match(coach, /if:\s*failure\(\)/);
});

test('no workflow in the repository echoes a secret', () => {
  for (const file of readdirSync('.github/workflows')) {
    const text = stripComments(readFileSync(`.github/workflows/${file}`, 'utf8'));
    for (const line of text.split('\n')) {
      if (!/secrets\./.test(line)) continue;
      assert.doesNotMatch(line, /\becho\b|\bcat\b|\bprintf\b/,
        `${file} may print a secret: ${line.trim()}`);
    }
  }
});

test('no workflow checks out untrusted code before using a secret', () => {
  assert.doesNotMatch(coach, /ref:\s*\$\{\{\s*github\.event\.(pull_request|client_payload)/);
});
