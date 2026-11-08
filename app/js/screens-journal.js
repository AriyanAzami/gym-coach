/* Journal: one running conversation with the coach.

   Each message is an `ask` job tagged mode=journal, so the whole history lives
   in ai_jobs behind row-level security. The Action gives the model every logged
   session plus the earlier turns, so it can pick the thread back up. Reading is
   the default; a turn can change notes, decisions, rules or the manual only when
   the owner switches changes on for that message. */

import * as store from './store.js';
import {
  h, cleanText, markdown, fmtDate, fmtDuration, fmtTokens,
  extractJobMeta, encodeJobPrompt, parseJobPrompt, toast, el,
} from './ui.js';
import { nav } from './nav.js';

export const isJournalJob = (job) => parseJobPrompt(job?.instructions).mode === 'journal';
export const journalJobs = (jobs) => jobs.filter(isJournalJob);

const when = (iso) => {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.valueOf())) return '';
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return fmtDate(day);
};

const turnsOldestFirst = () => [...journalJobs(store.state.journal ?? [])]
  .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

const pending = (turns) => turns.some((t) => t.status === 'queued' || t.status === 'running');

function chips(meta) {
  return [
    `<span class="meta-chip accent"><b>Model</b> ${h(meta.modelLabel)}</span>`,
    `<span class="meta-chip"><b>Effort</b> ${h(meta.effortLabel)}</span>`,
    meta.write ? '<span class="meta-chip warn"><b>Changes allowed</b></span>' : '',
    meta.durationS != null ? `<span class="meta-chip"><b>Thinking time</b> ${h(fmtDuration(meta.durationS))}</span>` : '',
    meta.totalTokens != null ? `<span class="meta-chip"><b>Tokens</b> ${h(fmtTokens(meta.totalTokens))}</span>` : '',
  ].filter(Boolean).join('');
}

function turnHtml(job) {
  const meta = extractJobMeta(job);
  const asked = `<div class="card">
      <div class="card-title"><h3>You</h3><span class="small muted">${when(job.created_at)}</span></div>
      <div class="sub" style="white-space:pre-wrap">${cleanText(meta.question)}</div>
    </div>`;

  let reply;
  if (job.status === 'done') {
    reply = `<div class="card">
      <div class="card-title"><h3>Coach</h3></div>
      <div class="meta-bar">${chips(meta)}</div>
      ${meta.body ? markdown(meta.body) : '<p class="muted small">No reply.</p>'}
    </div>`;
  } else if (job.status === 'failed') {
    reply = `<div class="banner bad"><b>No reply</b> (${h(meta.modelLabel)}) — ${h(job.error ?? 'no reason given')}</div>`;
  } else {
    reply = `<div class="banner warn"><b>Thinking…</b> ${h(meta.modelLabel)} · ${h(meta.effortLabel)} effort${meta.write ? ' · changes allowed' : ''}</div>`;
  }
  return asked + reply;
}

function composer(busy) {
  return `<div class="card">
    <label>Message<textarea id="journal-input" rows="4"
      placeholder="Ask anything, or just talk it through. The coach has your whole log."></textarea></label>
    <div class="grid2">
      <label>Model
        <select id="journal-model">
          <option value="opus" selected>Claude Opus 5.5</option>
          <option value="sonnet">Claude Sonnet 5</option>
        </select>
      </label>
      <label>Effort
        <select id="journal-effort">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high" selected>High</option>
          <option value="max">Max</option>
        </select>
      </label>
    </div>
    <label class="row small" style="margin:6px 0 10px">
      <input type="checkbox" id="journal-write" style="width:auto;min-height:auto">
      Allow changes to notes, decisions, rules and manual for this message
    </label>
    <button class="btn primary full" data-action="journal-send"${busy ? ' disabled' : ''}>${busy ? 'Waiting for the coach…' : 'Send'}</button>
  </div>`;
}

export function render() {
  const turns = turnsOldestFirst();
  const head = `<div class="topbar">
    <div><div class="eyebrow">Talk it through</div><h1>Journal</h1></div>
    <div class="small muted">${turns.length} ${turns.length === 1 ? 'message' : 'messages'}</div>
  </div>`;

  const body = turns.length === 0
    ? `<div class="card"><h2>Nothing here yet</h2>
        <p class="muted">A running conversation with your coach. It reads everything you have
        logged and remembers what you said before. It only reads unless you allow changes.</p></div>`
    : turns.map(turnHtml).join('');

  return head + body + composer(pending(turns));
}

export const actions = {
  'journal-send': async () => {
    const text = el('journal-input').value.trim();
    if (!text) {
      toast('Nothing to send');
      return;
    }
    const model = el('journal-model')?.value ?? 'opus';
    const effort = el('journal-effort')?.value ?? 'high';
    const write = Boolean(el('journal-write')?.checked);
    try {
      await store.dispatchJob('ask', encodeJobPrompt({ model, effort, mode: 'journal', write, instructions: text }), null);
      toast('Sent to the coach');
    } catch (err) {
      toast(err.message ?? 'Could not send', 'bad');
    }
    nav.refresh();
  },
};
