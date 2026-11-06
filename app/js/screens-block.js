/* Blocks: the active one, any drafts the coach has written, and the buttons
   that ask for a new one or for changes. A draft only becomes real when it is
   activated here. */

import * as store from './store.js';
import { h, markdown, fmtRest, toast, sheet, closeSheet, confirm, el } from './ui.js';
import { nav } from './nav.js';
import { plannedWeeklyVolume } from './engine.js';

const BLOCK_KINDS = ['block', 'revise_block'];

const nameOf = (id) => store.state.exercises.find((e) => e.id === id)?.name ?? 'Unknown exercise';
const detailOf = (blockId) => store.state.blockDetails?.[blockId] ?? null;

const inFlight = () => store.state.jobs.find(
  (j) => BLOCK_KINDS.includes(j.kind) && (j.status === 'queued' || j.status === 'running'),
) ?? null;

function daysView(blockId) {
  const d = detailOf(blockId);
  if (!d) return '<p class="small muted">Loading the plan…</p>';
  if (d.days.length === 0) return '<p class="small muted">This block has no days.</p>';

  return d.days.map((day) => {
    const slots = d.slots
      .filter((s) => s.day_id === day.id)
      .sort((a, b) => a.position - b.position);
    const rows = slots.map((s) => {
      const marks = [
        s.non_negotiable ? '<span class="pill must">non-negotiable</span>' : '',
        s.cut_order !== null && s.cut_order !== undefined ? `<span class="pill">cut ${s.cut_order}</span>` : '',
      ].join(' ');
      return `<div class="exrow">
        <div class="grow">
          <div class="name">${h(nameOf(s.exercise_id))}</div>
          <div class="sub">rest ${fmtRest(s.rest_s)} ${marks}</div>
          ${s.notes ? `<div class="sub muted">${h(s.notes)}</div>` : ''}
        </div>
        <div class="target">${s.sets} &times; ${s.rep_min}-${s.rep_max}</div>
      </div>`;
    }).join('');

    return `<div class="card">
      <div class="card-title">
        <div><div class="eyebrow">Day ${day.day_index + 1}</div><h3>${h(day.name)}</h3></div>
        <span class="small muted">${slots.length} exercises</span>
      </div>
      ${day.warmup_note ? `<p class="small muted">Warm-up: ${h(day.warmup_note)}</p>` : ''}
      ${rows}
    </div>`;
  }).join('');
}

function volumeTable(blockId) {
  const d = detailOf(blockId);
  if (!d) return '';
  const rows = plannedWeeklyVolume({
    days: d.days,
    slots: d.slots,
    exercises: store.state.exercises,
    rules: store.state.rules,
    perWeekRate: store.state.trainingRate?.per_week_4w ?? null,
  });
  if (rows.length === 0) return '';

  const rate = store.state.trainingRate?.per_week_4w;
  const body = rows.map((r) => `<tr class="${r.shortBy > 0 ? 'short' : ''}">
      <td>${h(r.muscle)}</td>
      <td class="n">${r.sets}</td>
      <td class="n">${r.target}</td>
      <td class="n">${r.shortBy > 0 ? `short ${r.shortBy}` : 'met'}</td>
    </tr>`).join('');

  return `<div class="card">
    <div class="card-title"><h3>Weekly sets</h3>
      <span class="small muted">at ${rate ? `${rate}/week` : 'one cycle a week'}</span></div>
    <table class="vol"><thead><tr><th>Muscle</th><th class="n">Planned</th><th class="n">Min</th><th class="n"></th></tr></thead>
    <tbody>${body}</tbody></table>
  </div>`;
}

function jobsView() {
  const jobs = store.state.jobs.filter((j) => BLOCK_KINDS.includes(j.kind)).slice(0, 4);
  if (jobs.length === 0) return '';
  return jobs.map((j) => {
    const kind = j.status === 'failed' ? 'bad' : 'warn';
    const detail = j.status === 'failed' && j.error ? ` — ${h(j.error)}` : '';
    if (j.status === 'done') return '';
    return `<div class="banner ${kind}">Block job ${h(j.status)}${detail}</div>`;
  }).join('');
}

export function generateSheet() {
  return `<h2>Generate a block</h2>
    <p class="small muted">How should the next block be built? Anything you say here
    is binding on the coach, alongside your manual and rules.</p>
    <label>Instructions<textarea id="job-instructions" rows="6"
      placeholder="e.g. four days, more upper back, keep the squat first"></textarea></label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Cancel</button>
      <button class="btn primary" data-action="submit-generate">Ask the coach</button>
    </div>`;
}

export function reviseSheet(block) {
  return `<h2>Request changes</h2>
    <p class="small muted">What should change about ${h(block.name)}?</p>
    <label>Comment<textarea id="job-instructions" rows="6"
      placeholder="e.g. swap the leg press for a hack squat, add a set of rows"></textarea></label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Cancel</button>
      <button class="btn primary" data-action="submit-revise" data-id="${h(block.id)}">Send</button>
    </div>`;
}

export function render() {
  const { activeBlock, blocks } = store.state;
  const drafts = blocks.filter((b) => b.status === 'draft');
  const busy = inFlight();

  const head = `<div class="topbar">
    <div><div class="eyebrow">Programme</div><h1>Block</h1></div>
    <button class="btn sm" data-action="generate-block"${busy ? ' disabled' : ''}>Generate</button>
  </div>`;

  if (!activeBlock && drafts.length === 0) {
    return `${head}${jobsView()}
      <div class="card">
        <h2>No block yet</h2>
        <p class="muted">Ask the coach to write one. It arrives as a draft you can
        read, comment on, and activate when you are happy with it.</p>
        <button class="btn primary full" data-action="generate-block"${busy ? ' disabled' : ''}>Generate a block</button>
      </div>`;
  }

  const draftCards = drafts.map((b) => `<div class="card">
      <div class="card-title">
        <div><div class="eyebrow">Draft</div><h2>${h(b.name)}</h2></div>
      </div>
      ${b.rationale ? markdown(b.rationale) : '<p class="muted small">No rationale given.</p>'}
    </div>
    ${volumeTable(b.id)}
    ${daysView(b.id)}
    <div class="row wrap" style="margin-bottom:18px">
      <button class="btn primary" data-action="activate-block" data-id="${h(b.id)}">Activate</button>
      <button class="btn" data-action="request-changes" data-id="${h(b.id)}">Request changes</button>
      <button class="btn ghost danger" data-action="discard-block" data-id="${h(b.id)}">Discard</button>
    </div>`).join('');

  const activeCard = activeBlock
    ? `<div class="card">
        <div class="card-title">
          <div><div class="eyebrow">Active</div><h2>${h(activeBlock.name)}</h2></div>
          <span class="small muted">${h(activeBlock.starts_on ?? '')}${activeBlock.ends_on ? ` → ${h(activeBlock.ends_on)}` : ''}</span>
        </div>
        ${activeBlock.rationale ? markdown(activeBlock.rationale) : ''}
      </div>
      ${volumeTable(activeBlock.id)}
      ${daysView(activeBlock.id)}`
    : '';

  return head + jobsView() + draftCards + activeCard;
}

/* Drafts are not part of the main load, so their days and slots come in when
   this screen opens. */
export async function mount() {
  const wanted = store.state.blocks
    .filter((b) => b.status !== 'archived')
    .map((b) => b.id)
    .filter((id) => !store.state.blockDetails?.[id]);
  if (wanted.length === 0) return;

  store.state.blockDetails ??= {};
  for (const id of wanted) {
    store.state.blockDetails[id] = await store.loadBlockDetail(id);
  }
  nav.refresh();
}

async function submit(kind, targetBlockId) {
  const instructions = el('job-instructions').value.trim();
  closeSheet();
  try {
    await store.dispatchJob(kind, instructions, targetBlockId);
    toast('Sent to the coach');
  } catch (err) {
    toast(err.message ?? 'Could not send the job', 'bad');
  }
  nav.refresh();
}

export const actions = {
  'generate-block': () => sheet(generateSheet()),

  'request-changes': (node) => {
    const block = store.state.blocks.find((b) => b.id === node.dataset.id);
    if (block) sheet(reviseSheet(block));
  },

  'submit-generate': () => submit('block', null),
  'submit-revise': (node) => submit('revise_block', node.dataset.id),

  /* Archiving the old block first keeps the one-active-block index satisfied;
     if it rejects the activation, the archive is rolled back by hand so the
     owner is never left with no active block. */
  'activate-block': async (node) => {
    const id = node.dataset.id;
    const previous = store.state.activeBlock;
    if (!await confirm('Activate this block?',
      previous ? `${previous.name} will be archived.` : 'It becomes the block Today reads from.',
      'Activate')) return;

    try {
      if (previous) {
        await store.write({ table: 'blocks', action: 'update', id: previous.id, row: { status: 'archived' } });
      }
      await store.write({ table: 'blocks', action: 'update', id, row: { status: 'active' } });
      await store.load();
      store.state.blockDetails = {};
      await mount();
      toast('Block activated');
    } catch (err) {
      if (previous) {
        await store.write({ table: 'blocks', action: 'update', id: previous.id, row: { status: 'active' } })
          .catch(() => {});
      }
      toast(err.message ?? 'Could not activate the block', 'bad');
    }
    nav.refresh();
  },

  'discard-block': async (node) => {
    if (!await confirm('Discard this draft?', 'It cannot be recovered.', 'Discard', true)) return;
    await store.write({ table: 'blocks', action: 'delete', id: node.dataset.id });
    await store.load();
    toast('Draft discarded');
    nav.refresh();
  },
};
