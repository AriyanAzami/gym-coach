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
import * as settings from './screens-settings.js';

const screens = { today, workout, block, progress, coach, journal, settings };

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
    const result = await store.flushOutbox();
    ui.toast(result.sent ? `${result.sent} saved` : 'Nothing to sync');
    render();
  },
};

for (const screen of Object.values(screens)) {
  Object.assign(actions, screen.actions ?? {});
}

function chrome() {
  const pending = store.state.pendingWrites;
  const bits = [];
  if (!store.state.online) bits.push('offline');
  if (pending > 0) {
    bits.push(`<button class="link" data-action="retry-sync">${pending} unsaved</button>`);
  }
  return bits.length ? `<div class="banner warn">${bits.join(' · ')}</div>` : '';
}

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
  root.innerHTML = chrome() + body;
  root.scrollTop = 0;

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
  render();
  try {
    await store.load();
    await store.flushOutbox();
    const watchPrefill = consumeWatchUrlParams();
    if (watchPrefill) {
      nav.go('workout', { watchPrefill });
    }
    store.subscribeJobs(() => {
      if (current === 'coach' || current === 'block' || current === 'journal') render();
    });
  } catch (err) {
    ui.toast(err.message ?? 'Could not load', 'bad');
  }
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
