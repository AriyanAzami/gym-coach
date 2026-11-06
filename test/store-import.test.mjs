/* The screens import store.js, so store.js has to be importable without a
   browser or a vendored supabase-js global. The client is created on first use. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('store.js imports with no supabase global present', async () => {
  assert.equal(globalThis.supabase, undefined, 'this test is only meaningful without the global');
  const store = await import('../app/js/store.js');
  assert.equal(typeof store.load, 'function');
  assert.equal(typeof store.write, 'function');
  assert.equal(typeof store.dispatchJob, 'function');
  assert.equal(typeof store.saveDocument, 'function');
});

test('the app points at a real project', async () => {
  const store = await import('../app/js/store.js');
  assert.equal(store.isConfigured(), true, 'config.js still holds the placeholder');
});

/* config.js is committed to a public repository. The anon key belongs there —
   it grants nothing without a session — but the service-role key bypasses RLS
   entirely, and pasting it here by mistake would hand over the whole database. */
test('the committed key is the anon key, never the service-role key', async () => {
  const { SUPABASE_ANON_KEY, SUPABASE_URL } = await import('../app/js/config.js');
  assert.match(SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);

  if (SUPABASE_ANON_KEY.startsWith('sb_publishable_')) return;

  const [, payload] = SUPABASE_ANON_KEY.split('.');
  assert.ok(payload, 'the key is neither a publishable key nor a JWT');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.equal(claims.role, 'anon',
    `config.js holds a key with role "${claims.role}". Only the anon key may be committed.`);
  assert.doesNotMatch(SUPABASE_ANON_KEY, /service_role/);
});

test('state starts empty rather than undefined', async () => {
  const { state } = await import('../app/js/store.js');
  assert.equal(state.user, null);
  assert.equal(state.loaded, false);
  assert.deepEqual(state.exercises, []);
  assert.deepEqual(state.slots, []);
  assert.equal(state.rules, null);
});

test('every screen module exports a render function', async () => {
  for (const name of ['today', 'workout', 'block', 'progress', 'coach', 'settings']) {
    const screen = await import(`../app/js/screens-${name}.js`);
    assert.equal(typeof screen.render, 'function', `screens-${name}.js has no render`);
    assert.equal(typeof screen.actions, 'object', `screens-${name}.js has no actions`);
  }
});
