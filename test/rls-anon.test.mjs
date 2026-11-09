/* Runs against the live project with the anon key and no session. The whole
   privacy model rests on this: the anon key is committed to a public
   repository, so it must read nothing and write nothing on its own.

   Skipped unless RUN_LIVE_TESTS=1, so the normal suite stays offline. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, configured } from '../app/js/config.js';

const live = process.env.RUN_LIVE_TESTS === '1' && configured;

const TABLES = [
  'exercises', 'blocks', 'block_days', 'block_slots', 'sessions',
  'session_exercises', 'sets', 'body_metrics', 'decisions', 'coach_notes',
  'documents', 'ai_jobs', 'health_runs', 'health_settings',
];

const VIEWS = [
  'current_documents', 'lift_history', 'lift_exposures', 'lift_state',
  'weekly_muscle_volume', 'training_rate', 'rotation_next', 'body_trend', 'health_due',
];

describe('an anonymous client', { skip: live ? false : 'set RUN_LIVE_TESTS=1 to run against the live project' }, () => {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of TABLES) {
    test(`reads no rows from ${table}`, async () => {
      const { data, error } = await anon.from(table).select('*').limit(5);
      assert.equal(error, null, `${table} errored: ${error?.message}`);
      assert.deepEqual(data, [], `${table} leaked ${data?.length} row(s) to an anonymous caller`);
    });
  }

  for (const view of VIEWS) {
    test(`reads no rows from the view ${view}`, async () => {
      const { data, error } = await anon.from(view).select('*').limit(5);
      // Either the view refuses or it returns nothing. Both are safe; returning
      // a row would not be.
      if (!error) {
        assert.deepEqual(data, [], `${view} leaked ${data?.length} row(s) to an anonymous caller`);
      }
    });
  }

  for (const table of ['exercises', 'sessions', 'sets', 'documents', 'coach_notes', 'ai_jobs']) {
    test(`cannot insert into ${table}`, async () => {
      const { error } = await anon.from(table).insert({ name: 'x' });
      assert.notEqual(error, null, `an anonymous caller inserted into ${table}`);
    });
  }

  /* Run this one deliberately, and only after turning sign-ups off in the
     dashboard. It is opt-in because the only way to prove sign-ups are closed
     is to try one: if they are still open, this CREATES AN ACCOUNT on the
     project, which then has to be deleted by hand.

     Note that a rejection is not by itself proof. An address at a reserved
     domain such as .invalid comes back "email_address_invalid" whether or not
     sign-ups are enabled, so this asserts on the specific code instead. */
  test('public sign-ups are disabled', {
    skip: process.env.RUN_SIGNUP_PROBE === '1' ? false : 'set RUN_SIGNUP_PROBE=1 (it creates a user if sign-ups are open)',
  }, async () => {
    const { data, error } = await anon.auth.signUp({
      email: `probe-${Date.now()}@gym-coach-probe.example.com`,
      password: `probe-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    });
    assert.notEqual(error, null,
      `sign-ups are OPEN: a probe account was created (${data?.user?.id}). Turn sign-ups off in the dashboard and delete that user.`);
    assert.equal(error.code, 'signup_disabled',
      `sign-ups were refused, but for the wrong reason: ${error.code} — ${error.message}`);
  });

  test('the dispatch-job function rejects a caller with no session', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-job`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ kind: 'checkin' }),
    });
    assert.ok(response.status === 401 || response.status === 403,
      `expected 401 or 403 with no session, got ${response.status}`);
  });

  test('the dispatch-job function rejects the anon key as if it were a session', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-job`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ kind: 'checkin' }),
    });
    assert.equal(response.status, 401,
      'the anon key is a valid JWT but resolves to no user, so it must be refused');
  });
});
