/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ymd, isoWeekStart, addDays, nextDayIndex, sessionComplete,
  volumeVsTarget, projectWeeklySets,
} from '../app/js/engine.js';

const rules = {
  volume: {
    min_weekly_sets: { default: 8, by_muscle: { chest: 10 } },
    indirect_factor: 0.5,
    count_over: 'calendar_week_at_observed_rate',
  },
  priority: ['back', 'chest', 'shoulders', 'legs'],
  rotation: { complete_fraction: 0.6, gap_flag_days: 10 },
};

// ---- dates: the phone is in a local timezone, the database stores a date ----

test('ymd reads the local calendar date just after midnight', () => {
  assert.equal(ymd(new Date(2026, 2, 1, 0, 30)), '2026-03-01');
});

test('ymd reads the local calendar date just before midnight', () => {
  assert.equal(ymd(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('ymd never shifts a day the way an ISO string would', () => {
  // getTimezoneOffset() is minutes behind UTC, so it is negative east of UTC.
  // East of UTC the 00:30 case shifts back a day under toISOString; west of UTC
  // the 23:59 case shifts forward. One of the two always proves the difference.
  const early = new Date(2026, 2, 1, 0, 30);
  const late = new Date(2026, 11, 31, 23, 59);
  const offset = early.getTimezoneOffset();
  if (offset < 0) assert.notEqual(ymd(early), early.toISOString().slice(0, 10));
  else if (offset > 0) assert.notEqual(ymd(late), late.toISOString().slice(0, 10));
  else assert.equal(ymd(early), early.toISOString().slice(0, 10));
});

test('ymd pads single-digit months and days', () => {
  assert.equal(ymd(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
});

test('isoWeekStart returns Monday for every day of one week', () => {
  // 2026-11-02 is a Monday.
  for (const [date, monday] of [
    ['2026-11-02', '2026-11-02'],
    ['2026-11-03', '2026-11-02'],
    ['2026-11-04', '2026-11-02'],
    ['2026-11-05', '2026-11-02'],
    ['2026-11-06', '2026-11-02'],
    ['2026-11-07', '2026-11-02'],
    ['2026-11-08', '2026-11-02'],
  ]) {
    assert.equal(isoWeekStart(date), monday, `${date} should map to ${monday}`);
  }
});

test('isoWeekStart starts a new week on the next Monday', () => {
  assert.equal(isoWeekStart('2026-11-09'), '2026-11-09');
});

test('isoWeekStart crosses a year boundary', () => {
  assert.equal(isoWeekStart('2027-01-01'), '2026-12-28');
});

test('addDays crosses a month boundary', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
});

test('addDays goes backwards', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

// ---- rotation ----

test('nextDayIndex advances by one', () => {
  assert.equal(nextDayIndex({ lastCompleteIndex: 0, dayCount: 3 }), 1);
});

test('nextDayIndex wraps at the last day', () => {
  assert.equal(nextDayIndex({ lastCompleteIndex: 2, dayCount: 3 }), 0);
});

test('nextDayIndex with no history is day 0', () => {
  assert.equal(nextDayIndex({ lastCompleteIndex: null, dayCount: 3 }), 0);
});

test('nextDayIndex returns null for a block with no days', () => {
  assert.equal(nextDayIndex({ lastCompleteIndex: null, dayCount: 0 }), null);
  assert.equal(nextDayIndex({ lastCompleteIndex: 2, dayCount: 0 }), null);
});

test('nextDayIndex survives a stale index beyond the day count', () => {
  assert.equal(nextDayIndex({ lastCompleteIndex: 9, dayCount: 3 }), 1);
});

// ---- session completeness ----

test('sessionComplete is true when every slot is logged', () => {
  assert.equal(sessionComplete({ slotCount: 3, loggedSlotPositions: [0, 1, 2], rules }), true);
});

test('sessionComplete is false when the first slot is unlogged', () => {
  assert.equal(sessionComplete({ slotCount: 3, loggedSlotPositions: [1, 2], rules }), false);
});

test('sessionComplete uses complete_fraction from the rules', () => {
  // 2 of 3 is 0.67, which clears 0.6
  assert.equal(sessionComplete({ slotCount: 3, loggedSlotPositions: [0, 1], rules }), true);
  // 1 of 3 is 0.33, which does not
  assert.equal(sessionComplete({ slotCount: 3, loggedSlotPositions: [0], rules }), false);
});

test('a stricter complete_fraction rejects what a looser one accepts', () => {
  const strict = structuredClone(rules);
  strict.rotation.complete_fraction = 0.9;
  assert.equal(sessionComplete({ slotCount: 3, loggedSlotPositions: [0, 1], rules: strict }), false);
});

test('sessionComplete is false for a day with no slots', () => {
  assert.equal(sessionComplete({ slotCount: 0, loggedSlotPositions: [], rules }), false);
});

test('sessionComplete ignores duplicate logged positions', () => {
  assert.equal(sessionComplete({ slotCount: 3, loggedSlotPositions: [0, 0, 0], rules }), false);
});

test('sessionComplete falls back to a usable default with no rules', () => {
  assert.equal(sessionComplete({ slotCount: 2, loggedSlotPositions: [0, 1], rules: null }), true);
});

// ---- volume ----

test('volumeVsTarget reports the shortfall per priority muscle', () => {
  const weeklyVolume = [
    { muscle: 'back', total_sets: 12 },
    { muscle: 'chest', total_sets: 6 },
    { muscle: 'shoulders', total_sets: 8 },
  ];
  assert.deepEqual(volumeVsTarget({ weeklyVolume, rules }), [
    { muscle: 'back', sets: 12, target: 8, shortBy: 0 },
    { muscle: 'chest', sets: 6, target: 10, shortBy: 4 },
    { muscle: 'shoulders', sets: 8, target: 8, shortBy: 0 },
    { muscle: 'legs', sets: 0, target: 8, shortBy: 8 },
  ]);
});

test('volumeVsTarget keeps priority order, not the order of the rows', () => {
  const weeklyVolume = [{ muscle: 'legs', total_sets: 9 }, { muscle: 'back', total_sets: 9 }];
  assert.deepEqual(volumeVsTarget({ weeklyVolume, rules }).map((r) => r.muscle),
    ['back', 'chest', 'shoulders', 'legs']);
});

test('volumeVsTarget lists a trained muscle that is not in priority, after the rest', () => {
  const weeklyVolume = [{ muscle: 'forearms', total_sets: 4 }];
  const rows = volumeVsTarget({ weeklyVolume, rules });
  assert.equal(rows.at(-1).muscle, 'forearms');
  assert.equal(rows.at(-1).target, 8, 'the default minimum applies');
});

test('volumeVsTarget with no rules document returns an empty list, not NaN', () => {
  assert.deepEqual(volumeVsTarget({ weeklyVolume: [{ muscle: 'back', total_sets: 9 }], rules: null }), []);
});

test('volumeVsTarget with no logged volume still reports every target', () => {
  const rows = volumeVsTarget({ weeklyVolume: [], rules });
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.sets === 0 && r.shortBy === r.target));
});

test('projectWeeklySets multiplies per-session sets by the observed rate', () => {
  assert.equal(projectWeeklySets(4, 2.5), 10);
});

test('projectWeeklySets with no observed rate yet returns null', () => {
  assert.equal(projectWeeklySets(4, null), null);
  assert.equal(projectWeeklySets(4, 0), null);
});
