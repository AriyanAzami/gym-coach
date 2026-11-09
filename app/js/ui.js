/* Rendering helpers: escaping, sheets, toasts, a rest timer. No data logic. */

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/* Strips benign Notion export tags (<b>, <i>, <code>) before HTML-escaping. */
export const cleanText = (s) => h(
  String(s ?? '')
    .replace(/<\/?(?:b|i|strong|em|code)>/gi, '')
    .replace(/\\~/g, '~'),
);

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

export function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export function fmtTokens(n) {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k tokens` : `${Math.round(n)} tokens`;
}

const JOB_HEADER_RE = /^\[([^\]]+)\]\s*\n?/;

export function encodeJobPrompt({ model = 'opus', effort = 'high', target = null, mode = null, write = false, instructions = '' } = {}) {
  const parts = [`model=${model}`, `effort=${effort}`];
  if (target) parts.push(`target=${target}`);
  if (mode) parts.push(`mode=${mode}`);
  if (write) parts.push('write=1');
  const body = String(instructions ?? '').trim();
  return `[${parts.join(' ')}]${body ? `\n${body}` : ''}`;
}

export function parseJobPrompt(raw) {
  const str = String(raw ?? '');
  const m = str.match(JOB_HEADER_RE);
  if (!m) return { model: null, effort: null, target: null, text: str.trim() };
  const kv = {};
  for (const token of m[1].trim().split(/\s+/)) {
    const [k, v] = token.split('=');
    if (k && v) kv[k.toLowerCase()] = v.toLowerCase();
  }
  return {
    model: kv.model ?? null,
    effort: kv.effort ?? null,
    target: kv.target ?? null,
    mode: kv.mode ?? null,
    write: kv.write === '1',
    text: str.slice(m[0].length).trim(),
  };
}

const META_COMMENT_RE = /^<!--\s*coach-meta:\s*(\{[^\n]*?\})\s*-->\s*\n?/;

export function extractJobMeta(job) {
  const rawMd = String(job?.output_md ?? '');
  let meta = {};
  let body = rawMd;
  const m = rawMd.match(META_COMMENT_RE);
  if (m) {
    try { meta = JSON.parse(m[1]); } catch { meta = {}; }
    body = rawMd.slice(m[0].length);
  }
  const parsedPrompt = parseJobPrompt(job?.instructions);
  const model = meta.model ?? parsedPrompt.model ?? 'opus';
  const effort = meta.effort ?? parsedPrompt.effort ?? 'high';
  const target = meta.target ?? parsedPrompt.target ?? null;

  let durationS = typeof meta.duration_s === 'number' ? meta.duration_s : null;
  if (durationS === null && job?.started_at && job?.finished_at) {
    const diff = (new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000;
    if (Number.isFinite(diff) && diff >= 0) durationS = Math.round(diff);
  } else if (durationS === null && job?.created_at && job?.finished_at) {
    const diff = (new Date(job.finished_at).getTime() - new Date(job.created_at).getTime()) / 1000;
    if (Number.isFinite(diff) && diff >= 0) durationS = Math.round(diff);
  }

  const inputTokens = typeof meta.input_tokens === 'number' ? meta.input_tokens : null;
  const outputTokens = typeof meta.output_tokens === 'number' ? meta.output_tokens : null;
  const totalTokens = typeof meta.total_tokens === 'number'
    ? meta.total_tokens
    : ((inputTokens ?? 0) + (outputTokens ?? 0) || (typeof meta.tokens === 'number' ? meta.tokens : null));
  const turns = typeof meta.turns === 'number' ? meta.turns : null;
  const modelLabel = model === 'sonnet' ? 'Claude Sonnet 5' : 'Claude Opus 5.5';
  const effortLabel = effort ? effort.charAt(0).toUpperCase() + effort.slice(1) : 'High';

  return {
    model,
    modelLabel,
    effort,
    effortLabel,
    target,
    mode: parsedPrompt.mode,
    write: parsedPrompt.write,
    question: parsedPrompt.text,
    durationS,
    inputTokens,
    outputTokens,
    totalTokens,
    turns,
    body,
  };
}

/* Rich markdown subset for the coach's rationale, check-ins, manual and
   decisions. Normalises Notion's <b>/<i>/<code> export tags first, then
   escapes all HTML so nothing a model or import writes can inject markup. */
export function markdown(text) {
  const normalized = String(text ?? '')
    .replace(META_COMMENT_RE, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
    .replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*')
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<\/?(?:b|i|strong|em|code)>/gi, '')
    .replace(/\\~/g, '~');

  const lines = h(normalized).split('\n');
  const out = [];
  let listKind = null; // 'ul' | 'ol' | null
  let tableRows = [];

  const closeList = () => {
    if (listKind) {
      out.push(`</${listKind}>`);
      listKind = null;
    }
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const isSep = (row) => row.every((c) => /^[:\-\s]+$/.test(c));
    const headRow = tableRows[0];
    const bodyRows = tableRows.slice(1).filter((r) => !isSep(r));
    out.push('<div class="table-wrap"><table class="vol md-table">');
    out.push(`<thead><tr>${headRow.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`);
    if (bodyRows.length > 0) {
      out.push(`<tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`);
    }
    out.push('</table></div>');
    tableRows = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      closeList();
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      tableRows.push(cells);
      continue;
    }
    flushTable();

    const ulItem = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ulItem) {
      if (listKind !== 'ul') { closeList(); out.push('<ul>'); listKind = 'ul'; }
      out.push(`<li>${inline(ulItem[1])}</li>`);
      continue;
    }

    const olItem = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (olItem) {
      if (listKind !== 'ol') { closeList(); out.push('<ol>'); listKind = 'ol'; }
      out.push(`<li>${inline(olItem[2])}</li>`);
      continue;
    }

    closeList();

    if (/^(?:---+|\*\*\*+)\s*$/.test(trimmed)) {
      out.push('<hr class="md-hr">');
      continue;
    }

    const quote = line.match(/^\s*&gt;\s?(.*)$/);
    if (quote) {
      out.push(`<blockquote class="md-quote">${inline(quote[1])}</blockquote>`);
      continue;
    }

    const head = line.match(/^(#{1,4})\s+(.*)$/);
    if (head) {
      const level = Math.min(head[1].length + 1, 5);
      out.push(`<h${level}>${inline(head[2])}</h${level}>`);
    } else if (trimmed === '') {
      out.push('');
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }

  closeList();
  flushTable();
  return out.join('\n');
}

const inline = (s) => s
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
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

const THEME_KEY = 'gym-coach.theme';

export function getTheme() {
  try {
    const v = globalThis.localStorage?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setTheme(mode) {
  const next = mode === 'light' || mode === 'dark' ? mode : 'auto';
  try {
    if (next === 'auto') globalThis.localStorage?.removeItem(THEME_KEY);
    else globalThis.localStorage?.setItem(THEME_KEY, next);
  } catch {
    // Storage unavailable in private mode or test runner.
  }
  const root = globalThis.document?.documentElement;
  if (!root) return next;
  if (next === 'auto') delete root.dataset.theme;
  else root.dataset.theme = next;

  const meta = globalThis.document?.querySelector('meta[name="theme-color"]');
  if (meta) {
    const prefersLight = globalThis.matchMedia?.('(prefers-color-scheme: light)')?.matches;
    const isLight = next === 'light' || (next === 'auto' && prefersLight);
    meta.setAttribute('content', isLight ? '#f6f7f9' : '#101214');
  }
  return next;
}

export function wireChrome(actions) {
  setTheme(getTheme());
  document.addEventListener('click', (event) => {
    const sheetBtn = event.target.closest('[data-sheet]');
    if (sheetBtn) {
      closeSheet(sheetBtn.dataset.sheet === 'ok');
      return;
    }
    const node = event.target.closest('[data-action]');
    if (!node || node.tagName === 'SELECT' || node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') return;
    const fn = actions[node.dataset.action];
    if (fn) { event.preventDefault(); fn(node, event); }
  });
  document.addEventListener('change', (event) => {
    const node = event.target.closest('[data-action]');
    if (!node) return;
    const fn = actions[node.dataset.action];
    if (fn) fn(node, event);
  });
  document.addEventListener('input', (event) => {
    const node = event.target.closest('textarea[data-action], input[data-action]');
    if (!node || node.type === 'file') return;
    const fn = actions[node.dataset.action];
    if (fn) fn(node, event);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && el('sheet-root').classList.contains('show')) closeSheet(false);
  });
  el('sheet-backdrop').addEventListener('click', () => closeSheet(false));
  el('timer-plus').addEventListener('click', () => timer.adjust(30));
  el('timer-minus').addEventListener('click', () => timer.adjust(-30));
  el('timer-skip').addEventListener('click', () => timer.stop());
}

export function scaledSize(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/* A full-size iPhone screenshot is 1–3 MB and takes a vision model ~10x longer
   to read than a scaled JPEG; the numbers stay perfectly legible at 1600 px.
   Anything the browser cannot decode is uploaded as it came. */
export async function shrinkImage(file, maxSide = 1600, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaledSize(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], 'watch.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
