/* The edge function runs on Deno, so it cannot be executed here. These checks
   hold its contract: it is the one door between the phone and a GitHub Action
   that holds secrets, and what it forwards ends up in a public repository. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/dispatch-job/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

test('the function verifies the caller is a real user', () => {
  assert.match(source, /auth\.getUser\(/, 'the JWT must be resolved to a user, not just present');
});

test('a request with no user is rejected with 401', () => {
  assert.match(source, /401/);
});

test('verify_jwt is left on for this function', () => {
  assert.match(config, /\[functions\.dispatch-job\][\s\S]*?verify_jwt = true/);
});

test('the job kind is checked against the four allowed values', () => {
  for (const kind of ['block', 'revise_block', 'checkin', 'ask']) {
    assert.match(source, new RegExp(`'${kind}'`), `${kind} is not in the allow list`);
  }
  assert.match(source, /400/, 'an unknown kind must be rejected');
});

test('the row is inserted with the service-role key, not the caller\'s', () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('the row is owned by the verified user, never by a client-supplied id', () => {
  assert.match(source, /user_id:\s*user\.id/);
});

test('the dispatch payload carries the job id and nothing else', () => {
  const match = source.match(/client_payload:\s*\{([^}]*)\}/);
  assert.ok(match, 'no client_payload found');
  const keys = match[1].split(',').map((s) => s.split(':')[0].trim()).filter(Boolean);
  assert.deepEqual(keys, ['job_id'], `client_payload carries ${keys.join(', ')}`);
});

test('the instructions are never forwarded to GitHub', () => {
  const match = source.match(/client_payload:\s*\{([^}]*)\}/);
  assert.doesNotMatch(match[1], /instruction/i, 'instructions must stay in the database');
});

test('the event type is the one coach.yml listens for', () => {
  assert.match(source, /event_type:\s*['"]coach-job['"]/);
});

test('a failed dispatch marks the job failed rather than leaving it queued', () => {
  assert.match(source, /status:\s*['"]failed['"]/);
  assert.match(source, /502/);
});

test('the GitHub token and repo come from secrets, never from the request', () => {
  assert.match(source, /GH_DISPATCH_TOKEN/);
  assert.match(source, /GH_REPO/);
  assert.doesNotMatch(source, /body\.(repo|token)/, 'the caller must not choose the repo or token');
});

test('the function never echoes the instructions back in a response', () => {
  const responses = [...source.matchAll(/JSON\.stringify\(\{([^}]*)\}/g)].map((m) => m[1]);
  for (const body of responses) {
    assert.doesNotMatch(body, /instructions/, 'a response body carries the instructions back');
  }
});

test('only POST is accepted', () => {
  assert.match(source, /method\s*!==\s*['"]POST['"]|method\s*===\s*['"]POST['"]/);
});

/* Regression: the function first built its auth client with SUPABASE_ANON_KEY.
   This project uses the newer publishable/secret API keys, where that variable
   can be empty — a client with an empty key sends no apikey header, the gateway
   returns an HTML error page, and getUser fails with a JSON parse error that
   looks exactly like a rejected login. Signing in worked; pressing Check-in
   said "not signed in". The service key is always present, so the JWT check
   uses that. */
test('the auth check does not depend on SUPABASE_ANON_KEY', () => {
  // The comment above the fix names the variable, so check the code only.
  const code = source.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.doesNotMatch(code, /SUPABASE_ANON_KEY/,
    'an empty anon key makes getUser fail with a parse error that reads as an auth failure');
});

test('the JWT is resolved with a client built from a key that is always present', () => {
  const before = source.slice(0, source.indexOf('auth.getUser('));
  assert.match(before, /createClient\(\s*url,\s*serviceKey/,
    'getUser must run on a client whose key is guaranteed to exist');
});

test('a GitHub rejection reports the status, so a bad token is distinguishable', () => {
  assert.match(source, /GitHub returned \$\{dispatch\.status\}/,
    '401 vs 403 vs 404 is the difference between a bad token, a missing permission and a wrong repo');
});
