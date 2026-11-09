/* Reading Apple Watch / Fitness workout screenshots: the prompt, and the guard
   between what a vision model says and what lands in the finish-session form.
   A value that is missing, unreadable or implausible comes back null, so the
   form keeps whatever the owner already has rather than taking a guess.

   Models do not always answer with bare numbers ("367 kcal", "0:36:49"), and
   the same request can land on a replica that formats differently, so every
   field accepts the forms the screenshot itself uses. */

export const WATCH_PROMPT = `These are screenshots of one Apple Watch / Apple Fitness workout summary.
Read the numbers off them and answer with one JSON object and nothing else:
{"workout_date": the date of the workout as YYYY-MM-DD,
 "duration_min": Workout Time rounded to the nearest minute (0:36:49 is 37),
 "calories": Active Calories in kcal,
 "total_calories": Total Calories in kcal,
 "avg_hr": average heart rate in bpm,
 "peak_hr": the highest heart rate shown (the top of the heart-rate chart, or a Max/Peak value),
 "effort_1_10": the Effort score 1-10,
 "hr_zones": minutes per heart-rate zone as "z1:27 z2:5 z3:3", rounded to the nearest minute}
Use plain numbers. Use null for anything not visible. Never estimate a number that is not on screen.`;

const RANGES = {
  duration_min: [1, 600],
  calories: [1, 5000],
  total_calories: [1, 6000],
  avg_hr: [30, 240],
  peak_hr: [30, 240],
  effort_1_10: [1, 10],
};

const SAID_CHARS = 300;

// "0:36:49" and "36:49" are clock times; anything else is its first number.
function minutesFromClock(s) {
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return m[3] !== undefined
    ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60
    : Number(m[1]) + Number(m[2]) / 60;
}

function toNumber(value, clock) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  if (clock) {
    const mins = minutesFromClock(value);
    if (mins !== null) return mins;
  }
  const m = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function number(value, [lo, hi], clock = false) {
  const n = toNumber(value, clock);
  if (n === null || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= lo && r <= hi ? r : null;
}

function zones(value) {
  let pairs = [];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    pairs = Object.entries(value).map(([k, v]) => [Number(String(k).replace(/\D/g, '')), toNumber(v, true)]);
  } else if (typeof value === 'string') {
    pairs = [...value.matchAll(/(?:z|zone)\s*([1-5])\s*[:\s]\s*(\d{1,3}(?::\d{2}){0,2})/gi)]
      .map((m) => [Number(m[1]), toNumber(m[2], true)]);
  }
  const kept = pairs
    .filter(([z, mins]) => z >= 1 && z <= 5 && Number.isFinite(mins))
    .map(([z, mins]) => [z, Math.round(mins)])
    .filter(([, mins]) => mins > 0);
  return kept.length > 0 ? kept.map(([z, mins]) => `z${z}:${mins}`).join(' ') : null;
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value.trim() ? value.trim() : null;
}

export function parseWatchReply(text) {
  const cleaned = String(text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the model returned no JSON');
  const raw = JSON.parse(cleaned.slice(start, end + 1));
  const out = {};
  for (const [k, range] of Object.entries(RANGES)) out[k] = number(raw[k], range, k === 'duration_min');
  out.hr_zones = zones(raw.hr_zones);
  out.workout_date = date(raw.workout_date);
  if (Object.values(out).every((v) => v === null)) out.said = cleaned.trim().slice(0, SAID_CHARS);
  return out;
}

/* Storage paths are shots/{user_id}/{session_id}/file; RLS already scopes the
   bucket, but this function reads with the service key, so it checks again. */
export function ownedPath(path, userId) {
  const p = String(path ?? '');
  return p.startsWith(`${userId}/`) && !p.includes('..') && p.split('/').length >= 3;
}
