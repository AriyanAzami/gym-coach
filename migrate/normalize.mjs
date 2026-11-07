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

/* ---- Gym Log page bodies ----

   Most pages hold a markdown table; a few hold prose; a few are empty. Each
   form is handled explicitly and anything that fits none of them is reported
   for review rather than guessed at. */

const DASHES = /^[—–-]$/;

const cellNumber = (cell) => {
  const text = String(cell ?? '').trim();
  if (!text || DASHES.test(text)) return null;
  const m = text.match(/^(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

function parseLoadCell(cell) {
  const text = String(cell ?? '').trim();
  if (!text || DASHES.test(text)) return { weight: null, unit: null, per_hand: false, weight_note: null };
  const m = text.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|kg)\b\s*(\/\s*hand|per\s*hand|each)?/i);
  if (!m) return { weight: null, unit: null, per_hand: false, weight_note: text };
  const after = text.slice(m.index + m[0].length).replace(/^[,;\s]+/, '').trim();
  return {
    weight: Number(m[1]),
    unit: m[2].toLowerCase().startsWith('lb') ? 'lb' : 'kg',
    per_hand: Boolean(m[3]),
    weight_note: after || null,
  };
}

function parseRepsCell(cell) {
  const text = String(cell ?? '').trim();
  if (!text || DASHES.test(text)) return { reps: null, rep_min: null, rep_max: null };
  const range = text.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})/);
  if (range) {
    return { reps: Number(range[2]), rep_min: Number(range[1]), rep_max: Number(range[2]) };
  }
  const single = cellNumber(text);
  return { reps: single, rep_min: single, rep_max: single };
}

function parseSetsCell(cell) {
  const text = String(cell ?? '').trim();
  if (!text || DASHES.test(text)) return { sets: null, per_side: false, ok: true };
  const m = text.match(/^(\d{1,2})\s*(\/\s*(?:side|each|hand))?/i);
  if (!m) return { sets: null, per_side: false, ok: false };
  return { sets: Number(m[1]), per_side: Boolean(m[2]), ok: true };
}

// The export escapes a literal tilde as \~ inside note cells.
const unescapeTilde = (s) => String(s ?? '').replace(/\\~/g, '~');

function parseTableRow(line, review) {
  // Split on pipes, dropping the empty cells the leading and trailing pipe make.
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 5) {
    review.push(`Table row has ${cells.length} cells, expected 5: ${line.trim()}`);
    return null;
  }

  const [exercise, setsCell, repsCell, weightCell, ...rest] = cells;
  const note = unescapeTilde(rest.join(' | ')).trim() || null;

  const sets = parseSetsCell(setsCell);
  if (!sets.ok) {
    review.push(`Could not read the set count "${setsCell}" for ${exercise}: ${line.trim()}`);
    return null;
  }

  const reps = parseRepsCell(repsCell);
  const load = parseLoadCell(weightCell);
  const skipped = sets.sets === null && reps.reps === null && load.weight === null;

  return {
    exercise,
    sets: sets.sets,
    per_side: sets.per_side,
    ...reps,
    ...load,
    note,
    skipped,
    source_text: line.trim(),
  };
}

/* A prose line names one exercise before a colon and describes it after.
   Without a number anywhere after the colon there is nothing to import, so the
   line goes to review instead of becoming a row with null everything. */
function parseProseLine(line, review) {
  const text = line.replace(/<\/?b>/g, '').trim();
  if (!text) return null;

  const split = text.match(/^([^:]{2,60}):\s*(.+)$/);
  if (!split) {
    review.push(text);
    return null;
  }

  const [, exercise, rest] = split;
  if (!/\d/.test(rest)) {
    review.push(text);
    return null;
  }

  const sets = parseSets(rest);
  const load = parseLoadCell(rest);

  if (!sets.ok && load.weight === null) {
    review.push(text);
    return null;
  }

  return {
    exercise: exercise.trim(),
    sets: sets.ok ? sets.sets : null,
    per_side: false,
    reps: sets.ok ? sets.rep_max : null,
    rep_min: sets.ok ? sets.rep_min : null,
    rep_max: sets.ok ? sets.rep_max : null,
    weight: sets.ok && sets.weight !== null ? sets.weight : load.weight,
    unit: sets.ok && sets.unit ? sets.unit : load.unit,
    per_hand: sets.ok ? sets.per_hand || load.per_hand : load.per_hand,
    weight_note: null,
    note: text,
    skipped: false,
    source_text: text,
  };
}

export function parseGymLogBody(markdown) {
  const body = String(markdown ?? '').trim();
  if (!body) return { form: 'empty', rows: [], review: [] };

  const lines = body.split('\n');
  const review = [];
  const rows = [];

  const tableLines = lines.filter((l) => l.trim().startsWith('|'));
  const isSeparator = (l) => /^\|[\s|:-]+\|$/.test(l.trim());
  const isHeader = (l) => /^\|\s*exercise\s*\|/i.test(l.trim());

  if (tableLines.length > 1) {
    for (const line of tableLines) {
      if (isSeparator(line) || isHeader(line)) continue;
      const row = parseTableRow(line, review);
      if (row) rows.push(row);
    }
    return { form: 'table', rows, review };
  }

  // Prose: one exercise per line. Headings, Apple Watch lines and the coach's
  // closing paragraphs are not exercises.
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    if (text.startsWith('#')) continue;
    if (/^<b>Apple Watch data/i.test(text)) continue;
    if (/^(coach notes?|micro-goal|two open items)/i.test(text)) continue;
    const row = parseProseLine(text, review);
    if (row) rows.push(row);
  }

  return { form: 'prose', rows, review };
}
