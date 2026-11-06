/* A durable queue of writes for when the phone has no network. Logging a set
   must never fail because the gym has no signal, so every write goes through
   here and is replayed on reconnect.

   Browser storage can be absent or refuse to answer (private window, cleared
   site data), so every read and write is guarded and an unreadable outbox
   behaves as an empty one. */

const KEY = 'gym-coach.outbox';

export function createOutbox({ storage, key = KEY, maxAttempts = 3 } = {}) {
  function read() {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return [];
      const ops = JSON.parse(raw);
      return Array.isArray(ops) ? ops : [];
    } catch {
      return [];
    }
  }

  function write(ops) {
    try {
      if (ops.length === 0) storage?.removeItem(key);
      else storage?.setItem(key, JSON.stringify(ops));
    } catch {
      // Nothing to do: the write is lost, but the app keeps working.
    }
  }

  const newId = () => (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  return {
    queue(op) {
      const ops = read();
      ops.push({ ...op, id: op?.id ?? newId(), attempts: 0, queuedAt: new Date().toISOString() });
      write(ops);
    },

    list: read,
    size: () => read().length,
    clear: () => write([]),

    /* Replays queued writes in order. `apply(op)` resolves on success. A
       rejection with `permanent` set — a duplicate key, a rejected row — drops
       that write and carries on; anything else is treated as transient, which
       stops the replay so later writes cannot overtake the one that failed. A
       write that fails maxAttempts times is dropped, because one bad row must
       not block every set logged after it. */
    async flush(apply) {
      const ops = read();
      const result = { sent: 0, dropped: 0, kept: 0 };
      if (ops.length === 0) return result;

      const remaining = [];
      for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i];
        try {
          await apply(op);
          result.sent += 1;
        } catch (err) {
          const attempts = (op.attempts ?? 0) + 1;
          if (err?.permanent === true || attempts >= maxAttempts) {
            result.dropped += 1;
          } else {
            remaining.push({ ...op, attempts, lastError: String(err?.message ?? err) });
            remaining.push(...ops.slice(i + 1));
            result.kept = ops.length - i;
            break;
          }
        }
      }

      write(remaining);
      return result;
    },
  };
}
