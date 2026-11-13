/* write(), flushOutbox() and load() together, against a fake Supabase client
   and a fake localStorage. The pure helpers are tested in offline.test.mjs;
   this is where a set could still be lost between them. Fabricated values. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const storageData = {};
globalThis.localStorage = {
  getItem: (k) => (k in storageData ? storageData[k] : null),
  setItem: (k, v) => { storageData[k] = String(v); },
  removeItem: (k) => { delete storageData[k]; },
};

const fake = {
  tables: {},
  session: { user: { id: 'u-1' }, access_token: 't' },
  offline: false,
  rejectInsert: () => false,
  gate: null,
  calls: 0,
};

function handle(st) {
  fake.calls += 1;
  if (fake.offline) return { error: { message: 'Failed to fetch', code: '' } };
  const table = (fake.tables[st.table] ??= new Map());
  const idFilter = st.filters.find(([k]) => k === 'id');
  if (st.op === 'insert') {
    const rows = Array.isArray(st.row) ? st.row : [st.row];
    if (rows.some((r) => fake.rejectInsert(st.table, r))) {
      return { error: { code: '23503', message: 'violates foreign key' } };
    }
    if (rows.some((r) => table.has(r.id))) return { error: { code: '23505', message: 'duplicate key' } };
    for (const r of rows) table.set(r.id, { ...r });
    return { data: rows, error: null };
  }
  if (st.op === 'update') {
    const hits = (idFilter?.[1] ?? []).filter((id) => table.has(id));
    for (const id of hits) Object.assign(table.get(id), st.row);
    return { data: hits.map((id) => table.get(id)), error: null };
  }
  if (st.op === 'delete') {
    for (const id of idFilter?.[1] ?? []) table.delete(id);
    return { data: null, error: null };
  }
  if (idFilter) {
    return { data: idFilter[1].filter((id) => table.has(id)).map((id) => ({ id })), error: null };
  }
  return st.single ? { data: null, error: null } : { data: [], error: null };
}

function from(table) {
  const st = { table, op: 'select', filters: [], row: null, single: false };
  const api = {
    select: () => api,
    insert: (row) => { st.op = 'insert'; st.row = row; return api; },
    update: (row) => { st.op = 'update'; st.row = row; return api; },
    upsert: (row) => { st.op = 'insert'; st.row = row; return api; },
    delete: () => { st.op = 'delete'; return api; },
    eq: (k, v) => { st.filters.push([k, [v]]); return api; },
    in: (k, vs) => { st.filters.push([k, vs]); return api; },
    order: () => api, limit: () => api, gte: () => api, ilike: () => api, neq: () => api,
    maybeSingle: () => { st.single = true; return api; },
    then: (res, rej) => Promise.resolve(fake.gate?.(st)).then(() => handle(st)).then(res, rej),
  };
  return api;
}

globalThis.supabase = {
  createClient: () => ({
    from,
    auth: {
      getSession: async () => ({ data: { session: fake.session }, error: null }),
      refreshSession: async () => ({ data: {}, error: null }),
      onAuthStateChange: () => {},
      signOut: async () => {},
    },
  }),
};

const store = await import('../app/js/store.js');
const { state } = store;

beforeEach(() => {
  for (const k of Object.keys(storageData)) delete storageData[k];
  Object.assign(fake, {
    tables: {}, session: { user: { id: 'u-1' }, access_token: 't' },
    offline: false, rejectInsert: () => false, gate: null, calls: 0,
  });
  Object.assign(state, {
    user: { id: 'u-1' }, online: true, loaded: true, sessions: [], sessionDetail: null,
    bodyMetrics: [], pendingWrites: 0, failedWrites: 0,
  });
});

const setRow = (n) => ({ table: 'sets', action: 'insert', row: { id: `st-${n}`, session_exercise_id: 'sx-1', set_no: n } });

test('a set logged while the queue is flushing is not lost', async () => {
  state.online = false;
  await store.write(setRow(1));
  state.online = true;

  let release;
  const held = new Promise((r) => { release = r; });
  fake.gate = (st) => (st.op === 'insert' && st.row?.id === 'st-1' ? held : null);

  const flushing = store.flushOutbox();
  await store.write(setRow(2));
  release();
  await flushing;
  fake.gate = null;
  await store.flushOutbox();

  assert.ok(fake.tables.sets?.has('st-1'));
  assert.ok(fake.tables.sets?.has('st-2'), 'the set written mid-flush reached the database');
  assert.equal(store.pendingWrites(), 0);
});

test('an edit to a row whose insert was rejected stays queued instead of vanishing', async () => {
  state.online = false;
  fake.rejectInsert = (table, row) => table === 'sessions' && row.id === 'se-x';
  await store.write({ table: 'sessions', action: 'insert', row: { id: 'se-x', date: '2026-01-05', kind: 'training', status: 'planned' } });
  await store.write({ table: 'sessions', action: 'update', id: 'se-x', row: { status: 'done' } });
  state.online = true;

  await store.flushOutbox();

  assert.equal(store.pendingWrites(), 2, 'neither write is gone');
  assert.equal(store.failedWrites().length, 2);
});

test('with no session the write waits in the queue rather than going out as anon', async () => {
  fake.session = null;
  await store.write({ table: 'sets', action: 'update', id: 'st-1', row: { reps: 9 } });
  assert.equal(fake.calls, 0, 'nothing was sent');
  assert.equal(store.pendingWrites(), 1);
  assert.equal(store.failedWrites().length, 0);
});

test('a reload never swaps the open workout for another queued session', async () => {
  state.sessionDetail = { session: { id: 'se-a' }, exercises: [], sets: [] };
  state.online = false;
  await store.write({ table: 'sessions', action: 'insert', row: { id: 'se-b', date: '2026-01-04', kind: 'training', status: 'planned' } });
  state.sessionDetail = { session: { id: 'se-a' }, exercises: [], sets: [] };
  await store.write({ table: 'session_exercises', action: 'insert', row: [{ id: 'sx-b', session_id: 'se-b', position: 0 }] });
  state.sessionDetail = { session: { id: 'se-a' }, exercises: [], sets: [] };

  state.online = true;
  fake.offline = true;
  await store.load();
  fake.offline = false;
  await store.load();

  assert.equal(state.sessionDetail.session.id, 'se-a');
  assert.ok(state.sessions.some((s) => s.id === 'se-b'), 'the queued session still shows in the list');
});

test('an offline cold start with an expired token opens on the saved state', () => {
  const snap = { userId: 'u-1', state: {} };
  const netErr = Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError' });
  assert.deepEqual(store.pickUser(null, netErr, snap), { id: 'u-1', offline: true });
  assert.equal(store.pickUser(null, null, snap), null, 'a real sign-out stays signed out');
  assert.equal(store.pickUser(null, netErr, null), null);
  assert.deepEqual(store.pickUser({ user: { id: 'u-1' } }, null, snap), { id: 'u-1' });
});

test('a set shows on the screen before a slow network answers', async () => {
  state.sessionDetail = { session: { id: 'se-1', status: 'planned' }, exercises: [{ id: 'sx-1', session_id: 'se-1' }], sets: [] };
  let release;
  const held = new Promise((r) => { release = r; });
  fake.gate = () => held;
  const writing = store.write(setRow(1));
  assert.deepEqual(state.sessionDetail.sets.map((s) => s.id), ['st-1'], 'shown before the network answered');
  release();
  await writing;
  assert.ok(fake.tables.sets.has('st-1'));
});

test('a rejected direct write is taken back off the screen', async () => {
  state.sessionDetail = { session: { id: 'se-1', status: 'planned' }, exercises: [{ id: 'sx-1', session_id: 'se-1' }], sets: [] };
  fake.rejectInsert = (table) => table === 'sets';
  await assert.rejects(store.write(setRow(1)));
  assert.deepEqual(state.sessionDetail.sets, []);
});

test('the saved state shows at boot before any network call', () => {
  state.loaded = true;
  state.rules = { from: 'phone' };
  state.sessionDetail = null;
  store.persist();
  Object.assign(state, { loaded: false, rules: null });
  assert.equal(store.showSaved(), true);
  assert.equal(state.loaded, true);
  assert.deepEqual(state.rules, { from: 'phone' });
});

test('a finished session in the snapshot does not reopen as the workout', () => {
  state.loaded = true;
  state.sessionDetail = { session: { id: 'se-old', status: 'done' }, exercises: [], sets: [] };
  store.persist();
  Object.assign(state, { loaded: false, sessionDetail: null });
  store.showSaved();
  assert.equal(state.sessionDetail, null);
});
