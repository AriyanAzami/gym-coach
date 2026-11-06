/* Logging. The targets were frozen when the session started, so this screen
   only records what actually happened: done as prescribed in one tap, or exact
   numbers per set. */

import * as store from './store.js';
import { h, fmtLoad, fmtRest, toast, sheet, closeSheet, timer, el, q } from './ui.js';
import { nav } from './nav.js';
import { sessionComplete } from './engine.js';

const nameOf = (id) => store.state.exercises.find((e) => e.id === id)?.name ?? 'Unknown exercise';
const exerciseOf = (id) => store.state.exercises.find((e) => e.id === id) ?? null;
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
    return loggedSxIds.size === detail.exercises.length ? 'done' : 'partial';
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

  const rows = detail.exercises.map((x) => {
    const exercise = exerciseOf(x.exercise_id);
    const perHand = exercise?.load_mode === 'per_hand';
    const mine = setsOf(detail, x.id);
    const done = mine.filter((s) => s.done);
    const slot = store.state.slots.find((s) => s.id === x.slot_id);

    const logged = done.length === 0
      ? '<div class="sub muted">not logged yet</div>'
      : done.map((s) => `<div class="sub mono">${s.set_no}. ${fmtLoad(s.weight, s.unit, perHand)} × ${s.reps}${s.partial ? ' <span class="pill flag">partial</span>' : ''}</div>`).join('');

    return `<div class="card">
      <div class="card-title">
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
export function finishSheet(session) {
  return `<h2>Finish session</h2>
    <p class="small muted">All optional except pain, which defaults to none.</p>
    <div class="grid2">
      <label>Duration (min)<input id="f-duration_min" class="num" type="number" inputmode="numeric" min="0"></label>
      <label>Calories<input id="f-calories" class="num" type="number" inputmode="numeric" min="0"></label>
      <label>Average HR<input id="f-avg_hr" class="num" type="number" inputmode="numeric" min="0"></label>
      <label>Peak HR<input id="f-peak_hr" class="num" type="number" inputmode="numeric" min="0"></label>
      <label>Effort 1-10<input id="f-effort_1_10" class="num" type="number" inputmode="numeric" min="1" max="10"></label>
      <label>HR zones<input id="f-hr_zones" type="text" placeholder="z2:12 z3:20"></label>
    </div>
    <label>Pain<input id="f-pain" type="text" value="none"></label>
    <label>Notes<textarea id="f-notes" rows="3"></textarea></label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Back</button>
      <button class="btn primary" data-action="save-finish">Save</button>
    </div>`;
}

function setsEditor(sxId) {
  const detail = store.state.sessionDetail;
  const x = detail.exercises.find((e) => e.id === sxId);
  const perHand = exerciseOf(x.exercise_id)?.load_mode === 'per_hand';
  const mine = setsOf(detail, sxId);
  const count = Math.max(mine.length, x.target_sets ?? 1);

  const rows = Array.from({ length: count }, (_, i) => {
    const existing = mine.find((s) => s.set_no === i + 1);
    const weight = existing?.weight ?? x.target_weight ?? '';
    const reps = existing?.reps ?? x.target_reps ?? '';
    return `<div class="row" style="margin-bottom:8px" data-set="${i + 1}">
      <span class="mono muted" style="width:20px">${i + 1}</span>
      <input class="num" id="w-${i + 1}" type="number" inputmode="decimal" step="0.5" value="${weight}" aria-label="Set ${i + 1} weight">
      <span class="small muted">${h(x.target_unit ?? '')}${perHand ? '/hand' : ''}</span>
      <input class="num" id="r-${i + 1}" type="number" inputmode="numeric" value="${reps}" aria-label="Set ${i + 1} reps">
      <label class="row small" style="margin:0;white-space:nowrap">
        <input type="checkbox" id="p-${i + 1}" style="width:auto;min-height:auto" ${existing?.partial ? 'checked' : ''}> partial
      </label>
    </div>`;
  }).join('');

  return `<h2>${h(nameOf(x.exercise_id))}</h2>
    <p class="small muted">Target ${x.target_sets} &times; ${x.target_reps} @ ${fmtLoad(x.target_weight, x.target_unit, perHand)}</p>
    <div id="set-rows" data-sx="${h(sxId)}" data-count="${count}">${rows}</div>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Back</button>
      <button class="btn primary" data-action="save-sets" data-id="${h(sxId)}">Save sets</button>
    </div>`;
}

async function reload() {
  const id = store.state.sessionDetail?.session?.id;
  if (id) await store.loadSessionDetail(id);
  nav.refresh();
}

/* Copies the frozen targets into real sets. The quickest honest log: it records
   exactly what was prescribed, not a guess. */
async function logPrescribed(sessionExercises) {
  const rows = [];
  for (const x of sessionExercises) {
    const already = new Set(setsOf(store.state.sessionDetail, x.id).map((s) => s.set_no));
    for (let n = 1; n <= (x.target_sets ?? 0); n += 1) {
      if (already.has(n)) continue;
      rows.push({
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
  if (rows.length === 0) {
    toast('Already logged');
    return;
  }
  await store.write({ table: 'sets', action: 'insert', row: rows });
  await reload();
  toast(`${rows.length} sets logged`);
}

export const actions = {
  'done-all': async () => logPrescribed(store.state.sessionDetail.exercises),

  'done-exercise': async (node) => {
    const x = store.state.sessionDetail.exercises.find((e) => e.id === node.dataset.id);
    if (x) await logPrescribed([x]);
  },

  'edit-sets': (node) => sheet(setsEditor(node.dataset.id)),

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

  'finish-session': () => sheet(finishSheet(store.state.sessionDetail.session)),

  'save-finish': async () => {
    const detail = store.state.sessionDetail;
    const num = (id) => {
      const v = el(`f-${id}`).value;
      return v === '' ? null : Number(v);
    };
    const zones = el('f-hr_zones').value.trim();

    await store.write({
      table: 'sessions',
      action: 'update',
      id: detail.session.id,
      row: {
        status: statusFor(detail, store.state.slots, store.state.rules),
        duration_min: num('duration_min'),
        calories: num('calories'),
        avg_hr: num('avg_hr'),
        peak_hr: num('peak_hr'),
        effort_1_10: num('effort_1_10'),
        hr_zones: zones === '' ? null : { raw: zones },
        pain: el('f-pain').value.trim() || 'none',
        notes: el('f-notes').value.trim() || null,
      },
    });

    closeSheet();
    timer.stop();
    await store.load();
    toast('Session finished');
    nav.go('today');
  },
};

/* Pulls the session in when the screen is opened with a different one, or with
   none loaded yet. */
export async function mount(params = {}) {
  const want = params.sessionId;
  const have = store.state.sessionDetail?.session?.id;
  if (!want || want === have) return;
  await store.loadSessionDetail(want);
  nav.refresh();
}
