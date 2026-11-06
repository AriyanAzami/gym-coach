import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOutbox } from '../app/js/outbox.js';

/* A localStorage stand-in. The real one can throw in a private window, so the
   outbox has to survive that too. */
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

const throwingStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
  removeItem() { throw new Error('denied'); },
};

const op = (n) => ({ table: 'sets', action: 'insert', row: { set_no: n } });

test('a write while offline is queued and replayed in order', async () => {
  const storage = fakeStorage();
  const box = createOutbox({ storage });
  box.queue(op(1));
  box.queue(op(2));
  box.queue(op(3));
  assert.equal(box.size(), 3);

  const seen = [];
  const result = await box.flush(async (o) => { seen.push(o.row.set_no); });

  assert.deepEqual(seen, [1, 2, 3]);
  assert.equal(result.sent, 3);
  assert.equal(box.size(), 0);
});

test('the outbox survives a reload', () => {
  const storage = fakeStorage();
  createOutbox({ storage }).queue(op(1));
  const fresh = createOutbox({ storage });
  assert.equal(fresh.size(), 1);
  assert.equal(fresh.list()[0].row.set_no, 1);
});

test('a replayed write that conflicts is dropped, not retried forever', async () => {
  const storage = fakeStorage();
  const box = createOutbox({ storage });
  box.queue(op(1));
  box.queue(op(2));
  box.queue(op(3));

  const seen = [];
  const result = await box.flush(async (o) => {
    seen.push(o.row.set_no);
    if (o.row.set_no === 2) {
      const err = new Error('duplicate key');
      err.permanent = true;
      throw err;
    }
  });

  assert.deepEqual(seen, [1, 2, 3], 'a permanent failure must not stop the queue');
  assert.equal(result.dropped, 1);
  assert.equal(result.sent, 2);
  assert.equal(box.size(), 0, 'the conflicting write is gone, not parked forever');
});

test('a transient failure keeps the write and stops the queue to preserve order', async () => {
  const storage = fakeStorage();
  const box = createOutbox({ storage });
  box.queue(op(1));
  box.queue(op(2));
  box.queue(op(3));

  const seen = [];
  const result = await box.flush(async (o) => {
    seen.push(o.row.set_no);
    if (o.row.set_no === 2) throw new Error('network down');
  });

  assert.deepEqual(seen, [1, 2], 'op 3 must not overtake op 2');
  assert.equal(result.sent, 1);
  assert.equal(box.size(), 2);
  assert.deepEqual(box.list().map((o) => o.row.set_no), [2, 3]);
  assert.equal(box.list()[0].attempts, 1);
});

test('a write that keeps failing is dropped after the attempt limit', async () => {
  const storage = fakeStorage();
  const box = createOutbox({ storage, maxAttempts: 2 });
  box.queue(op(1));

  await box.flush(async () => { throw new Error('network down'); });
  assert.equal(box.size(), 1);
  assert.equal(box.list()[0].attempts, 1);

  const result = await box.flush(async () => { throw new Error('network down'); });
  assert.equal(result.dropped, 1);
  assert.equal(box.size(), 0, 'a write that can never land must not block every later write');
});

test('flushing an empty outbox does nothing and calls nothing', async () => {
  const box = createOutbox({ storage: fakeStorage() });
  let calls = 0;
  const result = await box.flush(async () => { calls += 1; });
  assert.equal(calls, 0);
  assert.deepEqual(result, { sent: 0, dropped: 0, kept: 0 });
});

test('a storage that refuses to read leaves the outbox empty rather than throwing', () => {
  const box = createOutbox({ storage: throwingStorage });
  assert.equal(box.size(), 0);
  assert.doesNotThrow(() => box.queue(op(1)));
});

test('corrupt stored data is discarded rather than crashing the app', () => {
  const storage = fakeStorage({ 'gym-coach.outbox': 'not json' });
  assert.equal(createOutbox({ storage }).size(), 0);
});

test('stored data of the wrong shape is discarded', () => {
  const storage = fakeStorage({ 'gym-coach.outbox': '{"not":"an array"}' });
  assert.equal(createOutbox({ storage }).size(), 0);
});

test('every queued write carries an id so a replay can be recognised', () => {
  const box = createOutbox({ storage: fakeStorage() });
  box.queue(op(1));
  box.queue(op(2));
  const [a, b] = box.list();
  assert.ok(a.id && b.id);
  assert.notEqual(a.id, b.id);
});

test('two outboxes over the same storage do not lose a write', () => {
  const storage = fakeStorage();
  createOutbox({ storage }).queue(op(1));
  createOutbox({ storage }).queue(op(2));
  assert.deepEqual(createOutbox({ storage }).list().map((o) => o.row.set_no), [1, 2]);
});
