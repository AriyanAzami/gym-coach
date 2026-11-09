/* All values below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionForDate } from '../app/js/screens-progress.js';
import { singleFlight } from '../app/js/ui.js';

const s = (id, date, status, kind = 'training') => ({ id, date, status, kind });

test('a day with an empty planned twin opens the session that was actually done', () => {
  const list = [s('twin', '2026-11-08', 'planned'), s('real', '2026-11-08', 'done'), s('x', '2026-11-07', 'done')];
  assert.equal(sessionForDate(list, '2026-11-08').id, 'real');
  assert.equal(sessionForDate([...list].reverse(), '2026-11-08').id, 'real');
});

test('done beats partial beats rest beats planned beats skipped', () => {
  const d = '2026-11-01';
  assert.equal(sessionForDate([s('p', d, 'partial'), s('d', d, 'done')], d).id, 'd');
  assert.equal(sessionForDate([s('pl', d, 'planned'), s('pa', d, 'partial')], d).id, 'pa');
  assert.equal(sessionForDate([s('sk', d, 'skipped'), s('pl', d, 'planned')], d).id, 'pl');
  assert.equal(sessionForDate([s('sk', d, 'skipped'), s('r', d, 'done', 'rest')], d).id, 'r');
});

test('a day with nothing logged has no session', () => {
  assert.equal(sessionForDate([s('a', '2026-11-01', 'done')], '2026-11-02'), null);
});

test('a second tap while the first is still running does nothing', async () => {
  let calls = 0;
  let release;
  const slow = () => { calls += 1; return new Promise((r) => { release = r; }); };
  const guarded = singleFlight(slow);
  const first = guarded();
  const second = guarded();
  assert.equal(calls, 1);
  release('ok');
  assert.equal(await first, 'ok');
  assert.equal(await second, 'ok');
  const third = guarded();
  assert.equal(calls, 2, 'once the first finishes, a new tap runs again');
  release('again');
  assert.equal(await third, 'again');
});

test('earlier screenshots: small copies are read as they are, big originals get shrunk first', async () => {
  const { planEarlierShots } = await import('../app/js/screens-workout.js');
  const big = [{ name: 'watch-1-1.png', metadata: { size: 2809928 } }, { name: 'watch-2-1.png', metadata: { size: 1998122 } }];
  assert.deepEqual(planEarlierShots('u/s', big), { read: [], shrink: ['u/s/watch-1-1.png', 'u/s/watch-2-1.png'] });
  const withCopies = [...big, { name: 'watch-3-1.jpg', metadata: { size: 150000 } }];
  assert.deepEqual(planEarlierShots('u/s', withCopies), { read: ['u/s/watch-3-1.jpg'], shrink: [] });
  assert.deepEqual(planEarlierShots('u/s', [{ name: '.emptyFolderPlaceholder', metadata: { size: 0 } }]), { read: [], shrink: [] });
});

test('the finish sheet has a place to offer screenshots uploaded earlier', async () => {
  const { finishSheet } = await import('../app/js/screens-workout.js');
  assert.match(finishSheet({ id: 's1', date: '2026-11-08' }), /id="f-earlier-shots"/);
});
