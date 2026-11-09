/* The read-watch-shots contract, checked against source text because the
   function runs on Deno. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/read-watch-shots/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

test('the function requires a signed-in user', () => {
  assert.match(config, /\[functions\.read-watch-shots\][\s\S]*?verify_jwt = true/);
  assert.match(source, /auth\.getUser\(jwt\)/);
  assert.match(source, /401/);
});

test('every path is checked against the caller before the service key reads it', () => {
  const check = source.indexOf('ownedPath(p, user.id)');
  const read = source.indexOf(".from('shots').download");
  assert.ok(check > 0 && read > check, 'ownership must be checked before downloading');
  assert.match(source, /403/);
});

test('it reads only, and writes nothing to the database', () => {
  assert.doesNotMatch(source, /\.(insert|update|upsert|delete)\(/);
});

test('the key comes from a secret and nothing is logged', () => {
  assert.match(source, /Deno\.env\.get\('NVIDIA_API_KEY'\)/);
  assert.doesNotMatch(source, /console\./);
});

test('the fast vision model is tried first', () => {
  const first = source.indexOf("'nvidia/nemotron-3.5-super-vl-120b-a12b'");
  const second = source.indexOf("'meta/llama-3.2-90b-vision-instruct'");
  assert.ok(first > 0 && second > first);
});
