/* Reading Apple Health body-weight screenshots: the prompt, and the guard between
   what a vision model says and what the app may log. An entry that is missing a
   readable date, unit or plausible weight is dropped, never guessed. */

export const weightPrompt = (today) => `These are screenshots from the Apple Health app showing body weight readings.
Today is ${today}. Read every dated weight reading you can see and answer with one JSON object and nothing else:
{"entries": [{"date": "YYYY-MM-DD", "weight": number, "unit": "kg" or "lb"}]}
If a date has no year, use the most recent such date that is not after ${today}.
Use plain numbers. One entry per date. Skip anything you cannot read clearly. Never estimate a value that is not on screen.`;

const RANGES = { kg: [25, 300], lb: [55, 660] };
const MAX_ENTRIES = 120;
const SAID_CHARS = 300;
const YEARS_BACK = 3;

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const m = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function unitOf(value) {
  const u = String(value ?? '').trim().toLowerCase();
  if (u === 'kg' || u === 'kgs' || u === 'kilograms') return 'kg';
  if (u === 'lb' || u === 'lbs' || u === 'pounds') return 'lb';
  return null;
}

function dateOf(value, today) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const v = value.trim();
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== v) return null;
  if (v > today) return null;
  const floor = new Date(`${today}T00:00:00Z`);
  floor.setUTCFullYear(floor.getUTCFullYear() - YEARS_BACK);
  return d >= floor ? v : null;
}

export function parseWeightReply(text, today) {
  const cleaned = String(text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the model returned no JSON');
  const raw = JSON.parse(cleaned.slice(start, end + 1));
  const list = Array.isArray(raw?.entries) ? raw.entries.slice(0, MAX_ENTRIES) : [];

  const seen = new Set();
  const entries = [];
  for (const item of list) {
    const date = dateOf(item?.date, today);
    const unit = unitOf(item?.unit);
    const n = toNumber(item?.weight);
    if (!date || !unit || n === null || !Number.isFinite(n) || seen.has(date)) continue;
    const [lo, hi] = RANGES[unit];
    const weight = Math.round(n * 100) / 100;
    if (weight < lo || weight > hi) continue;
    seen.add(date);
    entries.push({ date, weight, unit });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries.length > 0 ? { entries } : { entries, said: cleaned.trim().slice(0, SAID_CHARS) };
}

/* Storage paths are {user_id}/{folder}/file. The bucket is already scoped by RLS,
   but this function reads with the service key, so it checks again. */
export function ownedPath(path, userId) {
  const p = String(path ?? '');
  return p.startsWith(`${userId}/`) && !p.includes('..') && p.split('/').length >= 3;
}
