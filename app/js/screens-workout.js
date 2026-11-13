/* Logging. The targets were frozen when the session started, so this screen
   only records what actually happened: done as prescribed in one tap, or exact
   numbers per set. */

import * as store from './store.js';
import { h, fmtLoad, fmtRest, toast, sheet, closeSheet, timer, el, q, shrinkImage } from './ui.js';
import { nav } from './nav.js';
import { sessionComplete, ymd, parseAppleWatchText } from './engine.js';

const nameOf = (id) => store.state.exercises.find((e) => e.id === id)?.name ?? 'Unknown exercise';
const exerciseOf = (id) => store.state.exercises.find((e) => e.id === id) ?? null;

/* A skipped exercise has no sets at all, which the lift views already ignore, so
   a skip never reads as a failed attempt. The marker lives in deviation_note. */
export const SKIPPED_NOTE = 'skipped';
export const isSkipped = (x) => x?.deviation_note === SKIPPED_NOTE;

const setsOf = (detail, sxId) => detail.sets
  .filter((s) => s.session_exercise_id === sxId)
  .sort((a, b) => a.set_no - b.set_no);

/* Status when the session is finished. The day's first slot is required for a
   session to count as complete, which is the same rule the rotation uses, so
   skipping the opener never advances the block. */
export function statusFor(detail, slots, rules) {
  const doneSets = detail.sets.filter((s) => s.done);
  if (doneSets.length === 0) return 'skipped';

  const loggedSxIds = new Set(doneSets.map((s) => s.session_exercise_id));
  const withSlots = detail.exercises.filter((x) => x.slot_id);

  if (withSlots.length === 0) {
    // A free session with no block day: complete when every exercise was logged.
    const wanted = detail.exercises.filter((x) => !isSkipped(x));
    return wanted.every((x) => loggedSxIds.has(x.id)) ? 'done' : 'partial';
  }

  const positionOf = new Map(slots.map((s) => [s.id, s.position]));
  const dayId = slots.find((s) => s.id === withSlots[0].slot_id)?.day_id;
  const daySlots = slots.filter((s) => s.day_id === dayId);
  const loggedPositions = withSlots
    .filter((x) => loggedSxIds.has(x.id))
    .map((x) => positionOf.get(x.slot_id))
    .filter((p) => p !== undefined);

  if (loggedPositions.length === daySlots.length && daySlots.length > 0) return 'done';
  return sessionComplete({ slotCount: daySlots.length, loggedSlotPositions: loggedPositions, rules })
    ? 'done'
    : 'partial';
}

export function render(params = {}) {
  const detail = store.state.sessionDetail;
  if (!detail?.session) {
    return `<div class="topbar"><h1>Log</h1></div>
      <div class="card">
        <h2>No session open</h2>
        <p class="muted">Start today's session from the Today screen, then log it here.</p>
        <button class="btn primary full" data-action="go-tab" data-tab="today">Open today</button>
      </div>`;
  }

  const session = detail.session;
  const head = `<div class="topbar">
    <div><div class="eyebrow">${h(session.status)}</div><h1>Log</h1></div>
    <div class="small muted">${h(session.date)}</div>
  </div>`;

  if (detail.exercises.length === 0) {
    return `${head}<div class="card"><h2>Nothing to log</h2>
      <p class="muted">This session has no exercises on it.</p></div>`;
  }

  const rows = detail.exercises.map((x, idx) => {
    const exercise = exerciseOf(x.exercise_id);
    const perHand = exercise?.load_mode === 'per_hand';
    const mine = setsOf(detail, x.id);
    const done = mine.filter((s) => s.done);
    const slot = store.state.slots.find((s) => s.id === x.slot_id);

    if (isSkipped(x)) {
      return `<div class="card">
        <div class="card-title">
          <span class="ex-num">${idx + 1}</span>
          <div class="grow">
            <h3>${h(nameOf(x.exercise_id))}</h3>
            <div class="sub muted">target ${x.target_sets} &times; ${x.target_reps} @ ${fmtLoad(x.target_weight, x.target_unit, perHand)}</div>
          </div>
          <span class="pill flag">skipped</span>
        </div>
        <div class="row wrap" style="margin-top:10px">
          <button class="btn sm ghost" data-action="unskip-exercise" data-id="${h(x.id)}">Undo skip</button>
        </div>
      </div>`;
    }

    const logged = done.length === 0
      ? '<div class="sub muted">not logged yet</div>'
      : done.map((s) => `<div class="sub mono">${s.set_no}. ${fmtLoad(s.weight, s.unit, perHand)} × ${s.reps}${s.partial ? ' <span class="pill flag">partial</span>' : ''}</div>`).join('');

    return `<div class="card">
      <div class="card-title">
        <span class="ex-num">${idx + 1}</span>
        <div class="grow">
          <h3>${h(nameOf(x.exercise_id))}</h3>
          <div class="sub muted">target ${x.target_sets} &times; ${x.target_reps} @ ${fmtLoad(x.target_weight, x.target_unit, perHand)}${slot ? ` · rest ${fmtRest(slot.rest_s)}` : ''}</div>
        </div>
        <span class="pill${done.length >= (x.target_sets ?? 0) && done.length > 0 ? ' must' : ''}">${done.length} of ${x.target_sets ?? '?'}</span>
      </div>
      ${logged}
      <div class="row wrap" style="margin-top:10px">
        <button class="btn sm" data-action="done-exercise" data-id="${h(x.id)}">Done as prescribed</button>
        <button class="btn sm ghost" data-action="edit-sets" data-id="${h(x.id)}">Edit sets</button>
        <button class="btn sm ghost" data-action="skip-exercise" data-id="${h(x.id)}">Skip</button>
        ${slot?.rest_s ? `<button class="btn sm ghost" data-action="rest" data-s="${slot.rest_s}">Rest</button>` : ''}
      </div>
    </div>`;
  }).join('');

  return `${head}
    <button class="btn primary big full" data-action="done-all">Done as prescribed</button>
    <div style="height:12px"></div>
    ${rows}
    <button class="btn big full" data-action="finish-session">Finish session</button>
    <div style="height:24px"></div>`;
}

/* Every field is optional except pain, which defaults to none so the owner is
   never forced to answer a question they have no answer to. */
export function finishSheet(session, prefill = {}) {
  let defaultDuration = prefill.duration_min ?? session?.duration_min ?? '';
  let durationGuess = false;
  if (defaultDuration === '' && session?.created_at) {
    const elapsedMin = Math.round((Date.now() - Date.parse(session.created_at)) / 60000);
    if (Number.isFinite(elapsedMin) && elapsedMin > 0 && elapsedMin <= 240) {
      defaultDuration = elapsedMin;
      durationGuess = true;
    }
  }
  const cal = prefill.calories ?? session?.calories ?? '';
  const totalCal = prefill.total_calories ?? session?.total_calories ?? '';
  const avgHr = prefill.avg_hr ?? session?.avg_hr ?? '';
  const peakHr = prefill.peak_hr ?? session?.peak_hr ?? '';
  const effort = prefill.effort_1_10 ?? session?.effort_1_10 ?? '';
  const zones = prefill.hr_zones ?? session?.hr_zones?.raw ?? '';
  const pain = prefill.pain ?? session?.pain ?? 'none';
  const notes = prefill.notes ?? session?.notes ?? '';

  return `<h2>Finish session</h2>
    <p class="small muted">All optional except pain, which defaults to none.</p>

    <div class="watch-box" style="margin-bottom:12px;padding:12px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius-sm)">
      <div class="card-title" style="margin-bottom:8px">
        <div>
          <div class="eyebrow" style="margin:0">Apple Watch / Fitness</div>
          <div class="small muted">Auto-fill from screenshot, iOS Shortcut, or Live Text</div>
        </div>
      </div>
      <div class="grid2" style="margin-bottom:8px">
        <label class="btn sm primary" style="margin:0;cursor:pointer">
          <input id="f-shots" type="file" accept="image/*" multiple data-action="upload-watch-shots" style="display:none">
          Upload screenshot(s)
        </label>
        <button class="btn sm" type="button" data-action="paste-watch">Paste Watch text</button>
      </div>
      <details>
        <summary class="small muted">Scan / paste screenshot text or setup iOS Shortcut</summary>
        <label style="margin-top:8px">Tap inside box &rarr; Scan Text (or paste OCR text)
          <textarea id="f-watch-raw" rows="2" data-action="parse-watch-input" placeholder="Paste Apple Fitness screenshot text here to auto-fill all fields…"></textarea>
        </label>
        <div class="small muted" style="line-height:1.45">
          <b>1-Tap iOS Shortcut:</b> In Apple Shortcuts, add <i>Find Health Samples (Workouts, limit 1)</i> or <i>Extract Text from Image</i> (Share Sheet), then open:<br>
          <code>${h((globalThis.location?.origin ?? '') + (globalThis.location?.pathname ?? '/'))}?watch=TEXT</code>
        </div>
      </details>
      <div id="f-read-panel"></div>
      <div id="f-earlier-shots"></div>
    </div>

    <div class="grid2">
      <label>Duration (min)<input id="f-duration_min" class="num" type="number" inputmode="numeric" min="0" value="${h(defaultDuration)}"${durationGuess ? ' data-guess="1"' : ''}></label>
      <label>Effort 1-10<input id="f-effort_1_10" class="num" type="number" inputmode="numeric" min="1" max="10" value="${h(effort)}"></label>
      <label>Active calories<input id="f-calories" class="num" type="number" inputmode="numeric" min="0" value="${h(cal)}"></label>
      <label>Total calories<input id="f-total_calories" class="num" type="number" inputmode="numeric" min="0" value="${h(totalCal)}"></label>
      <label>Average HR<input id="f-avg_hr" class="num" type="number" inputmode="numeric" min="0" value="${h(avgHr)}"></label>
      <label>Peak HR<input id="f-peak_hr" class="num" type="number" inputmode="numeric" min="0" value="${h(peakHr)}"></label>
      <label class="span2">HR zones<input id="f-hr_zones" type="text" placeholder="z2:12 z3:20" value="${h(zones)}"></label>
    </div>
    <label>Pain<input id="f-pain" type="text" value="${h(pain)}"></label>
    <label>Notes<textarea id="f-notes" rows="3">${h(notes)}</textarea></label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Back</button>
      <button class="btn primary" data-action="save-finish">Save</button>
    </div>`;
}

function setRowHtml(n, { weight = '', reps = '', unit = '', perHand = false, partial = false }) {
  return `<div class="row" style="margin-bottom:8px" data-set="${n}">
      <span class="mono muted" style="width:20px">${n}</span>
      <input class="num" id="w-${n}" type="number" inputmode="decimal" step="0.5" value="${weight}" aria-label="Set ${n} weight">
      <span class="small muted">${h(unit)}${perHand ? '/hand' : ''}</span>
      <input class="num" id="r-${n}" type="number" inputmode="numeric" value="${reps}" aria-label="Set ${n} reps">
      <label class="row small" style="margin:0;white-space:nowrap">
        <input type="checkbox" id="p-${n}" style="width:auto;min-height:auto" ${partial ? 'checked' : ''}> partial
      </label>
    </div>`;
}

export function setsEditor(sxId) {
  const detail = store.state.sessionDetail;
  const x = detail.exercises.find((e) => e.id === sxId);
  const perHand = exerciseOf(x.exercise_id)?.load_mode === 'per_hand';
  const mine = setsOf(detail, sxId);
  const count = Math.max(mine.length, x.target_sets ?? 1);

  const rows = Array.from({ length: count }, (_, i) => {
    const existing = mine.find((s) => s.set_no === i + 1);
    const weight = existing?.weight ?? x.target_weight ?? '';
    const reps = existing?.reps ?? x.target_reps ?? '';
    return setRowHtml(i + 1, {
      weight,
      reps,
      unit: x.target_unit ?? '',
      perHand,
      partial: Boolean(existing?.partial),
    });
  }).join('');

  return `<h2>${h(nameOf(x.exercise_id))}</h2>
    <p class="small muted">Target ${x.target_sets} &times; ${x.target_reps} @ ${fmtLoad(x.target_weight, x.target_unit, perHand)}</p>
    <div id="set-rows" data-sx="${h(sxId)}" data-count="${count}">${rows}</div>
    <button class="btn sm ghost full" style="margin-bottom:10px" data-action="add-set" data-id="${h(sxId)}">Add a set</button>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Back</button>
      <button class="btn primary" data-action="save-sets" data-id="${h(sxId)}">Save sets</button>
    </div>`;
}

/* Every write has already been applied to the screen state, so the screen is
   redrawn at once. The server copy is fetched only when nothing is still
   queued, since a fetch then would not yet contain the queued sets. */
async function reload() {
  nav.refresh();
  const id = store.state.sessionDetail?.session?.id;
  if (!id || !store.state.online || store.pendingWrites() > 0) return;
  try {
    await store.loadSessionDetail(id);
    nav.refresh();
  } catch {
    // The screen already shows what was logged.
  }
}

/* Copies the frozen targets into real sets. The quickest honest log: it records
   exactly what was prescribed, not a guess. */
/* Pure: the sets "Done as prescribed" would insert. Skipped exercises are left
   alone and sets that already exist are never duplicated. */
export function prescribedRows(sessionExercises, existingSets, newId = () => globalThis.crypto.randomUUID()) {
  const rows = [];
  for (const x of sessionExercises) {
    if (isSkipped(x)) continue;
    const already = new Set(existingSets.filter((s) => s.session_exercise_id === x.id).map((s) => s.set_no));
    for (let n = 1; n <= (x.target_sets ?? 0); n += 1) {
      if (already.has(n)) continue;
      rows.push({
        id: newId(),
        session_exercise_id: x.id,
        set_no: n,
        weight: x.target_weight,
        unit: x.target_weight === null ? null : x.target_unit,
        reps: x.target_reps,
        partial: false,
        done: true,
      });
    }
  }
  return rows;
}

/* Copies the frozen targets into real sets. The quickest honest log: it records
   exactly what was prescribed, not a guess. */
async function logPrescribed(sessionExercises) {
  const rows = prescribedRows(sessionExercises, store.state.sessionDetail.sets);
  if (rows.length === 0) {
    toast('Already logged');
    return;
  }
  await store.write({ table: 'sets', action: 'insert', row: rows });
  await reload();
  toast(`${rows.length} sets logged`);
}

let pendingShotPaths = [];

/* Screenshots attached on an earlier save are kept, so re-saving the sheet
   never detaches them. */
export function hrZonesPayload(zonesText, existing, pendingShots) {
  const raw = String(zonesText ?? '').trim();
  const shots = [...new Set([...(existing?.shots ?? []), ...(pendingShots ?? [])])];
  if (raw === '' && shots.length === 0) return null;
  return {
    ...(raw !== '' ? { raw } : {}),
    ...(shots.length > 0 ? { shots } : {}),
  };
}

export function applyParsedWatch(parsed) {
  let filled = 0;
  const setIf = (id, val) => {
    if (val === null || val === undefined || val === '') return;
    const node = el(`f-${id}`);
    if (node) {
      node.value = String(val);
      filled += 1;
    }
  };
  setIf('duration_min', parsed.duration_min);
  setIf('calories', parsed.calories);
  setIf('total_calories', parsed.total_calories);
  setIf('avg_hr', parsed.avg_hr);
  setIf('peak_hr', parsed.peak_hr);
  setIf('effort_1_10', parsed.effort_1_10);
  setIf('hr_zones', parsed.hr_zones);
  return filled;
}

// The read-watch-shots function reads a ~150 KB JPEG in seconds and a full-size
// PNG in ~25; anything over this is shrunk on the phone first.
const READ_AS_IS_BYTES = 400_000;

export function planEarlierShots(folder, files) {
  const images = (files ?? []).filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f.name ?? ''));
  const small = images.filter((f) => (f.metadata?.size ?? Infinity) <= READ_AS_IS_BYTES);
  const pick = small.length > 0 ? small : images;
  const paths = pick.map((f) => `${folder}/${f.name}`);
  return small.length > 0 ? { read: paths, shrink: [] } : { read: [], shrink: paths };
}

let earlierShots = null;

export const WATCH_FIELDS = [
  ['duration_min', 'Workout time', ' min'],
  ['calories', 'Active calories', ' kcal'],
  ['total_calories', 'Total calories', ' kcal'],
  ['avg_hr', 'Avg HR', ' bpm'],
  ['peak_hr', 'Peak HR', ' bpm'],
  ['effort_1_10', 'Effort', '/10'],
  ['hr_zones', 'HR zones', ''],
];

/* What reading the screenshots should do to the form. Only empty boxes are
   filled; a box the owner already filled keeps its value and the Watch reading
   is offered beside it. The clock-based duration guess counts as empty. */
export function planWatchFill(current, fields) {
  const fill = [];
  const conflicts = [];
  const missing = [];
  for (const [id, label, unit] of WATCH_FIELDS) {
    const watch = fields?.[id];
    if (watch === null || watch === undefined || watch === '') {
      missing.push(label);
      continue;
    }
    const box = current[id] ?? { value: '', guess: false };
    if (box.value === '' || box.guess) fill.push({ id, label, unit, value: watch });
    else if (String(box.value).trim() !== String(watch)) conflicts.push({ id, label, current: box.value, watch });
  }
  return { fill, conflicts, missing };
}

const step = (done, text) => `<div class="read-step${done ? ' done' : ''}">${done ? '✓' : '<span class="spin"></span>'} ${text}</div>`;

export function readPanelHtml(r) {
  const label = h(r.label ?? 'screenshots');
  if (r.phase === 'uploading') return `<div class="read-panel">${step(false, `Uploading ${label}…`)}</div>`;
  if (r.phase === 'reading') {
    return `<div class="read-panel">${step(true, `Uploaded ${label}`)}${step(false, 'Reading the numbers with the vision model…')}</div>`;
  }
  if (r.phase === 'error') {
    return `<div class="read-panel">${step(true, `Uploaded ${label}`)}
      <div class="read-step bad">✗ Could not read them: ${h(r.error ?? 'error')}. Fill the numbers in by hand.</div></div>`;
  }
  const { fill = [], conflicts = [], missing = [] } = r.plan ?? {};
  const timing = r.model ? `<div class="small muted mono">${h(r.model)}${r.seconds != null ? ` · ${h(r.seconds)}s` : ''}</div>` : '';
  const dateWarn = r.workoutDate && r.sessionDate && r.workoutDate !== r.sessionDate
    ? `<div class="banner warn"><b>Different day.</b> The screenshot is from ${h(r.workoutDate)}, but this session is ${h(r.sessionDate)}. Check you picked the right workout before saving.</div>`
    : '';
  if (fill.length === 0 && conflicts.length === 0) {
    return `<div class="read-panel">${step(true, `Uploaded ${label}`)}
      <div class="read-step bad">✗ No numbers found on the screenshot.</div>
      ${r.said ? `<div class="small muted">The model said: ${h(r.said)}</div>` : ''}${timing}</div>`;
  }
  const n = fill.length + conflicts.length;
  const filled = fill.map((f) => `<li><b>${h(f.label)}</b> ${h(f.value)}${h(f.unit ?? '')}</li>`).join('');
  const differs = conflicts.map((c) => `<li><b>${h(c.label)}</b> you have ${h(c.current)} · Watch says ${h(c.watch)}
      <button class="btn sm ghost" type="button" data-action="use-watch-value" data-id="${h(c.id)}" data-value="${h(c.watch)}">Use ${h(c.watch)}</button></li>`).join('');
  return `<div class="read-panel">${step(true, `Uploaded ${label}`)}${step(true, `Read ${n} value${n === 1 ? '' : 's'}`)}
    ${dateWarn}
    ${filled ? `<div class="small" style="margin-top:6px">Filled in:</div><ul class="read-list">${filled}</ul>` : ''}
    ${differs ? `<div class="small" style="margin-top:6px">Already filled, kept yours:</div><ul class="read-list">${differs}</ul>` : ''}
    ${missing.length ? `<div class="small muted">Not on the screenshot: ${h(missing.join(', '))}</div>` : ''}
    ${timing}
    <div class="small"><b>Check them, then Save.</b></div></div>`;
}

function showPanel(r) {
  const node = el('f-read-panel');
  if (node) node.innerHTML = readPanelHtml(r);
}

function currentBoxes() {
  const out = {};
  for (const [id] of WATCH_FIELDS) {
    const node = el(`f-${id}`);
    out[id] = { value: node?.value ?? '', guess: node?.dataset?.guess === '1' };
  }
  return out;
}

async function readAndFill(paths, label) {
  showPanel({ phase: 'reading', label });
  const started = Date.now();
  try {
    const { fields, model } = await store.readWatchShots(paths);
    const plan = planWatchFill(currentBoxes(), fields ?? {});
    for (const f of plan.fill) {
      const node = el(`f-${f.id}`);
      if (!node) continue;
      node.value = String(f.value);
      delete node.dataset.guess;
      node.classList.add('from-watch');
    }
    showPanel({
      phase: 'done', label, plan, model,
      seconds: Math.round((Date.now() - started) / 1000),
      said: fields?.said,
      workoutDate: fields?.workout_date,
      sessionDate: store.state.sessionDetail?.session?.date,
    });
  } catch (err) {
    showPanel({ phase: 'error', label, error: err.message ?? 'error' });
  }
}

async function offerEarlierShots(sessionId) {
  earlierShots = null;
  try {
    const { folder, files } = await store.listSessionShots(sessionId);
    const plan = planEarlierShots(folder, files);
    const n = plan.read.length + plan.shrink.length;
    const slot = el('f-earlier-shots');
    if (n === 0 || !slot) return;
    earlierShots = plan;
    slot.innerHTML = `<button class="btn sm full" type="button" data-action="read-earlier-shots" style="margin-top:8px">Read ${n} screenshot${n === 1 ? '' : 's'} uploaded earlier</button>`;
  } catch {
    // Offline or no folder yet: the upload button still works.
  }
}

export const actions = {
  'done-all': async () => logPrescribed(store.state.sessionDetail.exercises),

  'done-exercise': async (node) => {
    const x = store.state.sessionDetail.exercises.find((e) => e.id === node.dataset.id);
    if (x) await logPrescribed([x]);
  },

  'skip-exercise': async (node) => {
    const x = store.state.sessionDetail.exercises.find((e) => e.id === node.dataset.id);
    if (!x) return;
    for (const set of setsOf(store.state.sessionDetail, x.id)) {
      await store.write({ table: 'sets', action: 'delete', id: set.id });
    }
    await store.write({ table: 'session_exercises', action: 'update', id: x.id, row: { deviation_note: SKIPPED_NOTE } });
    await reload();
    toast('Skipped');
  },

  'unskip-exercise': async (node) => {
    await store.write({ table: 'session_exercises', action: 'update', id: node.dataset.id, row: { deviation_note: null } });
    await reload();
    toast('Skip undone');
  },

  'edit-sets': (node) => sheet(setsEditor(node.dataset.id)),

  'add-set': (node) => {
    const box = q('#set-rows');
    if (!box) return;
    const x = store.state.sessionDetail.exercises.find((e) => e.id === node.dataset.id);
    if (!x) return;
    const perHand = exerciseOf(x.exercise_id)?.load_mode === 'per_hand';
    const next = Number(box.dataset.count) + 1;
    box.dataset.count = String(next);
    box.insertAdjacentHTML('beforeend', setRowHtml(next, {
      weight: x.target_weight ?? '',
      reps: x.target_reps ?? '',
      unit: x.target_unit ?? '',
      perHand,
      partial: false,
    }));
  },

  'rest': (node) => timer.start(Number(node.dataset.s), 'Rest'),

  'save-sets': async (node) => {
    const sxId = node.dataset.id;
    const count = Number(q('#set-rows').dataset.count);
    const existing = setsOf(store.state.sessionDetail, sxId);
    const x = store.state.sessionDetail.exercises.find((e) => e.id === sxId);

    for (let n = 1; n <= count; n += 1) {
      const weight = el(`w-${n}`).value;
      const reps = el(`r-${n}`).value;
      const partial = el(`p-${n}`).checked;
      const was = existing.find((s) => s.set_no === n);

      if (reps === '' && weight === '') {
        if (was) await store.write({ table: 'sets', action: 'delete', id: was.id });
        continue;
      }

      const row = {
        weight: weight === '' ? null : Number(weight),
        unit: weight === '' ? null : (x.target_unit ?? store.state.rules?.units?.weight ?? 'lb'),
        reps: reps === '' ? null : Number(reps),
        partial,
        done: true,
      };
      if (was) await store.write({ table: 'sets', action: 'update', id: was.id, row });
      else await store.write({ table: 'sets', action: 'insert', row: { ...row, session_exercise_id: sxId, set_no: n } });
    }

    closeSheet();
    await reload();
    toast('Sets saved');
  },

  'finish-session': () => {
    pendingShotPaths = [];
    const session = store.state.sessionDetail.session;
    sheet(finishSheet(session));
    offerEarlierShots(session.id);
  },

  'read-earlier-shots': async (node) => {
    if (!earlierShots) return;
    node.disabled = true;
    const n = earlierShots.read.length + earlierShots.shrink.length;
    const label = `${n} screenshot${n === 1 ? '' : 's'}`;
    let paths = earlierShots.read;
    if (earlierShots.shrink.length > 0) {
      showPanel({ phase: 'uploading', label });
      try {
        const blobs = await Promise.all(earlierShots.shrink.map((p) => store.downloadShot(p)));
        const files = await Promise.all(blobs.map((b) => shrinkImage(b)));
        paths = await store.uploadSessionShots(store.state.sessionDetail.session.id, files);
      } catch (err) {
        showPanel({ phase: 'error', label, error: `could not prepare them: ${err.message ?? 'error'}` });
        node.disabled = false;
        return;
      }
    }
    pendingShotPaths.push(...paths);
    await readAndFill(paths, label);
    node.remove();
  },

  'paste-watch': async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        toast('Clipboard is empty', 'bad');
        return;
      }
      const rawBox = el('f-watch-raw');
      if (rawBox) rawBox.value = text;
      const count = applyParsedWatch(parseAppleWatchText(text));
      toast(count > 0 ? `Auto-filled ${count} Apple Watch field${count === 1 ? '' : 's'}` : 'No Apple Watch stats found in clipboard', count > 0 ? undefined : 'bad');
    } catch {
      const rawBox = el('f-watch-raw');
      if (rawBox) {
        rawBox.closest('details')?.setAttribute('open', '');
        rawBox.focus();
      }
      toast('Paste into the Apple Watch box below');
    }
  },

  'parse-watch-input': (node) => {
    const parsed = parseAppleWatchText(node.value);
    const count = applyParsedWatch(parsed);
    if (count > 0) {
      toast(`Auto-filled ${count} field${count === 1 ? '' : 's'}`);
    }
  },

  'upload-watch-shots': async (node) => {
    const picked = Array.from(node.files ?? []);
    if (picked.length === 0) return;
    const label = `${picked.length} screenshot${picked.length === 1 ? '' : 's'}`;
    showPanel({ phase: 'uploading', label });

    let paths;
    try {
      const files = await Promise.all(picked.map((f) => shrinkImage(f)));
      paths = await store.uploadSessionShots(store.state.sessionDetail?.session?.id, files);
      pendingShotPaths.push(...paths);
    } catch (err) {
      showPanel({ phase: 'error', label, error: `upload failed: ${err.message ?? 'error'}` });
      return;
    }
    await readAndFill(paths, label);
  },

  'use-watch-value': (node) => {
    const input = el(`f-${node.dataset.id}`);
    if (input) {
      input.value = node.dataset.value;
      input.classList.add('from-watch');
    }
    node.closest('li')?.remove();
  },

  'save-finish': async () => {
    const detail = store.state.sessionDetail;
    const num = (id) => {
      const v = el(`f-${id}`).value;
      return v === '' ? null : Number(v);
    };

    await store.write({
      table: 'sessions',
      action: 'update',
      id: detail.session.id,
      row: {
        status: statusFor(detail, store.state.slots, store.state.rules),
        duration_min: num('duration_min'),
        calories: num('calories'),
        total_calories: num('total_calories'),
        avg_hr: num('avg_hr'),
        peak_hr: num('peak_hr'),
        effort_1_10: num('effort_1_10'),
        hr_zones: hrZonesPayload(el('f-hr_zones').value, detail.session.hr_zones, pendingShotPaths),
        pain: el('f-pain').value.trim() || 'none',
        notes: el('f-notes').value.trim() || null,
      },
    });

    pendingShotPaths = [];
    closeSheet();
    timer.stop();
    store.state.sessionDetail = null;
    store.persist();
    toast(store.pendingWrites() > 0 ? 'Session finished — saved on this phone until you reconnect' : 'Session finished');
    nav.go('today');
    store.load().catch(() => {});
  },
};

/* Pulls the session in when the screen is opened with a different one, or with
   none loaded yet. Also opens the Finish sheet pre-filled when launched from
   an iOS Shortcut with ?watch=... or prefill params. */
export async function mount(params = {}) {
  const today = ymd(new Date());
  const openToday = store.state.sessions.find(
    (s) => s.date === today && s.kind === 'training' && (s.status === 'planned' || s.status === 'partial'),
  );
  const have = store.state.sessionDetail?.session?.id;
  const want = params.sessionId ?? have ?? openToday?.id;
  if (want && want !== have) {
    try {
      await store.loadSessionDetail(want);
    } catch {
      toast('No signal, and this session is not saved on this phone yet', 'bad');
    }
    nav.refresh();
  }
  if (params.openFinish && store.state.sessionDetail?.session) {
    delete params.openFinish;
    pendingShotPaths = [];
    const session = store.state.sessionDetail.session;
    sheet(finishSheet(session));
    offerEarlierShots(session.id);
  }
  if (params.watchPrefill && store.state.sessionDetail?.session) {
    const prefill = params.watchPrefill;
    delete params.watchPrefill;
    pendingShotPaths = [];
    sheet(finishSheet(store.state.sessionDetail.session, prefill));
    toast('Apple Watch stats loaded');
  }
}
