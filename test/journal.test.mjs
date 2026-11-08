/* All content below is fabricated. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state } from '../app/js/store.js';
import { encodeJobPrompt, parseJobPrompt, extractJobMeta } from '../app/js/ui.js';
import { render, journalJobs, isJournalJob } from '../app/js/screens-journal.js';
import { render as renderCoach } from '../app/js/screens-coach.js';
import { parseJobInstructions, buildContext, buildJournalHistory } from '../coach/context.mjs';
import { journalWrites } from '../coach/save.mjs';
import rulesExample from '../supabase/seed/rules.example.json' with { type: 'json' };

const prompt = (over = {}) => encodeJobPrompt({ model: 'sonnet', effort: 'low', mode: 'journal', instructions: 'how is my squat?', ...over });

test('a journal prompt round-trips its mode and write flag', () => {
  const raw = prompt({ write: true });
  assert.match(raw, /^\[model=sonnet effort=low mode=journal write=1\]/);
  const back = parseJobPrompt(raw);
  assert.equal(back.mode, 'journal');
  assert.equal(back.write, true);
  assert.equal(back.text, 'how is my squat?');
});

test('a prompt without a mode is not a journal prompt', () => {
  const back = parseJobPrompt(encodeJobPrompt({ instructions: 'hello' }));
  assert.equal(back.mode, null);
  assert.equal(back.write, false);
});

test('job meta exposes mode and write', () => {
  const meta = extractJobMeta({ instructions: prompt({ write: true }), output_md: 'ok', status: 'done' });
  assert.equal(meta.mode, 'journal');
  assert.equal(meta.write, true);
});

test('the Action reads mode and write out of the instructions', () => {
  const p = parseJobInstructions(prompt({ write: true }));
  assert.equal(p.mode, 'journal');
  assert.equal(p.write, true);
  assert.equal(p.model, 'sonnet');
  assert.equal(p.instructions, 'how is my squat?');
  const plain = parseJobInstructions('[model=opus effort=high]\nhello');
  assert.equal(plain.mode, null);
  assert.equal(plain.write, false);
});

const ctxData = () => ({
  documents: [], exercises: [], sessions: [], sets: [], sessionExercises: [],
  liftState: [], weeklyVolume: [], trainingRate: null, bodyTrend: [], blocks: [],
  days: [], slots: [], decisions: [],
  notes: [{ id: 'n-1', body: 'tight hip', consumed_by_job: null, created_at: '2026-11-01T00:00:00Z' }],
  journal: [],
});

test('a journal turn carries its history and never spends the field notes', () => {
  const data = ctxData();
  data.journal = [{ id: 'j-0', status: 'done', created_at: '2026-11-02T00:00:00Z', instructions: prompt({ instructions: 'first question' }), output_md: '<!-- coach-meta: {"model":"opus"} -->\nfirst answer' }];
  const ctx = buildContext(data, { id: 'j-1', kind: 'ask', instructions: prompt() });
  assert.equal(ctx.job.mode, 'journal');
  assert.deepEqual(ctx.journal_history, [{ asked_at: '2026-11-02T00:00:00Z', question: 'first question', answer: 'first answer' }]);
  assert.deepEqual(ctx.consumed_note_ids, []);
  assert.equal(ctx.coach_notes.length, 1);
});

test('an ordinary ask still spends the field notes and has no history', () => {
  const ctx = buildContext(ctxData(), { id: 'j-1', kind: 'ask', instructions: '[model=opus effort=high]\nhi' });
  assert.deepEqual(ctx.consumed_note_ids, ['n-1']);
  assert.equal(ctx.journal_history, undefined);
});

test('history is oldest first, skips the current turn and unfinished turns, and trims long answers', () => {
  const mk = (id, at, status, out) => ({ id, status, created_at: at, instructions: prompt({ instructions: id }), output_md: out });
  const hist = buildJournalHistory([
    mk('b', '2026-11-03T00:00:00Z', 'done', 'B'),
    mk('a', '2026-11-02T00:00:00Z', 'done', 'x'.repeat(9000)),
    mk('c', '2026-11-04T00:00:00Z', 'failed', null),
    mk('now', '2026-11-05T00:00:00Z', 'running', null),
  ], 'now');
  assert.deepEqual(hist.map((h) => h.question), ['a', 'b']);
  assert.ok(hist[0].answer.length < 9000);
});

const writeCtx = (write) => ({ job: { mode: 'journal', write } });

test('journal writes are ignored unless the owner allowed changes', () => {
  const raw = { notes: ['keep an eye on the hip'], decisions: [{ title: 'Drop lunges', body: 'knee' }] };
  assert.deepEqual(journalWrites(raw, writeCtx(false)), { notes: [], decisions: [] });
  assert.deepEqual(journalWrites(raw, { job: { mode: null, write: true } }), { notes: [], decisions: [] });
});

test('allowed journal writes are cleaned, bounded and limited to notes and decisions', () => {
  const out = journalWrites({
    notes: ['  hip  ', '', 7, 'n'.repeat(5000)],
    decisions: [{ title: 'Drop lunges', body: 'knee' }, { title: '' }, { title: 't', body: null }],
    sessions: [{ id: 'x' }],
    sql: 'drop table sets',
  }, writeCtx(true));
  assert.equal(out.notes[0], 'hip');
  assert.equal(out.notes.length, 2);
  assert.ok(out.notes[1].length <= 1000);
  assert.deepEqual(out.decisions, [{ title: 'Drop lunges', body: 'knee' }, { title: 't', body: null }]);
  assert.deepEqual(Object.keys(out).sort(), ['decisions', 'notes']);
  assert.deepEqual(journalWrites('nonsense', writeCtx(true)), { notes: [], decisions: [] });
});

function reset(over = {}) {
  Object.assign(state, {
    user: { id: 'u-1' }, loaded: true, online: true, pendingWrites: 0,
    rules: structuredClone(rulesExample),
    notes: [], decisions: [],
    jobs: [],
    journal: [],
    ...over,
  });
}
beforeEach(() => reset());

const turn = (over = {}) => ({
  id: 'j-1', kind: 'ask', status: 'done', created_at: '2026-11-04T09:00:00Z',
  instructions: prompt(), output_md: 'ok', ...over,
});

test('an empty journal explains itself and offers the composer', () => {
  const html = render();
  assert.match(html, /<h1>Journal<\/h1>/);
  assert.match(html, /nothing here yet/i);
  assert.match(html, /id="journal-input"/);
  assert.match(html, /data-action="journal-send"/);
});

test('the composer offers both models, every effort and an explicit write switch', () => {
  const html = render();
  assert.match(html, /id="journal-model"[\s\S]*value="opus"[\s\S]*value="sonnet"/);
  for (const e of ['low', 'medium', 'high', 'max']) {
    assert.match(html, new RegExp(`id="journal-effort"[\\s\\S]*value="${e}"`));
  }
  assert.match(html, /id="journal-write"/);
  assert.doesNotMatch(html, /id="journal-write"[^>]*checked/, 'read-only must be the default');
});

test('turns show oldest first with the question and a markdown answer', () => {
  reset({
    journal: [
      turn({ id: 'j-2', created_at: '2026-11-05T09:00:00Z', instructions: prompt({ instructions: 'second one' }), output_md: 'Answer **two**' }),
      turn({ id: 'j-1', instructions: prompt({ instructions: 'first one' }), output_md: 'Answer one' }),
    ],
  });
  const html = render();
  assert.ok(html.indexOf('first one') < html.indexOf('second one'));
  assert.match(html, /<strong>two<\/strong>/);
});

test('a pending turn disables sending; a failed one shows its error', () => {
  reset({ journal: [turn({ status: 'running', output_md: null })] });
  assert.match(render(), /data-action="journal-send" disabled/);
  reset({ journal: [turn({ status: 'failed', error: 'context build failed', output_md: null })] });
  const html = render();
  assert.match(html, /context build failed/);
  assert.doesNotMatch(html, /data-action="journal-send" disabled/);
});

test('a question is HTML-escaped', () => {
  reset({ journal: [turn({ instructions: prompt({ instructions: '<img src=x onerror=alert(1)>' }) })] });
  const html = render();
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test('a write-enabled turn is labelled', () => {
  reset({ journal: [turn({ instructions: prompt({ write: true }) })] });
  assert.match(render(), /changes allowed/i);
});

test('journal turns are told apart from ordinary questions', () => {
  assert.equal(isJournalJob({ instructions: prompt() }), true);
  assert.equal(isJournalJob({ instructions: '[model=opus effort=high]\nhi' }), false);
  assert.equal(journalJobs([{ instructions: prompt() }, { instructions: 'plain' }]).length, 1);
});

test('the Coach screen leaves journal turns to the Journal', () => {
  reset({ jobs: [turn({ instructions: prompt({ instructions: 'private chat' }), output_md: 'journal answer' })] });
  assert.doesNotMatch(renderCoach(), /journal answer/);
});

test('the Journal tab is wired into the shell', () => {
  assert.match(readFileSync('app/index.html', 'utf8'), /data-tab="journal"/);
  assert.match(readFileSync('app/js/app.js', 'utf8'), /screens-journal\.js/);
  assert.match(readFileSync('app/sw.js', 'utf8'), /\.\/js\/screens-journal\.js/);
  assert.match(readFileSync('.github/workflows/coach.yml', 'utf8'), /journal/);
});
