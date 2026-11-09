/* Reading Apple Watch / Fitness workout screenshots: the prompt, and the guard
   between what a vision model says and what lands in the finish-session form.
   A value that is missing, unreadable or implausible comes back null, so the
   form keeps whatever the owner already has rather than taking a guess. */

export const WATCH_PROMPT = `These are screenshots of one Apple Watch / Apple Fitness workout summary.
Read the numbers off them and answer with one JSON object and nothing else:
{"duration_min": whole minutes of Workout Time (0:52:14 is 52),
 "calories": Active Calories in kcal (use Total Calories only if Active is not shown),
 "avg_hr": average heart rate in bpm,
 "peak_hr": the highest heart rate shown (the top of the heart-rate chart, or a Max/Peak value),
 "effort_1_10": the Effort score 1-10,
 "hr_zones": minutes per heart-rate zone as "z1:14 z2:22 z3:11", rounded to whole minutes}
Use null for anything not visible. Never estimate a number that is not on screen.`;

const RANGES = {
  duration_min: [1, 600],
  calories: [1, 5000],
  avg_hr: [30, 240],
  peak_hr: [30, 240],
  effort_1_10: [1, 10],
};

function number(value, [lo, hi]) {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= lo && r <= hi ? r : null;
}

function zones(value) {
  if (typeof value !== 'string') return null;
  const parts = [...value.matchAll(/z\s*([1-5])\s*:\s*(\d{1,3})/gi)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([, mins]) => mins > 0);
  return parts.length > 0 ? parts.map(([z, mins]) => `z${z}:${mins}`).join(' ') : null;
}

export function parseWatchReply(text) {
  const cleaned = String(text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the model returned no JSON');
  const raw = JSON.parse(cleaned.slice(start, end + 1));
  const out = {};
  for (const [k, range] of Object.entries(RANGES)) out[k] = number(raw[k], range);
  out.hr_zones = zones(raw.hr_zones);
  return out;
}

/* Storage paths are shots/{user_id}/{session_id}/file; RLS already scopes the
   bucket, but this function reads with the service key, so it checks again. */
export function ownedPath(path, userId) {
  const p = String(path ?? '');
  return p.startsWith(`${userId}/`) && !p.includes('..') && p.split('/').length >= 3;
}
