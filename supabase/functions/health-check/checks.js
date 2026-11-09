/* Deterministic health checks: plain data in, a list of findings out. Runs in
   the health-check edge function and under node --test. Every coaching
   threshold is read from the rules document.

   engine.js and rules-check.js beside this file are byte-identical copies of
   the app's, because a deployed edge function can only import its own folder.
   test/health-function.test.mjs fails if they drift. */

import { toUnit, volumeVsTarget, isoWeekStart, addDays } from './engine.js';
import { validateRulesWith } from './rules-check.js';

const LB_PER_KG = toUnit(1, 'kg', 'lb');
const SLIP_TOLERANCE = 0.08;

// coach.yml times out at 25 minutes; anything older than this never finishes.
const JOB_STUCK_MINUTES = 30;
const FAILED_JOB_WINDOW_DAYS = 7;

const CADENCE_DAYS = { daily: 1, weekly: 7, biweekly: 14 };

const finding = (area, severity, code, title, detail) => ({ area, severity, code, title, detail });

const utcDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const daysBetween = (from, to) => Math.round((utcDay(to) - utcDay(from)) / 86400000);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function trainingChecks(d) {
  const { rules, today } = d;
  const out = [];

  if (!d.activeBlock) {
    out.push(finding('training', 'warn', 'no_active_block', 'No active block',
      'There is no active block, so the Today screen has nothing to plan from.'));
  }

  const lastWeek = addDays(isoWeekStart(today), -7);
  const weekRows = (d.weeklyVolume ?? []).filter((r) => r.week_start === lastWeek);
  const short = volumeVsTarget({ weeklyVolume: weekRows, rules }).filter((r) => r.shortBy > 0);
  if (short.length > 0) {
    out.push(finding('training', 'warn', 'volume_short', 'Last week was short on volume',
      `Week of ${lastWeek}: ${short.map((r) => `${r.muscle} ${r.sets}/${r.target}`).join(', ')}.`));
  }

  const trigger = rules.stall?.sessions_to_trigger;
  const stalled = (d.liftState ?? [])
    .filter((s) => s.active !== false && typeof trigger === 'number' && (s.stall_count ?? 0) >= trigger);
  if (stalled.length > 0) {
    out.push(finding('training', 'warn', 'stalled', `${plural(stalled.length, 'lift')} stalled`,
      stalled.map((s) => `${s.name} (${s.stall_count} sessions)`).join(', ')));
  }

  const triggers = rules.deload?.triggers ?? {};
  if (typeof triggers.stalled_exercises === 'number' && stalled.length >= triggers.stalled_exercises) {
    out.push(finding('training', 'bad', 'deload_stalls', 'Deload due: too many stalls',
      `${stalled.length} lifts stalled; the rules call a deload at ${triggers.stalled_exercises}.`));
  }

  const lastTrained = (d.sessions ?? [])
    .filter((s) => s.kind === 'training' && (s.status === 'done' || s.status === 'partial'))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (lastTrained && typeof triggers.effort_above === 'number'
      && typeof lastTrained.effort_1_10 === 'number' && lastTrained.effort_1_10 > triggers.effort_above) {
    out.push(finding('training', 'warn', 'deload_effort', 'Last session felt too hard',
      `Effort ${lastTrained.effort_1_10}/10 on ${lastTrained.date}; the rules flag anything above ${triggers.effort_above}.`));
  }

  const backstop = rules.deload?.backstop_weeks;
  if (d.activeBlock?.starts_on && typeof backstop === 'number') {
    const weeks = Math.floor(daysBetween(d.activeBlock.starts_on, today) / 7);
    if (weeks >= backstop) {
      out.push(finding('training', 'warn', 'deload_backstop', 'Long time without a deload',
        `The active block started ${weeks} weeks ago; the rules backstop is ${backstop} weeks.`));
    }
  }

  const gap = rules.rotation?.gap_flag_days;
  const last = d.trainingRate?.last_session_date;
  if (typeof gap === 'number' && last) {
    const days = daysBetween(last, today);
    if (days > gap) {
      out.push(finding('training', 'warn', 'rotation_gap', 'Long gap since the last session',
        `${days} days since ${last}; the rules flag gaps over ${gap} days.`));
    }
  }

  const band = rules.nutrition?.gain_band_kg_per_week;
  const trend = (d.bodyTrend ?? [])
    .filter((r) => r.rate_3w !== null && r.rate_3w !== undefined && r.unit)
    .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))[0];
  if (Array.isArray(band) && band.length === 2 && trend) {
    const rate = toUnit(Number(trend.rate_3w), trend.unit, 'kg');
    if (rate < band[0] || rate > band[1]) {
      out.push(finding('training', 'warn', 'body_rate', 'Body weight moving outside the band',
        `${rate} kg/week over the last three weeks; the target band is ${band[0]}–${band[1]} kg/week.`));
    }
  }

  return out;
}

function topLoadsByExercise(d) {
  const sessionById = new Map((d.sessions ?? []).map((s) => [s.id, s]));
  const sxById = new Map((d.sessionExercises ?? []).map((x) => [x.id, x]));
  const tops = new Map();
  for (const set of d.sets ?? []) {
    if (!set.done || set.weight === null || set.weight === undefined || !set.unit) continue;
    const sx = sxById.get(set.session_exercise_id);
    const session = sx && sessionById.get(sx.session_id);
    if (!session) continue;
    const kg = toUnit(Number(set.weight), set.unit, 'kg');
    const key = `${sx.exercise_id}|${session.id}`;
    const prev = tops.get(key);
    if (!prev || kg > prev.kg) tops.set(key, { exerciseId: sx.exercise_id, date: session.date, kg });
  }
  const byExercise = new Map();
  for (const t of tops.values()) {
    const list = byExercise.get(t.exerciseId) ?? [];
    list.push(t);
    byExercise.set(t.exerciseId, list);
  }
  for (const list of byExercise.values()) list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return byExercise;
}

function dataChecks(d) {
  const { today } = d;
  const out = [];
  const names = new Map((d.exercises ?? []).map((e) => [e.id, e.name]));

  const cadence = CADENCE_DAYS[d.rules?.nutrition?.weigh_in_cadence];
  if (cadence) {
    const lastWeigh = (d.bodyMetrics ?? [])
      .filter((m) => m.weight !== null && m.weight !== undefined)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!lastWeigh) {
      out.push(finding('data', 'warn', 'weigh_in_overdue', 'Weigh-in overdue', 'No weigh-in logged yet.'));
    } else {
      const days = daysBetween(lastWeigh.date, today);
      if (days > cadence) {
        out.push(finding('data', 'warn', 'weigh_in_overdue', 'Weigh-in overdue',
          `Last weigh-in ${lastWeigh.date}, ${days} days ago; the rules ask for ${d.rules.nutrition.weigh_in_cadence}.`));
      }
    }
  }

  const slips = [];
  for (const [exerciseId, list] of topLoadsByExercise(d)) {
    for (let i = 1; i < list.length; i += 1) {
      const ratio = list[i].kg / list[i - 1].kg;
      const near = (target) => Math.abs(ratio / target - 1) <= SLIP_TOLERANCE;
      if (list[i - 1].kg > 0 && (near(LB_PER_KG) || near(1 / LB_PER_KG))) {
        slips.push(`${names.get(exerciseId) ?? 'an exercise'} on ${list[i].date}`);
      }
    }
  }
  if (slips.length > 0) {
    out.push(finding('data', 'warn', 'unit_slip', 'Possible lb/kg mix-up',
      `The load changed by the lb/kg factor: ${slips.join(', ')}.`));
  }

  const noReps = (d.sets ?? []).filter((s) => s.done && (s.reps === null || s.reps === undefined));
  if (noReps.length > 0) {
    out.push(finding('data', 'warn', 'set_no_reps', 'Sets marked done with no reps',
      `${plural(noReps.length, 'set')} marked done without a rep count.`));
  }

  const trained = (d.sessions ?? [])
    .filter((s) => s.kind === 'training' && (s.status === 'done' || s.status === 'partial'));
  const perDay = new Map();
  for (const s of trained) perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);
  const dupes = [...perDay].filter(([, n]) => n > 1).map(([date]) => date).sort();
  if (dupes.length > 0) {
    out.push(finding('data', 'warn', 'duplicate_sessions', 'Two training sessions on one day',
      `On ${dupes.join(', ')}.`));
  }

  const stale = (d.sessions ?? [])
    .filter((s) => s.kind === 'training' && s.status === 'planned' && s.date < today)
    .map((s) => s.date).sort();
  if (stale.length > 0) {
    out.push(finding('data', 'warn', 'stale_planned', 'Past sessions never finished',
      `Still marked planned: ${stale.join(', ')}.`));
  }

  const withSets = new Set();
  const sxSession = new Map((d.sessionExercises ?? []).map((x) => [x.id, x.session_id]));
  for (const set of d.sets ?? []) {
    if (set.done) withSets.add(sxSession.get(set.session_exercise_id));
  }
  const empty = (d.sessions ?? [])
    .filter((s) => s.kind === 'training' && s.status === 'done' && !withSets.has(s.id))
    .map((s) => s.date).sort();
  if (empty.length > 0) {
    out.push(finding('data', 'warn', 'empty_session', 'Done sessions with no sets',
      `Marked done but nothing logged: ${empty.join(', ')}.`));
  }

  return out;
}

function plumbingChecks(d) {
  const out = [];
  const nowMs = Date.parse(d.now);

  const stuck = (d.jobs ?? []).filter((j) => (j.status === 'queued' || j.status === 'running')
    && nowMs - Date.parse(j.created_at) > JOB_STUCK_MINUTES * 60000);
  if (stuck.length > 0) {
    out.push(finding('plumbing', 'bad', 'job_stuck', 'Coach jobs stuck',
      `${plural(stuck.length, 'job')} queued or running for over ${JOB_STUCK_MINUTES} minutes.`));
  }

  const failed = (d.jobs ?? [])
    .filter((j) => j.status === 'failed'
      && nowMs - Date.parse(j.created_at) <= FAILED_JOB_WINDOW_DAYS * 86400000)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (failed.length > 0) {
    out.push(finding('plumbing', 'warn', 'jobs_failed', 'Coach jobs failed recently',
      `${failed.length} failed in the last ${FAILED_JOB_WINDOW_DAYS} days. Latest: ${failed[0].error ?? 'no reason given'}`));
  }

  return out;
}

export function runChecks(d) {
  if (!d.rules) {
    return [
      finding('plumbing', 'bad', 'rules_missing', 'No rules document',
        'Every coaching number comes from the rules document, and there is none.'),
      ...dataChecks(d),
      ...plumbingChecks(d),
    ];
  }

  const errors = d.schema ? validateRulesWith(d.rules, d.schema) : [];
  const rulesFinding = errors.length > 0
    ? [finding('plumbing', 'bad', 'rules_invalid', 'Rules document is invalid',
      errors.slice(0, 5).join('; '))]
    : [];

  return [...trainingChecks(d), ...dataChecks(d), ...plumbingChecks(d), ...rulesFinding];
}

/* Findings from GitHub's record of the workflows. `test` is the latest run of
   test.yml, `coach` the recent runs of coach.yml, `error` set when GitHub could
   not be read at all. */
export function repoFindings({ test, coach, error } = {}) {
  if (error) {
    return [finding('repo', 'warn', 'repo_unreadable', 'Could not read GitHub', error)];
  }
  const out = [];
  if (test && test.conclusion && test.conclusion !== 'success') {
    out.push(finding('repo', 'bad', 'tests_failing', 'Tests are failing',
      `The latest test run ended in ${test.conclusion}.`));
  }
  const failedCoach = (coach ?? []).filter((r) => r.conclusion === 'failure');
  if (failedCoach.length > 0) {
    out.push(finding('repo', 'warn', 'coach_runs_failing', 'Coach runs failing',
      `${failedCoach.length} of the last ${(coach ?? []).length} coach runs failed.`));
  }
  return out;
}
