/* The health check's contract, checked against source text: the edge function
   runs on Deno and the migration runs on Postgres, neither of which runs here. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SUPABASE_URL } from '../app/js/config.js';

const DIR = 'supabase/functions/health-check';
const sql = readFileSync('supabase/migrations/0005_health_check.sql', 'utf8');
const source = readFileSync(`${DIR}/index.ts`, 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

test('the function folder carries byte-identical copies of the shared modules', () => {
  for (const [copy, original] of [
    ['engine.js', 'app/js/engine.js'],
    ['rules-check.js', 'app/js/rules-check.js'],
    ['rules.schema.json', 'app/schema/rules.schema.json'],
  ]) {
    assert.ok(existsSync(`${DIR}/${copy}`), `${copy} is missing`);
    assert.equal(readFileSync(`${DIR}/${copy}`, 'utf8'), readFileSync(original, 'utf8'), `${copy} has drifted from ${original}`);
  }
});

test('the app can only read health runs', () => {
  const ops = [...sql.matchAll(/on health_runs\s+for (select|insert|update|delete)\b/g)].map((m) => m[1]);
  assert.deepEqual(ops, ['select']);
});

test('health runs are published for realtime', () => {
  assert.match(sql, /alter publication supabase_realtime add table health_runs/);
});

test('the due view obeys RLS', () => {
  assert.match(sql, /create view health_due with \(security_invoker = true\)/);
});

test('run now is limited to the signed-in user and throttled', () => {
  const body = sql.match(/create function request_health_run\(\)[\s\S]*?end \$\$;/)[0];
  assert.match(body, /auth\.uid\(\)/);
  assert.match(body, /interval '5 minutes'/);
  assert.match(sql, /revoke execute on function request_health_run\(\) from public, anon;/);
});

test('only the cron job can enqueue scheduled runs', () => {
  assert.match(sql, /revoke execute on function enqueue_due_health_runs\(\) from public, anon, authenticated;/);
  assert.match(sql, /cron\.schedule\('health-check-hourly', '0 \* \* \* \*'/);
});

test('the wake trigger sends the run id to this project and nothing else', () => {
  const body = sql.match(/create function health_runs_wake\(\)[\s\S]*?end \$\$;/)[0];
  assert.match(body, new RegExp(`url := '${SUPABASE_URL}/functions/v1/health-check'`));
  assert.match(body, /jsonb_build_object\('run_id', new\.id\)/);
  assert.doesNotMatch(body, /authorization|apikey|secret/i);
});

test('the function is reachable without a user token, because the caller is the database', () => {
  assert.match(config, /\[functions\.health-check\][\s\S]*?verify_jwt = false/);
});

test('the function claims a run only from queued, so a replayed id does nothing', () => {
  assert.match(source, /\.eq\('status', 'queued'\)/);
  assert.match(source, /status: 'running'/);
});

test('the NVIDIA key comes from a secret and is never logged', () => {
  assert.match(source, /Deno\.env\.get\('NVIDIA_API_KEY'\)/);
  assert.doesNotMatch(source, /console\.\w+\([^)]*(key|token|findings|context)/i);
});

test('a failed model call still finishes the run with the deterministic findings', () => {
  assert.match(source, /ai_error/);
  assert.match(source, /status: 'done'/);
});

test('the default models are the ones the settings table defaults to', () => {
  const migrations = sql + readFileSync('supabase/migrations/0007_health_fast_fallback.sql', 'utf8');
  assert.match(migrations, /alter column fallback_model set default 'deepseek-ai\/deepseek-v4\.1-flash'/);
  for (const id of ['nvidia/nemotron-3-ultra-550b-a55b', 'deepseek-ai/deepseek-v4.1-flash']) {
    assert.ok(migrations.includes(`'${id}'`), `${id} is not a settings default`);
    assert.ok(source.includes(`'${id}'`), `${id} is not the function's fallback`);
  }
});

test('the wake trigger function cannot be called over the API', () => {
  const all = readFileSync('supabase/migrations/0006_health_wake_revoke.sql', 'utf8');
  assert.match(all, /revoke execute on function health_runs_wake\(\) from public, anon, authenticated;/);
});
