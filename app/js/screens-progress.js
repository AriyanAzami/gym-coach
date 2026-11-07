/* Progress: one lift at a time, weekly volume against the minimums, and the
   body-weight trend. Everything is read from views, so the numbers here are the
   same ones the coach sees. */

import * as store from './store.js';
import { h, fmtLoad, toast } from './ui.js';
import { nav } from './nav.js';
import { line, bars } from './charts.js';
import { volumeVsTarget, ymd, isoWeekStart } from './engine.js';

const nameOf = (id) => store.state.exercises.find((e) => e.id === id)?.name ?? 'Unknown exercise';

/* Lifts worth charting: the ones with something logged. */
const loggedLifts = () => store.state.liftState
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

function liftCard(exerciseId) {
  const lifts = loggedLifts();
  if (lifts.length === 0) {
    return `<div class="card">
      <div class="card-title"><h3>Lifts</h3></div>
      <p class="muted small">Nothing logged yet. Log a session and the chart appears here.</p>
    </div>`;
  }

  const picked = lifts.find((l) => l.id === exerciseId) ?? lifts[0];
  const rows = store.state.liftHistory?.[picked.id];
  const perHand = store.state.exercises.find((e) => e.id === picked.id)?.load_mode === 'per_hand';

  const options = lifts.map((l) => `<option value="${h(l.id)}"${l.id === picked.id ? ' selected' : ''}>${h(l.name)}</option>`).join('');

  const chart = rows === undefined
    ? '<p class="muted small">Loading…</p>'
    : line(
      exposures(rows).map((e) => ({
        x: e.date,
        y: Number(e.weight),
        label: fmtLoad(e.weight, e.unit, perHand),
      })),
      { title: picked.name },
    );

  return `<div class="card">
    <label>Lift<select data-action="pick-lift">${options}</select></label>
    ${chart}
  </div>`;
}

function volumeCard() {
  const week = isoWeekStart(ymd(new Date()));
  const thisWeek = store.state.weeklyVolume.filter((r) => r.week_start === week);
  const rows = volumeVsTarget({ weeklyVolume: thisWeek, rules: store.state.rules });
  if (rows.length === 0) {
    return `<div class="card"><div class="card-title"><h3>Sets this week</h3></div>
      <p class="muted small">No rules document yet, so there is nothing to measure against.</p></div>`;
  }

  const chart = bars(
    rows.map((r) => ({ label: r.muscle, value: r.sets, target: r.target })),
    { title: 'Sets this week vs minimum' },
  );

  /* The same numbers as a table, so the chart is never the only way to read
     them — on a phone there is no hover, and a screen reader needs the rows. */
  const table = `<details><summary class="small muted">Show the numbers</summary>
    <table class="vol"><thead><tr><th>Muscle</th><th class="n">Direct</th><th class="n">Total</th><th class="n">Min</th></tr></thead>
    <tbody>${rows.map((r) => {
    const raw = thisWeek.find((v) => v.muscle === r.muscle);
    return `<tr class="${r.shortBy > 0 ? 'short' : ''}">
        <td>${h(r.muscle)}</td>
        <td class="n">${raw?.direct_sets ?? 0}</td>
        <td class="n">${r.sets}</td>
        <td class="n">${r.target}</td>
      </tr>`;
  }).join('')}</tbody></table></details>`;

  return `<div class="card">${chart}${table}</div>`;
}

function bodyCard() {
  const trend = [...store.state.bodyTrend]
    .sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  if (trend.length === 0) {
    return `<div class="card"><div class="card-title"><h3>Body weight</h3><button class="btn sm" data-action="log-weight">Log weight</button></div>
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
    <div class="card-title"><h3>Body weight</h3><button class="btn sm" data-action="log-weight">Log weight</button></div>
    ${chart}
    <div class="small" style="margin-top:8px">${rateLine}</div>
  </div>`;
}

export function render(params = {}) {
  const head = `<div class="topbar">
    <div><div class="eyebrow">Trends</div><h1>Progress</h1></div>
    <div class="small muted">${store.state.trainingRate?.per_week_4w ?? '—'}/week</div>
  </div>`;
  return head + liftCard(params.exerciseId) + volumeCard() + bodyCard();
}

/* The chart for one lift is a separate read, so it is fetched when the screen
   opens and whenever the picker changes. */
export async function mount(params = {}) {
  const lifts = loggedLifts();
  if (lifts.length === 0) return;
  const id = lifts.find((l) => l.id === params.exerciseId)?.id ?? lifts[0].id;
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
  'pick-lift': (node) => nav.go('progress', { exerciseId: node.value }),
};
