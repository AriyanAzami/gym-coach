/* The unit tests stub store.state, so they would keep passing if a view's
   columns drifted away from what the screens and the engine read. This pins the
   real shape: it queries the live project and compares against the snapshot
   below, which was captured from the deployed database.

   Rename a column in a migration without updating the code and this fails.

   Skipped unless RUN_LIVE_TESTS=1. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, configured } from '../app/js/config.js';

const live = process.env.RUN_LIVE_TESTS === '1' && configured;

/* Captured from the deployed database. Update this only alongside a migration
   and the code that reads the changed column. */
const EXPECTED = {
  body_trend: ['user_id', 'week_start', 'avg_weight', 'unit', 'entries', 'rate_3w'],
  current_documents: ['user_id', 'key', 'version', 'body_md', 'body_json', 'created_at'],
  lift_exposures: ['user_id', 'exercise_id', 'session_id', 'date', 'work_sets', 'weight', 'unit', 'reps', 'full_reps'],
  lift_history: ['user_id', 'session_id', 'date', 'exercise_id', 'session_exercise_id', 'set_no', 'weight', 'unit', 'reps', 'partial'],
  lift_state: ['user_id', 'exercise_id', 'name', 'primary_muscle', 'equipment', 'load_mode', 'flag', 'active',
    'last_date', 'last_weight', 'last_unit', 'last_reps', 'last_full_reps', 'last_sets',
    'sessions_since_change', 'stall_count'],
  rotation_next: ['user_id', 'block_id', 'day_index', 'reason', 'day_id', 'day_name', 'warmup_note'],
  training_rate: ['user_id', 'per_week_4w', 'per_week_8w', 'last_session_date'],
  weekly_muscle_volume: ['user_id', 'week_start', 'muscle', 'direct_sets', 'indirect_sets', 'total_sets'],
};

/* Column names the code actually depends on, per view. A column could be added
   harmlessly; one of these going missing breaks a screen. */
const READ_BY_CODE = {
  lift_state: ['exercise_id', 'primary_muscle', 'equipment', 'load_mode', 'flag',
    'last_date', 'last_weight', 'last_unit', 'last_reps', 'last_full_reps', 'last_sets', 'stall_count'],
  rotation_next: ['block_id', 'day_index', 'day_id', 'reason'],
  weekly_muscle_volume: ['week_start', 'muscle', 'total_sets', 'direct_sets'],
  training_rate: ['per_week_4w'],
  body_trend: ['week_start', 'avg_weight', 'unit', 'rate_3w'],
  lift_history: ['session_id', 'date', 'exercise_id', 'weight', 'unit', 'reps', 'partial'],
  current_documents: ['key', 'version', 'body_md', 'body_json'],
};

describe('the live views', { skip: live ? false : 'set RUN_LIVE_TESTS=1' }, () => {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* RLS means an anonymous select returns no rows, but PostgREST still reports
     an unknown column as an error, which is what makes this work without a
     session. */
  for (const [view, columns] of Object.entries(READ_BY_CODE)) {
    test(`${view} still has every column the code reads`, async () => {
      const { error } = await anon.from(view).select(columns.join(',')).limit(1);
      assert.equal(error, null,
        `${view} is missing a column the app reads: ${error?.message}`);
    });
  }

  for (const [view, columns] of Object.entries(EXPECTED)) {
    test(`${view} matches the captured snapshot`, async () => {
      const { error } = await anon.from(view).select(columns.join(',')).limit(1);
      assert.equal(error, null, `${view} drifted from the snapshot: ${error?.message}`);
    });
  }

  test('a column that does not exist is actually reported, so these tests can fail', async () => {
    const { error } = await anon.from('lift_state').select('definitely_not_a_column').limit(1);
    assert.notEqual(error, null, 'PostgREST accepted an unknown column, so the checks above prove nothing');
  });
});
