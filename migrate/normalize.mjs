/* Turns the Notion export's free text into rows.

   The guiding rule is the brief's: anything ambiguous goes to review.md to be
   asked about, never guessed at. A wrong guess here becomes a wrong lift_state,
   which becomes a wrong target, which the owner then trains against. Leaving a
   line unparsed costs a question; guessing costs a bad session. */

const MAX_PLAUSIBLE_SETS = 20;
const MAX_PLAUSIBLE_REPS = 100;

const SET_NOTATION = /(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/gi;
const WEIGHT = /(\d+(?:\.\d+)?)\s*(lb|lbs|kg)\b\s*(\/\s*hand|per\s*hand|each)?/i;
const DATE_HINT = /^(?:\d{1,2}\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{0,2}$|^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/i;

const fail = (reason, text) => ({ ok: false, reason, text });

/* Reads "3x8-10 @ 135 lb (Oct 21)" and the variants of it the log used. */
export function parseSets(text) {
  const input = String(text ?? '').trim();
  if (!input) return fail('empty line', input);

  const matches = [...input.matchAll(SET_NOTATION)];
  if (matches.length === 0) return fail('no set notation found', input);
  if (matches.length > 1) {
    return fail('more than one set notation on one line', input);
  }

  const [, setsRaw, firstRaw, secondRaw] = matches[0];
  const sets = Number(setsRaw);
  const repMin = Number(firstRaw);
  const repMax = secondRaw === undefined ? repMin : Number(secondRaw);

  if (!(sets >= 1 && sets <= MAX_PLAUSIBLE_SETS)) {
    return fail(`implausible set count: ${sets}`, input);
  }
  if (!(repMin >= 1 && repMax <= MAX_PLAUSIBLE_REPS) || repMin > repMax) {
    return fail(`implausible rep range: ${repMin}-${repMax}`, input);
  }

  const weightMatch = input.match(WEIGHT);
  const weight = weightMatch ? Number(weightMatch[1]) : null;
  const unit = weightMatch ? (weightMatch[2].toLowerCase().startsWith('lb') ? 'lb' : 'kg') : null;
  const perHand = Boolean(weightMatch && weightMatch[3]);

  // A parenthesised tail is either a date or a remark, never data.
  let note = null;
  let dateHint = null;
  for (const m of input.matchAll(/\(([^)]*)\)/g)) {
    const inner = m[1].trim();
    if (DATE_HINT.test(inner)) dateHint = inner;
    else note = note ? `${note}; ${inner}` : inner;
  }

  return {
    ok: true,
    sets,
    rep_min: repMin,
    rep_max: repMax,
    weight,
    unit,
    per_hand: perHand,
    note,
    date_hint: dateHint,
    source_text: input,
  };
}

/* Reads "Bench press - 3x8-10 @ 135 lb". The separator has to be the first one
   that is followed by set notation, or "Pull-up - 3x8" loses its name. */
export function parseExerciseLine(text) {
  const input = String(text ?? '').trim();
  if (!input) return fail('empty line', input);

  const separators = [...input.matchAll(/\s*[:\-–—]\s+|\s+[-–—]\s*/g)];
  for (const sep of separators) {
    const name = input.slice(0, sep.index).trim();
    const rest = input.slice(sep.index + sep[0].length).trim();
    if (!name || !rest) continue;
    const parsed = parseSets(rest);
    if (parsed.ok) return { ...parsed, ok: true, exercise: name };
  }

  // No separator produced a parseable tail: say so with the whole line, so the
  // review file shows what has to be decided.
  return fail('could not read sets from this line', input);
}

const LEGACY_TYPES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'upper', 'lower', 'full body', 'other'];

/* Session types changed partway through the log: the early ones predate the
   block structure and import without a day index. */
export function classifySession(properties) {
  const raw = String(properties?.Type ?? properties?.type ?? '').trim();
  const type = raw.toLowerCase();

  if (!type) return { kind: 'training', day_index: null, needs_review: true, source_type: raw };
  if (type.includes('rest')) return { kind: 'rest', day_index: null, needs_review: false, source_type: raw };

  const day = type.match(/^day\s*(\d{1,2})$/);
  if (day) {
    return {
      kind: 'training',
      day_index: Number(day[1]) - 1,
      needs_review: false,
      source_type: raw,
    };
  }

  if (LEGACY_TYPES.includes(type)) {
    return { kind: 'training', day_index: null, needs_review: false, source_type: raw };
  }

  return { kind: 'training', day_index: null, needs_review: true, source_type: raw };
}
