/* Today: the computed plan for the next rotation day, and the one button that
   starts logging it. Everything here is read from views and the rules; nothing
   is asked of a model. */

import * as store from './store.js';
import { h, cleanText, fmtLoad, fmtDate, fmtRest, toast, sheet, closeSheet, el } from './ui.js';
import { nav } from './nav.js';
import { planForDay, volumeVsTarget, ymd, isoWeekStart, nextDayIndex } from './engine.js';

/* Which day the rotation points at. The view answers this; with no answer and
   days present, fall back to the first day rather than showing nothing. */
function dayForToday() {
  const { rotation, days } = store.state;
  if (days.length === 0) return null;
  const index = rotation?.day_index ?? nextDayIndex({ lastCompleteIndex: null, dayCount: days.length });
  if (index === null || index === undefined) return null;
  return days.find((d) => d.day_index === index) ?? days[0];
}

function todaysSession() {
  const today = ymd(new Date());
  return store.state.sessions.find(
    (s) => s.date === today && s.kind === 'training' && (s.status === 'planned' || s.status === 'partial'),
  ) ?? null;
}

function empty(title, body, tab, cta) {
  return `<div class="card">
    <h2>${h(title)}</h2>
    <p class="muted">${h(body)}</p>
    <button class="btn primary full" data-action="go-tab" data-tab="${tab}">${h(cta)}</button>
  </div>`;
}

function planCard(plan, session) {
  const flags = plan.flags.length === 0 ? '' : `<div class="banner warn">${plan.flags
    .map((f) => `<div><b>${h(f.exercise)}</b> — ${cleanText(f.flag)}</div>`).join('')}</div>`;

  const rows = plan.exercises.map((e, idx) => {
    const marks = [
      e.nonNegotiable ? '<span class="pill must">non-negotiable</span>' : '',
      e.cutOrder !== null ? `<span class="pill">cut ${e.cutOrder}</span>` : '',
      e.label ? `<span class="pill flag">${cleanText(e.label)}</span>` : '',
    ].filter(Boolean).join(' ');
    const last = e.lastLogged?.weight !== null && e.lastLogged?.weight !== undefined
      ? `last ${fmtLoad(e.lastLogged.weight, e.lastLogged.unit, e.perHand)} × ${h((e.lastLogged.reps ?? []).join('/'))} on ${fmtDate(e.lastLogged.date)}`
      : 'no history yet';
    return `<div class="exrow">
      <span class="ex-num">${idx + 1}</span>
      <div class="grow">
        <div class="name">${h(e.name)}</div>
        <div class="sub">${last} · rest ${fmtRest(e.restS)}</div>
        ${e.notes ? `<div class="sub muted">${cleanText(e.notes)}</div>` : ''}
        ${marks ? `<div class="sub">${marks}</div>` : ''}
      </div>
      <div class="target">${e.sets} &times; ${e.reps}<br><span class="small">${fmtLoad(e.weight, e.unit, e.perHand)}</span></div>
    </div>`;
  }).join('');

  const button = session
    ? `<button class="btn primary big full" data-action="resume-session" data-id="${h(session.id)}">Resume logging</button>`
    : '<button class="btn primary big full" data-action="start-session">Start this session</button>';

  return `${flags}
    <div class="card">
      <div class="card-title">
        <div><div class="eyebrow">1 · Next up</div><h2>${h(plan.dayName ?? 'Training')}</h2></div>
        <span class="small muted">${plan.exercises.length} exercises</span>
      </div>
      ${plan.warmupNote ? `<p class="small muted"><b>Warm-up:</b> ${cleanText(plan.warmupNote)}</p>` : ''}
      ${rows}
    </div>
    ${button}`;
}

function volumeCard() {
  const week = isoWeekStart(ymd(new Date()));
  const thisWeek = store.state.weeklyVolume.filter((r) => r.week_start === week);
  const rows = volumeVsTarget({ weeklyVolume: thisWeek, rules: store.state.rules });
  if (rows.length === 0) return '';

  const body = rows.map((r, idx) => `<tr class="${r.shortBy > 0 ? 'short' : ''}">
      <td class="mono muted">${idx + 1}</td>
      <td>${h(r.muscle)}</td>
      <td class="n">${r.sets}</td>
      <td class="n">${r.target}</td>
      <td class="n">${r.shortBy > 0 ? `short ${r.shortBy}` : 'met'}</td>
    </tr>`).join('');

  return `<div class="card">
    <div class="card-title"><div><div class="eyebrow">2 · Weekly Target</div><h3>Sets this week</h3></div><span class="small muted">vs minimum</span></div>
    <table class="vol"><thead><tr><th>#</th><th>Muscle</th><th class="n">Done</th><th class="n">Min</th><th class="n">Status</th></tr></thead>
    <tbody>${body}</tbody></table>
  </div>`;
}

function statsCard() {
  const week = isoWeekStart(ymd(new Date()));
  const trained = store.state.sessions.filter(
    (s) => s.kind === 'training' && s.date >= week && (s.status === 'done' || s.status === 'partial'),
  ).length;
  const rate = store.state.trainingRate?.per_week_4w ?? '—';
  const body = store.state.bodyMetrics[0];

  return `<div class="stat-row">
    <div class="stat"><div class="v">${trained}</div><div class="l">sessions this week</div></div>
    <div class="stat"><div class="v">${rate}</div><div class="l">per week, 4wk</div></div>
    <button class="stat" data-action="log-weight" title="Log body weight"><div class="v">${body ? fmtLoad(body.weight, body.unit) : '—'}</div><div class="l">last weigh-in</div></button>
  </div>`;
}

export function weightSheet() {
  const latest = store.state.bodyMetrics[0];
  const unit = latest?.unit ?? store.state.rules?.units?.body ?? 'kg';
  return `<h2>Log weigh-in</h2>
    <p class="small muted">Recorded for today (${fmtDate(ymd(new Date()))}).</p>
    <div class="grid2">
      <label>Weight<input id="bw-weight" class="num" type="number" inputmode="decimal" step="0.1" min="0" value="${h(latest?.weight ?? '')}"></label>
      <label>Unit<select id="bw-unit">
        <option value="kg"${unit === 'kg' ? ' selected' : ''}>kg</option>
        <option value="lb"${unit === 'lb' ? ' selected' : ''}>lb</option>
      </select></label>
    </div>
    <label>Notes (optional)<input id="bw-notes" type="text" placeholder="e.g. morning fasted"></label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Cancel</button>
      <button class="btn primary" data-action="save-weight">Save</button>
    </div>`;
}

export function render() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const head = `<div class="topbar">
    <div><div class="eyebrow">${greeting}</div><h1>Today</h1></div>
    <div class="small muted">${new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
  </div>`;

  if (!store.state.rules) {
    return head + empty(
      'No rules yet',
      'Every target comes from the rules document. Add one before the first plan can be computed.',
      'settings', 'Open settings',
    );
  }

  if (!store.state.activeBlock) {
    return head + empty(
      'No active block',
      'Ask the coach to generate a block, then activate it. Today needs an active block to know what is next.',
      'block', 'Open blocks',
    );
  }

  const day = dayForToday();
  if (!day) {
    return head + empty(
      'This block has no days',
      'The active block has no training days, so there is nothing to rotate to. Request changes on it, or activate another.',
      'block', 'Open blocks',
    );
  }

  const plan = planForDay({
    day,
    slots: store.state.slots,
    exercises: store.state.exercises,
    states: store.state.liftState,
    rules: store.state.rules,
  });

  if (plan.exercises.length === 0) {
    return head + empty(
      'This day has no exercises',
      `${plan.dayName ?? 'The day'} has no exercises yet. Request changes on the block to fill it in.`,
      'block', 'Open blocks',
    );
  }

  const warning = plan.reason ? `<div class="banner bad">${h(plan.reason)}</div>` : '';
  return head + warning + planCard(plan, todaysSession()) + statsCard() + volumeCard();
}

/* Starting a session freezes the plan the owner just read: one
   session_exercises row per slot, holding the computed target. What they saw is
   what gets logged against, even if a view changes underneath. */
async function startSession() {
  const day = dayForToday();
  if (!day) return;
  const plan = planForDay({
    day,
    slots: store.state.slots,
    exercises: store.state.exercises,
    states: store.state.liftState,
    rules: store.state.rules,
  });

  try {
    const session = await store.write({
      table: 'sessions',
      action: 'insert',
      row: {
        date: ymd(new Date()),
        block_id: store.state.activeBlock.id,
        day_index: day.day_index,
        kind: 'training',
        status: 'planned',
      },
    });
    if (!session) {
      toast('Saved offline — reconnect to start logging', 'bad');
      return;
    }

    await store.write({
      table: 'session_exercises',
      action: 'insert',
      row: plan.exercises.map((e, i) => ({
        session_id: session.id,
        slot_id: e.slotId,
        exercise_id: e.exerciseId,
        position: i,
        target_weight: e.weight,
        target_unit: e.weight === null ? null : e.unit,
        target_reps: e.reps,
        target_sets: e.sets,
      })),
    });

    await store.load();
    nav.go('workout', { sessionId: session.id });
  } catch (err) {
    toast(err.message ?? 'Could not start the session', 'bad');
  }
}

export const actions = {
  'start-session': startSession,
  'resume-session': (node) => nav.go('workout', { sessionId: node.dataset.id }),
  'log-weight': () => sheet(weightSheet()),
  'save-weight': async () => {
    const raw = el('bw-weight')?.value ?? '';
    const weight = Number(raw);
    if (!raw.trim() || !Number.isFinite(weight) || weight <= 0) {
      toast('Enter a valid weight', 'bad');
      return;
    }
    const unit = el('bw-unit')?.value === 'lb' ? 'lb' : 'kg';
    const notes = el('bw-notes')?.value.trim() || null;
    try {
      await store.write({
        table: 'body_metrics',
        action: 'insert',
        row: { date: ymd(new Date()), weight, unit, notes },
      });
      closeSheet();
      await store.load();
      toast('Weigh-in saved');
      nav.refresh();
    } catch (err) {
      toast(err.message ?? 'Could not save weigh-in', 'bad');
    }
  },
};
