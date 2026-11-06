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
