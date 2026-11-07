#!/usr/bin/env node
/* Idempotent Notion-to-Supabase loader.

   Reads:
     - migrate/out/rows.json
     - migrate/out/documents.json
     - migrate/out/overrides.local.json (optional: exercise aliases/muscle/equipment overrides)
     - .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional MIGRATE_USER_ID)

   Validates the rules document against coach/schema/rules.schema.json before
   touching the database. Upserts exercises by case-insensitive name, sessions
   and body_metrics on notion_page_id, the active block by name, decisions by
   title, and inserts documents v1 only when no version exists yet.

   Prints row counts only — never personal data. */

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateRules } from '../coach/lib/rules.mjs';
import { serviceClient, rows } from '../coach/lib/db.mjs';

const OUT = 'migrate/out';
const norm = (s) => String(s ?? '').trim().toLowerCase();

/* For columns the schema declares as integer. */
const asInt = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

/* For columns the schema declares as a POSITIVE integer. A zero or negative
   value means "not recorded" in the source, and the check constraint rejects
   it; nulling it here keeps one odd row from aborting a load of hundreds. */
const asPositiveInt = (v) => {
  const n = asInt(v);
  return n !== null && n > 0 ? n : null;
};

/* Pure transformation from migrate/out/{rows,documents}.json into DB-ready
   structures. Exported so tests can verify the mapping without a database. */
export function prepareLoadPayload({ rowsData, docsData, userId, overrides = {} }) {
  if (!userId) throw new Error('prepareLoadPayload requires a userId');

  const ruleErrors = validateRules(docsData?.rules);
  if (ruleErrors.length > 0) {
    throw new Error(`the derived rules do not validate: ${ruleErrors[0]}`);
  }

  const aliases = new Map(
    Object.entries(overrides.aliases ?? {}).map(([k, v]) => [norm(k), String(v).trim()]),
  );
  const muscleOverrides = new Map(
    Object.entries(overrides.muscles ?? {}).map(([k, v]) => [norm(k), String(v).trim()]),
  );
  const equipmentOverrides = new Map(
    Object.entries(overrides.equipment ?? {}).map(([k, v]) => [norm(k), String(v).trim()]),
  );

  const canonicalName = (name) => aliases.get(norm(name)) ?? String(name ?? '').trim();

  const exercisesByKey = new Map();
  for (const ex of rowsData.exercises ?? []) {
    const name = canonicalName(ex.name);
    const key = norm(name);
    if (!key || exercisesByKey.has(key)) continue;

    const primaryMuscle = muscleOverrides.get(key)
      ?? ex.primary_muscle
      ?? 'unclassified';
    const equipment = equipmentOverrides.get(key)
      ?? ex.equipment
      ?? 'other';

    exercisesByKey.set(key, {
      user_id: userId,
      name,
      primary_muscle: primaryMuscle,
      secondary_muscles: ex.secondary_muscles ?? [],
      equipment,
      increment: ex.increment ?? null,
      unit: ex.increment ? ex.unit : null,
      load_mode: ex.load_mode ?? 'total',
      movement_tags: ex.movement_tags ?? [],
      cues: ex.cues ?? null,
      flag: ex.flag ?? null,
      active: Boolean(ex.active),
    });
  }

  const sessions = (rowsData.sessions ?? []).map((s) => {
    const exercises = (s.exercises ?? []).map((entry, idx) => {
      const exerciseName = canonicalName(entry.exercise);
      const skipped = Boolean(entry.skipped)
        || (entry.sets === null && entry.reps === null && entry.weight === null);
      const setCount = skipped ? 0 : (entry.sets ?? 1);
      const repsVal = entry.reps ?? entry.rep_max ?? entry.rep_min ?? 0;
      const hasWeight = typeof entry.weight === 'number' && Number.isFinite(entry.weight);

      const sets = Array.from({ length: setCount }, (_, i) => ({
        user_id: userId,
        set_no: i + 1,
        weight: hasWeight ? entry.weight : null,
        unit: hasWeight ? (entry.unit ?? 'lb') : null,
        reps: repsVal,
        partial: false,
        done: true,
      }));

      return {
        position: idx,
        exercise_name: exerciseName,
        target_weight: hasWeight ? entry.weight : null,
        target_unit: hasWeight ? (entry.unit ?? 'lb') : null,
        target_reps: asPositiveInt(entry.rep_max ?? entry.reps),
        target_sets: asPositiveInt(entry.sets),
        deviation_note: entry.note ?? entry.weight_note ?? null,
        sets,
      };
    });

    return {
      row: {
        user_id: userId,
        notion_page_id: s.notion_page_id,
        date: s.date,
        day_index: s.day_index ?? null,
        kind: s.kind ?? 'training',
        status: s.status ?? 'done',
        // Notion records these as floats (a 48.68 minute session); the columns
        // are integers and Postgres rejects a float outright rather than
        // coercing it. Rounding to the nearest minute, calorie or beat loses
        // nothing a training log cares about.
        duration_min: asInt(s.duration_min),
        calories: asInt(s.calories),
        avg_hr: asInt(s.avg_hr),
        peak_hr: asInt(s.peak_hr),
        effort_1_10: asInt(s.effort_1_10),
        hr_zones: s.hr_zones ?? null,
        pain: s.pain ?? 'none',
        notes: s.notes ?? null,
        source: 'notion_import',
      },
      exercises,
    };
  });

  const bodyMetrics = (rowsData.body_metrics ?? []).map((b) => ({
    user_id: userId,
    notion_page_id: b.notion_page_id,
    date: b.date,
    weight: b.weight ?? null,
    unit: b.weight !== null && b.weight !== undefined ? (b.unit ?? 'kg') : null,
    waist_note: b.waist_note ?? null,
    arm_cm: b.arm_cm ?? null,
    notes: b.notes ?? null,
  }));

  const block = rowsData.block
    ? {
      row: {
        user_id: userId,
        name: rowsData.block.name,
        status: 'active',
        starts_on: rowsData.block.starts_on ?? null,
        ends_on: rowsData.block.ends_on ?? null,
        rationale: rowsData.block.rationale ?? null,
      },
      days: (rowsData.block.days ?? []).map((d) => ({
        day_index: d.day_index,
        name: d.name,
        warmup_note: d.warmup_note ?? null,
        slots: (d.slots ?? []).map((slot) => ({
          position: slot.position,
          exercise_name: canonicalName(slot.exercise_name),
          sets: slot.sets,
          rep_min: slot.rep_min,
          rep_max: slot.rep_max,
          rest_s: slot.rest_s ?? 90,
          non_negotiable: Boolean(slot.non_negotiable),
          cut_order: slot.cut_order ?? null,
          notes: slot.notes ?? null,
        })),
      })),
    }
    : null;

  const decisions = (docsData.decisions ?? []).map((d) => {
    const dateMatch = String(d.title ?? '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
    return {
      user_id: userId,
      ...(dateMatch ? { date: dateMatch[1] } : {}),
      title: d.title,
      body: d.body ?? null,
    };
  });

  return {
    exercises: [...exercisesByKey.values()],
    sessions,
    bodyMetrics,
    block,
    documents: {
      manual: docsData.manual,
      rules: docsData.rules,
    },
    decisions,
  };
}

/* Every check constraint the schema declares, applied to the payload before a
   single row is written.

   Two live loads aborted part-way — once on a float in an integer column, once
   on a zero in a "> 0" column — each time after hundreds of rows were already
   in. Postgres rejects one row and the script dies; the rest never load. This
   turns that into one list, up front, with nothing written. */
export function preflight(payload) {
  const problems = [];
  const fail = (where, what) => problems.push(`${where}: ${what}`);
  const UNITS = ['lb', 'kg'];

  const posInt = (where, col, v) => {
    if (v === null || v === undefined) return;
    if (!Number.isInteger(v) || v <= 0) fail(where, `${col} is ${JSON.stringify(v)}, must be a positive integer`);
  };
  const nonNegInt = (where, col, v) => {
    if (v === null || v === undefined) return;
    if (!Number.isInteger(v) || v < 0) fail(where, `${col} is ${JSON.stringify(v)}, must be a non-negative integer`);
  };
  const unit = (where, col, v) => {
    if (v === null || v === undefined) return;
    if (!UNITS.includes(v)) fail(where, `${col} is ${JSON.stringify(v)}, must be lb or kg`);
  };
  const oneOf = (where, col, v, allowed) => {
    if (!allowed.includes(v)) fail(where, `${col} is ${JSON.stringify(v)}, must be one of ${allowed.join(', ')}`);
  };

  for (const e of payload.exercises) {
    const w = `exercise "${e.name}"`;
    if (!e.name) fail(w, 'name is empty');
    if (!e.primary_muscle) fail(w, 'primary_muscle is null (NOT NULL)');
    if (!e.equipment) fail(w, 'equipment is null (NOT NULL)');
    oneOf(w, 'load_mode', e.load_mode, ['total', 'per_hand']);
    if ((e.increment === null) !== (e.unit === null)) fail(w, 'increment and unit must both be set or both null');
    unit(w, 'unit', e.unit);
  }

  for (const s of payload.sessions) {
    const w = `session ${s.row.date}`;
    if (!s.row.date) fail(w, 'date is null (NOT NULL)');
    oneOf(w, 'kind', s.row.kind, ['training', 'rest']);
    oneOf(w, 'status', s.row.status, ['planned', 'done', 'partial', 'skipped']);
    oneOf(w, 'source', s.row.source, ['app', 'notion_import']);
    nonNegInt(w, 'duration_min', s.row.duration_min);
    nonNegInt(w, 'calories', s.row.calories);
    nonNegInt(w, 'day_index', s.row.day_index);
    posInt(w, 'avg_hr', s.row.avg_hr);
    posInt(w, 'peak_hr', s.row.peak_hr);
    if (s.row.effort_1_10 !== null && s.row.effort_1_10 !== undefined
        && !(Number.isInteger(s.row.effort_1_10) && s.row.effort_1_10 >= 1 && s.row.effort_1_10 <= 10)) {
      fail(w, `effort_1_10 is ${s.row.effort_1_10}, must be 1 to 10`);
    }

    const positions = new Set();
    for (const x of s.exercises) {
      const xw = `${w} / ${x.exercise_name}`;
      nonNegInt(xw, 'position', x.position);
      if (positions.has(x.position)) fail(xw, `duplicate position ${x.position}`);
      positions.add(x.position);
      posInt(xw, 'target_sets', x.target_sets);
      posInt(xw, 'target_reps', x.target_reps);
      unit(xw, 'target_unit', x.target_unit);
      if (x.target_weight !== null && x.target_unit === null) fail(xw, 'target_weight set with no target_unit');

      const setNos = new Set();
      for (const st of x.sets) {
        posInt(xw, 'set_no', st.set_no);
        if (setNos.has(st.set_no)) fail(xw, `duplicate set_no ${st.set_no}`);
        setNos.add(st.set_no);
        nonNegInt(xw, 'reps', st.reps);
        unit(xw, 'set unit', st.unit);
        if (st.weight !== null && st.unit === null) fail(xw, 'set weight with no unit');
      }
    }
  }

  for (const b of payload.bodyMetrics) {
    const w = `body metric ${b.date}`;
    if (!b.date) fail(w, 'date is null (NOT NULL)');
    unit(w, 'unit', b.unit);
    if (b.weight !== null && b.unit === null) fail(w, 'weight set with no unit');
  }

  if (payload.block) {
    oneOf('block', 'status', payload.block.row.status, ['draft', 'active', 'archived']);
    const { starts_on: a, ends_on: z } = payload.block.row;
    if (a && z && z < a) fail('block', 'ends_on is before starts_on');
    const dayIndexes = new Set();
    for (const d of payload.block.days) {
      const w = `block day ${d.day_index}`;
      nonNegInt(w, 'day_index', d.day_index);
      if (dayIndexes.has(d.day_index)) fail(w, 'duplicate day_index');
      dayIndexes.add(d.day_index);
      const slotPositions = new Set();
      for (const sl of d.slots) {
        const sw = `${w} / ${sl.exercise_name}`;
        nonNegInt(sw, 'position', sl.position);
        if (slotPositions.has(sl.position)) fail(sw, `duplicate position ${sl.position}`);
        slotPositions.add(sl.position);
        posInt(sw, 'sets', sl.sets);
        posInt(sw, 'rep_min', sl.rep_min);
        posInt(sw, 'rep_max', sl.rep_max);
        if (sl.rep_min > sl.rep_max) fail(sw, `rep_min ${sl.rep_min} is above rep_max ${sl.rep_max}`);
        nonNegInt(sw, 'rest_s', sl.rest_s);
      }
    }
  }

  if (!payload.documents.manual) fail('documents', 'manual body is empty');
  if (!payload.documents.rules) fail('documents', 'rules body is empty');
  for (const d of payload.decisions) {
    if (!d.title) fail('decision', 'title is empty (NOT NULL)');
  }

  return problems;
}

async function resolveUserId(client) {
  if (process.env.MIGRATE_USER_ID) return process.env.MIGRATE_USER_ID;
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 2 });
  if (error) throw new Error(`could not list users: ${error.message}`);
  const users = data?.users ?? [];
  if (users.length === 0) {
    throw new Error('no user exists in auth.users; create your user in the Supabase dashboard first');
  }
  return users[0].id;
}

async function loadDatabase(client, payload, userId) {
  // 1. Documents (insert v1 only when no version exists for that key).
  const existingDocs = await client.from('documents').select('key, version')
    .eq('user_id', userId).then(rows);
  const hasKey = new Set(existingDocs.map((d) => d.key));
  let docsInserted = 0;

  if (!hasKey.has('rules')) {
    await client.from('documents').insert({
      user_id: userId, key: 'rules', version: 1, body_json: payload.documents.rules,
    }).then(rows);
    docsInserted += 1;
  }
  if (!hasKey.has('manual')) {
    await client.from('documents').insert({
      user_id: userId, key: 'manual', version: 1, body_md: payload.documents.manual,
    }).then(rows);
    docsInserted += 1;
  }

  // 2. Exercises (idempotent by lower(name) per user).
  const existingExercises = await client.from('exercises').select('*')
    .eq('user_id', userId).then(rows);
  const exerciseIdByName = new Map(existingExercises.map((e) => [norm(e.name), e.id]));

  for (const ex of payload.exercises) {
    const id = exerciseIdByName.get(norm(ex.name));
    if (id) {
      await client.from('exercises').update(ex).eq('id', id).then(rows);
    } else {
      const [created] = await client.from('exercises').insert(ex).select().then(rows);
      exerciseIdByName.set(norm(created.name), created.id);
    }
  }

  // 3. Active block, days, and slots.
  let blockId = null;
  let slotCount = 0;
  if (payload.block) {
    const existingBlocks = await client.from('blocks').select('*')
      .eq('user_id', userId).eq('status', 'active').then(rows);
    let active = existingBlocks[0] ?? null;

    if (active) {
      const [updated] = await client.from('blocks')
        .update(payload.block.row).eq('id', active.id).select().then(rows);
      active = updated;
      await client.from('block_days').delete().eq('block_id', active.id);
    } else {
      const [created] = await client.from('blocks')
        .insert(payload.block.row).select().then(rows);
      active = created;
    }
    blockId = active.id;

    for (const day of payload.block.days) {
      const [dayRow] = await client.from('block_days').insert({
        user_id: userId,
        block_id: blockId,
        day_index: day.day_index,
        name: day.name,
        warmup_note: day.warmup_note,
      }).select().then(rows);

      const slotsToInsert = day.slots
        .map((s) => {
          const exId = exerciseIdByName.get(norm(s.exercise_name));
          if (!exId) return null;
          return {
            user_id: userId,
            day_id: dayRow.id,
            position: s.position,
            exercise_id: exId,
            sets: s.sets,
            rep_min: s.rep_min,
            rep_max: s.rep_max,
            rest_s: s.rest_s,
            non_negotiable: s.non_negotiable,
            cut_order: s.cut_order,
            notes: s.notes,
          };
        })
        .filter(Boolean);

      if (slotsToInsert.length > 0) {
        await client.from('block_slots').insert(slotsToInsert).then(rows);
        slotCount += slotsToInsert.length;
      }
    }
  }

  // 4. Sessions, session_exercises, and sets (idempotent on notion_page_id).
  let totalSets = 0;
  for (const s of payload.sessions) {
    const sessionRow = {
      ...s.row,
      block_id: s.row.day_index !== null ? blockId : null,
    };
    const [savedSession] = await client.from('sessions')
      .upsert(sessionRow, { onConflict: 'notion_page_id' })
      .select().then(rows);

    await client.from('session_exercises').delete().eq('session_id', savedSession.id);

    for (const sx of s.exercises) {
      const exId = exerciseIdByName.get(norm(sx.exercise_name));
      if (!exId) continue;

      const [savedSx] = await client.from('session_exercises').insert({
        user_id: userId,
        session_id: savedSession.id,
        slot_id: null,
        exercise_id: exId,
        position: sx.position,
        target_weight: sx.target_weight,
        target_unit: sx.target_unit,
        target_reps: sx.target_reps,
        target_sets: sx.target_sets,
        deviation_note: sx.deviation_note,
      }).select().then(rows);

      if (sx.sets.length > 0) {
        await client.from('sets').insert(
          sx.sets.map((st) => ({ ...st, session_exercise_id: savedSx.id })),
        ).then(rows);
        totalSets += sx.sets.length;
      }
    }
  }

  // 5. Body metrics (idempotent on notion_page_id).
  if (payload.bodyMetrics.length > 0) {
    await client.from('body_metrics')
      .upsert(payload.bodyMetrics, { onConflict: 'notion_page_id' }).then(rows);
  }

  // 6. Decisions (idempotent by title per user).
  const existingDecisions = await client.from('decisions').select('title')
    .eq('user_id', userId).then(rows);
  const seenTitles = new Set(existingDecisions.map((d) => d.title));
  const newDecisions = payload.decisions.filter((d) => !seenTitles.has(d.title));
  if (newDecisions.length > 0) {
    await client.from('decisions').insert(newDecisions).then(rows);
  }

  return {
    documents_inserted: docsInserted,
    exercises: payload.exercises.length,
    block_slots: slotCount,
    sessions: payload.sessions.length,
    sets: totalSets,
    body_metrics: payload.bodyMetrics.length,
    decisions: seenTitles.size + newDecisions.length,
  };
}

async function main() {
  if (existsSync('.env')) process.loadEnvFile?.('.env');

  const rowsData = JSON.parse(readFileSync(`${OUT}/rows.json`, 'utf8'));
  const docsData = JSON.parse(readFileSync(`${OUT}/documents.json`, 'utf8'));
  const overrides = existsSync(`${OUT}/overrides.local.json`)
    ? JSON.parse(readFileSync(`${OUT}/overrides.local.json`, 'utf8'))
    : {};

  const client = serviceClient();
  const userId = await resolveUserId(client);
  const payload = prepareLoadPayload({ rowsData, docsData, userId, overrides });

  const problems = preflight(payload);
  if (problems.length > 0) {
    console.error(`${problems.length} row(s) would be rejected by the schema; nothing was written:`);
    for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
    if (problems.length > 40) console.error(`  ...and ${problems.length - 40} more`);
    return 1;
  }

  const counts = await loadDatabase(client, payload, userId);

  console.log(`exercises       ${counts.exercises}`);
  console.log(`sessions        ${counts.sessions}`);
  console.log(`sets            ${counts.sets}`);
  console.log(`body metrics    ${counts.body_metrics}`);
  console.log(`block slots     ${counts.block_slots}`);
  console.log(`decisions       ${counts.decisions}`);
  console.log(`new documents   ${counts.documents_inserted}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
