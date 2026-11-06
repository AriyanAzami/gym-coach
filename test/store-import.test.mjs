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

test('an unconfigured copy reports itself as unconfigured', async () => {
  const store = await import('../app/js/store.js');
  assert.equal(store.isConfigured(), false, 'the committed placeholder is not a real project');
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
