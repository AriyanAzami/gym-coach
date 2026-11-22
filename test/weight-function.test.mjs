import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/read-weight-shots/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

test('the function requires a signed-in user', () => {
  assert.match(config, /\[functions\.read-weight-shots\][\s\S]*?verify_jwt = true/);
  assert.match(source, /auth\.getUser\(jwt\)/);
});

test('every path is checked before the service key reads it', () => {
  const check = source.indexOf('ownedPath(p, user.id)');
  const read = source.indexOf(".from('shots').download");
  assert.ok(check > 0 && read > check);
});

test('it reads only, logs nothing, and the key is a secret', () => {
  assert.doesNotMatch(source, /\.(insert|update|upsert|delete)\(/);
  assert.doesNotMatch(source, /console\./);
  assert.match(source, /Deno\.env\.get\('NVIDIA_API_KEY'\)/);
});
