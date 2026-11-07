#!/usr/bin/env node
/* Assembles the two documents the app and the coach read, from the one-off
   Notion export.

   - manual: the Coach Operating Manual, verbatim from the export.
   - rules:  every number and rule in that manual, as the rules document.

   **This script contains no rules and no numbers, deliberately.** The manual is
   a private document; reading rules out of its prose is a hand job that cannot
   be automated, and the result is the owner's coaching policy. Both the source
   and the result are personal data, so neither belongs in a public repository.

   So the hand-derived rules live in `migrate/out/rules.derived.json`, which is
   gitignored, in the shape:

     { "rules": { ...matching coach/schema/rules.schema.json... },
       "review": ["question to ask the owner", ...] }

   This script validates that file against the schema, pairs it with the manual
   and the decision log from the export, and writes `migrate/out/documents.json`
   ready for the loader. It refuses to write anything if the rules do not
   validate: a rules document that is wrong silently changes every future
   target, so a loud failure here is much cheaper than a quiet one later. */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateRules } from '../coach/lib/rules.mjs';

const OUT = 'migrate/out';
const DERIVED = `${OUT}/rules.derived.json`;

const read = (name) => JSON.parse(readFileSync(`${OUT}/raw/${name}.json`, 'utf8'));
const first = (j) => (Array.isArray(j) ? j[0] : j);

/* The decision log is one decision per "## " heading, with the prose beneath it. */
export function splitDecisions(markdown) {
  const decisions = [];
  let current = null;
  for (const line of String(markdown ?? '').split('\n')) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = { title: heading[1].trim(), body: [] };
      decisions.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }
  return decisions.map((d) => ({ title: d.title, body: d.body.join('\n').trim() }));
}

function main() {
  if (!existsSync(DERIVED)) {
    console.error(`${DERIVED} does not exist.`);
    console.error('Read the exported manual and write the rules into that file by hand,');
    console.error('as { "rules": {...}, "review": [...] }. It is gitignored on purpose.');
    return 1;
  }

  const { rules, review = [] } = JSON.parse(readFileSync(DERIVED, 'utf8'));

  const errors = validateRules(rules);
  if (errors.length > 0) {
    console.error(`the derived rules do not validate (${errors.length} problems):`);
    for (const e of errors) console.error(`  ${e}`);
    return 1;
  }

  const manual = String(first(read('manual')).body_markdown ?? '').trim();
  if (!manual) {
    console.error('the manual export has no body');
    return 1;
  }

  const decisions = splitDecisions(first(read('decision_log')).body_markdown);

  writeFileSync(`${OUT}/documents.json`, JSON.stringify({ manual, rules, decisions }, null, 2));

  if (review.length > 0) {
    const section = `\n## rules derived from the manual (${review.length})\n\n`
      + review.map((r) => `- ${r}`).join('\n\n') + '\n';
    const existing = existsSync(`${OUT}/review.md`)
      ? readFileSync(`${OUT}/review.md`, 'utf8').replace(/\n## rules derived from the manual \(\d+\)[\s\S]*$/, '')
      : '';
    writeFileSync(`${OUT}/review.md`, existing + section);
  }

  console.log('rules validate      : yes');
  console.log(`manual characters   : ${manual.length}`);
  console.log(`decisions           : ${decisions.length}`);
  console.log(`priority muscles    : ${rules.priority.length}`);
  console.log(`review questions    : ${review.length}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
