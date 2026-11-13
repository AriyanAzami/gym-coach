/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { timer, wakeLock, unlockAudio, playBeep } from '../app/js/ui.js';
import { restFor } from '../app/js/screens-workout.js';

const css = readFileSync('app/css/app.css', 'utf8');
const sw = readFileSync('app/sw.js', 'utf8');
const html = readFileSync('app/index.html', 'utf8');

test('no input, select or textarea rule sets a font-size under 16px', () => {
  assert.ok(!/(html|:root)\s*\{[^}]*font-size:\s*(?!16px)/.test(css), 'root font-size must stay 16px');
  let checked = 0;
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(',').map((s) => s.trim().replace(/^.*\*\//s, '').trim());
    if (!selectors.some((s) => /(^|[\s>+~])(input|select|textarea)\b/.test(s))) continue;
    const fs = m[2].match(/font-size:\s*([\d.]+)(rem|px|em)/);
    if (!fs) continue;
    checked += 1;
    const px = fs[2] === 'px' ? Number(fs[1]) : Number(fs[1]) * 16;
    assert.ok(px >= 16, `${selectors.join(', ')} sets font-size ${fs[0]}`);
  }
  assert.ok(checked >= 1);
});

function fakeDom() {
  const nodes = {};
  const mk = () => ({
    textContent: '', style: {},
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(...cs) { cs.forEach((c) => this.s.delete(c)); }, contains(c) { return this.s.has(c); } },
  });
  for (const id of ['timerbar', 'timer-label', 'timer-time', 'timer-track']) nodes[id] = mk();
  globalThis.document = { getElementById: (id) => nodes[id] };
  return nodes;
}

test('audio helpers are no-ops without AudioContext', () => {
  assert.doesNotThrow(() => { unlockAudio(); playBeep(); });
});

test('timer shows Rest done at zero, then hides', async (t) => {
  const nodes = fakeDom();
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  timer.start(10, 'Rest');
  assert.ok(nodes.timerbar.classList.contains('show'));
  t.mock.timers.tick(10500);
  assert.equal(nodes['timer-label'].textContent, 'Rest done');
  assert.ok(nodes.timerbar.classList.contains('done'));
  assert.ok(nodes.timerbar.classList.contains('show'));
  t.mock.timers.tick(6000);
  assert.ok(!nodes.timerbar.classList.contains('show'));
  assert.ok(!nodes.timerbar.classList.contains('done'));
  delete globalThis.document;
});

test('a new timer clears the done state', (t) => {
  const nodes = fakeDom();
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  timer.start(2);
  t.mock.timers.tick(2500);
  timer.start(60);
  assert.ok(!nodes.timerbar.classList.contains('done'));
  assert.equal(nodes['timer-label'].textContent, 'Rest');
  timer.stop();
  delete globalThis.document;
});

test('wakeLock is a no-op without the API and acquires/releases with it', async () => {
  await wakeLock.hold(() => true);
  wakeLock.release();
  let released = 0;
  const sentinel = { addEventListener() {}, release: async () => { released += 1; } };
  Object.defineProperty(globalThis, 'navigator', { value: { wakeLock: { request: async () => sentinel } }, configurable: true });
  let hold = true;
  await wakeLock.hold(() => hold);
  assert.equal(wakeLock.sentinel, sentinel);
  hold = false;
  await wakeLock.sync();
  assert.equal(released, 1);
  assert.equal(wakeLock.sentinel, null);
  wakeLock.release();
  delete globalThis.navigator;
});

const rules = { session: { rest_s: { compound: 120, isolation: 60 } } };
const EX = [
  { id: 'a', secondary_muscles: ['shoulders'] },
  { id: 'b', secondary_muscles: [] },
];
test('restFor prefers the slot, then the rules table, else null', () => {
  const slots = [{ id: 's1', rest_s: 150 }, { id: 's2' }];
  assert.equal(restFor({ slot_id: 's1', exercise_id: 'b' }, slots, EX, rules), 150);
  assert.equal(restFor({ slot_id: 's2', exercise_id: 'a' }, slots, EX, rules), 120);
  assert.equal(restFor({ slot_id: 's2', exercise_id: 'b' }, slots, EX, rules), 60);
  assert.equal(restFor({ slot_id: 'zz', exercise_id: 'b' }, slots, EX, {}), null);
  assert.equal(restFor(undefined, slots, EX, rules), null);
});

test('service worker ignores the query string for navigations and never caches one', () => {
  assert.match(sw, /mode === 'navigate'/);
  assert.match(sw, /ignoreSearch:\s*true/);
  assert.match(sw, /\.\/index\.html/);
  assert.match(sw, /url\.search/);
});

test('the Google Fonts stylesheet does not block rendering', () => {
  const tag = html.match(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/)[0];
  assert.match(tag, /media="print"/);
  assert.match(tag, /onload="this\.media='all'"/);
  assert.match(html, /<noscript>\s*<link[^>]*fonts\.googleapis\.com\/css2/);
});

test('the done timer has a style', () => {
  assert.match(css, /\.timerbar\.done/);
});
