// The only door between the phone and a GitHub Action that holds secrets.
//
// It verifies the caller's Supabase session, writes the job row itself with the
// service-role key, and then tells GitHub a job id. Nothing else crosses: the
// instructions stay in the database behind row-level security, because a
// repository_dispatch payload ends up in a public repository's event history.
//
// The app cannot insert into ai_jobs directly (it has a select policy only), so
// a queued row always has an Action behind it.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const KINDS = ['block', 'revise_block', 'checkin', 'ask'];
const MAX_INSTRUCTIONS = 4000;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'use POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = Deno.env.get('GH_DISPATCH_TOKEN');
  const repo = Deno.env.get('GH_REPO');

  // 1. The caller must be a real user of this project. A token that parses but
  //    resolves to nobody is not good enough.
  const authorization = request.headers.get('authorization') ?? '';
  const jwt = authorization.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'not signed in' }, 401);

  const asCaller = createClient(url, anonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await asCaller.auth.getUser(jwt);
  if (authError || !user) return json({ error: 'not signed in' }, 401);

  // 2. The request body decides only the kind and the text, never the owner,
  //    the repository or the token.
  let body: { kind?: string; instructions?: string; target_block_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }

  const kind = String(body.kind ?? '');
  if (!KINDS.includes(kind)) {
    return json({ error: `kind must be one of ${KINDS.join(', ')}` }, 400);
  }

  const instructions = body.instructions ? String(body.instructions).slice(0, MAX_INSTRUCTIONS) : null;
  const targetBlockId = body.target_block_id ?? null;
  if (kind === 'revise_block' && !targetBlockId) {
    return json({ error: 'revise_block needs a target_block_id' }, 400);
  }

  if (!token || !repo) {
    return json({ error: 'the dispatcher is not configured' }, 500);
  }

  // 3. Write the job as the verified user.
  const asService = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: job, error: insertError } = await asService
    .from('ai_jobs')
    .insert({
      user_id: user.id,
      kind,
      instructions,
      target_block_id: targetBlockId,
      status: 'queued',
    })
    .select()
    .single();

  if (insertError || !job) {
    return json({ error: 'could not create the job' }, 500);
  }

  // 4. Tell GitHub a job id. That is the entire payload.
  const dispatch = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'coach-job',
      client_payload: { job_id: job.id },
    }),
  });

  if (!dispatch.ok) {
    await asService.from('ai_jobs').update({
      status: 'failed',
      error: `could not start the run (GitHub returned ${dispatch.status})`,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id);
    return json({ error: 'could not start the run' }, 502);
  }

  return json({ job_id: job.id, status: 'queued' }, 201);
});
