/* Offline logging: a set logged with no signal is never lost, and the screen
   shows it the moment it is tapped. All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOutbox } from '../app/js/outbox.js';
import {
  classifyError, withIds, mirror, snapshotOf, restoreSnapshot, timedFetch,
} from '../app/js/store.js';
import { prescribedRows } from '../app/js/screens-workout.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

const op = (n) => ({ table: 'sets', action: 'insert', row: { id: `id-${n}`, set_no: n } });
const fail = (props) => Object.assign(new Error('boom'), props);

test('a rejected write is kept and marked failed, and the queue carries on', async () => {
  const box = createOutbox({ storage: fakeStorage() });
  box.queue(op(1));
  box.queue(op(2));
  box.queue(op(3));

  const seen = [];
  const result = await box.flush(async (o) => {
    seen.push(o.row.set_no);
    if (o.row.set_no === 2) throw fail({ permanent: true });
  });

  assert.deepEqual(seen, [1, 2, 3]);
  assert.equal(result.sent, 2);
  assert.equal(result.failed, 1);
  assert.deepEqual(box.list().map((o) => o.row.set_no), [2], 'a logged set is never thrown away');
  assert.equal(box.failed().length, 1);
  assert.equal(box.failed()[0].failed, true);
});

test('a write that already landed counts as sent', async () => {
  const box = createOutbox({ storage: fakeStorage() });
  box.queue(op(1));
  const result = await box.flush(async () => { throw fail({ landed: true }); });
  assert.equal(result.sent, 1);
  assert.equal(box.size(), 0);
});

test('a write that keeps failing transiently is never dropped', async () => {
  const box = createOutbox({ storage: fakeStorage() });
  box.queue(op(1));
  for (let i = 0; i < 10; i += 1) {
    await box.flush(async () => { throw new Error('network down'); });
  }
  assert.equal(box.size(), 1);
  assert.equal(box.list()[0].attempts, 10);
  assert.equal(box.failed().length, 0, 'a network failure is not a rejection');
});

test('a failed write leaves the queue only when the owner discards it', async () => {
  const box = createOutbox({ storage: fakeStorage() });
  box.queue(op(1));
  await box.flush(async () => { throw fail({ permanent: true }); });
  const [stuck] = box.failed();
  box.discard(stuck.qid);
  assert.equal(box.size(), 0);
});

test('a rejected write that succeeds on retry clears its failed mark', async () => {
  const box = createOutbox({ storage: fakeStorage() });
  box.queue(op(1));
  await box.flush(async () => { throw fail({ permanent: true }); });
  const result = await box.flush(async () => {});
  assert.equal(result.sent, 1);
  assert.equal(box.size(), 0);
});

test('errors are sorted into landed, rejected, auth and transient', () => {
  assert.deepEqual(classifyError({ code: '23505' }, 'insert'), { kind: 'duplicate' });
  assert.deepEqual(classifyError({ code: '23503' }, 'insert'), { kind: 'permanent' });
  assert.deepEqual(classifyError({ code: '22P02' }, 'update'), { kind: 'permanent' });
  assert.deepEqual(classifyError({ code: '42501' }, 'insert'), { kind: 'permanent' });
  assert.deepEqual(classifyError({ code: 'PGRST301', message: 'JWT expired' }, 'insert'), { kind: 'auth' });
  assert.deepEqual(classifyError({ code: '', message: 'JWT expired', status: 401 }, 'update'), { kind: 'auth' });
  assert.deepEqual(classifyError({ message: 'Failed to fetch' }, 'insert'), { kind: 'transient' });
  assert.deepEqual(classifyError({ name: 'AbortError', message: 'aborted' }, 'insert'), { kind: 'transient' });
});

test('every inserted row gets an id before it leaves the phone', () => {
  let n = 0;
  const newId = () => `gen-${n += 1}`;
  const single = withIds({ table: 'sessions', action: 'insert', row: { date: '2026-01-05' } }, newId);
  assert.equal(single.row.id, 'gen-1');

  const many = withIds({ table: 'sets', action: 'insert', row: [{ set_no: 1 }, { id: 'keep', set_no: 2 }] }, newId);
  assert.deepEqual(many.row.map((r) => r.id), ['gen-2', 'keep']);

  const update = { table: 'sets', action: 'update', id: 'x', row: { reps: 9 } };
  assert.deepEqual(withIds(update, newId), update, 'only inserts need an id');
});

function workoutState() {
  return {
    sessions: [{ id: 'se-1', date: '2026-01-05', status: 'planned', kind: 'training' }],
    sessionDetail: {
      session: { id: 'se-1', date: '2026-01-05', status: 'planned', kind: 'training' },
      exercises: [{ id: 'sx-1', session_id: 'se-1', target_sets: 3 }, { id: 'sx-2', session_id: 'se-1', target_sets: 2 }],
      sets: [{ id: 'st-1', session_exercise_id: 'sx-1', set_no: 1, reps: 8, weight: 100, unit: 'lb' }],
    },
  };
}

test('a logged set shows on the screen without a round trip', () => {
  const s = workoutState();
  mirror(s, { table: 'sets', action: 'insert', row: [
    { id: 'st-2', session_exercise_id: 'sx-1', set_no: 2, reps: 7 },
    { id: 'st-3', session_exercise_id: 'sx-1', set_no: 3, reps: 6 },
  ] });
  assert.deepEqual(s.sessionDetail.sets.map((x) => x.id), ['st-1', 'st-2', 'st-3']);

  mirror(s, { table: 'sets', action: 'update', id: 'st-2', row: { reps: 8 } });
  assert.equal(s.sessionDetail.sets[1].reps, 8);

  mirror(s, { table: 'sets', action: 'delete', id: 'st-3' });
  assert.deepEqual(s.sessionDetail.sets.map((x) => x.id), ['st-1', 'st-2']);
});

test('a skip and a finish show locally too', () => {
  const s = workoutState();
  mirror(s, { table: 'session_exercises', action: 'update', id: 'sx-2', row: { deviation_note: 'skipped' } });
  assert.equal(s.sessionDetail.exercises[1].deviation_note, 'skipped');

  mirror(s, { table: 'sessions', action: 'update', id: 'se-1', row: { status: 'done' } });
  assert.equal(s.sessions[0].status, 'done');
  assert.equal(s.sessionDetail.session.status, 'done');
});

test('a session started offline becomes the open session', () => {
  const s = { sessions: [], sessionDetail: null };
  mirror(s, { table: 'sessions', action: 'insert', row: { id: 'se-9', date: '2026-01-06', kind: 'training', status: 'planned' } });
  assert.equal(s.sessions[0].id, 'se-9');
  assert.equal(s.sessions[0].pain, 'none', 'server defaults are filled in so the row looks real');

  mirror(s, { table: 'session_exercises', action: 'insert', row: [{ id: 'sx-9', session_id: 'se-9', position: 0 }] });
  assert.equal(s.sessionDetail.session.id, 'se-9');
  assert.deepEqual(s.sessionDetail.exercises.map((x) => x.id), ['sx-9']);
  assert.deepEqual(s.sessionDetail.sets, []);
});

test('writes to other tables leave the workout alone', () => {
  const s = workoutState();
  const before = structuredClone(s);
  mirror(s, { table: 'body_metrics', action: 'insert', row: { id: 'bm', weight: 70 } });
  mirror(s, { table: 'sets', action: 'insert', row: { id: 'st-x', session_exercise_id: 'other', set_no: 1 } });
  assert.deepEqual(s, before);
});

test('the snapshot restores what Today and Log need, for the same user only', () => {
  const state = {
    user: { id: 'u-1' }, rules: { a: 1 }, exercises: [{ id: 'e' }], activeBlock: { id: 'b' },
    days: [{ id: 'd' }], slots: [{ id: 's' }], liftState: [{ exercise_id: 'e' }], rotation: { day_index: 1 },
    sessions: [{ id: 'se' }], sessionDetail: { session: { id: 'se' }, exercises: [], sets: [] },
    documents: [{ big: 'x'.repeat(10) }], journal: [{ big: true }], loaded: true,
  };
  const snap = snapshotOf(state);
  assert.equal(snap.userId, 'u-1');
  assert.equal(snap.state.documents, undefined, 'history stays out of the snapshot');
  assert.equal(snap.state.journal, undefined);

  const fresh = { user: { id: 'u-1' }, loaded: false, rules: null, sessions: [] };
  assert.equal(restoreSnapshot(fresh, JSON.parse(JSON.stringify(snap))), true);
  assert.deepEqual(fresh.rules, { a: 1 });
  assert.equal(fresh.sessionDetail.session.id, 'se');
  assert.equal(fresh.loaded, true);
  assert.equal(fresh.stale, true);

  const other = { user: { id: 'u-2' }, loaded: false, rules: null };
  assert.equal(restoreSnapshot(other, snap), false);
  assert.equal(other.rules, null);
  assert.equal(restoreSnapshot(fresh, null), false);
});

test('database calls give up instead of hanging on a weak signal', async () => {
  let seenSignal = null;
  const fetchImpl = async (_url, init) => { seenSignal = init?.signal ?? null; return 'ok'; };
  await timedFetch(fetchImpl, 5)('https://x.supabase.co/rest/v1/sets', {});
  assert.ok(seenSignal, 'a REST call carries a timeout signal');

  seenSignal = null;
  await timedFetch(fetchImpl, 5)('https://x.supabase.co/storage/v1/object/shots/a.jpg', {});
  assert.equal(seenSignal, null, 'a screenshot upload may take as long as it needs');
});

test('Done as prescribed gives every new set its own id', () => {
  const rows = prescribedRows(
    [{ id: 'sx-1', target_sets: 2, target_weight: 100, target_unit: 'lb', target_reps: 8 }],
    [],
  );
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => typeof r.id === 'string' && r.id.length > 0));
  assert.notEqual(rows[0].id, rows[1].id);
});

test('an action that rejects reports the error instead of failing silently', async () => {
  const { guarded } = await import('../app/js/ui.js');
  const seen = [];
  const quiet = console.error;
  console.error = () => {};
  try {
    await guarded(async () => { throw new Error('no signal'); }, null, null, (m) => seen.push(m));
    await guarded(() => { throw new Error('sync boom'); }, null, null, (m) => seen.push(m));
    await guarded(async () => 'fine', null, null, (m) => seen.push(m));
  } finally {
    console.error = quiet;
  }
  assert.deepEqual(seen, ['no signal', 'sync boom']);
});

test('finishing a complete session moves Today to the next day before the server knows', async () => {
  const { advanceRotation } = await import('../app/js/screens-workout.js');
  const days = [{ id: 'd0', day_index: 0, name: 'Push' }, { id: 'd1', day_index: 1, name: 'Pull' }];
  const rotation = { block_id: 'bl', day_index: 1, day_id: 'd1', day_name: 'Pull' };
  const session = { block_id: 'bl', day_index: 1 };
  assert.deepEqual(advanceRotation(rotation, days, session, 'done'),
    { block_id: 'bl', day_index: 0, day_id: 'd0', day_name: 'Push' });
  assert.equal(advanceRotation(rotation, days, session, 'partial'), rotation, 'an incomplete day repeats');
  assert.equal(advanceRotation(rotation, days, { block_id: 'other', day_index: 1 }, 'done'), rotation);
});
