/* Validates a rules document, for the Action and for scripts. The app does the
   same job with the same code: the checker in app/js/rules-check.js has no
   dependencies and no node built-ins, so it runs unchanged in the browser.

   ajv is not in this path. It is the oracle in test/rules-check.test.mjs, which
   runs both over a corpus and fails if the checker ever drifts from what the
   schema really means. One implementation, one behaviour, no divergence between
   what the app accepts and what the Action accepts. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRulesWith } from '../../app/js/rules-check.js';

const here = dirname(fileURLToPath(import.meta.url));

export const rulesSchema = JSON.parse(
  readFileSync(join(here, '..', 'schema', 'rules.schema.json'), 'utf8'),
);

export const validateRules = (doc) => validateRulesWith(doc, rulesSchema);
