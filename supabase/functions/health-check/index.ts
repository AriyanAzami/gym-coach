// The health check. Woken by the database with a run id and nothing else.
//
// It claims the run (queued -> running), answers at once, and does the work in
// the background: deterministic checks first, saved straight away, then a second
// opinion from a model on NVIDIA's API. A model failure never fails the run; the
// deterministic findings stand on their own and ai_error says what went wrong.
//
// The service-role client bypasses RLS, so every read below filters on the
// run's user_id.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { runChecks, repoFindings } from './checks.js';
import schema from './rules.schema.json' with { type: 'json' };

const DEFAULT_PRIMARY = 'nvidia/nemotron-3-ultra-550b-a55b';
const DEFAULT_FALLBACK = 'mistralai/mistral-large-4-1t-a52b';
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const WEEKS_OF_HISTORY = 8;
// The platform stops a function at 150 s; leave room to write the result.
const MODEL_BUDGET_MS = 135_000;
const PRIMARY_CAP_MS = 105_000;
const MAX_AI_FINDINGS = 12;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const short = (err: unknown) => String((err as Error)?.message ?? err).slice(0, 300);

const rows = <T>(r: { data: T[] | null; error: unknown }) => {
  if (r.error) throw r.error;
  return r.data ?? [];
};

const SYSTEM_PROMPT = `You review a personal strength-training system for problems.
You receive JSON with the owner's rules (every coaching number), operating manual,
exercises, the last ${WEEKS_OF_HISTORY} weeks of sessions with every set, derived views,
the active block, decisions, coach notes, recent coach-job statuses, recent journal
turns, and the findings a deterministic checker already produced.

Look for what the checker cannot see: logging that contradicts a note or injury,
a plan that drifts from the manual or rules, exercises that keep getting skipped,
effort or pain trends, inconsistencies between the block and what was actually
done, anything that looks wrong. Do not repeat the checker's findings. Do not
invent coaching numbers; quote the rules when you cite a threshold.

Answer with one JSON object and nothing else:
{"summary_md": "3-6 short markdown bullet points, plain and direct",
 "findings": [{"area": "training" | "data" | "plumbing",
               "severity": "warn" | "bad",
               "title": "under 60 characters",
               "detail": "one or two sentences with the dates or names involved"}]}
Return an empty findings array if nothing else is wrong.`;

function localToday(timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function gather(db: SupabaseClient, uid: string, today: string) {
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - WEEKS_OF_HISTORY * 7);
  const sinceYmd = since.toISOString().slice(0, 10);

  const [documents, exercises, sessionsDeep, liftState, weeklyVolume, trainingRate,
    bodyTrend, bodyMetrics, blocks, decisions, notes, jobs] = await Promise.all([
    db.from('current_documents').select('key,version,body_md,body_json').eq('user_id', uid).then(rows),
    db.from('exercises').select('*').eq('user_id', uid).order('name').then(rows),
    db.from('sessions').select('*, session_exercises(*, sets(*))').eq('user_id', uid)
      .gte('date', sinceYmd).order('date').then(rows),
    db.from('lift_state').select('*').eq('user_id', uid).then(rows),
    db.from('weekly_muscle_volume').select('*').eq('user_id', uid).gte('week_start', sinceYmd).then(rows),
    db.from('training_rate').select('*').eq('user_id', uid).maybeSingle().then((r) => r.data ?? null),
    db.from('body_trend').select('*').eq('user_id', uid).gte('week_start', sinceYmd).then(rows),
    db.from('body_metrics').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(60).then(rows),
    db.from('blocks').select('*, block_days(*, block_slots(*))').eq('user_id', uid).eq('status', 'active').then(rows),
    db.from('decisions').select('date,title,body').eq('user_id', uid).order('date', { ascending: false }).limit(25).then(rows),
    db.from('coach_notes').select('body,created_at').eq('user_id', uid).is('consumed_by_job', null).limit(40).then(rows),
    db.from('ai_jobs').select('id,kind,status,error,instructions,output_md,created_at').eq('user_id', uid)
      .order('created_at', { ascending: false }).limit(40).then(rows),
  ]);

  // deno-lint-ignore no-explicit-any
  const sessions: any[] = sessionsDeep;
  const sessionExercises = sessions.flatMap((s) => s.session_exercises ?? []);
  const sets = sessionExercises.flatMap((x) => x.sets ?? []);
  // deno-lint-ignore no-explicit-any
  const doc = (key: string) => documents.find((d: any) => d.key === key) ?? null;

  return {
    today,
    rules: doc('rules')?.body_json ?? null,
    manual: doc('manual')?.body_md ?? null,
    exercises, sessions, sessionExercises, sets, liftState, weeklyVolume,
    trainingRate, bodyTrend, bodyMetrics,
    activeBlock: blocks[0] ?? null,
    decisions, notes, jobs,
  };
}

async function readGitHub() {
  const repo = Deno.env.get('GH_REPO');
  if (!repo) return { error: 'GH_REPO is not set' };
  const token = Deno.env.get('GH_DISPATCH_TOKEN');
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'gym-coach-health-check',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const runs = async (file: string, n: number) => {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${file}/runs?status=completed&per_page=${n}`,
      { headers },
    );
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    return (await r.json()).workflow_runs ?? [];
  };
  try {
    const [test, coach] = await Promise.all([runs('test.yml', 1), runs('coach.yml', 5)]);
    return { test: test[0] ?? null, coach };
  } catch (err) {
    return { error: short(err) };
  }
}

// deno-lint-ignore no-explicit-any
function modelContext(d: any, findings: unknown[]) {
  return {
    today: d.today,
    rules: d.rules,
    manual: d.manual,
    exercises: d.exercises,
    sessions: d.sessions,
    lift_state: d.liftState,
    weekly_muscle_volume: d.weeklyVolume,
    training_rate: d.trainingRate,
    body_trend: d.bodyTrend,
    body_metrics: d.bodyMetrics,
    active_block: d.activeBlock,
    decisions: d.decisions,
    coach_notes: d.notes,
    // deno-lint-ignore no-explicit-any
    coach_jobs: d.jobs.map((j: any) => ({ kind: j.kind, status: j.status, error: j.error, created_at: j.created_at })),
    journal: d.jobs
      // deno-lint-ignore no-explicit-any
      .filter((j: any) => j.status === 'done' && /mode=journal/.test(j.instructions ?? ''))
      .slice(0, 10)
      // deno-lint-ignore no-explicit-any
      .map((j: any) => ({
        at: j.created_at,
        question: String(j.instructions ?? '').replace(/^\[[^\]]*\]\s*/, '').slice(0, 1500),
        answer: String(j.output_md ?? '').replace(/^<!--[\s\S]*?-->\s*/, '').slice(0, 1500),
      })),
    checker_findings: findings,
  };
}

function parseModelJson(text: string) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the model did not return JSON');
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  const findings = (Array.isArray(parsed.findings) ? parsed.findings : [])
    // deno-lint-ignore no-explicit-any
    .filter((f: any) => f && typeof f.title === 'string')
    .slice(0, MAX_AI_FINDINGS)
    // deno-lint-ignore no-explicit-any
    .map((f: any) => ({
      area: ['training', 'data', 'plumbing'].includes(f.area) ? f.area : 'training',
      severity: f.severity === 'bad' ? 'bad' : 'warn',
      code: 'ai',
      source: 'ai',
      title: String(f.title).slice(0, 120),
      detail: String(f.detail ?? '').slice(0, 600),
    }));
  const summary = typeof parsed.summary_md === 'string' ? parsed.summary_md.slice(0, 4000) : '';
  return { summary, findings };
}

async function callModel(model: string, context: unknown, timeoutMs: number) {
  const key = Deno.env.get('NVIDIA_API_KEY');
  if (!key) throw new Error('NVIDIA_API_KEY is not set');
  const r = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(context) },
      ],
    }),
  });
  if (!r.ok) throw new Error(`${model} returned ${r.status}`);
  const body = await r.json();
  const text = body?.choices?.[0]?.message?.content ?? '';
  return parseModelJson(text);
}

async function review(primary: string, fallback: string | null, context: unknown) {
  const deadline = Date.now() + MODEL_BUDGET_MS;
  const errors: string[] = [];
  for (const [model, cap] of [[primary, PRIMARY_CAP_MS], [fallback, MODEL_BUDGET_MS]] as const) {
    if (!model) continue;
    const left = Math.min(cap, deadline - Date.now());
    if (left < 5_000) break;
    try {
      return { model, ...(await callModel(model, context, left)) };
    } catch (err) {
      errors.push(short(err));
    }
  }
  return { error: errors.join('; ') || 'no model configured' };
}

// deno-lint-ignore no-explicit-any
async function work(db: SupabaseClient, run: any) {
  try {
    const { data: settings } = await db.from('health_settings').select('*')
      .eq('user_id', run.user_id).maybeSingle();
    const today = localToday(settings?.timezone ?? 'UTC');
    const d = await gather(db, run.user_id, today);

    const checked = [
      ...runChecks({ ...d, now: new Date().toISOString(), schema }),
      ...repoFindings(await readGitHub()),
    ].map((f) => ({ ...f, source: 'checker' }));
    await db.from('health_runs').update({ findings: checked }).eq('id', run.id);

    const ai = await review(
      settings?.primary_model ?? DEFAULT_PRIMARY,
      settings ? settings.fallback_model : DEFAULT_FALLBACK,
      modelContext(d, checked),
    );

    await db.from('health_runs').update({
      status: 'done',
      findings: [...checked, ...('findings' in ai ? ai.findings ?? [] : [])],
      ai_summary_md: 'summary' in ai ? ai.summary : null,
      ai_model: 'model' in ai ? ai.model : null,
      ai_error: 'error' in ai ? ai.error : null,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id);
  } catch (err) {
    await db.from('health_runs').update({
      status: 'failed', error: short(err), finished_at: new Date().toISOString(),
    }).eq('id', run.id);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'use POST' }, 405);

  let runId = '';
  try {
    runId = String((await request.json())?.run_id ?? '');
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }
  if (!UUID.test(runId)) return json({ error: 'run_id must be a uuid' }, 400);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: run } = await db.from('health_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('status', 'queued')
    .select()
    .maybeSingle();
  if (!run) return json({ error: 'nothing to run' }, 409);

  // @ts-ignore EdgeRuntime is a global on Supabase's runtime
  EdgeRuntime.waitUntil(work(db, run));
  return json({ run_id: run.id, status: 'running' }, 202);
});
