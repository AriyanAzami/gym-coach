/* Structural guarantees of the schema, checked against the migration text so
   they hold before anything is pushed to a database. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'supabase/migrations';
const sql = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(`${DIR}/${f}`, 'utf8'))
  .join('\n');

const tableNames = [...sql.matchAll(/create table (\w+) \(/g)].map((m) => m[1]);

function tableBody(name) {
  const m = sql.match(new RegExp(`create table ${name} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(m, `no "create table ${name} (" ... ");" block found`);
  return m[1];
}

function policyOps(table) {
  return [...sql.matchAll(new RegExp(`on ${table}\\s+for (\\w+)`, 'g'))].map((m) => m[1]);
}

test('the expected tables all exist', () => {
  for (const t of [
    'exercises', 'blocks', 'block_days', 'block_slots', 'sessions',
    'session_exercises', 'sets', 'body_metrics', 'decisions', 'coach_notes',
    'documents', 'ai_jobs',
  ]) {
    assert.ok(tableNames.includes(t), `missing table ${t}`);
  }
});

test('no table stores a bare weight', () => {
  for (const t of tableNames) {
    const body = tableBody(t);
    const weightCols = [...body.matchAll(/^\s*(\w*weight)\s+numeric/gm)].map((m) => m[1]);
    if (weightCols.length === 0) continue;
    for (const col of weightCols) {
      const unit = col === 'weight' ? 'unit' : col.replace(/weight$/, 'unit');
      assert.match(
        body,
        new RegExp(`^\\s*${unit}\\s+text`, 'm'),
        `${t}.${col} has no accompanying ${t}.${unit} column`,
      );
    }
  }
});

test('every unit column is constrained to lb or kg', () => {
  const units = [...sql.matchAll(/^\s*(\w*unit)\s+text.*/gm)].map((m) => m[0]);
  assert.ok(units.length > 0, 'no unit columns found');
  for (const line of units) {
    assert.match(line, /check \(\w*unit in \('lb', ?'kg'\)\)/, `unconstrained unit: ${line.trim()}`);
  }
});

test('block_slots has no weight column', () => {
  assert.doesNotMatch(tableBody('block_slots'), /weight/);
});

test('exercises records whether a load is per hand', () => {
  assert.match(tableBody('exercises'), /load_mode text .*check \(load_mode in \('total', ?'per_hand'\)\)/);
});

test('only one block can be active per user', () => {
  assert.match(sql, /create unique index blocks_one_active on blocks \(user_id\) where status = 'active'/);
});

test('documents is append-only: select and insert policies only', () => {
  assert.deepEqual(policyOps('documents').sort(), ['insert', 'select']);
});

test('ai_jobs has only a select policy', () => {
  assert.deepEqual(policyOps('ai_jobs'), ['select']);
});

test('every other table has all four policies', () => {
  for (const t of tableNames) {
    if (t === 'documents' || t === 'ai_jobs') continue;
    assert.deepEqual(
      policyOps(t).sort(),
      ['delete', 'insert', 'select', 'update'],
      `${t} is missing a policy`,
    );
  }
});

test('every table enables row level security', () => {
  for (const t of tableNames) {
    assert.match(
      sql,
      new RegExp(`alter table ${t} enable row level security`),
      `${t} does not enable RLS`,
    );
  }
});

test('every table scopes rows to the authenticated user', () => {
  for (const t of tableNames) {
    const body = tableBody(t);
    assert.match(
      body,
      /user_id uuid not null references auth\.users \(id\) on delete cascade default auth\.uid\(\)/,
      `${t} has no user_id default auth.uid() column`,
    );
  }
});

test('ai_jobs is published for realtime', () => {
  assert.match(sql, /alter publication supabase_realtime add table ai_jobs/);
});

test('every view obeys the caller\'s RLS policies', () => {
  const all = [...sql.matchAll(/create (?:or replace )?view (\w+)/g)].map((m) => m[1]);
  const invoker = [...sql.matchAll(/create (?:or replace )?view (\w+)\s+with \(security_invoker = true\)/g)]
    .map((m) => m[1]);
  assert.ok(all.length > 0, 'no views found');
  assert.deepEqual(all.sort(), invoker.sort(), 'a view is missing security_invoker = true');
});

test('the expected views all exist', () => {
  const all = [...sql.matchAll(/create (?:or replace )?view (\w+)/g)].map((m) => m[1]);
  for (const v of ['current_documents', 'lift_history', 'lift_exposures', 'lift_state']) {
    assert.ok(all.includes(v), `missing view ${v}`);
  }
});

function viewBody(name) {
  const m = sql.match(new RegExp(`create (?:or replace )?view ${name}[\\s\\S]*?;\\n`));
  assert.ok(m, `view ${name} not found`);
  return m[0];
}

test('the derived views all exist', () => {
  const all = [...sql.matchAll(/create (?:or replace )?view (\w+)/g)].map((m) => m[1]);
  for (const v of ['weekly_muscle_volume', 'training_rate', 'rotation_next', 'body_trend']) {
    assert.ok(all.includes(v), `missing view ${v}`);
  }
});

test('weekly_muscle_volume takes indirect_factor from the rules document', () => {
  const body = viewBody('weekly_muscle_volume');
  assert.match(body, /indirect_factor/);
  assert.match(body, /current_documents|rules_factor|factor/);
  assert.match(body, /secondary_muscles/);
});

test('weekly_muscle_volume groups by calendar week', () => {
  assert.match(viewBody('weekly_muscle_volume'), /date_trunc\('week'/);
});

test('rotation_next takes complete_fraction from the rules document', () => {
  assert.match(viewBody('rotation_next'), /complete_fraction/);
});

test('rotation_next guards a block with no days', () => {
  const body = viewBody('rotation_next');
  assert.match(body, /day_count = 0/, 'no zero-day guard before the modulo');
  assert.match(body, /block has no days/);
});

test('rotation_next requires the first slot for a partial session', () => {
  assert.match(viewBody('rotation_next'), /first_slot_logged/);
});

test('body_trend compares against three calendar weeks earlier, not three rows', () => {
  assert.match(viewBody('body_trend'), /week_start - 21/);
});

test('no view hardcodes a coaching threshold outside a rules fallback', () => {
  for (const v of ['weekly_muscle_volume', 'rotation_next']) {
    const body = viewBody(v);
    // every coaching number must sit inside a coalesce() beside the rules lookup
    const numbers = [...body.matchAll(/(?<![\w.'])0\.\d+/g)].map((m) => m[0]);
    for (const n of numbers) {
      assert.match(
        body,
        new RegExp(`coalesce\\([^)]*,\\s*${n.replace('.', '\\.')}\\)`),
        `${v} uses ${n} outside a coalesce fallback for a rules value`,
      );
    }
  }
});

test('lift_history counts only logged sets of completed training sessions', () => {
  const m = sql.match(/create (?:or replace )?view lift_history[\s\S]*?;\n/);
  assert.ok(m, 'lift_history not found');
  assert.match(m[0], /kind = 'training'/);
  assert.match(m[0], /status in \('done', ?'partial'\)/);
  assert.match(m[0], /\bdone\b/);
});

test('the shots bucket is created private', () => {
  assert.match(sql, /insert into storage\.buckets \(id, name, public\)\s*values \('shots', 'shots', false\)/);
});
