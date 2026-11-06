/* Coach: notes, check-ins, questions, and what the coach has said back.

   A note is not a job. It is written down the moment it occurs to you — in the
   gym, mid-set — and the next job that runs picks up every note nobody has used
   yet. That is why notes cost nothing and jobs are deliberate. */

import * as store from './store.js';
import { h, markdown, fmtDate, toast, sheet, closeSheet, el } from './ui.js';
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

export function askSheet() {
  return `<h2>Ask the coach</h2>
    <p class="small muted">Answered from your logged data — your sessions, your
    rules, your manual. It does not change your block.</p>
    <label>Question<textarea id="job-instructions" rows="5"
      placeholder="e.g. is my bench actually moving, or am I just adding reps?"></textarea></label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Cancel</button>
      <button class="btn primary" data-action="submit-ask">Ask</button>
    </div>`;
}

function notesCard() {
  const waiting = store.state.notes.filter((n) => !n.consumed_by_job);
  const used = store.state.notes.filter((n) => n.consumed_by_job).slice(0, 8);

  const row = (n, tag) => `<div class="exrow">
      <div class="grow">
        <div class="sub">${h(n.body)}</div>
        <div class="sub muted">${when(n.created_at)}${tag}</div>
      </div>
    </div>`;

  return `<div class="card">
    <div class="card-title"><h3>Notes</h3>
      <span class="small muted">${waiting.length} waiting</span></div>
    <p class="small muted">Anything the coach should know next time it plans.</p>
    <label><textarea id="note-body" rows="3" placeholder="e.g. knee felt off on the leg press"></textarea></label>
    <button class="btn full" data-action="add-note">Add note</button>
    ${waiting.map((n) => row(n, ' · <span class="pill flag">waiting</span>')).join('')}
    ${used.length ? `<details style="margin-top:10px"><summary class="small muted">Already used</summary>
      ${used.map((n) => row(n, '')).join('')}</details>` : ''}
  </div>`;
}

function askCard() {
  return `<div class="card">
    <div class="card-title"><h3>Ask the coach</h3></div>
    <p class="small muted">A check-in reports where you are. A question is answered
    from the same data.</p>
    <div class="grid2">
      <button class="btn" data-action="checkin"${busyWith('checkin') ? ' disabled' : ''}>Check-in</button>
      <button class="btn" data-action="ask-coach"${busyWith('ask') ? ' disabled' : ''}>Ask a question</button>
    </div>
  </div>`;
}

function jobsCard() {
  const jobs = store.state.jobs.filter((j) => COACH_KINDS.includes(j.kind)).slice(0, 12);
  if (jobs.length === 0) return '';

  return jobs.map((j) => {
    const title = j.kind === 'checkin' ? 'Check-in' : 'Question';
    if (j.status === 'done') {
      return `<div class="card">
        <div class="card-title"><h3>${title}</h3><span class="small muted">${when(j.created_at)}</span></div>
        ${j.instructions ? `<p class="small muted">You asked: ${h(j.instructions)}</p>` : ''}
        ${j.output_md ? markdown(j.output_md) : '<p class="muted small">No output.</p>'}
      </div>`;
    }
    if (j.status === 'failed') {
      return `<div class="banner bad">${title} failed — ${h(j.error ?? 'no reason given')}</div>`;
    }
    return `<div class="banner warn">${title} ${h(j.status)}…</div>`;
  }).join('');
}

function decisionsCard() {
  const decisions = store.state.decisions.slice(0, 8);
  if (decisions.length === 0) return '';
  return `<div class="card">
    <div class="card-title"><h3>Decisions</h3></div>
    ${decisions.map((d) => `<div class="exrow">
      <div class="grow">
        <div class="name">${h(d.title)}</div>
        <div class="sub muted">${h(d.date)}</div>
        ${d.body ? `<div class="sub">${h(d.body)}</div>` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}

export function render() {
  const head = `<div class="topbar">
    <div><div class="eyebrow">Between blocks</div><h1>Coach</h1></div>
  </div>`;
  return head + notesCard() + askCard() + jobsCard() + decisionsCard();
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

  'checkin': () => submitJob('checkin', null),

  'ask-coach': () => sheet(askSheet()),

  'submit-ask': () => {
    const question = el('job-instructions').value.trim();
    closeSheet();
    if (!question) {
      toast('Nothing to ask');
      return;
    }
    return submitJob('ask', question);
  },
};
