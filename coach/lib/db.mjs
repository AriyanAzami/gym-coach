/* The service-role client, used only inside the Action. It bypasses RLS, so it
   exists in exactly one place and nothing here ever prints a row. */

import { createClient } from '@supabase/supabase-js';

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const rows = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
};

export async function getJob(client, jobId) {
  const { data, error } = await client.from('ai_jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('job not found');
  return data;
}

export async function setJobStatus(client, jobId, patch) {
  const { error } = await client.from('ai_jobs').update(patch).eq('id', jobId);
  if (error) throw new Error(error.message);
}

/* An error string that goes in the ai_jobs row, which is behind RLS and so is
   the only place a detail may safely land. Capped so a stack trace cannot fill
   the column. */
export const shortError = (err) => String(err?.message ?? err).slice(0, 500);
