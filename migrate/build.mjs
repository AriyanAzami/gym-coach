#!/usr/bin/env node
/* Turns the raw Notion export into rows ready to load, plus a review file.

   Nothing here guesses at a number. Where the source does not say something the
   schema needs, this either leaves it null (an increment, which the rules
   supply) or derives it from evidence already in the data (load mode, from
   whether the logs actually recorded a per-hand weight). Where neither is
   possible — an unreadable line, an exercise that appears in a log but not in
   the tracker — the item goes to review.md to be asked about.

   Reads  migrate/out/raw/*.json
   Writes migrate/out/rows.json and migrate/out/review.md
   Prints counts only. */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseGymLogBody, classifySession } from './normalize.mjs';

const RAW = 'migrate/out/raw';
const read = (name) => JSON.parse(readFileSync(`${RAW}/${name}.json`, 'utf8'));
const norm = (s) => String(s ?? '').trim().toLowerCase();

/* Equipment is not a column in Notion, so it is inferred from the exercise
   name. Every inference is listed in review.md for confirmation — this is the
   one place the import leans on a convention rather than on the source. */
const EQUIPMENT_RULES = [
  [/\bcable\b|pulldown|pushdown|face pull|crossover/i, 'cable'],
  [/\bdb\b|dumbbell|hammer curl|\bshrug\b/i, 'dumbbell'],
  [/\bbarbell\b|\bbb\b/i, 'barbell'],
  [/machine|leg press|leg extension|leg curl|hip abduction|hip adduction|calf raise|chest press/i, 'machine'],
  [/back extension|push-?up|pull-?up|chin-?up|plank|dip\b/i, 'bodyweight'],
];

function inferEquipment(name) {
  for (const [pattern, equipment] of EQUIPMENT_RULES) {
    if (pattern.test(name)) return equipment;
  }
  return null;
}

function build() {
  const review = [];
  const note = (section, text) => review.push({ section, text });

  // ---- sessions, session exercises and sets, from the gym log ----
  const gymLog = read('gym_log');
  const sessions = [];
  const loggedNames = new Map(); // normalised name -> { name, perHand }

  for (const page of gymLog) {
    const props = page.properties ?? {};
    const date = props['date:Date:start'];
    if (!date) {
      note('sessions', `A gym log row has no date and was skipped: ${props.Session ?? page.id}`);
      continue;
    }

    const kind = classifySession({ Type: props['Session Type'] });
    if (kind.needs_review) {
      note('sessions', `Session type "${kind.source_type}" on ${date} is not one I recognise; imported as a training session with no block day.`);
    }

    const parsed = parseGymLogBody(page.body_markdown);
    for (const line of parsed.review) {
      note('log lines', `${date}: ${line}`);
    }

    for (const row of parsed.rows) {
      const key = norm(row.exercise);
      const seen = loggedNames.get(key) ?? { name: row.exercise, perHand: false };
      seen.perHand = seen.perHand || row.per_hand;
      loggedNames.set(key, seen);
    }

    const title = String(props.Session ?? '');
    sessions.push({
      notion_page_id: page.id,
      date,
      kind: kind.kind,
      day_index: kind.day_index,
      status: kind.kind === 'rest' ? 'done' : (parsed.rows.length > 0 ? 'done' : 'skipped'),
      duration_min: props['Duration (min)'] ?? null,
      calories: props.Calories ?? null,
      avg_hr: props['Avg HR'] ?? null,
      peak_hr: props['Peak HR'] ?? null,
      effort_1_10: props['Effort (1-10)'] ?? null,
      hr_zones: props['HR Zones'] ? { raw: String(props['HR Zones']) } : null,
      pain: props['Pain Status'] ? String(props['Pain Status']) : 'none',
      notes: title || null,
      source: 'notion_import',
      body_form: parsed.form,
      exercises: parsed.rows,
    });

    if (/INCOMPLETE|Return/i.test(title)) {
      note('sessions', `${date} is titled "${title}" — imported as a normal session; say if it should be partial or skipped.`);
    }
  }

  // ---- exercises, from the lift tracker plus anything only the logs mention ----
  const tracker = read('lift_tracker');
  const exercises = [];
  const byName = new Map();

  for (const row of tracker) {
    const p = row.properties ?? {};
    const name = String(p.Exercise ?? '').trim();
    if (!name) continue;
    const status = String(p.Status ?? '');
    const equipment = inferEquipment(name);
    if (!equipment) {
      note('equipment', `Could not infer equipment for "${name}" — it needs one before the plan can compute an increment.`);
    }

    const exercise = {
      name,
      primary_muscle: p.Muscle ? String(p.Muscle) : null,
      secondary_muscles: [],
      equipment,
      increment: null, // the rules supply it; Notion has no per-exercise increment
      unit: null,
      load_mode: loggedNames.get(norm(name))?.perHand ? 'per_hand' : 'total',
      movement_tags: [],
      cues: p['Notes / Cue'] ? String(p['Notes / Cue']) : null,
      // A flagged row's note is the active coaching flag.
      flag: status === 'Flagged' && p['Notes / Cue'] ? String(p['Notes / Cue']) : null,
      active: status !== 'Removed',
      notion_status: status,
      // Kept only so verify.mjs can compare them against the computed lift_state.
      notion_last_weight: p['Last Weight'] ? String(p['Last Weight']) : null,
      notion_last_reps: p['Last Reps'] ? String(p['Last Reps']) : null,
      notion_last_date: p['date:Last Date:start'] ?? null,
    };

    if (!exercise.primary_muscle) {
      note('exercises', `"${name}" (${status}) has no Muscle in Notion; it needs one before volume can count it.`);
    }
    exercises.push(exercise);
    byName.set(norm(name), exercise);
  }

  for (const [key, seen] of loggedNames) {
    if (byName.has(key)) continue;
    /* In the logs but not in the current tracker: a lift that was trained at
       some point and has since been dropped. Imported inactive so the history
       is kept and lift_history stays complete, but the exercise list and the
       coach's choices are not polluted by lifts no longer in the programme. */
    note('exercises-retired', `"${seen.name}" is in the logs but not in the Lift Tracker, so it was imported as INACTIVE. Its history is kept. Say if any of these should be active.`);
    const exercise = {
      name: seen.name,
      primary_muscle: null,
      secondary_muscles: [],
      equipment: inferEquipment(seen.name),
      increment: null,
      unit: null,
      load_mode: seen.perHand ? 'per_hand' : 'total',
      movement_tags: [],
      cues: null,
      flag: null,
      active: false,
      notion_status: '(from logs only)',
      notion_last_weight: null,
      notion_last_reps: null,
      notion_last_date: null,
    };
    exercises.push(exercise);
    byName.set(key, exercise);
  }

  // ---- body metrics ----
  const body = read('body_metrics').map((row) => {
    const p = row.properties ?? {};
    return {
      notion_page_id: row.id,
      date: p['date:Date:start'] ?? null,
      weight: typeof p['Weight (kg)'] === 'number' ? p['Weight (kg)'] : null,
      unit: typeof p['Weight (kg)'] === 'number' ? 'kg' : null,
      arm_cm: typeof p['Arm (cm, flexed)'] === 'number' ? p['Arm (cm, flexed)'] : null,
      waist_note: p['Waistband Check'] ? String(p['Waistband Check']) : null,
      notes: p.Notes ? String(p.Notes) : null,
    };
  }).filter((r) => {
    if (r.date) return true;
    note('body metrics', 'A body metrics row has no date and was skipped.');
    return false;
  });

  // ---- the active block ----
  const plans = read('monthly_plans');
  const activePlan = plans.find((p) => (p.properties ?? {}).Status === 'Active') ?? null;
  const block = activePlan ? parseBlock(activePlan, note) : null;
  if (!activePlan) note('block', 'No monthly plan is marked Active, so no block was built.');

  return {
    sessions,
    exercises,
    body_metrics: body,
    block,
    review,
  };
}

/* A monthly plan's body is a heading per day, each followed by a table of
   exercises. Day 5 is explicitly optional in the source, so it is not imported
   as part of the rotation without being asked about. */
function parseBlock(plan, note) {
  const props = plan.properties ?? {};
  const lines = String(plan.body_markdown ?? '').split('\n');
  const days = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^##\s+Day\s+(\d+)\s*[—–-]\s*(.+)$/i);
    if (heading) {
      const optional = /optional/i.test(heading[2]);
      current = { number: Number(heading[1]), name: heading[2].trim(), optional, slots: [] };
      days.push(current);
      continue;
    }
    if (line.startsWith('##')) { current = null; continue; }
    if (!current || !line.startsWith('|')) continue;
    if (/^\|[\s|:-]+\|$/.test(line)) continue;
    if (/^\|\s*exercise\s*\|/i.test(line)) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) {
      note('block', `Day ${current.number}: could not read this plan row: ${line}`);
      continue;
    }
    // Plan cells carry inline HTML (<b>…</b>) from Notion; the exercise name
    // has to match the Lift Tracker's plain text or the slot links to nothing.
    const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '').trim();
    const [exerciseRaw, setsCell, repsCell, restCell, ...noteCells] = cells;
    const exercise = stripTags(exerciseRaw);
    const sets = Number((setsCell.match(/\d+/) ?? [])[0]);
    const reps = repsCell.match(/(\d+)\s*(?:[-–]\s*(\d+))?/);
    const restMatch = restCell.match(/(\d+)\s*(s|sec|min|m)\b/i);

    if (!sets || !reps) {
      note('block', `Day ${current.number}: "${exercise}" has sets "${setsCell}" and reps "${repsCell}", which I could not read.`);
      continue;
    }

    current.slots.push({
      position: current.slots.length,
      exercise_name: exercise,
      sets,
      rep_min: Number(reps[1]),
      rep_max: reps[2] ? Number(reps[2]) : Number(reps[1]),
      rest_s: restMatch
        ? (/min|^m$/i.test(restMatch[2]) ? Number(restMatch[1]) * 60 : Number(restMatch[1]))
        : null,
      notes: noteCells.join(' | ').trim() || null,
    });
  }

  const optional = days.filter((d) => d.optional);
  for (const d of optional) {
    note('block', `Day ${d.number} ("${d.name}") is marked optional in the plan. It is NOT imported as a rotation day, because rotation_next would otherwise cycle through it. Say if you want it included.`);
  }

  const rotation = days.filter((d) => !d.optional).sort((a, b) => a.number - b.number);
  for (const d of rotation) {
    if (d.slots.length === 0) note('block', `Day ${d.number} ("${d.name}") has no readable exercises.`);
  }

  return {
    name: String(props.Month ?? 'Imported block'),
    status: 'active',
    starts_on: props['date:Start Date:start'] ?? null,
    ends_on: null,
    rationale: props['Adjustments From Last Month'] ? String(props['Adjustments From Last Month']) : null,
    days: rotation.map((d, i) => ({
      day_index: i,
      name: d.name,
      warmup_note: null,
      slots: d.slots,
    })),
    omitted_optional_days: optional.map((d) => d.number),
  };
}

function writeReview(review) {
  const bySection = new Map();
  for (const item of review) {
    const list = bySection.get(item.section) ?? [];
    list.push(item.text);
    bySection.set(item.section, list);
  }

  const out = ['# Import review', '',
    'Everything here is something the import would have had to guess at, so it did not.',
    'Answer these and I will re-run the build.', ''];

  for (const [section, items] of bySection) {
    out.push(`## ${section} (${items.length})`, '');
    for (const text of items) out.push(`- ${text}`);
    out.push('');
  }
  if (review.length === 0) out.push('Nothing needed a decision.', '');
  writeFileSync('migrate/out/review.md', out.join('\n'));
}

function main() {
  const result = build();
  writeFileSync('migrate/out/rows.json', JSON.stringify(result, null, 2));
  writeReview(result.review);

  const sets = result.sessions.reduce((n, s) => n + s.exercises.length, 0);
  console.log(`sessions        ${result.sessions.length}`);
  console.log(`  training      ${result.sessions.filter((s) => s.kind === 'training').length}`);
  console.log(`  rest          ${result.sessions.filter((s) => s.kind === 'rest').length}`);
  console.log(`exercise entries ${sets}`);
  console.log(`exercises       ${result.exercises.length}`);
  console.log(`  active        ${result.exercises.filter((e) => e.active).length}`);
  console.log(`  flagged       ${result.exercises.filter((e) => e.flag).length}`);
  console.log(`body metrics    ${result.body_metrics.length}`);
  console.log(`block days      ${result.block ? result.block.days.length : 0}`);
  console.log(`block slots     ${result.block ? result.block.days.reduce((n, d) => n + d.slots.length, 0) : 0}`);
  console.log(`review items    ${result.review.length}`);
  return 0;
}

export { build, inferEquipment, parseBlock };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
