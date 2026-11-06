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
    });
  }
  return supabaseClient;
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
  notes: [],
  decisions: [],
  bodyMetrics: [],
  sessionDetail: null,
  blockDetails: {},
  pendingWrites: 0,
};

const handlers = {};
export const on = (event, fn) => { (handlers[event] ??= []).push(fn); };
export const emit = (event, data) => (handlers[event] ?? []).forEach((fn) => {
  try { fn(data); } catch (err) { console.error(err); }
});

globalThis.addEventListener?.('online', () => {
  state.online = true;
  emit('net');
  flushOutbox();
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

export const signOut = () => client().auth.signOut();

export function onAuth(callback) {
  client().auth.getSession().then(({ data }) => {
    state.user = data.session?.user ?? null;
    callback(state.user);
  });
  client().auth.onAuthStateChange((_event, session) => {
    state.user = session?.user ?? null;
    callback(state.user);
  });
}

// ---------- reads ----------

const rows = (result) => {
  if (result.error) throw result.error;
  return result.data ?? [];
};

export async function load() {
  if (!state.user) return;
  const week = isoWeekStart(ymd(new Date()));

  const [
    documents, exercises, blocks, liftState, rotation,
    weeklyVolume, trainingRate, bodyTrend, sessions, jobs, notes, decisions, bodyMetrics,
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
    client().from('sessions').select('*').order('date', { ascending: false }).limit(120).then(rows),
    client().from('ai_jobs').select('*').order('created_at', { ascending: false }).limit(30).then(rows),
    client().from('coach_notes').select('*').order('created_at', { ascending: false }).limit(60).then(rows),
    client().from('decisions').select('*').order('date', { ascending: false }).limit(40).then(rows),
    client().from('body_metrics').select('*').order('date', { ascending: false }).limit(120).then(rows),
  ]);

  const latest = (key) => documents.find((d) => d.key === key) ?? null;
  const rulesDoc = latest('rules');
  const manualDoc = latest('manual');

  Object.assign(state, {
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
    loaded: true,
  });

  const blockId = state.activeBlock?.id;
  if (blockId) {
    state.days = await client().from('block_days').select('*')
      .eq('block_id', blockId).order('day_index').then(rows);
    const dayIds = state.days.map((d) => d.id);
    state.slots = dayIds.length
      ? await client().from('block_slots').select('*').in('day_id', dayIds).order('position').then(rows)
      : [];
  } else {
    state.days = [];
    state.slots = [];
  }

  state.pendingWrites = outbox.size();
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
  const session = state.sessions.find((s) => s.id === sessionId)
    ?? await client().from('sessions').select('*').eq('id', sessionId).maybeSingle()
      .then((r) => (r.error ? null : r.data));
  if (!session) {
    state.sessionDetail = null;
    return null;
  }
  const { exercises, sets } = await loadSession(sessionId);
  state.sessionDetail = { session, exercises, sets };
  return state.sessionDetail;
}

export const liftHistoryFor = (exerciseId) => client().from('lift_history').select('*')
  .eq('exercise_id', exerciseId).order('date').then(rows);

// ---------- writes ----------

/* A failure the row itself caused will fail the same way forever, so the outbox
   drops it instead of blocking every later write. Postgres class 22 and 23 are
   data and constraint violations; 401/403 mean the session, not the network. */
function isPermanent(error) {
  const code = String(error?.code ?? '');
  return /^(22|23)/.test(code) || ['401', '403', '400', '42501'].includes(code);
}

async function send(op) {
  const table = client().from(op.table);
  let result;
  if (op.action === 'insert') result = await table.insert(op.row).select();
  else if (op.action === 'upsert') result = await table.upsert(op.row, { onConflict: op.onConflict }).select();
  else if (op.action === 'update') result = await table.update(op.row).eq('id', op.id).select();
  else if (op.action === 'delete') result = await table.delete().eq('id', op.id);
  else throw Object.assign(new Error(`unknown action ${op.action}`), { permanent: true });

  if (result.error) {
    throw Object.assign(new Error(result.error.message), {
      permanent: isPermanent(result.error),
      code: result.error.code,
    });
  }
  return result.data?.[0] ?? null;
}

/* Online, a write goes straight out so the screen can use the returned id.
   Offline, it is queued and the caller gets null. */
export async function write(op) {
  if (state.online) {
    try {
      return await send(op);
    } catch (err) {
      if (err.permanent) throw err;
    }
  }
  outbox.queue(op);
  state.pendingWrites = outbox.size();
  emit('pending');
  return null;
}

export async function flushOutbox() {
  if (!state.online || outbox.size() === 0) return { sent: 0, dropped: 0, kept: 0 };
  const result = await outbox.flush(send);
  state.pendingWrites = outbox.size();
  emit('pending');
  if (result.sent > 0) await load();
  return result;
}

export const pendingWrites = () => outbox.size();

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

export function subscribeJobs(callback) {
  return client().channel('ai_jobs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_jobs' }, (payload) => {
      const row = payload.new ?? payload.old;
      if (!row) return;
      const i = state.jobs.findIndex((j) => j.id === row.id);
      if (payload.eventType === 'DELETE') state.jobs = state.jobs.filter((j) => j.id !== row.id);
      else if (i >= 0) state.jobs[i] = row;
      else state.jobs.unshift(row);
      callback(row);
    })
    .subscribe();
}
