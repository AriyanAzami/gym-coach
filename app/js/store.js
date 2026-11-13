/* Auth, reads, writes and realtime. The only file that talks to Supabase.

   Reads go straight to the database and into `state`. Writes go through the
   outbox, so logging a set in a basement gym with no signal still works and
   lands when the phone reconnects. */

import { SUPABASE_URL, SUPABASE_ANON_KEY, configured } from './config.js';
import { createOutbox } from './outbox.js';
import { ymd, isoWeekStart } from './engine.js';

/* Created on first use, not at import, so this module can be imported in a
   test runner where no vendored supabase-js global exists. */
let supabaseClient = null;
function client() {
  if (!supabaseClient) {
    supabaseClient = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      global: { fetch: timedFetch((...args) => globalThis.fetch(...args)) },
    });
  }
  return supabaseClient;
}

/* In a basement gym the phone often reports itself online while nothing gets
   through, and a fetch can hang for a minute. Database calls give up instead,
   so the write lands in the outbox. Storage and functions are left alone: a
   screenshot upload or a vision read may legitimately take longer. */
const REST_TIMEOUT_MS = 15_000;

export function timedFetch(fetchImpl, ms = REST_TIMEOUT_MS) {
  return (input, init = {}) => {
    const url = String(input?.url ?? input);
    if (!url.includes('/rest/v1/') || typeof AbortSignal?.timeout !== 'function') {
      return fetchImpl(input, init);
    }
    const timeout = AbortSignal.timeout(ms);
    const signal = init.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([init.signal, timeout])
      : (init.signal ?? timeout);
    return fetchImpl(input, { ...init, signal });
  };
}

let safeStorage = null;
try {
  globalThis.localStorage?.getItem('gym-coach.probe');
  safeStorage = globalThis.localStorage;
} catch {
  safeStorage = null;
}

const outbox = createOutbox({ storage: safeStorage });

export const state = {
  user: null,
  online: globalThis.navigator?.onLine ?? true,
  loaded: false,
  rules: null,
  rulesVersion: null,
  manual: null,
  manualVersion: null,
  documents: [],
  exercises: [],
  activeBlock: null,
  blocks: [],
  days: [],
  slots: [],
  liftState: [],
  rotation: null,
  weeklyVolume: [],
  trainingRate: null,
  bodyTrend: [],
  sessions: [],
  jobs: [],
  journal: [],
  notes: [],
  decisions: [],
  bodyMetrics: [],
  sessionDetail: null,
  blockDetails: {},
  liftHistory: {},
  rulesSchema: null,
  healthRuns: [],
  healthSettings: null,
  pendingWrites: 0,
  failedWrites: 0,
  stale: false,
};

const handlers = {};
export const on = (event, fn) => { (handlers[event] ??= []).push(fn); };
export const emit = (event, data) => (handlers[event] ?? []).forEach((fn) => {
  try { fn(data); } catch (err) { console.error(err); }
});

globalThis.addEventListener?.('online', () => {
  state.online = true;
  emit('net');
  flushOutbox()
    .then(() => (state.stale ? load() : null))
    .catch(() => {});
});
globalThis.addEventListener?.('offline', () => { state.online = false; emit('net'); });

// ---------- auth ----------

export const isConfigured = () => configured;

export async function signIn(email, password) {
  const { data, error } = await client().auth.signInWithPassword({
    email: String(email).trim(), password,
  });
  if (error) throw error;
  return data.user;
}

export const signOut = () => {
  try { safeStorage?.removeItem(SNAPSHOT_KEY); } catch { /* nothing to clear */ }
  return client().auth.signOut();
};

/* Who is signed in. An access token that expired overnight cannot be refreshed
   with no signal, and supabase-js then reports no session. That is not a
   sign-out: when the refresh failed on the network and this phone holds a
   snapshot, the app opens on it and the writes queue until the token refreshes. */
export function pickUser(session, error, snap) {
  if (session?.user) return session.user;
  const network = error && (error.name === 'AuthRetryableFetchError'
    || /fetch|network|load failed/i.test(String(error.message ?? '')));
  return network && snap?.userId ? { id: snap.userId, offline: true } : null;
}

export function onAuth(callback) {
  let lastUserId;
  let offlineUser = null;
  const notify = (user) => {
    state.user = user;
    const id = user?.id ?? null;
    if (id === lastUserId) return;
    lastUserId = id;
    callback(state.user);
  };
  client().auth.getSession().then(({ data, error }) => {
    const user = pickUser(data.session, error, readSnapshot());
    if (user?.offline) offlineUser = user;
    notify(user);
  });
  client().auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      offlineUser = null;
      notify(session.user);
      // A refreshed token is what writes queued as "signed out" were waiting for.
      if (outbox.size() > 0) flushOutbox().catch(() => {});
    } else if (event === 'SIGNED_OUT' || !offlineUser) {
      offlineUser = null;
      notify(null);
    }
  });
}

// ---------- reads ----------

const rows = (result) => {
  if (result.error) throw result.error;
  return result.data ?? [];
};

/* The last loaded state, kept on the phone so the app opens with today's plan
   and the open workout when there is no signal. History-sized lists (document
   versions, the journal) stay out to keep it small. */
const SNAPSHOT_KEY = 'gym-coach.snapshot';
const SNAPSHOT_KEYS = [
  'rules', 'rulesVersion', 'manual', 'manualVersion', 'exercises', 'activeBlock', 'blocks',
  'days', 'slots', 'liftState', 'rotation', 'weeklyVolume', 'trainingRate', 'bodyTrend',
  'sessions', 'jobs', 'notes', 'decisions', 'bodyMetrics', 'sessionDetail',
  'healthRuns', 'healthSettings',
];

export function snapshotOf(s) {
  const picked = {};
  for (const key of SNAPSHOT_KEYS) {
    if (s[key] !== undefined) picked[key] = s[key];
  }
  return { userId: s.user?.id ?? null, state: picked };
}

export function restoreSnapshot(s, snap) {
  if (!snap?.state || !s.user?.id || snap.userId !== s.user.id) return false;
  Object.assign(s, snap.state, { loaded: true, stale: true });
  return true;
}

function readSnapshot() {
  try {
    const raw = safeStorage?.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persist() {
  try {
    safeStorage?.setItem(SNAPSHOT_KEY, JSON.stringify(snapshotOf(state)));
  } catch {
    // Storage full or refused: the app still works online.
  }
}

function syncPending() {
  state.pendingWrites = outbox.size();
  state.failedWrites = outbox.failed().length;
}

/* Fresh rows from the server know nothing of writes still in the outbox, so
   those are laid back over them; otherwise a session started offline would
   vanish from Today and could be started twice. */
function replayQueued() {
  for (const op of outbox.list()) mirror(state, op, { replay: true });
}

/* With no network, the in-memory state is kept, or the snapshot restored on a
   cold start. Either way it is marked stale and the app still renders. */
function fallBackToLocal(err) {
  if (state.loaded || restoreSnapshot(state, readSnapshot())) {
    state.stale = true;
    syncPending();
    emit('loaded');
    return;
  }
  throw err;
}

export async function load() {
  if (!state.user) return;
  if (!state.online) {
    fallBackToLocal(new Error('offline, and nothing saved on this phone yet'));
    return;
  }
  try {
    await loadFromServer();
  } catch (err) {
    fallBackToLocal(err);
  }
}

async function loadFromServer() {
  const week = isoWeekStart(ymd(new Date()));

  const [
    documents, exercises, blocks, liftState, rotation,
    weeklyVolume, trainingRate, bodyTrend, sessions, jobs, notes, decisions, bodyMetrics, journal,
    healthRuns, healthSettings,
  ] = await Promise.all([
    client().from('documents').select('*').order('version', { ascending: false }).then(rows),
    client().from('exercises').select('*').order('name').then(rows),
    client().from('blocks').select('*').order('created_at', { ascending: false }).then(rows),
    client().from('lift_state').select('*').then(rows),
    client().from('rotation_next').select('*').maybeSingle()
      .then((r) => (r.error ? null : r.data)),
    client().from('weekly_muscle_volume').select('*').gte('week_start', week).then(rows),
    client().from('training_rate').select('*').maybeSingle()
      .then((r) => (r.error ? null : r.data)),
    client().from('body_trend').select('*').order('week_start', { ascending: false }).limit(26).then(rows),
    client().from('sessions').select('*').order('date', { ascending: false }).limit(365).then(rows),
    client().from('ai_jobs').select('*').order('created_at', { ascending: false }).limit(30).then(rows),
    client().from('coach_notes').select('*').order('created_at', { ascending: false }).limit(60).then(rows),
    client().from('decisions').select('*').order('date', { ascending: false }).limit(40).then(rows),
    client().from('body_metrics').select('*').order('date', { ascending: false }).limit(120).then(rows),
    client().from('ai_jobs').select('*').eq('kind', 'ask').ilike('instructions', '%mode=journal%')
      .order('created_at', { ascending: false }).limit(200).then(rows),
    // Optional: an older database without the health tables still loads.
    client().from('health_runs').select('*').order('created_at', { ascending: false }).limit(20)
      .then((r) => (r.error ? [] : r.data ?? [])),
    client().from('health_settings').select('*').maybeSingle()
      .then((r) => (r.error ? null : r.data)),
  ]);

  const latest = (key) => documents.find((d) => d.key === key) ?? null;
  const rulesDoc = latest('rules');
  const manualDoc = latest('manual');

  const blockId = blocks.find((b) => b.status === 'active')?.id;
  let days = [];
  let slots = [];
  if (blockId) {
    days = await client().from('block_days').select('*')
      .eq('block_id', blockId).order('day_index').then(rows);
    const dayIds = days.map((d) => d.id);
    slots = dayIds.length
      ? await client().from('block_slots').select('*').in('day_id', dayIds).order('position').then(rows)
      : [];
  }

  Object.assign(state, {
    days,
    slots,
    stale: false,
    documents,
    rules: rulesDoc?.body_json ?? null,
    rulesVersion: rulesDoc?.version ?? null,
    manual: manualDoc?.body_md ?? null,
    manualVersion: manualDoc?.version ?? null,
    exercises,
    blocks,
    activeBlock: blocks.find((b) => b.status === 'active') ?? null,
    liftState,
    rotation,
    weeklyVolume,
    trainingRate,
    bodyTrend,
    sessions,
    jobs,
    notes,
    decisions,
    bodyMetrics,
    journal,
    healthRuns,
    healthSettings,
    blockDetails: {},
    liftHistory: {},
    loaded: true,
  });

  replayQueued();
  syncPending();
  persist();
  emit('loaded');
}

/* Days and slots of any block, for the drafts on the Block screen. */
export async function loadBlockDetail(blockId) {
  const days = await client().from('block_days').select('*')
    .eq('block_id', blockId).order('day_index').then(rows);
  const slots = days.length
    ? await client().from('block_slots').select('*')
      .in('day_id', days.map((d) => d.id)).order('position').then(rows)
    : [];
  return { days, slots };
}

export async function loadSession(sessionId) {
  const exercises = await client().from('session_exercises').select('*')
    .eq('session_id', sessionId).order('position').then(rows);
  const sets = exercises.length
    ? await client().from('sets').select('*')
      .in('session_exercise_id', exercises.map((e) => e.id)).order('set_no').then(rows)
    : [];
  return { exercises, sets };
}

/* The open session, with its frozen targets and whatever has been logged so far.
   Held on state so the Workout screen can be rendered from stubbed data. */
export async function loadSessionDetail(sessionId) {
  const cached = state.sessionDetail?.session?.id === sessionId ? state.sessionDetail : null;
  if (!state.online && cached) return cached;
  try {
    const session = state.sessions.find((s) => s.id === sessionId)
      ?? await client().from('sessions').select('*').eq('id', sessionId).maybeSingle()
        .then((r) => (r.error ? null : r.data));
    if (!session) {
      state.sessionDetail = null;
      return null;
    }
    const { exercises, sets } = await loadSession(sessionId);
    state.sessionDetail = { session, exercises, sets };
    replayQueued();
    persist();
    return state.sessionDetail;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export const liftHistoryFor = (exerciseId) => client().from('lift_history').select('*')
  .eq('exercise_id', exerciseId).order('date').then(rows);

/* Uploads workout screenshot(s) into the private 'shots' bucket under the
   user's own folder (shots/{user_id}/{session_id}/...) so RLS permits it. */
export async function uploadSessionShots(sessionId, files) {
  const userId = state.user?.id;
  if (!userId || !sessionId || !files?.length) return [];
  const bucket = client().storage.from('shots');
  const uploaded = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${userId}/${sessionId}/watch-${Date.now()}-${i + 1}.${ext}`;
    const { error } = await bucket.upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (error) throw error;
    uploaded.push(path);
  }
  return uploaded;
}

// ---------- writes ----------

/* What a failed write means for the queue. "duplicate" on an insert is checked
   against the row's own id, because a replay after a lost response looks
   exactly like that. "auth" is an expired session, which a token refresh fixes.
   "permanent" is a row the database will reject however often it is sent.
   Anything else, including a timeout, is the network. */
export function classifyError(error, action) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  if (code === 'PGRST301' || code === 'PGRST303' || error?.status === 401 || /\bjwt\b/i.test(message)) {
    return { kind: 'auth' };
  }
  if (code === '23505' && action === 'insert') return { kind: 'duplicate' };
  if (/^(22|23)/.test(code) || /^PGRST[12]\d\d$/.test(code) || ['42501', '400', '403'].includes(code)) {
    return { kind: 'permanent' };
  }
  return { kind: 'transient' };
}

const uuid = () => globalThis.crypto.randomUUID();

/* Every inserted row carries an id made on the phone. The screen can show it
   and edit it before the server has seen it, and a replayed insert is
   recognisable as one rather than creating a second copy. */
export function withIds(op, newId = uuid) {
  if (op?.action !== 'insert') return op;
  const add = (r) => (r.id ? r : { ...r, id: newId() });
  return { ...op, row: Array.isArray(op.row) ? op.row.map(add) : add(op.row) };
}

const SESSION_DEFAULTS = {
  pain: 'none', notes: null, hr_zones: null, duration_min: null, calories: null,
  avg_hr: null, peak_hr: null, effort_1_10: null, source: 'app',
};

/* Applies a write to the in-memory state the screens render from, so a set
   logged with no signal shows the moment it is tapped. Covers the open
   workout, the session list and weigh-ins; everything else waits for a load.
   A replay over freshly loaded rows only fills in the open workout; it never
   makes a different session the open one. */
export function mirror(s, op, { replay = false } = {}) {
  const list = Array.isArray(op.row) ? op.row : [op.row];
  const detail = s.sessionDetail;
  const merge = (arr, id, row) => {
    const found = arr?.find((x) => x.id === id);
    if (found) Object.assign(found, row);
  };
  const has = (arr, id) => (arr ?? []).some((x) => x.id === id);

  if (op.table === 'sessions') {
    if (op.action === 'insert') {
      for (const row of list) {
        if (!has(s.sessions, row.id)) {
          s.sessions = [{ ...SESSION_DEFAULTS, created_at: new Date().toISOString(), ...row }, ...(s.sessions ?? [])];
        }
      }
    } else if (op.action === 'update') {
      merge(s.sessions, op.id, op.row);
      if (detail?.session?.id === op.id) Object.assign(detail.session, op.row);
    }
  } else if (op.table === 'session_exercises') {
    if (op.action === 'insert') {
      for (const row of list) {
        let d = s.sessionDetail;
        if (d?.session?.id !== row.session_id) {
          if (replay) continue;
          const session = (s.sessions ?? []).find((x) => x.id === row.session_id);
          if (!session) continue;
          d = { session, exercises: [], sets: [] };
          s.sessionDetail = d;
        }
        if (!has(d.exercises, row.id)) d.exercises.push({ deviation_note: null, ...row });
      }
    } else if (op.action === 'update') {
      merge(detail?.exercises, op.id, op.row);
    }
  } else if (op.table === 'sets' && detail) {
    if (op.action === 'insert') {
      for (const row of list) {
        if (has(detail.exercises, row.session_exercise_id) && !has(detail.sets, row.id)) {
          detail.sets.push({ partial: false, done: true, ...row });
        }
      }
    } else if (op.action === 'update') {
      merge(detail.sets, op.id, op.row);
    } else if (op.action === 'delete') {
      detail.sets = detail.sets.filter((x) => x.id !== op.id);
    }
  } else if (op.table === 'body_metrics' && op.action === 'insert' && Array.isArray(s.bodyMetrics)) {
    for (const row of list) {
      if (!has(s.bodyMetrics, row.id)) s.bodyMetrics = [row, ...s.bodyMetrics];
    }
  }
}

async function run(op) {
  const table = client().from(op.table);
  try {
    if (op.action === 'insert') return await table.insert(op.row).select();
    if (op.action === 'upsert') return await table.upsert(op.row, { onConflict: op.onConflict }).select();
    if (op.action === 'update') return await table.update(op.row).eq('id', op.id).select();
    if (op.action === 'delete') return await table.delete().eq('id', op.id);
  } catch (err) {
    return { error: { message: String(err?.message ?? err), code: '' } };
  }
  return { error: { message: `unknown action ${op.action}`, code: '400' } };
}

async function alreadyLanded(op) {
  const ids = (Array.isArray(op.row) ? op.row : [op.row]).map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return false;
  const { data, error } = await client().from(op.table).select('id').in('id', ids);
  return !error && (data ?? []).length === ids.length;
}

/* Thrown before anything is sent: with no session the request would go out as
   anon, match no rows under RLS, and look like a success. */
async function hasSession() {
  try {
    const { data } = await client().auth.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}

async function send(op) {
  if (!await hasSession()) throw new Error('signed out or token expired; waiting to retry');
  let result = await run(op);
  const errorOf = (r) => ({ ...r.error, status: r.status });
  if (result.error && classifyError(errorOf(result), op.action).kind === 'auth') {
    await client().auth.refreshSession().catch(() => {});
    result = await run(op);
  }
  if (result.error) {
    const { kind } = classifyError(errorOf(result), op.action);
    if (kind === 'duplicate' && await alreadyLanded(op)) {
      throw Object.assign(new Error('already saved'), { landed: true });
    }
    throw Object.assign(new Error(result.error.message), {
      permanent: kind === 'permanent' || kind === 'duplicate',
      code: result.error.code,
    });
  }
  // An update that matched nothing changed nothing; usually the row's own
  // insert is still queued or was rejected. Kept, so the edit is not lost.
  if (op.action === 'update' && Array.isArray(result.data) && result.data.length === 0) {
    throw Object.assign(new Error('the row to update is not in the database yet'), { permanent: true });
  }
  return result.data?.[0] ?? null;
}

/* Online with nothing queued, a write goes straight out. Otherwise it joins
   the back of the queue, so it can never overtake an earlier write. Either
   way the screen state is updated at once and saved on the phone. A write the
   database rejects outright is thrown, so the screen can say so. */
export async function write(input) {
  const op = withIds(input);
  const behind = outbox.size() > 0;
  if (state.online && !behind) {
    try {
      const saved = await send(op);
      mirror(state, op);
      persist();
      return saved;
    } catch (err) {
      if (err.landed) {
        mirror(state, op);
        persist();
        return null;
      }
      if (err.permanent) throw err;
    }
  }
  outbox.queue(op);
  mirror(state, op);
  persist();
  syncPending();
  emit('pending');
  if (behind && state.online) flushOutbox().catch(() => {});
  return null;
}

let flushing = null;

export async function flushOutbox() {
  if (!state.online || outbox.size() === 0) return { sent: 0, failed: 0, kept: 0 };
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const result = await outbox.flush(send);
      syncPending();
      emit('pending');
      if (result.sent > 0) await load();
      return result;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

export const pendingWrites = () => outbox.size();
export const failedWrites = () => outbox.failed();

/* The only way a queued write leaves the phone without landing: the owner
   looked at it and chose to throw it away. */
export async function discardWrite(qid) {
  outbox.discard(qid);
  syncPending();
  emit('pending');
  await load();
}

// ---------- documents ----------

/* documents is append-only, so saving is always an insert at version + 1. */
export async function saveDocument(key, body) {
  const current = state.documents.filter((d) => d.key === key);
  const version = (current[0]?.version ?? 0) + 1;
  const row = key === 'rules'
    ? { key, version, body_json: body }
    : { key, version, body_md: body };
  const saved = await send({ table: 'documents', action: 'insert', row });
  await load();
  return saved;
}

// ---------- AI jobs ----------

/* The app never inserts into ai_jobs. The edge function verifies the session
   and inserts with the service-role key, so a queued row always has an Action
   behind it. */
export async function dispatchJob(kind, instructions, targetBlockId = null) {
  const { data: { session } } = await client().auth.getSession();
  if (!session) throw new Error('not signed in');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-job`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ kind, instructions, target_block_id: targetBlockId }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `dispatch failed (${response.status})`);
  await load();
  return body;
}

let jobsChannel = null;

export function subscribeJobs(callback) {
  if (jobsChannel) {
    client().removeChannel(jobsChannel).catch(() => {});
    jobsChannel = null;
  }
  jobsChannel = client().channel('ai_jobs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_jobs' }, async (payload) => {
      const row = payload.new ?? payload.old;
      if (!row) return;
      const i = state.jobs.findIndex((j) => j.id === row.id);
      const prevStatus = i >= 0 ? state.jobs[i].status : null;
      if (payload.eventType === 'DELETE') state.jobs = state.jobs.filter((j) => j.id !== row.id);
      else if (i >= 0) state.jobs[i] = row;
      else state.jobs.unshift(row);

      const j = state.journal.findIndex((x) => x.id === row.id);
      if (payload.eventType === 'DELETE') state.journal = state.journal.filter((x) => x.id !== row.id);
      else if (j >= 0) state.journal[j] = row;
      else if (/mode=journal/.test(row.instructions ?? '')) state.journal.unshift(row);

      if (row.status === 'done' && prevStatus !== 'done') {
        await load().catch(() => {});
      }
      callback(row);
    })
    .subscribe();
  return jobsChannel;
}

// ---------- Health check ----------

/* request_health_run() checks the caller and throttles; the database trigger
   then wakes the edge function. The app never inserts a run itself. */
export async function requestHealthRun() {
  const { error } = await client().rpc('request_health_run');
  if (error) throw new Error(error.message);
  await load();
}

export async function saveHealthSettings(settings) {
  const { error } = await client().from('health_settings')
    .upsert({ ...settings, user_id: state.user.id }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  await load();
}

let healthChannel = null;

export function subscribeHealth(callback) {
  if (healthChannel) {
    client().removeChannel(healthChannel).catch(() => {});
    healthChannel = null;
  }
  healthChannel = client().channel('health_runs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'health_runs' }, (payload) => {
      const row = payload.new ?? payload.old;
      if (!row) return;
      const runs = state.healthRuns.filter((r) => r.id !== row.id);
      if (payload.eventType !== 'DELETE') runs.unshift(row);
      state.healthRuns = runs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      callback(row);
    })
    .subscribe();
  return healthChannel;
}

/* Asks the read-watch-shots function for the numbers on screenshots already
   uploaded. Returns { fields, model }; writes nothing. */
export async function readWatchShots(paths) {
  const { data: { session } } = await client().auth.getSession();
  if (!session) throw new Error('not signed in');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/read-watch-shots`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ paths }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `could not read the screenshots (${response.status})`);
  return body;
}

/* Screenshots already in a session's folder, including ones uploaded before
   the form could read them. */
export async function listSessionShots(sessionId) {
  const userId = state.user?.id;
  if (!userId || !sessionId) return { folder: null, files: [] };
  const folder = `${userId}/${sessionId}`;
  const { data, error } = await client().storage.from('shots').list(folder, { limit: 20 });
  if (error) throw error;
  return { folder, files: data ?? [] };
}

export async function downloadShot(path) {
  const { data, error } = await client().storage.from('shots').download(path);
  if (error) throw error;
  return data;
}
