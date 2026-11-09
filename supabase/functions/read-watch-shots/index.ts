// Reads the numbers off Apple Watch / Fitness screenshots the app just uploaded,
// so the finish-session form fills itself. Called by the signed-in app.
//
// The caller names storage paths; the function checks each is in the caller's
// own folder before reading it with the service key, sends the images to a fast
// vision model on NVIDIA's API, and returns six numbers. Nothing is written:
// the owner still sees the form and presses Save.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { WATCH_PROMPT, parseWatchReply, ownedPath } from './watch.js';

const MODELS: [string, number][] = [
  // A replica can take 35 s on a busy day; the platform stops the function at 150.
  ['nvidia/nemotron-3.5-super-vl-120b-a12b', 60_000],
  ['meta/llama-3.2-90b-vision-instruct', 45_000],
];
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MAX_SHOTS = 4;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });

const short = (err: unknown) => String((err as Error)?.message ?? err).slice(0, 200);

async function ask(model: string, timeoutMs: number, images: string[]) {
  const key = Deno.env.get('NVIDIA_API_KEY');
  if (!key) throw new Error('NVIDIA_API_KEY is not set');
  const r = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 400,
      ...(model.startsWith('nvidia/') ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: WATCH_PROMPT },
          ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error(`${model} returned ${r.status}`);
  const body = await r.json();
  return parseWatchReply(body?.choices?.[0]?.message?.content ?? '');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'use POST' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'not signed in' }, 401);
  const { data: { user }, error: authError } = await db.auth.getUser(jwt);
  if (authError || !user) return json({ error: 'not signed in' }, 401);

  let paths: string[];
  try {
    paths = (await request.json())?.paths;
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_SHOTS) {
    return json({ error: `send 1 to ${MAX_SHOTS} screenshot paths` }, 400);
  }
  if (!paths.every((p) => ownedPath(p, user.id))) {
    return json({ error: 'those screenshots are not yours' }, 403);
  }

  const images: string[] = [];
  for (const path of paths) {
    const { data: blob, error } = await db.storage.from('shots').download(path);
    if (error || !blob) return json({ error: 'could not read a screenshot' }, 404);
    const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    images.push(`data:${type};base64,${encodeBase64(new Uint8Array(await blob.arrayBuffer()))}`);
  }

  const errors: string[] = [];
  for (const [model, timeoutMs] of MODELS) {
    try {
      return json({ fields: await ask(model, timeoutMs, images), model }, 200);
    } catch (err) {
      errors.push(short(err));
    }
  }
  return json({ error: `could not read the screenshots (${errors.join('; ')})` }, 502);
});
