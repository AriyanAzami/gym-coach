/* Settings: the rules, the manual, the exercise library, and the way out.

   The rules document is the whole coaching policy, so editing it is the most
   consequential thing in the app. Nothing is saved that does not validate, every
   save is a new version, and rolling back is itself a new version — history is
   never rewritten, because the coach's old decisions were made against old rules
   and that record has to stay readable. */

import * as store from './store.js';
import { h, markdown, toast, sheet, closeSheet, confirm, el, getTheme, setTheme } from './ui.js';
import { nav } from './nav.js';
import { validateRulesWith } from './rules-check.js';

const schema = () => store.state.rulesSchema;

function rulesCard() {
  const current = store.state.rules;
  const version = store.state.rulesVersion;
  const versions = store.state.documents
    .filter((d) => d.key === 'rules')
    .sort((a, b) => b.version - a.version);

  const body = current
    ? JSON.stringify(current, null, 2)
    : '';

  const history = versions.length > 1
    ? `<details style="margin-top:10px"><summary class="small muted">Version history</summary>
        ${versions.map((d) => `<div class="exrow">
          <div class="grow">
            <div class="name">Version ${d.version}${d.version === version ? ' — current' : ''}</div>
            <div class="sub muted">${h(String(d.created_at ?? '').slice(0, 10))}</div>
          </div>
          ${d.version === version ? '' : `<button class="btn sm ghost" data-action="rollback-rules" data-version="${d.version}">Roll back</button>`}
        </div>`).join('')}
      </details>`
    : '';

  return `<div class="card">
    <div class="card-title">
      <h3>Rules</h3>
      <span class="small muted">${version ? `version ${version}` : 'no rules yet'}</span>
    </div>
    <p class="small muted">Every target, cap and minimum the app and the coach obey.
    ${schema() ? '' : 'The schema has not loaded, so a save will be checked on the server only.'}</p>
    ${current ? '' : '<div class="banner warn">There is no rules document yet. Paste one in and save.</div>'}
    <label><textarea id="rules-json" rows="16" spellcheck="false" class="mono">${h(body)}</textarea></label>
    <div id="rules-errors"></div>
    <button class="btn primary full" data-action="save-rules">Save as a new version</button>
    ${history}
  </div>`;
}

function manualCard() {
  return `<div class="card">
    <div class="card-title">
      <h3>Manual</h3>
      <span class="small muted">${store.state.manualVersion ? `version ${store.state.manualVersion}` : 'none'}</span>
    </div>
    <p class="small muted">Prose the coach treats as binding, alongside the rules.</p>
    <label><textarea id="manual-md" rows="10" spellcheck="false">${h(store.state.manual ?? '')}</textarea></label>
    <button class="btn full" data-action="save-manual">Save as a new version</button>
  </div>`;
}

export function exerciseSheet(exercise) {
  const e = exercise ?? {};
  const field = (id, label, value, type = 'text') => `<label>${h(label)}
    <input id="ex-${id}" type="${type}" value="${h(value ?? '')}"></label>`;

  return `<h2>${e.id ? h(e.name) : 'New exercise'}</h2>
    ${field('name', 'Name', e.name)}
    ${field('primary_muscle', 'Primary muscle', e.primary_muscle)}
    ${field('secondary_muscles', 'Secondary muscles (comma separated)', (e.secondary_muscles ?? []).join(', '))}
    ${field('equipment', 'Equipment', e.equipment)}
    <div class="grid2">
      ${field('increment', 'Increment', e.increment, 'number')}
      <label>Unit<select id="ex-unit">
        <option value="lb"${e.unit === 'lb' ? ' selected' : ''}>lb</option>
        <option value="kg"${e.unit === 'kg' ? ' selected' : ''}>kg</option>
      </select></label>
    </div>
    <label>Load mode<select id="ex-load_mode">
      <option value="total"${e.load_mode !== 'per_hand' ? ' selected' : ''}>total</option>
      <option value="per_hand"${e.load_mode === 'per_hand' ? ' selected' : ''}>per hand</option>
    </select></label>
    ${field('movement_tags', 'Movement tags (comma separated)', (e.movement_tags ?? []).join(', '))}
    <label>Cues<textarea id="ex-cues" rows="2">${h(e.cues ?? '')}</textarea></label>
    <label>Coaching flag<input id="ex-flag" type="text" value="${h(e.flag ?? '')}"
      placeholder="left shoulder: stop at 8"></label>
    <label class="row"><input id="ex-active" type="checkbox" style="width:auto;min-height:auto"
      ${e.active === false ? '' : 'checked'}> active</label>
    <div class="grid2">
      <button class="btn ghost" data-sheet="cancel">Cancel</button>
      <button class="btn primary" data-action="save-exercise" data-id="${h(e.id ?? '')}">Save</button>
    </div>`;
}

function exercisesCard() {
  const list = [...store.state.exercises].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return `<div class="card">
    <div class="card-title"><h3>Exercises</h3>
      <button class="btn sm" data-action="new-exercise">Add</button></div>
    ${list.length === 0 ? '<p class="muted small">None yet.</p>' : ''}
    ${list.map((e) => `<button class="exrow" data-action="edit-exercise" data-id="${h(e.id)}">
      <div class="grow">
        <div class="name">${h(e.name)}</div>
        <div class="sub muted">${h(e.primary_muscle)} · ${h(e.equipment)}${e.load_mode === 'per_hand' ? ' · per hand' : ''}</div>
        <div class="sub">
          ${e.active === false ? '<span class="pill">inactive</span>' : ''}
          ${e.flag ? `<span class="pill flag">${h(e.flag)}</span>` : ''}
        </div>
      </div>
      <div class="target small">${h(String(e.increment ?? ''))} ${h(e.unit ?? '')}</div>
    </button>`).join('')}
  </div>`;
}

export function render() {
  const head = `<div class="topbar">
    <div><div class="eyebrow">Your setup</div><h1>Settings</h1></div>
  </div>`;

  const theme = getTheme();
  const appearance = `<div class="card">
    <div class="card-title"><h3>Appearance</h3><span class="small muted">Theme</span></div>
    <div class="grid3">
      <button class="btn sm${theme === 'auto' ? ' on' : ''}" data-action="set-theme" data-theme="auto">System</button>
      <button class="btn sm${theme === 'dark' ? ' on' : ''}" data-action="set-theme" data-theme="dark">Dark</button>
      <button class="btn sm${theme === 'light' ? ' on' : ''}" data-action="set-theme" data-theme="light">Light</button>
    </div>
  </div>`;

  const account = `<div class="card">
    <div class="card-title"><h3>Account</h3></div>
    <p class="small muted">${h(store.state.user?.email ?? 'not signed in')}</p>
    <button class="btn ghost full" data-action="sign-out">Sign out</button>
  </div>`;

  return head + appearance + rulesCard() + manualCard() + exercisesCard() + account;
}

/* The schema is fetched once so the editor can refuse a bad document before it
   ever reaches the database. */
export async function mount() {
  if (store.state.rulesSchema) return;
  try {
    const response = await fetch('./schema/rules.schema.json');
    if (!response.ok) return;
    store.state.rulesSchema = await response.json();
    nav.refresh();
  } catch {
    // Offline: the save path still validates, just without the local schema.
  }
}

function showErrors(errors) {
  const box = el('rules-errors');
  if (!box) return;
  box.innerHTML = errors.length === 0
    ? ''
    : `<div class="banner bad"><b>${errors.length} problem${errors.length === 1 ? '' : 's'}:</b>
        <ul>${errors.slice(0, 12).map((e) => `<li>${h(e)}</li>`).join('')}</ul></div>`;
}

const listOf = (value) => String(value ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/* An omitted or non-positive increment becomes null alongside its unit, so the
   exercises_increment_has_unit constraint holds and the rules default applies. */
export function exerciseRowFromForm(fields) {
  const rawInc = String(fields.increment ?? '').trim();
  const incNum = rawInc === '' ? null : Number(rawInc);
  const hasInc = incNum !== null && Number.isFinite(incNum) && incNum > 0;
  return {
    name: String(fields.name ?? '').trim(),
    primary_muscle: String(fields.primary_muscle ?? '').trim(),
    secondary_muscles: listOf(fields.secondary_muscles),
    equipment: String(fields.equipment ?? '').trim(),
    increment: hasInc ? incNum : null,
    unit: hasInc ? fields.unit : null,
    load_mode: fields.load_mode,
    movement_tags: listOf(fields.movement_tags),
    cues: String(fields.cues ?? '').trim() || null,
    flag: String(fields.flag ?? '').trim() || null,
    active: Boolean(fields.active),
  };
}

export const actions = {
  'save-rules': async () => {
    let parsed;
    try {
      parsed = JSON.parse(el('rules-json').value);
    } catch (err) {
      showErrors([`The document is not valid JSON: ${err.message}`]);
      return;
    }

    const loaded = schema();
    const errors = loaded ? validateRulesWith(parsed, loaded) : [];
    showErrors(errors);
    if (errors.length > 0) {
      toast('Not saved — fix the problems above', 'bad');
      return;
    }

    try {
      await store.saveDocument('rules', parsed);
      toast(`Rules saved as version ${store.state.rulesVersion}`);
      nav.refresh();
    } catch (err) {
      showErrors([err.message ?? String(err)]);
      toast('Could not save the rules', 'bad');
    }
  },

  /* Rolling back writes the old document forward as a new version rather than
     deleting anything, so the history stays a record of what was in force when
     each block was written. */
  'rollback-rules': async (node) => {
    const version = Number(node.dataset.version);
    const doc = store.state.documents.find((d) => d.key === 'rules' && d.version === version);
    if (!doc) return;
    if (!await confirm('Roll back the rules?',
      `Version ${version} is written forward as version ${(store.state.rulesVersion ?? 0) + 1}. Nothing is deleted.`,
      'Roll back')) return;
    await store.saveDocument('rules', doc.body_json);
    toast(`Rolled back to version ${version}`);
    nav.refresh();
  },

  'save-manual': async () => {
    const body = el('manual-md').value;
    if (!body.trim()) {
      toast('The manual is empty', 'bad');
      return;
    }
    await store.saveDocument('manual', body);
    toast(`Manual saved as version ${store.state.manualVersion}`);
    nav.refresh();
  },

  'new-exercise': () => sheet(exerciseSheet(null)),

  'edit-exercise': (node) => {
    const exercise = store.state.exercises.find((e) => e.id === node.dataset.id);
    if (exercise) sheet(exerciseSheet(exercise));
  },

  'save-exercise': async (node) => {
    const row = exerciseRowFromForm({
      name: el('ex-name').value,
      primary_muscle: el('ex-primary_muscle').value,
      secondary_muscles: el('ex-secondary_muscles').value,
      equipment: el('ex-equipment').value,
      increment: el('ex-increment').value,
      unit: el('ex-unit').value,
      load_mode: el('ex-load_mode').value,
      movement_tags: el('ex-movement_tags').value,
      cues: el('ex-cues').value,
      flag: el('ex-flag').value,
      active: el('ex-active').checked,
    });

    if (!row.name || !row.primary_muscle || !row.equipment) {
      toast('Name, muscle and equipment are required', 'bad');
      return;
    }

    const id = node.dataset.id;
    try {
      if (id) await store.write({ table: 'exercises', action: 'update', id, row });
      else await store.write({ table: 'exercises', action: 'insert', row });
      closeSheet();
      await store.load();
      toast('Exercise saved');
      nav.refresh();
    } catch (err) {
      toast(err.message ?? 'Could not save the exercise', 'bad');
    }
  },

  'sign-out': async () => {
    if (!await confirm('Sign out?', 'Anything still waiting to sync will be lost.', 'Sign out', true)) return;
    await store.signOut();
  },

  'set-theme': (node) => {
    setTheme(node.dataset.theme);
    nav.refresh();
  },
};
