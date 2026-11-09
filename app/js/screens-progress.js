/* Progress: training calendar with per-day workout breakdown, one lift at a
   time with range filters and exposure history, weekly volume against the
   minimums, and the body-weight trend. */

import * as store from './store.js';
import { h, cleanText, fmtLoad, fmtDate, toast, sheet, closeSheet } from './ui.js';
import { nav } from './nav.js';
import { line, bars } from './charts.js';
import { volumeVsTarget, ymd, isoWeekStart, addDays } from './engine.js';

const nameOf = (id) => (store.state.exercises ?? []).find((e) => e.id === id)?.name ?? 'Unknown exercise';

const RANGES = [
  { key: '8w', label: '8W', days: 56 },
  { key: '16w', label: '16W', days: 112 },
  { key: '6m', label: '6M', days: 182 },
  { key: 'all', label: 'All', days: null },
];

let currentState = {
  exerciseId: null,
  range: 'all',
  month: null,
};

/* Lifts worth charting: the ones with something logged. */
const loggedLifts = () => (store.state.liftState ?? [])
  .filter((s) => s.last_date)
  .map((s) => ({ id: s.exercise_id, name: nameOf(s.exercise_id) }))
  .sort((a, b) => a.name.localeCompare(b.name));

/* lift_history is one row per set; the chart wants one point per exposure, at
   the session's top weight. */
function exposures(rows) {
  const bySession = new Map();
  for (const r of rows ?? []) {
    const current = bySession.get(r.session_id);
    if (!current) bySession.set(r.session_id, { date: r.date, weight: r.weight, unit: r.unit, reps: [r.reps] });
    else {
      current.weight = Math.max(Number(current.weight) || 0, Number(r.weight) || 0);
      current.reps.push(r.reps);
    }
  }
  return [...bySession.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function defaultMonth() {
  const sessions = store.state.sessions ?? [];
  const latest = sessions.find((s) => s.date)?.date ?? ymd(new Date());
  return String(latest).slice(0, 7);
}

function shiftMonth(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMonthTitle(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const RANK = { done: 0, partial: 1, planned: 3, skipped: 4 };
const rank = (s) => (s.kind === 'rest' ? 2 : RANK[s.status] ?? 5);

/* The session that stands for a day. A double tap can leave an empty planned
   twin beside the real one, so the day is whichever got furthest. */
export function sessionForDate(sessions, date) {
  return (sessions ?? [])
    .filter((s) => s.date === date)
    .sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

function calendarCard(ym) {
  const sessions = store.state.sessions ?? [];
  const [year, month] = String(ym).split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // Monday = 0
  const todayStr = ymd(new Date());

  const byDate = new Map();
  for (const s of sessions) {
    if (!s.date || !String(s.date).startsWith(ym) || byDate.has(s.date)) continue;
    byDate.set(s.date, sessionForDate(sessions, s.date));
  }

  let trainedCount = 0;
  let totalMin = 0;
  let minCount = 0;
  for (const s of byDate.values()) {
    if (s.kind === 'training' && (s.status === 'done' || s.status === 'partial')) {
      trainedCount += 1;
      if (s.duration_min > 0) { totalMin += s.duration_min; minCount += 1; }
    }
  }
  const avgMin = minCount > 0 ? `${Math.round(totalMin / minCount)}m avg` : '';

  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .map((d) => `<div class="cal-dow">${d}</div>`).join('');

  const cells = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push('<div class="cal-day empty"></div>');
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateStr = `${ym}-${String(d).padStart(2, '0')}`;
    const s = byDate.get(dateStr);
    const isToday = dateStr === todayStr ? ' today' : '';
    if (!s) {
      cells.push(`<div class="cal-day${isToday}"><span>${d}</span></div>`);
      continue;
    }
    const cls = s.kind === 'rest'
      ? 'rest'
      : s.status === 'done'
        ? 'done'
        : s.status === 'partial'
          ? 'partial'
          : '';
    cells.push(`<button class="cal-day ${cls}${isToday}" data-action="view-day" data-date="${h(dateStr)}" title="${h(dateStr)}: ${h(s.kind === 'rest' ? 'Rest day' : s.status)}">
      <span>${d}</span>
      <i class="cal-dot"></i>
    </button>`);
  }

  return `<div class="card">
    <div class="card-title">
      <div><div class="eyebrow">1 · Activity Log</div><h3>Training Calendar</h3></div>
      <span class="small muted">${trainedCount} workout${trainedCount === 1 ? '' : 's'}${avgMin ? ` · ${avgMin}` : ''}</span>
    </div>
    <div class="cal-head">
      <button class="btn sm ghost" data-action="cal-month" data-month="${shiftMonth(ym, -1)}">&larr; Prev</button>
      <div class="cal-title">${h(fmtMonthTitle(ym))}</div>
      <button class="btn sm ghost" data-action="cal-month" data-month="${shiftMonth(ym, 1)}">Next &rarr;</button>
    </div>
    <div class="cal-grid">${dows}${cells.join('')}</div>
    <div class="cal-legend">
      <span><i class="cal-swatch done"></i>Completed</span>
      <span><i class="cal-swatch partial"></i>Partial</span>
      <span><i class="cal-swatch rest"></i>Rest</span>
      <span class="right">Tap a highlighted day for details</span>
    </div>
  </div>`;
}

function liftCard(exerciseId, rangeKey) {
  const lifts = loggedLifts();
  if (lifts.length === 0) {
    return `<div class="card">
      <div class="card-title"><div><div class="eyebrow">2 · Strength</div><h3>Lifts</h3></div></div>
      <p class="muted small">Nothing logged yet. Log a session and the chart appears here.</p>
    </div>`;
  }

  const picked = lifts.find((l) => l.id === exerciseId) ?? lifts[0];
  const rows = store.state.liftHistory?.[picked.id];
  const exObj = (store.state.exercises ?? []).find((e) => e.id === picked.id);
  const perHand = exObj?.load_mode === 'per_hand';

  const options = lifts.map((l) => `<option value="${h(l.id)}"${l.id === picked.id ? ' selected' : ''}>${h(l.name)}</option>`).join('');

  const rangeSpec = RANGES.find((r) => r.key === rangeKey) ?? RANGES.at(-1);
  const rangeButtons = `<div class="range-tabs">${RANGES.map((r) => `<button class="range-tab${r.key === rangeSpec.key ? ' on' : ''}" data-action="pick-range" data-range="${r.key}">${r.label}</button>`).join('')}</div>`;

  if (rows === undefined) {
    return `<div class="card">
      <div class="card-title"><div><div class="eyebrow">2 · Strength</div><h3>Lift Progression</h3></div>${rangeButtons}</div>
      <label>Exercise<select data-action="pick-lift">${options}</select></label>
      <p class="muted small">Loading…</p>
    </div>`;
  }

  const allExposures = exposures(rows);
  const cutoff = rangeSpec.days ? addDays(ymd(new Date()), -rangeSpec.days) : null;
  const filtered = cutoff ? allExposures.filter((e) => e.date >= cutoff) : allExposures;
  const shown = filtered.length > 0 ? filtered : allExposures;

  const chart = line(
    shown.map((e) => ({
      x: e.date,
      y: Number(e.weight),
      label: fmtLoad(e.weight, e.unit, perHand),
    })),
    { title: picked.name },
  );

  let kpiHtml = '';
  let historyHtml = '';
  if (shown.length > 0) {
    const first = shown[0];
    const last = shown.at(-1);
    const best = shown.reduce((a, b) => (Number(b.weight) >= Number(a.weight) ? b : a), shown[0]);
    const delta = Math.round(((Number(last.weight) || 0) - (Number(first.weight) || 0)) * 10) / 10;
    const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;

    kpiHtml = `<div class="meta-bar" style="margin-top:10px">
      <span class="meta-chip">Latest: <b>${fmtLoad(last.weight, last.unit, perHand)}</b> (${h(last.reps.join('/'))})</span>
      <span class="meta-chip">Best: <b>${fmtLoad(best.weight, best.unit, perHand)}</b></span>
      ${shown.length > 1 ? `<span class="meta-chip">Change: <b>${deltaSign} ${h(last.unit ?? '')}</b> (${shown.length} sessions)</span>` : ''}
    </div>`;

    const recent = [...shown].reverse().slice(0, 12);
    historyHtml = `<details style="margin-top:8px"><summary class="small muted">Session history (${shown.length} exposures)</summary>
      <table class="vol"><thead><tr><th>#</th><th>Date</th><th class="n">Top Load</th><th class="n">Reps per Set</th></tr></thead>
      <tbody>${recent.map((e, idx) => `<tr>
        <td class="mono muted">${shown.length - idx}</td>
        <td>${fmtDate(e.date)}</td>
        <td class="n">${fmtLoad(e.weight, e.unit, perHand)}</td>
        <td class="n">${h(e.reps.filter((r) => r !== null && r !== undefined).join(' / '))}</td>
      </tr>`).join('')}</tbody></table>
    </details>`;
  }

  return `<div class="card">
    <div class="card-title"><div><div class="eyebrow">2 · Strength</div><h3>Lift Progression</h3></div>${rangeButtons}</div>
    <label>Lift<select data-action="pick-lift">${options}</select></label>
    ${chart}
    ${kpiHtml}
    ${historyHtml}
  </div>`;
}

function volumeCard() {
  const week = isoWeekStart(ymd(new Date()));
  const thisWeek = (store.state.weeklyVolume ?? []).filter((r) => r.week_start === week);
  const rows = volumeVsTarget({ weeklyVolume: thisWeek, rules: store.state.rules });
  if (rows.length === 0) {
    return `<div class="card"><div class="card-title"><div><div class="eyebrow">3 · Hypertrophy</div><h3>Sets this week</h3></div></div>
      <p class="muted small">No rules document yet, so there is nothing to measure against.</p></div>`;
  }

  const metCount = rows.filter((r) => r.shortBy === 0).length;
  const chart = bars(
    rows.map((r) => ({ label: r.muscle, value: r.sets, target: r.target })),
    { title: 'Sets this week vs minimum' },
  );

  /* The same numbers as a table, so the chart is never the only way to read
     them — on a phone there is no hover, and a screen reader needs the rows. */
  const table = `<details style="margin-top:8px"><summary class="small muted">Show the numbers</summary>
    <table class="vol"><thead><tr><th>#</th><th>Muscle</th><th class="n">Direct</th><th class="n">Total</th><th class="n">Min</th></tr></thead>
    <tbody>${rows.map((r, i) => {
    const raw = thisWeek.find((v) => v.muscle === r.muscle);
    return `<tr class="${r.shortBy > 0 ? 'short' : ''}">
        <td class="mono muted">${i + 1}</td>
        <td>${h(r.muscle)}</td>
        <td class="n">${raw?.direct_sets ?? 0}</td>
        <td class="n">${r.sets}</td>
        <td class="n">${r.target}</td>
      </tr>`;
  }).join('')}</tbody></table></details>`;

  return `<div class="card">
    <div class="card-title">
      <div><div class="eyebrow">3 · Weekly Volume</div><h3>Muscle Targets</h3></div>
      <span class="small muted">${metCount} of ${rows.length} met</span>
    </div>
    ${chart}${table}
  </div>`;
}

function bodyCard() {
  const trend = [...(store.state.bodyTrend ?? [])]
    .sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  if (trend.length === 0) {
    return `<div class="card"><div class="card-title"><div><div class="eyebrow">4 · Composition</div><h3>Body weight</h3></div><button class="btn sm" data-action="log-weight">Log weight</button></div>
      <p class="muted small">No weigh-ins yet.</p></div>`;
  }

  const latest = trend.at(-1);
  const rate = trend.findLast((t) => t.rate_3w !== null && t.rate_3w !== undefined)?.rate_3w;
  const band = store.state.rules?.nutrition?.gain_band_kg_per_week;
  const inBand = band && rate !== undefined && rate !== null
    ? rate >= band[0] && rate <= band[1]
    : null;

  const chart = line(
    trend.map((t) => ({
      x: t.week_start,
      y: Number(t.avg_weight),
      label: fmtLoad(t.avg_weight, t.unit),
    })),
    { title: 'Weekly average body weight' },
  );

  const rateLine = rate === undefined || rate === null
    ? '<span class="muted">not enough weeks for a rate yet</span>'
    : `${rate} ${h(latest.unit ?? '')}/week over 3 weeks${
      inBand === null ? '' : inBand ? ' · <span class="pill must">in band</span>' : ' · <span class="pill flag">outside band</span>'}`;

  return `<div class="card">
    <div class="card-title"><div><div class="eyebrow">4 · Composition</div><h3>Body weight</h3></div><button class="btn sm" data-action="log-weight">Log weight</button></div>
    ${chart}
    <div class="small" style="margin-top:8px">${rateLine}</div>
  </div>`;
}

/* The Apple Watch numbers saved with a session, or a way to add them. */
function watchSummary(session) {
  const stat = (label, value) => (value === null || value === undefined || value === ''
    ? ''
    : `<div class="stat"><div class="v">${h(value)}</div><div class="l">${h(label)}</div></div>`);
  const stats = [
    stat('Minutes', session.duration_min),
    stat('Effort', session.effort_1_10 ? `${session.effort_1_10}/10` : null),
    stat('Active kcal', session.calories),
    stat('Total kcal', session.total_calories),
    stat('Avg HR', session.avg_hr),
    stat('Peak HR', session.peak_hr),
  ].filter(Boolean).join('');
  const zones = [...String(session.hr_zones?.raw ?? '').matchAll(/z([1-5]):(\d+)/g)]
    .map((m) => `<span class="meta-chip">Z${m[1]} ${m[2]}m</span>`).join('');

  if (!stats && !zones) {
    return `<div class="watch-summary empty">
      <div class="eyebrow">Apple Watch</div>
      <p class="small muted">No Apple Watch data for this session yet.</p>
      <button class="btn sm" data-action="add-watch-data" data-id="${h(session.id)}">Add from screenshots</button>
    </div>`;
  }
  return `<div class="watch-summary">
    <div class="eyebrow">Apple Watch</div>
    ${stats ? `<div class="stat-row">${stats}</div>` : ''}
    ${zones ? `<div class="meta-bar">${zones}</div>` : ''}
  </div>`;
}

export function dayDetailSheet(session, detail) {
  const dayRow = (store.state.days ?? []).find((d) => d.block_id === session.block_id && d.day_index === session.day_index);
  const title = session.kind === 'rest'
    ? 'Rest Day'
    : dayRow?.name ?? (session.day_index !== null && session.day_index !== undefined ? `Day ${session.day_index + 1}` : 'Training Session');

  const meta = session.pain && session.pain !== 'none'
    ? `<span class="pill flag">Pain: ${cleanText(session.pain)}</span>`
    : '';

  const exList = (detail?.exercises ?? []).map((sx, idx) => {
    const ex = (store.state.exercises ?? []).find((e) => e.id === sx.exercise_id);
    const perHand = ex?.load_mode === 'per_hand';
    const sets = (detail?.sets ?? [])
      .filter((st) => st.session_exercise_id === sx.id && st.done)
      .sort((a, b) => a.set_no - b.set_no);

    const setsSummary = sets.length === 0
      ? '<span class="muted small">Skipped / no sets logged</span>'
      : sets.map((st) => `<span class="meta-chip">${st.set_no}. ${fmtLoad(st.weight, st.unit, perHand)} &times; ${st.reps}${st.partial ? ' (partial)' : ''}</span>`).join(' ');

    return `<div class="exrow">
      <span class="ex-num">${idx + 1}</span>
      <div class="grow">
        <div class="name">${h(nameOf(sx.exercise_id))}</div>
        <div class="meta-bar" style="margin:4px 0 0">${setsSummary}</div>
        ${sx.deviation_note ? `<div class="sub muted">${cleanText(sx.deviation_note)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div class="eyebrow">${fmtDate(session.date)} · ${h(session.status)}</div>
    <h2>${h(title)}</h2>
    ${meta ? `<div class="meta-bar">${meta}</div>` : ''}
    ${session.kind === 'rest' ? '' : watchSummary(session)}
    ${session.notes ? `<p class="small muted">${cleanText(session.notes)}</p>` : ''}
    ${exList || '<p class="small muted">No exercises recorded for this day.</p>'}
    <div class="grid2" style="margin-top:14px">
      <button class="btn ghost" data-sheet="cancel">Close</button>
      <button class="btn primary" data-action="open-logged-session" data-id="${h(session.id)}">Open in Log</button>
    </div>`;
}

export function render(params = {}) {
  if (params.exerciseId !== undefined) currentState.exerciseId = params.exerciseId;
  if (params.range !== undefined) currentState.range = params.range;
  if (params.month !== undefined) currentState.month = params.month;

  const ym = currentState.month ?? defaultMonth();
  const head = `<div class="topbar">
    <div><div class="eyebrow">Trends &amp; History</div><h1>Progress</h1></div>
    <div class="small muted">${store.state.trainingRate?.per_week_4w ?? '—'}/week (4wk)</div>
  </div>`;
  return head
    + calendarCard(ym)
    + liftCard(currentState.exerciseId, currentState.range)
    + volumeCard()
    + bodyCard();
}

/* The chart for one lift is a separate read, so it is fetched when the screen
   opens and whenever the picker changes. */
export async function mount(params = {}) {
  const lifts = loggedLifts();
  if (lifts.length === 0) return;
  const pickId = params.exerciseId ?? currentState.exerciseId;
  const id = lifts.find((l) => l.id === pickId)?.id ?? lifts[0].id;
  store.state.liftHistory ??= {};
  if (store.state.liftHistory[id] !== undefined) return;
  try {
    store.state.liftHistory[id] = await store.liftHistoryFor(id);
    nav.refresh();
  } catch (err) {
    toast(err.message ?? 'Could not load the lift history', 'bad');
  }
}

export const actions = {
  'pick-lift': (node) => {
    currentState.exerciseId = node.value;
    nav.go('progress', { ...currentState, exerciseId: node.value });
  },
  'pick-range': (node) => {
    currentState.range = node.dataset.range;
    nav.go('progress', { ...currentState, range: node.dataset.range });
  },
  'cal-month': (node) => {
    currentState.month = node.dataset.month;
    nav.go('progress', { ...currentState, month: node.dataset.month });
  },
  'view-day': async (node) => {
    const date = node.dataset.date;
    const session = sessionForDate(store.state.sessions, date);
    if (!session) return;
    sheet(`<div class="eyebrow">${fmtDate(date)}</div><h2>Loading workout…</h2>`);
    try {
      const detail = await store.loadSession(session.id);
      sheet(dayDetailSheet(session, detail));
    } catch (err) {
      toast(err.message ?? 'Could not load session details', 'bad');
    }
  },
  'add-watch-data': async (node) => {
    const id = node.dataset.id;
    await store.loadSessionDetail(id);
    closeSheet();
    nav.go('workout', { sessionId: id, openFinish: true });
  },
  'open-logged-session': async (node) => {
    const id = node.dataset.id;
    await store.loadSessionDetail(id);
    sheet('');
    document.getElementById('sheet-root')?.classList.remove('show');
    document.body.style.overflow = '';
    nav.go('workout', { sessionId: id });
  },
};
