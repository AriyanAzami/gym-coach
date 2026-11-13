/* Boot, auth gate and the tab router. */

import * as store from './store.js';
import * as ui from './ui.js';
import { nav } from './nav.js';
import { parseAppleWatchText } from './engine.js';

import * as today from './screens-today.js';
import * as workout from './screens-workout.js';
import * as block from './screens-block.js';
import * as progress from './screens-progress.js';
import * as coach from './screens-coach.js';
import * as journal from './screens-journal.js';
import * as health from './screens-health.js';
import * as settings from './screens-settings.js';

const screens = { today, workout, block, progress, coach, journal, health, settings };

let current = 'today';
let params = {};

const actions = {
  'sign-in': async (node) => {
    const form = node.closest('form') ?? document;
    const email = ui.q('#email', form).value;
    const password = ui.q('#password', form).value;
    node.disabled = true;
    try {
      await store.signIn(email, password);
    } catch (err) {
      ui.toast(err.message ?? 'Could not sign in', 'bad');
      node.disabled = false;
    }
  },
  'go-tab': (node) => nav.go(node.dataset.tab),
  'retry-sync': async () => {
    ui.closeSheet();
    const result = await store.flushOutbox();
    ui.toast(result.sent ? `${result.sent} saved` : 'Nothing saved yet — still no connection');
    render();
  },
  'review-failed': () => ui.sheet(failedSheet()),
  'discard-write': async (node) => {
    ui.closeSheet();
    if (!await ui.confirm('Throw this change away?',
      'It was rejected by the database and has not been saved anywhere else.', 'Discard', true)) return;
    await store.discardWrite(node.dataset.qid);
    ui.toast('Discarded');
  },
};

const describe = (op) => {
  const what = {
    sets: 'Logged sets', session_exercises: 'Session exercises', sessions: 'Session',
    body_metrics: 'Weigh-in', coach_notes: 'Coach note', blocks: 'Block', exercises: 'Exercise',
  }[op.table] ?? op.table;
  return `${what} (${op.action})`;
};

function failedSheet() {
  const failed = store.failedWrites();
  if (failed.length === 0) return '<h2>Nothing failed</h2><button class="btn ghost full" data-sheet="cancel">Close</button>';
  const items = failed.map((op) => `<li>
      <b>${ui.h(describe(op))}</b>
      <div class="small muted">${ui.h(ui.fmtDate(String(op.queuedAt ?? '').slice(0, 10)))} · ${ui.h(op.lastError ?? 'rejected')}</div>
      <button class="btn sm ghost" data-action="discard-write" data-qid="${ui.h(op.qid)}">Discard</button>
    </li>`).join('');
  return `<h2>Not saved</h2>
    <p class="small muted">The database rejected these. They stay on this phone until you retry or discard them.</p>
    <ul class="plain">${items}</ul>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Close</button>
      <button class="btn primary" data-action="retry-sync">Retry all</button>
    </div>`;
}

for (const screen of Object.values(screens)) {
  Object.assign(actions, screen.actions ?? {});
}

function chrome() {
  const { pendingWrites: pending, failedWrites: failed, online, stale } = store.state;
  const bits = [];
  if (!online) bits.push('offline');
  else if (stale) bits.push('showing what was saved on this phone');
  const waiting = pending - failed;
  if (waiting > 0) {
    bits.push(`<button class="link" data-action="retry-sync">${waiting} waiting to sync</button>`);
  }
  const bad = failed > 0
    ? `<div class="banner bad"><button class="link" data-action="review-failed">${failed} not saved — review</button></div>`
    : '';
  return bad + (bits.length ? `<div class="banner warn">${bits.join(' · ')}</div>` : '');
}

let lastRendered = null;

function render() {
  const root = ui.el('root');

  if (!store.isConfigured()) {
    root.innerHTML = `<div class="auth">
      <h1>Gym Coach</h1>
      <p class="muted">This copy has no Supabase project yet. Set the project URL
      and anon key in <code>app/js/config.js</code>.</p></div>`;
    ui.el('tabbar').classList.add('hidden');
    return;
  }

  if (!store.state.user) {
    root.innerHTML = `<form class="auth" onsubmit="return false">
      <h1>Gym Coach</h1>
      <label>Email<input id="email" type="email" autocomplete="username" required></label>
      <label>Password<input id="password" type="password" autocomplete="current-password" required></label>
      <button class="btn primary big full" data-action="sign-in">Sign in</button>
      <p class="muted small">One account, created by hand. There is no sign-up.</p>
    </form>`;
    ui.el('tabbar').classList.add('hidden');
    return;
  }

  if (!store.state.loaded) {
    root.innerHTML = '<div class="auth"><div class="eyebrow">Loading</div></div>';
    return;
  }

  ui.el('tabbar').classList.remove('hidden');
  const screen = screens[current] ?? screens.today;
  let body;
  try {
    body = screen.render(params);
  } catch (err) {
    console.error(err);
    body = `<div class="topbar"><h1>Something broke</h1></div>
      <div class="card"><p class="muted">${ui.h(err.message ?? String(err))}</p></div>`;
  }
  // A background reload redraws the screen; only a change of tab scrolls up.
  const keepScroll = lastRendered === current;
  const scrollY = globalThis.scrollY ?? 0;
  const rootScroll = root.scrollTop;
  root.innerHTML = chrome() + body;
  if (keepScroll) {
    root.scrollTop = rootScroll;
    globalThis.scrollTo?.(0, scrollY);
  } else {
    root.scrollTop = 0;
    globalThis.scrollTo?.(0, 0);
  }
  lastRendered = current;

  for (const tab of ui.qa('.tab')) {
    tab.classList.toggle('on', tab.dataset.tab === current);
  }
  screen.mount?.(params);
}

nav.go = (name, next = {}) => {
  current = name;
  params = next;
  render();
};
nav.refresh = render;
nav.current = () => current;

store.on('loaded', render);
store.on('net', render);
store.on('pending', render);

ui.wireChrome(actions);

function consumeWatchUrlParams() {
  try {
    const url = new URL(globalThis.location.href);
    const sp = url.searchParams;
    const rawWatch = sp.get('watch');
    const prefill = rawWatch ? parseAppleWatchText(rawWatch) : {};
    const numParam = (k) => {
      const v = sp.get(k);
      return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
    };
    const dur = numParam('duration') ?? numParam('duration_min');
    const cal = numParam('calories') ?? numParam('cal');
    const avg = numParam('avg_hr') ?? numParam('hr');
    const peak = numParam('peak_hr') ?? numParam('max_hr');
    const eff = numParam('effort') ?? numParam('effort_1_10');
    const zones = sp.get('zones') ?? sp.get('hr_zones');

    if (dur !== null) prefill.duration_min = dur;
    if (cal !== null) prefill.calories = cal;
    if (avg !== null) prefill.avg_hr = avg;
    if (peak !== null) prefill.peak_hr = peak;
    if (eff !== null) prefill.effort_1_10 = eff;
    if (zones) prefill.hr_zones = zones;

    const hasAny = Object.values(prefill).some((v) => v !== null && v !== undefined && v !== '');
    if (!hasAny) return null;

    for (const k of ['watch', 'duration', 'duration_min', 'calories', 'cal', 'avg_hr', 'hr', 'peak_hr', 'max_hr', 'effort', 'effort_1_10', 'zones', 'hr_zones']) {
      sp.delete(k);
    }
    const cleanUrl = url.pathname + (sp.toString() ? `?${sp.toString()}` : '') + url.hash;
    globalThis.history?.replaceState?.(null, '', cleanUrl);
    return prefill;
  } catch {
    return null;
  }
}

store.onAuth(async (user) => {
  if (!user) {
    store.state.loaded = false;
    render();
    return;
  }
  store.showSaved();
  render();
  try {
    // Flush first, so the load that follows already contains last session's sets.
    await store.flushOutbox().catch(() => {});
    await store.load();
    const watchPrefill = consumeWatchUrlParams();
    if (watchPrefill) {
      nav.go('workout', { watchPrefill });
    }
    subscribe();
  } catch (err) {
    ui.toast(err.message ?? 'Could not load', 'bad');
  }
});

function subscribe() {
  store.subscribeJobs(() => {
    if (current === 'coach' || current === 'block' || current === 'journal') render();
  });
  store.subscribeHealth(() => {
    if (current === 'health') render();
  });
}

/* iOS freezes a home-screen app in the background and drops its realtime
   socket, so coming back after a while reloads and resubscribes. Mid-workout
   only the outbox is flushed: the Log screen already holds the live state. */
const RESUME_RELOAD_MS = 60_000;
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  if (!store.state.user || !store.state.loaded) return;
  store.state.online = navigator.onLine ?? true;
  store.flushOutbox().catch(() => {});
  if (Date.now() - hiddenAt < RESUME_RELOAD_MS) return;
  subscribe();
  if (current !== 'workout') store.load().catch(() => {});
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
