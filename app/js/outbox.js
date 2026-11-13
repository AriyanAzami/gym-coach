/* A durable queue of writes for when the phone has no network. Logging a set
   must never fail because the gym has no signal, so every write goes through
   here and is replayed on reconnect.

   Nothing in the queue is ever thrown away by the queue itself. A write the
   database rejects is marked failed and kept until the owner retries or
   discards it, because a silently dropped set is a lost set.

   Browser storage can be absent or refuse to answer (private window, cleared
   site data), so every read and write is guarded and an unreadable outbox
   behaves as an empty one. */

const KEY = 'gym-coach.outbox';

export function createOutbox({ storage, key = KEY } = {}) {
  const newId = () => (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  function read() {
    let ops;
    try {
      const raw = storage?.getItem(key);
      if (!raw) return [];
      ops = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(ops)) return [];
    // Entries queued before qid existed get one, saved, so it stays stable.
    if (ops.some((op) => !op?.qid)) {
      ops = ops.map((op) => (op?.qid ? op : { ...op, qid: newId() }));
      write(ops);
    }
    return ops;
  }

  function write(ops) {
    try {
      if (ops.length === 0) storage?.removeItem(key);
      else storage?.setItem(key, JSON.stringify(ops));
    } catch {
      // Nothing to do: the write is lost, but the app keeps working.
    }
  }

  return {
    queue(op) {
      const ops = read();
      // qid is the queue's own key. op.id is the row an update or delete targets,
      // and two writes to one row must stay separately discardable.
      ops.push({ ...op, qid: newId(), attempts: 0, queuedAt: new Date().toISOString() });
      write(ops);
    },

    list: read,
    size: () => read().length,
    failed: () => read().filter((op) => op.failed === true),
    discard: (qid) => write(read().filter((op) => op.qid !== qid)),
    clear: () => write([]),

    /* Replays queued writes in order. `apply(op)` resolves on success. A
       rejection with `landed` set means the row is already in the database (a
       replay after a lost response), which is a success. One with `permanent`
       set marks that write failed, keeps it, and carries on, so one bad row
       cannot block every set logged after it. Anything else is transient: it
       stops the replay so later writes cannot overtake the one that failed. */
    async flush(apply) {
      const ops = read();
      const result = { sent: 0, failed: 0, kept: 0 };
      if (ops.length === 0) return result;

      const remaining = [];
      for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i];
        try {
          await apply(op);
          result.sent += 1;
        } catch (err) {
          if (err?.landed === true) {
            result.sent += 1;
            continue;
          }
          const attempts = (op.attempts ?? 0) + 1;
          const lastError = String(err?.message ?? err).slice(0, 200);
          if (err?.permanent === true) {
            remaining.push({ ...op, attempts, lastError, failed: true });
            result.failed += 1;
          } else {
            remaining.push({ ...op, attempts, lastError });
            remaining.push(...ops.slice(i + 1));
            break;
          }
        }
      }

      // The queue may have changed while the network was awaited: writes added
      // then go after what was replayed, and anything discarded stays gone.
      const started = new Set(ops.map((op) => op.qid));
      const now = read();
      const present = new Set(now.map((op) => op.qid));
      const merged = [
        ...remaining.filter((op) => present.has(op.qid)),
        ...now.filter((op) => !started.has(op.qid)),
      ];
      result.kept = merged.length;
      write(merged);
      return result;
    },
  };
}
