/* Health: the scheduled check of the whole system.

   Runs live in health_runs, written by the health-check edge function. The app
   reads them, asks for a new one through request_health_run(), and edits its own
   health_settings row, which the hourly cron job reads to decide when to run. */

import * as store from './store.js';
import { h, markdown, toast, el } from './ui.js';
import { nav } from './nav.js';

const AREAS = [
  ['training', 'Training'],
  ['data', 'Data'],
  ['plumbing', 'Plumbing'],
  ['repo', 'Code'],
];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CADENCES = [['daily', 'Daily'], ['weekly', 'Weekly'], ['fortnightly', 'Every two weeks'], ['monthly', 'Monthly']];
const MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'mistralai/mistral-large-4-1t-a52b',
  'moonshotai/kimi-k2.6',
  'deepseek-ai/deepseek-v4.1-flash',
  'z-ai/glm-5.3-flash',
  'nvidia/nemotron-3-super-120b-a12b',
];

// The edge function is stopped by the platform well inside this.
const STALE_MS = 10 * 60 * 1000;

const DEFAULTS = {
  enabled: true,
  cadence: 'weekly',
  run_weekday: 6,
  run_hour: 19,
  timezone: 'UTC',
  primary_model: MODELS[0],
  fallback_model: MODELS[1],
};

const hour = (n) => `${String(n).padStart(2, '0')}:00`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const localTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const when = (iso) => {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.valueOf())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const isStale = (run) => (run.status === 'queued' || run.status === 'running')
  && Date.now() - Date.parse(run.created_at) > STALE_MS;
const inFlight = (run) => (run.status === 'queued' || run.status === 'running') && !isStale(run);

export function summarize(findings) {
  const list = findings ?? [];
  const bad = list.filter((x) => x.severity === 'bad').length;
  const warn = list.filter((x) => x.severity === 'warn').length;
  return { bad, warn, worst: bad > 0 ? 'bad' : warn > 0 ? 'warn' : 'ok' };
}

export function describeSchedule(s) {
  if (!s?.enabled) return 'Paused';
  const at = `at ${hour(s.run_hour)} (${s.timezone})`;
  if (s.cadence === 'daily') return `Daily ${at}`;
  const label = CADENCES.find(([v]) => v === s.cadence)?.[1] ?? s.cadence;
  return `${label} on ${WEEKDAYS[s.run_weekday]} ${at}`;
}

const countText = ({ bad, warn }) => (bad + warn === 0
  ? 'all clear'
  : [bad ? plural(bad, 'problem') : '', warn ? plural(warn, 'warning') : ''].filter(Boolean).join(' · '));

function findingHtml(x) {
  const tag = x.source === 'ai' ? ' <span class="pill">AI</span>' : '';
  return `<div class="finding ${x.severity === 'bad' ? 'bad' : 'warn'}">
    <div class="finding-title">${h(x.title)}${tag}</div>
    <div class="small muted">${h(x.detail)}</div>
  </div>`;
}

function areasHtml(findings) {
  return AREAS.map(([key, label]) => {
    const mine = (findings ?? []).filter((x) => x.area === key);
    const s = summarize(mine);
    const body = mine.length === 0
      ? '<p class="small muted">All clear</p>'
      : mine.map(findingHtml).join('');
    return `<div class="card">
      <div class="card-title"><h3>${label}</h3><span class="pill ${s.worst}">${h(countText(s))}</span></div>
      ${body}
    </div>`;
  }).join('');
}

function latestHtml(run) {
  if (!run) {
    return `<div class="card"><h2>No checks yet</h2>
      <p class="muted">Looks over your training, your logging and the machinery behind the app,
      then asks a model on NVIDIA's free API for a second opinion. Run one now, or set a schedule below.</p></div>`;
  }

  const meta = `<div class="small muted">${run.trigger === 'manual' ? 'Run by hand' : 'Scheduled'} · ${h(when(run.created_at))}</div>`;

  if (isStale(run)) {
    return `<div class="banner bad"><b>The last check did not finish.</b> It started ${h(when(run.created_at))} and never reported back.</div>`;
  }
  if (run.status === 'failed') {
    return `<div class="banner bad"><b>The last check failed</b> — ${h(run.error ?? 'no reason given')}</div>${meta}`;
  }
  if (inFlight(run)) {
    const partial = (run.findings ?? []).length > 0 ? areasHtml(run.findings) : '';
    return `<div class="banner warn"><b>Checking…</b> the model review can take a couple of minutes.</div>${partial}`;
  }

  const s = summarize(run.findings);
  const head = `<div class="card">
    <div class="card-title"><h2>${s.worst === 'ok' ? 'All clear' : h(countText(s))}</h2><span class="pill ${s.worst}">${s.worst === 'ok' ? 'healthy' : s.worst === 'bad' ? 'needs attention' : 'worth a look'}</span></div>
    ${meta}
  </div>`;

  const ai = run.ai_error
    ? `<div class="banner warn"><b>AI review skipped</b> — ${h(run.ai_error)}</div>`
    : run.ai_summary_md
      ? `<div class="card"><div class="card-title"><h3>Second opinion</h3><span class="small muted mono">${h(run.ai_model ?? '')}</span></div>${markdown(run.ai_summary_md)}</div>`
      : '';

  return head + ai + areasHtml(run.findings);
}

function historyHtml(runs) {
  const earlier = runs.slice(1, 11);
  if (earlier.length === 0) return '';
  const rows = earlier.map((r) => {
    const status = r.status === 'done' ? countText(summarize(r.findings))
      : isStale(r) ? 'did not finish' : r.status;
    return `<tr><td>${h(when(r.created_at))}</td><td class="small muted">${r.trigger === 'manual' ? 'by hand' : 'scheduled'}</td><td class="n">${h(status)}</td></tr>`;
  }).join('');
  return `<div class="card"><div class="card-title"><h3>History</h3></div>
    <table class="vol"><tbody>${rows}</tbody></table></div>`;
}

function settingsHtml(saved) {
  const s = { ...DEFAULTS, timezone: localTimezone(), ...(saved ?? {}) };
  const opt = (value, label, current) => `<option value="${h(value)}"${String(value) === String(current) ? ' selected' : ''}>${h(label)}</option>`;
  return `<div class="card">
    <div class="card-title"><h3>Schedule</h3><span class="small muted">${h(saved ? describeSchedule(s) : 'not saved yet')}</span></div>
    <label class="row small" style="margin:0 0 10px">
      <input type="checkbox" id="health-enabled" style="width:auto;min-height:auto"${s.enabled ? ' checked' : ''}>
      Run automatically
    </label>
    <label>How often<select id="health-cadence">${CADENCES.map(([v, l]) => opt(v, l, s.cadence)).join('')}</select></label>
    <div class="grid2">
      <label>Day<select id="health-weekday">${WEEKDAYS.map((d, i) => opt(i, d, s.run_weekday)).join('')}</select></label>
      <label>Time<select id="health-hour">${Array.from({ length: 24 }, (_, i) => opt(i, hour(i), s.run_hour)).join('')}</select></label>
    </div>
    <label>Timezone<input id="health-timezone" value="${h(s.timezone)}" autocomplete="off"></label>
    <datalist id="health-models">${MODELS.map((m) => `<option value="${h(m)}">`).join('')}</datalist>
    <label>Model<input id="health-primary" list="health-models" value="${h(s.primary_model)}" autocomplete="off"></label>
    <label>Fallback model<input id="health-fallback" list="health-models" value="${h(s.fallback_model ?? '')}" placeholder="none" autocomplete="off"></label>
    <p class="small muted">The check sends your rules, manual, notes and the last eight weeks of logs to NVIDIA's
    free trial API, which does not publish how it handles prompts. Its findings stay here, behind your login.</p>
    <button class="btn full" data-action="health-save">Save schedule</button>
  </div>`;
}

export function render() {
  const runs = [...(store.state.healthRuns ?? [])]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const latest = runs[0] ?? null;
  const busy = latest ? inFlight(latest) : false;

  const head = `<div class="topbar">
    <div><div class="eyebrow">System check</div><h1>Health</h1></div>
    <button class="btn primary" data-action="health-run"${busy ? ' disabled' : ''}>${busy ? 'Checking…' : 'Run now'}</button>
  </div>`;

  return head + latestHtml(latest) + historyHtml(runs) + settingsHtml(store.state.healthSettings);
}

export const actions = {
  'health-run': async (node) => {
    node.disabled = true;
    try {
      await store.requestHealthRun();
      toast('Health check started');
    } catch (err) {
      toast(err.message ?? 'Could not start the check', 'bad');
    }
    nav.refresh();
  },
  'health-save': async () => {
    const fallback = el('health-fallback').value.trim();
    const settings = {
      enabled: el('health-enabled').checked,
      cadence: el('health-cadence').value,
      run_weekday: Number(el('health-weekday').value),
      run_hour: Number(el('health-hour').value),
      timezone: el('health-timezone').value.trim() || 'UTC',
      primary_model: el('health-primary').value.trim() || DEFAULTS.primary_model,
      fallback_model: fallback || null,
    };
    try {
      await store.saveHealthSettings(settings);
      toast('Schedule saved');
    } catch (err) {
      toast(err.message ?? 'Could not save', 'bad');
    }
    nav.refresh();
  },
};
