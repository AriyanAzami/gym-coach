/* Boot, auth gate and the tab router. */

import * as store from './store.js';
import * as ui from './ui.js';
import { nav } from './nav.js';

import * as today from './screens-today.js';
import * as workout from './screens-workout.js';
import * as block from './screens-block.js';
import * as progress from './screens-progress.js';
import * as coach from './screens-coach.js';
import * as settings from './screens-settings.js';

const screens = { today, workout, block, progress, coach, settings };

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
    store.subscribeJobs(() => {
      if (current === 'coach' || current === 'block') render();
    });
  } catch (err) {
    ui.toast(err.message ?? 'Could not load', 'bad');
  }
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
