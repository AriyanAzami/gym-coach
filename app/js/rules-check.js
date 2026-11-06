/* A dependency-free JSON Schema checker, covering exactly the keywords
   coach/schema/rules.schema.json uses.

   It exists because the rules editor validates in the browser, where ajv and
   node:fs are not available, and because one implementation on both sides
   cannot drift. ajv is still the authority on what the schema means:
   test/rules-check.test.mjs runs both over a corpus of valid and broken
   documents and fails if they ever disagree.

   Adding a keyword to the schema means adding it here, or the corpus test will
   catch the omission the first time a document exercises it. */

const typeOf = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

const matchesType = (value, expected) => {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function checkAgainstSchema(doc, schema) {
  const errors = [];
  walk(doc, schema, '', errors);
  return errors;
}

function walk(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') return;
  const at = path || '/';
  const fail = (message) => errors.push(`${at} ${message}`);

  if ('const' in schema && !same(value, schema.const)) {
    fail(`must be ${JSON.stringify(schema.const)}`);
    return;
  }

  if (schema.enum && !schema.enum.some((option) => same(value, option))) {
    fail(`must be one of ${schema.enum.map((o) => JSON.stringify(o)).join(', ')}`);
    return;
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((t) => matchesType(value, t))) {
      fail(`must be ${allowed.join(' or ')}, got ${typeOf(value)}`);
      return;
    }
  }

  const kind = typeOf(value);

  if (kind === 'number' || kind === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) fail(`must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`must be at most ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      fail(`must be greater than ${schema.exclusiveMinimum}`);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      fail(`must be less than ${schema.exclusiveMaximum}`);
    }
  }

  if (kind === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      fail(`must be at least ${schema.minLength} characters`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      fail(`must be at most ${schema.maxLength} characters`);
    }
  }

  if (kind === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      fail(`must have at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      fail(`must have at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems) {
      const seen = new Set(value.map((v) => JSON.stringify(v)));
      if (seen.size !== value.length) fail('must not contain duplicates');
    }
    if (schema.items) {
      value.forEach((item, i) => walk(item, schema.items, `${path}/${i}`, errors));
    }
  }

  if (kind === 'object') {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      fail(`must have at least ${schema.minProperties} entries`);
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      fail(`must have at most ${schema.maxProperties} entries`);
    }

    for (const required of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) {
        fail(`is missing ${required}`);
      }
    }

    const known = schema.properties ?? {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(known, key)) {
        walk(value[key], known[key], `${path}/${key}`, errors);
      } else if (schema.additionalProperties === false) {
        fail(`has an unknown key: ${key}`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        walk(value[key], schema.additionalProperties, `${path}/${key}`, errors);
      }
    }
  }
}

/* The two rules the schema cannot express, kept beside the checker so the app
   and the Action apply exactly the same set. */
export function checkCrossFieldRules(doc) {
  const errors = [];
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return errors;

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

export function validateRulesWith(doc, schema) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['/ must be a rules object'];
  }
  return [...checkAgainstSchema(doc, schema), ...checkCrossFieldRules(doc)];
}
