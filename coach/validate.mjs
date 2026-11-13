#!/usr/bin/env node
/* Gates a block the coach wrote, against the owner's own rules.

   Every threshold here is read from the rules document. The only hardcoded rule
   is structural: a plan may not contain a weight, because loads are computed
   from what was logged and a prescribed load would silently override that.

   Run by the model inside the Action until it passes, and again by save.mjs
   before anything is written — the model's word that it passed is not evidence.

   Printing: failures only, numbered. Never the plan, never the context. */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { checkAgainstSchema } from '../app/js/rules-check.js';
import { plannedWeeklyVolume } from '../app/js/engine.js';
import { validateRules } from './lib/rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const blockSchema = JSON.parse(
  readFileSync(join(here, 'schema', 'block.schema.json'), 'utf8'),
);

const round = (n) => Math.round(n * 100) / 100;
const norm = (s) => String(s ?? '').trim().toLowerCase();

/* A weight can only reach the database through a key, so the structural check
   is for any key that looks like a load, at any depth. */
function findWeights(value, path = '') {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => found.push(...findWeights(item, `${path}/${i}`)));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (/weight|load_kg|load_lb|\bkg\b|\blbs?\b/i.test(key)) {
        found.push(`${path}/${key}`);
      }
      found.push(...findWeights(child, `${path}/${key}`));
    }
  }
  return found;
}

export function validateBlock(plan, context) {
  const failures = [];
  const add = (message) => failures.push(message);

  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) {
    return ['The plan must be a JSON object.'];
  }

  const rules = context?.rules;
  if (!rules) return ['No rules document in the context: nothing can be checked against.'];
  const ruleErrors = validateRules(rules);
  if (ruleErrors.length > 0) {
    return [`The rules document in the context is itself invalid: ${ruleErrors[0]}`];
  }

  // 1. Shape.
  for (const error of checkAgainstSchema(plan, blockSchema)) {
    add(`Schema: ${error}`);
  }

  // 2. No load anywhere, at any depth.
  for (const path of findWeights(plan)) {
    add(`A plan must never prescribe a load, but ${path} does. Loads come from the last logged set.`);
  }

  if (!Array.isArray(plan.days) || plan.days.length === 0) return failures;

  const seenDayIndex = new Set();
  for (const day of plan.days) {
    if (seenDayIndex.has(day?.day_index)) add(`Two days share day_index ${day.day_index}.`);
    seenDayIndex.add(day?.day_index);
  }

  const library = new Map((context.exercises ?? []).map((e) => [norm(e.name), e]));
  const maxExercises = rules.session.max_exercises;
  const restBounds = rules.session.rest_s;
  const banned = new Set(rules.constraints.banned_movement_tags ?? []);
  const unavailable = new Set(rules.constraints.equipment_unavailable ?? []);
  const placement = rules.warmup.core_mobility_placement;

  for (const day of plan.days) {
    const slots = Array.isArray(day?.slots) ? day.slots : [];
    const where = `Day ${day?.day_index} (${day?.name})`;

    // 3. Session size.
    if (slots.length > maxExercises) {
      add(`${where} has ${slots.length} exercises, above rules.session.max_exercises of ${maxExercises}.`);
    }

    const seenPosition = new Set();
    for (const s of slots) {
      if (seenPosition.has(s?.position)) add(`${where} has two slots at position ${s.position}.`);
      seenPosition.add(s?.position);

      if (Number.isInteger(s?.rep_min) && Number.isInteger(s?.rep_max) && s.rep_min > s.rep_max) {
        add(`${where} slot ${s.position} (${s.exercise}) has rep_min ${s.rep_min} above rep_max ${s.rep_max}.`);
      }

      const known = library.get(norm(s?.exercise));

      // 4. Unknown exercises must be declared, known ones must not be redeclared.
      if (!known && !s?.new) {
        add(`${where} slot ${s?.position} uses "${s?.exercise}", which is not in the library. `
          + 'Either use an existing exercise, or add a "new" block with its muscle, equipment and tags.');
      }
      if (known && s?.new) {
        add(`${where} slot ${s.position} marks "${s.exercise}" as new, but it is already in the library.`);
      }

      // 5. Banned movements.
      const tags = known?.movement_tags ?? s?.new?.movement_tags ?? [];
      for (const tag of tags) {
        if (banned.has(tag)) {
          add(`${where} slot ${s.position} uses "${s.exercise}", which is tagged ${tag}, `
            + 'and that tag is banned by rules.constraints.banned_movement_tags.');
        }
      }

      const equipment = known?.equipment ?? s?.new?.equipment;
      if (equipment && unavailable.has(equipment)) {
        add(`${where} slot ${s.position} uses "${s.exercise}", which needs ${equipment}, `
          + 'and that equipment is listed in rules.constraints.equipment_unavailable.');
      }

      // 6. Rest within the rules.
      if (Number.isInteger(s?.rest_s)) {
        const lo = Math.min(restBounds.isolation, restBounds.compound);
        const hi = Math.max(restBounds.isolation, restBounds.compound);
        if (s.rest_s < lo) {
          add(`${where} slot ${s.position} rests ${s.rest_s}s, below the shortest rest in the rules (${lo}s).`);
        }
        if (s.rest_s > hi * 2) {
          add(`${where} slot ${s.position} rests ${s.rest_s}s, more than double the longest rest in the rules (${hi}s).`);
        }
      }
    }

    // 7. Core and mobility belong where the rules say.
    if (placement === 'warmup' && slots.length > 0) {
      const last = slots.reduce((a, b) => ((b?.position ?? 0) > (a?.position ?? 0) ? b : a), slots[0]);
      const exercise = library.get(norm(last?.exercise));
      const muscle = exercise?.primary_muscle ?? last?.new?.primary_muscle;
      const tags = exercise?.movement_tags ?? last?.new?.movement_tags ?? [];
      if (norm(muscle) === 'core' || tags.includes('mobility')) {
        add(`${where} ends with "${last.exercise}", which is core or mobility work. `
          + 'rules.warmup.core_mobility_placement says it belongs in the warm-up.');
      }
    }
  }

  // 8 and 9. Volume at the observed rate, and priority order.
  const perWeekRate = context.training_rate?.per_week_4w ?? null;
  const days = plan.days.map((d) => ({ id: `d${d.day_index}`, day_index: d.day_index }));
  const slots = plan.days.flatMap((d) => (d.slots ?? []).map((s) => {
    const known = library.get(norm(s.exercise));
    return {
      day_id: `d${d.day_index}`,
      exercise_id: known?.id ?? null,
      sets: s.sets,
      exercise: known ?? (s.new
        ? { primary_muscle: s.new.primary_muscle, secondary_muscles: s.new.secondary_muscles ?? [] }
        : null),
    };
  }));

  const volume = plannedWeeklyVolume({
    days, slots, exercises: context.exercises ?? [], rules, perWeekRate,
  });

  const rateText = perWeekRate > 0
    ? `${perWeekRate} sessions a week (your trailing 4-week rate)`
    : `${days.length} sessions a week (no logged rate yet, so one full cycle is assumed)`;

  const deload = plan.deload === true;
  const factor = rules.deload.set_factor;
  for (const row of volume) {
    if (!rules.priority.includes(row.muscle)) continue;
    const target = deload ? round(row.target * factor) : row.target;
    const shortBy = deload ? Math.max(0, round(target - row.sets)) : row.shortBy;
    if (shortBy > 0) {
      const minimum = deload
        ? `${target} (the minimum of ${row.target} scaled by the deload set_factor of ${factor})`
        : `${target}`;
      add(`Volume: ${row.muscle} gets ${row.sets} sets a week at ${rateText}, `
        + `below the minimum of ${minimum}. Short by ${shortBy}.`);
    }
  }

  const tolerance = rules.volume.priority_tolerance;
  const setsFor = new Map(volume.map((r) => [r.muscle, r.sets]));
  for (let i = 0; i < rules.priority.length; i += 1) {
    const higher = rules.priority[i];
    const higherSets = setsFor.get(higher) ?? 0;
    for (let j = i + 1; j < rules.priority.length; j += 1) {
      const lower = rules.priority[j];
      const lowerSets = setsFor.get(lower) ?? 0;
      const allowed = higherSets * (1 + tolerance);
      if (lowerSets > allowed) {
        add(`Priority: ${lower} gets ${lowerSets} sets a week but ${higher} is higher priority `
          + `and gets only ${higherSets}. The tolerance allows up to ${round(allowed)}.`);
      }
    }
  }

  return failures;
}

/* CLI. Prints a numbered list of failures and exits 1, or "ok" and exits 0.
   It never prints the plan or the context: this runs in a public repository's
   Action log. */
function main(argv) {
  const arg = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };

  if (argv.includes('--rules')) {
    const path = arg('--rules');
    if (!path) {
      console.error('--rules needs a file path');
      return 1;
    }
    const errors = validateRules(JSON.parse(readFileSync(path, 'utf8')));
    if (errors.length === 0) {
      console.log('ok');
      return 0;
    }
    errors.forEach((e, i) => console.error(`${i + 1}. ${e}`));
    return 1;
  }

  const planPath = arg('--plan', 'work/output.json');
  const contextPath = arg('--context', 'work/context.json');

  let failures;
  try {
    failures = validateBlock(
      JSON.parse(readFileSync(planPath, 'utf8')),
      JSON.parse(readFileSync(contextPath, 'utf8')),
    );
  } catch (err) {
    console.error(`Could not read the plan or the context: ${err.message}`);
    return 1;
  }

  if (failures.length === 0) {
    console.log('ok');
    return 0;
  }
  console.error(`${failures.length} problem${failures.length === 1 ? '' : 's'} to fix:`);
  failures.forEach((f, i) => console.error(`${i + 1}. ${f}`));
  return 1;
}

// pathToFileURL, not string building: on Windows a path becomes file:///D:/...
// with three slashes, and a hand-built file://D:/... never matches, which would
// leave this script exiting 0 without checking anything.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
