#!/usr/bin/env node
/* Verifies the Notion import against the live database and writes
   migrate/out/report.md.

   Checks three things (Spec §9.5):
   1. Row counts against migrate/out/sources.local.json.
   2. For every Lift Tracker row, Notion's Last Weight, Last Reps, and Last Date
      against the database's lift_state view, listing every mismatch.
   3. Today's computed plan for the next rotation day printed beside Notion's
      old "Next Target" text. */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { serviceClient, rows } from '../coach/lib/db.mjs';
import { planForDay, nextDayIndex } from '../app/js/engine.js';
import { parseSets } from './normalize.mjs';

const OUT = 'migrate/out';
const norm = (s) => String(s ?? '').trim().toLowerCase();

function parseNotionWeight(raw) {
  const m = String(raw ?? '').match(/(\d+(?:\.\d+)?)\s*(lb|lbs|kg)\b/i);
  if (!m) return { weight: null, unit: null };
  return {
    weight: Number(m[1]),
    unit: m[2].toLowerCase().startsWith('lb') ? 'lb' : 'kg',
  };
}

function parseNotionReps(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const nxm = text.match(/^d+s*xs*(d+)(?:s*-s*(d+))?/i);
  if (nxm) return Number(nxm[2] ?? nxm[1]);
  const parsed = parseSets(text);
  if (parsed.ok) return parsed.rep_max;
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function fmtTarget(entry) {
  const load = entry.weight !== null && entry.weight !== undefined
    ? `${entry.weight} ${entry.unit}${entry.perHand ? '/hand' : ''}`
    : 'bodyweight';
  return `${entry.sets} × ${entry.reps} @ ${load}`;
}

/* Pure report builder so the three checks can be unit-tested with fabricated
   inputs without touching a live database. */
export function buildVerifyReport({
  sources = [],
  tracker = [],
  dbCounts = {},
  exercises = [],
  liftState = [],
  days = [],
  slots = [],
  rotation = null,
  rules = null,
}) {
  const lines = ['# Migration verification report', ''];

  // ---- 1. Row counts ----
  lines.push('## 1. Row counts', '');
  lines.push('| Source | Expected (Notion) | In database | Status |');
  lines.push('| :-- | --: | --: | :-- |');

  const sourceRows = (name) => {
    const n = sources.find((x) => x.name === name)?.actual_rows;
    return typeof n === 'number' ? n : undefined;
  };
  const countPairs = [
    ['Gym log (`sessions`)', sourceRows('Gym Log'), dbCounts.sessions],
    ['Lift tracker (rows read)', sourceRows('Lift Tracker'), dbCounts.Active_or_Tracked_Exercises],
    ['Body metrics (`body_metrics`)', sourceRows('Body Metrics'), dbCounts.body_metrics],
    ['Active block (`blocks`)', Array.isArray(sources) && sources.length ? 1 : undefined, dbCounts.blocks],
  ];

  let countDiffs = 0;
  for (const [label, expected, actual] of countPairs) {
    if (expected === undefined && actual === undefined) continue;
    const match = expected === undefined || expected === actual;
    if (!match) countDiffs += 1;
    lines.push(`| ${label} | ${expected ?? '—'} | ${actual ?? '—'} | ${match ? 'OK' : 'MISMATCH'} |`);
  }
  lines.push('');

  // ---- 2. Lift Tracker vs lift_state ----
  lines.push('## 2. Lift Tracker vs `lift_state`', '');
  const stateByName = new Map(liftState.map((s) => [norm(s.name), s]));
  const mismatches = [];
  const nextTargetByName = new Map();

  lines.push('| Exercise | Notion (weight / reps / date) | `lift_state` (weight / reps / date) | Status |');
  lines.push('| :-- | :-- | :-- | :-- |');

  for (const row of tracker) {
    const p = row.properties ?? {};
    const name = String(p.Exercise ?? '').trim();
    if (!name) continue;
    const status = String(p.Status ?? '');
    if (p['Next Target']) {
      nextTargetByName.set(norm(name), String(p['Next Target']).trim());
    }
    if (status === 'Removed') continue;

    const nWeightRaw = p['Last Weight'] ? String(p['Last Weight']).trim() : '—';
    const nRepsRaw = p['Last Reps'] ? String(p['Last Reps']).trim() : '—';
    const nDate = p['date:Last Date:start'] ?? null;

    const st = stateByName.get(norm(name));
    const dbWeight = st?.last_weight ?? null;
    const dbUnit = st?.last_unit ?? null;
    const dbRepsArr = st?.last_reps ?? [];
    const dbMaxReps = dbRepsArr.length > 0 ? Math.max(...dbRepsArr) : null;
    const dbDate = st?.last_date ?? null;

    const nParsedWeight = parseNotionWeight(nWeightRaw);
    const nParsedReps = parseNotionReps(nRepsRaw);

    const weightMatches = nParsedWeight.weight === dbWeight;
    const repsMatches = nParsedReps === dbMaxReps;
    const dateMatches = (nDate ?? null) === (dbDate ?? null);
    const ok = weightMatches && repsMatches && dateMatches;

    const notionCell = `${nWeightRaw} / ${nRepsRaw} / ${nDate ?? '—'}`;
    const dbCell = `${dbWeight !== null ? `${dbWeight} ${dbUnit}` : '—'} / ${dbRepsArr.length ? dbRepsArr.join(',') : '—'} / ${dbDate ?? '—'}`;

    lines.push(`| ${name} | ${notionCell} | ${dbCell} | ${ok ? 'OK' : 'MISMATCH'} |`);
    if (!ok) {
      mismatches.push({
        exercise: name,
        notion: { weight: nWeightRaw, reps: nRepsRaw, date: nDate },
        lift_state: { weight: dbWeight, unit: dbUnit, reps: dbRepsArr, date: dbDate },
      });
    }
  }
  lines.push('');

  // ---- 3. Today's computed plan vs Notion's Next Target ----
  lines.push('## 3. Next rotation day: computed target vs Notion `Next Target`', '');
  const dayIdx = rotation?.day_index ?? nextDayIndex({ lastCompleteIndex: null, dayCount: days.length });
  const day = days.find((d) => d.day_index === dayIdx) ?? days[0] ?? null;

  if (!day || !rules) {
    lines.push('No active block day or rules document available to compute a plan.', '');
  } else {
    const plan = planForDay({ day, slots, exercises, states: liftState, rules });
    lines.push(`**Day ${day.day_index + 1}: ${day.name}** (${rotation?.reason ?? 'default'})`, '');
    lines.push('| Exercise | Computed target (`engine.js`) | Notion `Next Target` |');
    lines.push('| :-- | :-- | :-- |');
    for (const ex of plan.exercises) {
      const oldTarget = nextTargetByName.get(norm(ex.name)) ?? '—';
      lines.push(`| ${ex.name} | ${fmtTarget(ex)} | ${oldTarget} |`);
    }
    lines.push('');
  }

  return {
    markdown: lines.join('\n'),
    countDiffs,
    mismatches,
  };
}

async function main() {
  if (existsSync('.env')) process.loadEnvFile?.('.env');

  const sources = existsSync(`${OUT}/sources.local.json`)
    ? JSON.parse(readFileSync(`${OUT}/sources.local.json`, 'utf8'))
    : [];
  const tracker = existsSync(`${OUT}/raw/lift_tracker.json`)
    ? JSON.parse(readFileSync(`${OUT}/raw/lift_tracker.json`, 'utf8'))
    : [];

  const client = serviceClient();
  const [sessions, exercises, bodyMetrics, blocks, liftState, rotation, docs] = await Promise.all([
    client.from('sessions').select('id').then(rows),
    client.from('exercises').select('*').then(rows),
    client.from('body_metrics').select('id').then(rows),
    client.from('blocks').select('*').eq('status', 'active').then(rows),
    client.from('lift_state').select('*').then(rows),
    client.from('rotation_next').select('*').maybeSingle().then((r) => (r.error ? null : r.data)),
    client.from('current_documents').select('*').eq('key', 'rules').maybeSingle()
      .then((r) => (r.error ? null : r.data)),
  ]);

  const activeBlock = blocks[0] ?? null;
  const days = activeBlock
    ? await client.from('block_days').select('*').eq('block_id', activeBlock.id).order('day_index').then(rows)
    : [];
  const slots = days.length > 0
    ? await client.from('block_slots').select('*').in('day_id', days.map((d) => d.id)).order('position').then(rows)
    : [];

  const report = buildVerifyReport({
    sources,
    tracker,
    dbCounts: {
      sessions: sessions.length,
      Active_or_Tracked_Exercises: tracker.length,
      body_metrics: bodyMetrics.length,
      blocks: blocks.length,
    },
    exercises,
    liftState,
    days,
    slots,
    rotation,
    rules: docs?.body_json ?? null,
  });

  writeFileSync(`${OUT}/report.md`, report.markdown);
  console.log(`count differences : ${report.countDiffs}`);
  console.log(`lift mismatches   : ${report.mismatches.length}`);
  console.log(`wrote             : ${OUT}/report.md`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
