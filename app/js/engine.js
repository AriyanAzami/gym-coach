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
