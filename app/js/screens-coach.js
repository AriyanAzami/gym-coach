/* Coach: notes, check-ins, questions, and what the coach has said back.

   A note is not a job. It is written down the moment it occurs to you — in the
   gym, mid-set — and the next job that runs picks up every note nobody has used
   yet. That is why notes cost nothing and jobs are deliberate. */

import * as store from './store.js';
import {
  h, cleanText, markdown, fmtDate, fmtDuration, fmtTokens,
  extractJobMeta, encodeJobPrompt, parseJobPrompt, toast, sheet, closeSheet, el,
} from './ui.js';
import { nav } from './nav.js';

const COACH_KINDS = ['checkin', 'ask'];

const busyWith = (kind) => store.state.jobs.some(
  (j) => j.kind === kind && (j.status === 'queued' || j.status === 'running'),
);

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? '' : fmtDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
};

export function askSheet(defaultModel = 'opus', defaultEffort = 'high') {
  return `<h2>Ask the coach</h2>
    <p class="small muted">Answered directly by Claude from your logged sessions, rules,
    and manual. It does not alter your active block.</p>
    <div class="grid2">
      <label>Claude model
        <select id="ask-model">
          <option value="opus"${defaultModel === 'opus' ? ' selected' : ''}>Claude Opus 5.5 (Deep)</option>
          <option value="sonnet"${defaultModel === 'sonnet' ? ' selected' : ''}>Claude Sonnet 5 (Fast)</option>
        </select>
      </label>
      <label>Thinking effort
        <select id="ask-effort">
          <option value="low"${defaultEffort === 'low' ? ' selected' : ''}>Low</option>
          <option value="medium"${defaultEffort === 'medium' ? ' selected' : ''}>Medium</option>
          <option value="high"${defaultEffort === 'high' ? ' selected' : ''}>High</option>
          <option value="max"${defaultEffort === 'max' ? ' selected' : ''}>Max</option>
        </select>
      </label>
    </div>
    <label>Question<textarea id="job-instructions" rows="5"
      placeholder="e.g. is my bench actually moving, or am I just adding reps?"></textarea></label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Cancel</button>
      <button class="btn primary" data-action="submit-ask">Ask Claude</button>
    </div>`;
}

function notesCard() {
  const waiting = store.state.notes.filter((n) => !n.consumed_by_job);
  const used = store.state.notes.filter((n) => n.consumed_by_job).slice(0, 8);

  const row = (n, idx, tag) => `<div class="exrow">
      <span class="ex-num">${idx + 1}</span>
      <div class="grow">
        <div class="sub">${cleanText(n.body)}</div>
        <div class="sub muted">${when(n.created_at)}${tag}</div>
      </div>
    </div>`;

  return `<div class="card">
    <div class="card-title"><h3>2 · Field Notes</h3>
      <span class="small muted">${waiting.length} waiting</span></div>
    <p class="small muted">Anything the coach should know next time it plans or answers.</p>
    <label><textarea id="note-body" rows="3" placeholder="e.g. knee felt off on the leg press"></textarea></label>
    <button class="btn full" data-action="add-note">Add note</button>
    ${waiting.map((n, idx) => row(n, idx, ' · <span class="pill flag">waiting</span>')).join('')}
    ${used.length ? `<details style="margin-top:10px"><summary class="small muted">Already used (${used.length})</summary>
      ${used.map((n, idx) => row(n, idx, '')).join('')}</details>` : ''}
  </div>`;
}

function askCard() {
  return `<div class="card">
    <div class="card-title">
      <h3>1 · Coach Brain</h3>
      <span class="pill ok">Verbatim Claude output</span>
    </div>
    <p class="small muted">Choose which Claude model and thinking effort to run. Responses come verbatim from Claude with full context of your sessions, rules, and manual.</p>
    <div class="grid2" style="margin-bottom:10px">
      <label style="margin:0">Model
        <select id="coach-model">
          <option value="opus" selected>Claude Opus 5.5</option>
          <option value="sonnet">Claude Sonnet 5</option>
        </select>
      </label>
      <label style="margin:0">Effort
        <select id="coach-effort">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high" selected>High</option>
          <option value="max">Max</option>
        </select>
      </label>
    </div>
    <div class="grid2">
      <button class="btn" data-action="checkin"${busyWith('checkin') ? ' disabled' : ''}>Run Check-in</button>
      <button class="btn primary" data-action="ask-coach"${busyWith('ask') ? ' disabled' : ''}>Ask a Question</button>
    </div>
  </div>`;
}

function jobTitle(j, meta) {
  if (j.kind === 'checkin') return 'Check-in';
  if (meta.target === 'rules') return 'Rules Revision';
  if (meta.target === 'manual') return 'Manual Revision';
  return 'Question';
}

function jobsCard() {
  const jobs = store.state.jobs
    .filter((j) => COACH_KINDS.includes(j.kind) && parseJobPrompt(j.instructions).mode !== 'journal')
    .slice(0, 12);
  if (jobs.length === 0) return '';

  const items = jobs.map((j, idx) => {
    const meta = extractJobMeta(j);
    const title = jobTitle(j, meta);
    const chips = [
      `<span class="meta-chip accent"><b>Model</b> ${h(meta.modelLabel)}</span>`,
      `<span class="meta-chip"><b>Effort</b> ${h(meta.effortLabel)}</span>`,
      meta.durationS != null
        ? `<span class="meta-chip"><b>Thinking time</b> ${h(fmtDuration(meta.durationS))}</span>`
        : '',
      meta.totalTokens != null
        ? `<span class="meta-chip"><b>Tokens</b> ${h(fmtTokens(meta.totalTokens))}${meta.inputTokens != null && meta.outputTokens != null ? ` (${h(fmtTokens(meta.inputTokens))} in / ${h(fmtTokens(meta.outputTokens))} out)` : ''}</span>`
        : '',
    ].filter(Boolean).join('');

    if (j.status === 'done') {
      return `<div class="card">
        <div class="card-title">
          <div class="row" style="gap:8px"><span class="ex-num">${idx + 1}</span><h3>${title}</h3></div>
          <span class="small muted">${when(j.created_at)}</span>
        </div>
        <div class="meta-bar">${chips}</div>
        ${meta.question ? `<div class="sub" style="margin-bottom:10px"><b>Prompt:</b> ${cleanText(meta.question)}</div>` : ''}
        ${meta.body ? markdown(meta.body) : '<p class="muted small">No output.</p>'}
      </div>`;
    }
    if (j.status === 'failed') {
      return `<div class="banner bad"><b>${title} failed</b> (${h(meta.modelLabel)}) — ${h(j.error ?? 'no reason given')}</div>`;
    }
    return `<div class="banner warn"><b>${title} ${h(j.status)}…</b> · ${h(meta.modelLabel)} (${h(meta.effortLabel)} effort)</div>`;
  }).join('');

  return `<div class="eyebrow" style="margin:14px 4px 6px">3 · Coach Responses (${jobs.length})</div>${items}`;
}

function decisionsCard() {
  const decisions = store.state.decisions.slice(0, 8);
  if (decisions.length === 0) return '';
  return `<div class="card">
    <div class="card-title"><h3>4 · Decision Log</h3><span class="small muted">${decisions.length} recent</span></div>
    ${decisions.map((d, idx) => `<div class="exrow">
      <span class="ex-num">${idx + 1}</span>
      <div class="grow">
        <div class="name">${cleanText(d.title)}</div>
        <div class="sub muted">${h(d.date)}</div>
        ${d.body ? `<div class="sub" style="margin-top:4px">${markdown(d.body)}</div>` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}

export function render() {
  const head = `<div class="topbar">
    <div><div class="eyebrow">Between blocks</div><h1>Coach</h1></div>
  </div>`;
  return head + askCard() + notesCard() + jobsCard() + decisionsCard();
}

async function submitJob(kind, instructions) {
  try {
    await store.dispatchJob(kind, instructions, null);
    toast('Sent to the coach');
  } catch (err) {
    toast(err.message ?? 'Could not send the job', 'bad');
  }
  nav.refresh();
}

export const actions = {
  'add-note': async () => {
    const field = el('note-body');
    const body = field.value.trim();
    if (!body) {
      toast('Nothing to add');
      return;
    }
    field.value = '';
    await store.write({ table: 'coach_notes', action: 'insert', row: { body } });
    await store.load();
    toast('Note saved');
    nav.refresh();
  },

  'checkin': () => {
    const model = el('coach-model')?.value ?? 'opus';
    const effort = el('coach-effort')?.value ?? 'high';
    const payload = encodeJobPrompt({ model, effort, instructions: '' });
    return submitJob('checkin', payload || null);
  },

  'ask-coach': () => {
    const model = el('coach-model')?.value ?? 'opus';
    const effort = el('coach-effort')?.value ?? 'high';
    sheet(askSheet(model, effort));
  },

  'submit-ask': () => {
    const question = el('job-instructions').value.trim();
    const model = el('ask-model')?.value ?? 'opus';
    const effort = el('ask-effort')?.value ?? 'high';
    closeSheet();
    if (!question) {
      toast('Nothing to ask');
      return;
    }
    return submitJob('ask', encodeJobPrompt({ model, effort, instructions: question }));
  },
};
