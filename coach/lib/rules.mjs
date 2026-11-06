/* Validates a rules document. Used by the app before it stores a version, and
   by validate.mjs and save.mjs in the Action. The schema covers shape and
   bounds; the checks below cover the two things JSON Schema cannot express. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';

const here = dirname(fileURLToPath(import.meta.url));

export const rulesSchema = JSON.parse(
  readFileSync(join(here, '..', 'schema', 'rules.schema.json'), 'utf8'),
);

const validate = new Ajv({ allErrors: true, strict: true }).compile(rulesSchema);

export function validateRules(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['/ must be a rules object'];
  }

  const errors = [];
  if (!validate(doc)) {
    for (const e of validate.errors) {
      const extra = e.params?.additionalProperty ? `: ${e.params.additionalProperty}` : '';
      errors.push(`${e.instancePath || '/'} ${e.message}${extra}`);
    }
  }

  const band = doc.nutrition?.gain_band_kg_per_week;
  if (Array.isArray(band) && band.length === 2
      && typeof band[0] === 'number' && typeof band[1] === 'number'
      && band[0] > band[1]) {
    errors.push('/nutrition/gain_band_kg_per_week low bound must not exceed the high bound');
  }

  const priority = doc.priority;
  const byMuscle = doc.volume?.min_weekly_sets?.by_muscle;
  if (Array.isArray(priority) && byMuscle !== null && typeof byMuscle === 'object'
      && !Array.isArray(byMuscle)) {
    for (const muscle of Object.keys(byMuscle)) {
      if (!priority.includes(muscle)) {
        errors.push(`/volume/min_weekly_sets/by_muscle/${muscle} is not listed in /priority`);
      }
    }
  }

  return errors;
}
