/* Pure coaching maths: plain data in, plain data out. No Supabase, no DOM, no
   clock — the caller passes today's date in. Every coaching number comes from
   the rules document; the only constant here is the definition of a pound. */

const KG_PER_LB = 0.45359237;
const UNITS = ['lb', 'kg'];

const round2 = (n) => Math.round(n * 100) / 100;

function assertUnit(unit, what) {
  if (!UNITS.includes(unit)) {
    throw new Error(`${what}: unit must be lb or kg, got ${JSON.stringify(unit)}`);
  }
}

export function toUnit(value, from, to) {
  assertUnit(from, 'toUnit from');
  assertUnit(to, 'toUnit to');
  if (value === null || value === undefined) return null;
  if (from === to) return value;
  return round2(from === 'lb' ? value * KG_PER_LB : value / KG_PER_LB);
}

/* The smallest load step for an exercise: its own increment when it has one,
   otherwise the rules default for its equipment. Never a silent fallback — an
   exercise whose equipment the rules say nothing about is a rules gap the owner
   has to fill. */
export function incrementFor(exercise, rules) {
  if (typeof exercise?.increment === 'number' && exercise.increment > 0
      && UNITS.includes(exercise.unit)) {
    return { value: exercise.increment, unit: exercise.unit };
  }

  const progression = rules?.progression ?? {};
  const table = progression.increments;
  const unit = progression.increment_unit;
  const value = table && typeof table === 'object' ? table[exercise?.equipment] : undefined;

  if (typeof value !== 'number' || !(value > 0) || !UNITS.includes(unit)) {
    throw new Error(
      `no increment for equipment ${JSON.stringify(exercise?.equipment)} `
      + 'in rules.progression.increments',
    );
  }
  return { value, unit };
}

/* Adds one increment to a load, in the load's own unit. A load logged in kg
   never has a pound added to it. */
export function addIncrement(load, inc) {
  assertUnit(load?.unit, 'addIncrement load');
  assertUnit(inc?.unit, 'addIncrement increment');
  if (load.value === null || load.value === undefined) {
    return { value: null, unit: load.unit };
  }
  const step = toUnit(inc.value, inc.unit, load.unit);
  return { value: round2(load.value + step), unit: load.unit };
}

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

function hasHistory(state) {
  if (!state || state.last_date === null || state.last_date === undefined) return false;
  return state.last_weight !== null && state.last_weight !== undefined
    ? true
    : Array.isArray(state.last_reps) && state.last_reps.length > 0;
}

/* Rest for a slot: the slot's own value, else the rules rest for the exercise's
   category. Category is read off the data rather than stored: an exercise that
   trains other muscles alongside its primary is a compound. */
function restForSlot(slot, exercise, rules) {
  if (typeof slot?.rest_s === 'number') return slot.rest_s;
  const table = rules?.session?.rest_s ?? {};
  const compound = (exercise?.secondary_muscles ?? []).length > 0;
  const value = compound ? table.compound : table.isolation;
  return typeof value === 'number' ? value : null;
}

/* The next intervention for a stalled lift, or null. Interventions are applied
   in order, one per stalled exposure past the trigger, and the last one holds. */
function stallLabel(state, rules) {
  const trigger = rules?.stall?.sessions_to_trigger;
  const list = rules?.stall?.interventions ?? [];
  const count = state?.stall_count ?? 0;
  if (typeof trigger !== 'number' || list.length === 0 || count < trigger) return null;
  return list[Math.min(count - trigger, list.length - 1)];
}

/* A first exposure opens at a fraction of the nearest comparable lift: same
   primary muscle, same equipment, same load mode. Comparing a per-hand load
   with a total load would double or halve the opener, so load mode has to match. */
function openerFrom(exercise, similar, rules) {
  const mode = exercise?.load_mode ?? 'total';
  const candidates = (similar ?? [])
    .filter((s) => s.exercise_id !== exercise?.id
      && s.primary_muscle === exercise?.primary_muscle
      && s.equipment === exercise?.equipment
      && (s.load_mode ?? 'total') === mode
      && s.last_weight !== null && s.last_weight !== undefined)
    .sort((a, b) => String(b.last_date ?? '').localeCompare(String(a.last_date ?? '')));

  const nearest = candidates[0];
  if (!nearest) return { weight: null, unit: rules?.units?.weight ?? 'lb' };
  return {
    weight: round2(nearest.last_weight * rules.opener.fraction_of_similar),
    unit: nearest.last_unit,
  };
}

/* One exact target for one slot. Double progression: clear the top of the range
   on every working set, then add one increment and drop to the bottom. */
export function nextTarget({ slot, exercise, state, similar, rules }) {
  const perHand = (exercise?.load_mode ?? 'total') === 'per_hand';
  const common = {
    exerciseId: exercise?.id ?? null,
    name: exercise?.name ?? null,
    sets: slot?.sets ?? null,
    perHand,
    restS: restForSlot(slot, exercise, rules),
    nonNegotiable: slot?.non_negotiable === true,
    cutOrder: slot?.cut_order ?? null,
    notes: slot?.notes ?? null,
    flag: exercise?.flag ?? null,
    slotId: slot?.id ?? null,
  };

  if (!hasHistory(state)) {
    const { weight, unit } = openerFrom(exercise, similar, rules);
    return {
      ...common,
      weight,
      unit,
      reps: slot?.rep_min ?? null,
      label: rules?.opener?.label ?? null,
      lastLogged: null,
    };
  }

  const logged = rules.progression.partials_count === true
    ? (state.last_reps ?? [])
    : (state.last_full_reps ?? []);
  const countable = logged.filter((r) => typeof r === 'number');
  const cleared = countable.length > 0
    && countable.length >= slot.sets
    && countable.every((r) => r >= slot.rep_max);

  let weight;
  let reps;
  if (cleared && state.last_weight !== null && state.last_weight !== undefined) {
    weight = addIncrement(
      { value: state.last_weight, unit: state.last_unit },
      incrementFor(exercise, rules),
    ).value;
    reps = slot.rep_min;
  } else if (cleared) {
    // Nothing to add the increment to, so hold the top of the range rather than
    // dropping back to rep_min, which would be a step backwards.
    weight = null;
    reps = slot.rep_max;
  } else {
    weight = state.last_weight ?? null;
    reps = countable.length > 0
      ? clamp(Math.min(...countable) + 1, slot.rep_min, slot.rep_max)
      : slot.rep_min;
  }

  return {
    ...common,
    weight,
    unit: state.last_unit ?? rules?.units?.weight ?? 'lb',
    reps,
    label: stallLabel(state, rules),
    lastLogged: {
      weight: state.last_weight ?? null,
      unit: state.last_unit ?? null,
      reps: state.last_reps ?? null,
      date: state.last_date ?? null,
      sets: state.last_sets ?? null,
    },
  };
}

/* The whole card for one day: one exact target per slot, flags first. Takes the
   raw rows the app already has in memory, so the screen does no maths. */
export function planForDay({ day, slots, exercises, states, rules }) {
  if (!day) {
    return { dayName: null, warmupNote: null, flags: [], exercises: [], reason: 'no day to plan' };
  }

  const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
  const stateById = new Map((states ?? []).map((s) => [s.exercise_id, s]));
  const mine = (slots ?? [])
    .filter((s) => s.day_id === day.id)
    .sort((a, b) => a.position - b.position);

  const entries = [];
  const unknown = [];
  for (const slot of mine) {
    const exercise = byId.get(slot.exercise_id);
    if (!exercise) {
      unknown.push(slot.exercise_id);
      continue;
    }
    entries.push(nextTarget({
      slot,
      exercise,
      state: stateById.get(exercise.id) ?? null,
      similar: states ?? [],
      rules,
    }));
  }

  const flags = entries
    .filter((e) => e.flag)
    .map((e) => ({ exercise: e.name, flag: e.flag }));

  let reason = null;
  if (mine.length === 0) reason = 'this day has no exercises yet';
  else if (unknown.length > 0) reason = `${unknown.length} slot(s) point at an unknown exercise`;

  return {
    dayId: day.id,
    dayIndex: day.day_index ?? null,
    dayName: day.name ?? null,
    warmupNote: day.warmup_note ?? null,
    flags,
    exercises: entries,
    reason,
  };
}

/* Dates. sessions.date is a Postgres date and the phone has a timezone, so
   every conversion goes through the local calendar fields. toISOString() would
   shift a day in either direction depending on the offset. */
export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYmd(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/* Monday of the ISO week, matching date_trunc('week', ...) in the views. */
export function isoWeekStart(s) {
  const d = parseYmd(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

/* The next day of a rotation. A block with no days has no next day at all,
   which is why this returns null rather than dividing by zero. */
export function nextDayIndex({ lastCompleteIndex, dayCount }) {
  if (!Number.isInteger(dayCount) || dayCount <= 0) return null;
  if (lastCompleteIndex === null || lastCompleteIndex === undefined) return 0;
  return (lastCompleteIndex + 1) % dayCount;
}

/* Whether a logged session counts as having completed its day, which is what
   advances the rotation. The day's first slot is required however much else was
   logged: skipping the opener means the day did not really happen. */
export function sessionComplete({ slotCount, loggedSlotPositions, rules }) {
  if (!Number.isInteger(slotCount) || slotCount <= 0) return false;
  const logged = new Set(loggedSlotPositions ?? []);
  if (!logged.has(0)) return false;
  const fraction = rules?.rotation?.complete_fraction ?? 0.6;
  return logged.size / slotCount >= fraction;
}

/* Logged weekly sets against the rules minimum, in priority order. Muscles
   trained but not listed in priority come last, against the default minimum. */
export function volumeVsTarget({ weeklyVolume, rules }) {
  const min = rules?.volume?.min_weekly_sets;
  const priority = rules?.priority;
  if (!min || !Array.isArray(priority)) return [];

  const logged = new Map();
  for (const row of weeklyVolume ?? []) {
    logged.set(row.muscle, Number(row.total_sets) || 0);
  }

  const extra = [...logged.keys()].filter((m) => !priority.includes(m)).sort();
  return [...priority, ...extra].map((muscle) => {
    const sets = logged.get(muscle) ?? 0;
    const target = min.by_muscle?.[muscle] ?? min.default;
    return { muscle, sets, target, shortBy: Math.max(0, Math.round((target - sets) * 100) / 100) };
  });
}

/* What a plan's per-session sets add up to over a week at the rate actually
   trained, which is how volume is judged — not at the rate intended. */
export function projectWeeklySets(setsPerSession, perWeekRate) {
  if (!(perWeekRate > 0)) return null;
  return Math.round(setsPerSession * perWeekRate * 100) / 100;
}

/* What a block would produce per muscle per week, judged at the rate actually
   trained rather than the rate intended. The rotation cycles through the block's
   days, so a cycle's sets spread over however many sessions a week happen.

   With no observed rate yet — a first block — one full cycle a week is assumed,
   which is the most optimistic reading and so never hides a shortfall.

   Shared with coach/validate.mjs: the volume gate and the draft's volume table
   must agree, so they are the same function. */
export function plannedWeeklyVolume({ days, slots, exercises, rules, perWeekRate }) {
  const min = rules?.volume?.min_weekly_sets;
  const priority = rules?.priority;
  if (!min || !Array.isArray(priority)) return [];

  const dayCount = (days ?? []).length;
  if (dayCount === 0) return [];

  const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
  const factor = rules.volume.indirect_factor ?? 0;
  const perCycle = new Map();
  const add = (muscle, n) => {
    if (!muscle) return;
    perCycle.set(muscle, (perCycle.get(muscle) ?? 0) + n);
  };

  for (const slot of slots ?? []) {
    // A draft plan carries new exercises inline, before they exist as rows.
    const exercise = byId.get(slot.exercise_id) ?? slot.exercise ?? null;
    if (!exercise) continue;
    const sets = Number(slot.sets) || 0;
    add(exercise.primary_muscle, sets);
    for (const secondary of exercise.secondary_muscles ?? []) {
      add(secondary, sets * factor);
    }
  }

  const rate = perWeekRate > 0 ? perWeekRate : dayCount;
  const scale = rate / dayCount;
  const extra = [...perCycle.keys()].filter((m) => !priority.includes(m)).sort();

  return [...priority, ...extra].map((muscle) => {
    const sets = Math.round((perCycle.get(muscle) ?? 0) * scale * 100) / 100;
    const target = min.by_muscle?.[muscle] ?? min.default;
    return { muscle, sets, target, shortBy: Math.max(0, Math.round((target - sets) * 100) / 100) };
  });
}

/* Parses Apple Fitness / Apple Watch workout text (from iOS Live Text OCR, an
   iOS Shortcut, or a quick paste) into the finish-session fields. Handles one
   or two screenshots concatenated in any order. */
export function parseAppleWatchText(raw) {
  const out = {
    duration_min: null,
    calories: null,
    total_calories: null,
    avg_hr: null,
    peak_hr: null,
    effort_1_10: null,
    hr_zones: null,
  };
  const text = String(raw ?? '').replace(/\r/g, '');
  if (!text.trim()) return out;

  // 1. Duration: "Workout Time 0:36:49" (H:MM:SS or MM:SS), or "37 min".
  const wtMatch = text.match(/Workout\s*Time[\s:]*(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (wtMatch) {
    if (wtMatch[3] !== undefined) {
      const h = Number(wtMatch[1]);
      const m = Number(wtMatch[2]);
      const s = Number(wtMatch[3]);
      out.duration_min = Math.round(h * 60 + m + s / 60);
    } else {
      const m = Number(wtMatch[1]);
      const s = Number(wtMatch[2]);
      out.duration_min = Math.round(m + s / 60);
    }
  } else {
    const hmsMatch = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
    if (hmsMatch) {
      out.duration_min = Math.round(
        Number(hmsMatch[1]) * 60 + Number(hmsMatch[2]) + Number(hmsMatch[3]) / 60,
      );
    } else {
      const minMatch = text.match(/(?:duration|workout\s*time)?[\s:]*(\d{1,3})\s*(?:min|mins|minutes)\b/i);
      if (minMatch) out.duration_min = Number(minMatch[1]);
    }
  }

  // 2. Calories: prefer Active Calories ("Active Calories 367CAL"), else top "367CAL" or "Total Calories 437CAL".
  const activeCal = text.match(/Active\s*(?:Calories|Energy)[\s:]*(\d{1,4})\s*(?:CAL|KCAL)?/i)
    ?? text.match(/(\d{1,4})\s*(?:CAL|KCAL)\s*\n\s*Active\s*(?:Calories|Energy)/i);
  if (activeCal) {
    out.calories = Number(activeCal[1]);
  } else {
    const anyCal = text.match(/\b(\d{2,4})\s*(?:CAL|KCAL)\b/i);
    if (anyCal) out.calories = Number(anyCal[1]);
  }

  const totalCal = text.match(/Total\s*(?:Calories|Energy)[\s:]*(\d{1,4})\s*(?:CAL|KCAL)?/i);
  if (totalCal) out.total_calories = Number(totalCal[1]);

  // 3. Average HR: "Avg. Heart Rate 130BPM" or "130 BPM AVG".
  const avgHr = text.match(/Avg\.?\s*Heart\s*Rate[\s:]*(\d{2,3})\s*(?:BPM)?/i)
    ?? text.match(/\b(\d{2,3})\s*BPM\s*AVG\b/i)
    ?? text.match(/\bavg(?:erage)?\s*hr[\s:]*(\d{2,3})\b/i);
  if (avgHr) out.avg_hr = Number(avgHr[1]);

  // 4. Effort 1-10: "Effort ± 9 All Out" or "Effort: 8".
  const effortMatch = text.match(/Effort[\s±+\-:]*(\b10\b|[1-9])\b/i)
    ?? text.match(/\b(\b10\b|[1-9])\s*(?:Easy|Moderate|Hard|All\s*Out)\b/i);
  if (effortMatch) out.effort_1_10 = Number(effortMatch[1]);

  // 5. HR Zones: "Zone 1 27:23 <140BPM", or compact "z1:27 z2:5".
  const zoneMap = new Map();
  for (const m of text.matchAll(/Zone\s*([1-5])[^\d\n]*(\d{1,2}):(\d{2})/gi)) {
    const z = Number(m[1]);
    const mins = Number(m[2]) + Number(m[3]) / 60;
    const rounded = Math.round(mins);
    const val = rounded > 0 ? rounded : (Number(m[3]) >= 30 ? 1 : 0);
    if (val > 0) zoneMap.set(z, val);
  }
  if (zoneMap.size === 0) {
    for (const m of text.matchAll(/\bz([1-5])\s*:\s*(\d{1,3})\b/gi)) {
      const z = Number(m[1]);
      const val = Number(m[2]);
      if (val > 0) zoneMap.set(z, val);
    }
  }
  if (zoneMap.size > 0) {
    out.hr_zones = [...zoneMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([z, m]) => `z${z}:${m}`)
      .join(' ');
  }

  // 6. Peak HR: explicit "Peak HR 174" or the Apple Fitness chart y-axis peak
  //    printed right under the "Heart Rate" heading (before Post-Workout Heart Rate).
  const explicitPeak = text.match(/(?:Peak|Max)\s*(?:HR|Heart\s*Rate)[\s:]*(\d{2,3})\b/i);
  if (explicitPeak) {
    out.peak_hr = Number(explicitPeak[1]);
  } else {
    const hrSection = text.split(/Post[-\s]*Workout\s*Heart\s*Rate/i)[0] ?? text;
    const afterHeading = hrSection.match(/Heart\s*Rate\s*\n\s*(\d{2,3})\b/i);
    if (afterHeading) {
      const n = Number(afterHeading[1]);
      if (n >= 60 && n <= 230 && n !== out.avg_hr) out.peak_hr = n;
    }
  }

  return out;
}
