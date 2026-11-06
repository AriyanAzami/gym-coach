/* Rendering helpers: escaping, sheets, toasts, a rest timer. No data logic. */

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const el = (id) => document.getElementById(id);
export const q = (sel, root) => (root ?? document).querySelector(sel);
export const qa = (sel, root) => Array.from((root ?? document).querySelectorAll(sel));

/* Weights are a value plus a unit, always shown together. A per-hand load says
   so, because "30 lb" and "30 lb each hand" are different workouts. */
export function fmtLoad(weight, unit, perHand) {
  if (weight === null || weight === undefined) return '—';
  const n = Number(weight);
  const text = `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit ?? ''}`.trim();
  return perHand ? `${text}/hand` : text;
}

export function fmtDate(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* Short rests read better in seconds — 60s and 90s are how they are prescribed —
   and only whole minutes from two minutes up switch to minutes. */
export function fmtRest(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  return seconds >= 120 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

/* The smallest markdown subset the coach's rationale and check-ins need.
   Escaped first, so nothing a model writes can inject markup. */
export function markdown(text) {
  const lines = h(text ?? '').split('\n');
  const out = [];
  let list = false;
  for (const line of lines) {
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      if (!list) { out.push('<ul>'); list = true; }
      out.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    if (list) { out.push('</ul>'); list = false; }
    const head = line.match(/^(#{1,4})\s+(.*)$/);
    if (head) out.push(`<h${head[1].length + 1}>${inline(head[2])}</h${head[1].length + 1}>`);
    else if (line.trim() === '') out.push('');
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('\n');
}

const inline = (s) => s
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

let toastTimer = null;
export function toast(message, kind) {
  const node = el('toast');
  if (!node) return;
  node.textContent = message;
  node.className = `toast show${kind ? ` ${kind}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = 'toast'; }, 2600);
}

let sheetResolve = null;

export function sheet(html) {
  el('sheet-body').innerHTML = html;
  el('sheet-root').classList.add('show');
  el('sheet').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

export function closeSheet(value) {
  el('sheet-root').classList.remove('show');
  el('sheet-body').innerHTML = '';
  document.body.style.overflow = '';
  if (sheetResolve) { const f = sheetResolve; sheetResolve = null; f(value); }
}

export function confirm(title, body, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    sheetResolve = resolve;
    sheet(`<h2>${h(title)}</h2><p class="muted">${h(body ?? '')}</p>
      <div class="grid2">
        <button class="btn ghost" data-sheet="cancel">Cancel</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-sheet="ok">${h(okLabel)}</button>
      </div>`);
  });
}

export const timer = {
  endsAt: 0, total: 0, handle: null,
  start(seconds, label = 'Rest') {
    this.total = seconds;
    this.endsAt = Date.now() + seconds * 1000;
    el('timerbar').classList.add('show');
    el('timer-label').textContent = label;
    clearInterval(this.handle);
    this.handle = setInterval(() => this.tick(), 250);
    this.tick();
  },
  tick() {
    const left = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
    el('timer-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el('timer-track').style.width = `${Math.min(100, (1 - left / this.total) * 100)}%`;
    if (left <= 0) this.stop();
  },
  adjust(delta) {
    this.endsAt += delta * 1000;
    this.total = Math.max(1, this.total + delta);
    this.tick();
  },
  stop() {
    clearInterval(this.handle);
    this.handle = null;
    el('timerbar').classList.remove('show');
  },
};

export function wireChrome(actions) {
  document.addEventListener('click', (event) => {
    const sheetBtn = event.target.closest('[data-sheet]');
    if (sheetBtn) {
      closeSheet(sheetBtn.dataset.sheet === 'ok');
      return;
    }
    const node = event.target.closest('[data-action]');
    if (!node) return;
    const fn = actions[node.dataset.action];
    if (fn) { event.preventDefault(); fn(node, event); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && el('sheet-root').classList.contains('show')) closeSheet(false);
  });
  el('sheet-backdrop').addEventListener('click', () => closeSheet(false));
  el('timer-plus').addEventListener('click', () => timer.adjust(30));
  el('timer-minus').addEventListener('click', () => timer.adjust(-30));
  el('timer-skip').addEventListener('click', () => timer.stop());
}
