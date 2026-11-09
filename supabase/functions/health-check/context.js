/* What the model reads. Rows are flattened into short lines and stripped of ids
   and bookkeeping columns: the raw rows of eight weeks run to ~60k tokens, which
   a free-tier model cannot read inside the function's time limit. */

const JOURNAL_TURNS = 10;
const JOURNAL_CHARS = 1500;

const load = (weight, unit) => (weight === null || weight === undefined ? 'bw' : `${Number(weight)}${unit ?? ''}`);

function liftLine(sx, nameOf) {
  const sets = [...(sx.sets ?? [])]
    .filter((s) => s.done)
    .sort((a, b) => a.set_no - b.set_no)
    .map((s) => `${load(s.weight, s.unit)}×${s.reps ?? '?'}${s.partial ? 'p' : ''}`);
  const target = (sx.target_reps || (sx.target_weight !== null && sx.target_weight !== undefined))
    ? ` (target ${load(sx.target_weight, sx.target_unit)}×${sx.target_reps ?? '?'})`
    : '';
  const note = sx.deviation_note ? ` [${sx.deviation_note}]` : '';
  return `${nameOf(sx.exercise_id)}: ${sets.join(', ') || 'no sets'}${target}${note}`;
}

export function modelContext(d, findings) {
  const names = new Map((d.exercises ?? []).map((e) => [e.id, e.name]));
  const nameOf = (exerciseId) => names.get(exerciseId) ?? 'unknown exercise';

  const sessions = (d.sessions ?? []).map((s) => ({
    date: s.date,
    kind: s.kind,
    status: s.status,
    day_index: s.day_index,
    effort: s.effort_1_10 ?? null,
    pain: s.pain && s.pain !== 'none' ? s.pain : undefined,
    duration_min: s.duration_min ?? undefined,
    notes: s.notes || undefined,
    lifts: [...(s.session_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((sx) => liftLine(sx, nameOf)),
  }));

  const block = d.activeBlock
    ? {
      name: d.activeBlock.name,
      starts_on: d.activeBlock.starts_on,
      ends_on: d.activeBlock.ends_on,
      rationale: d.activeBlock.rationale,
      days: [...(d.activeBlock.block_days ?? [])]
        .sort((a, b) => a.day_index - b.day_index)
        .map((day) => ({
          day_index: day.day_index,
          name: day.name,
          slots: [...(day.block_slots ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((sl) => `${nameOf(sl.exercise_id)} ${sl.sets}×${sl.rep_min}-${sl.rep_max}${sl.notes ? ` (${sl.notes})` : ''}`),
        })),
    }
    : null;

  return {
    today: d.today,
    rules: d.rules,
    manual: d.manual,
    exercises: (d.exercises ?? []).filter((e) => e.active !== false).map((e) => ({
      name: e.name,
      primary: e.primary_muscle,
      secondary: e.secondary_muscles?.length ? e.secondary_muscles : undefined,
      equipment: e.equipment,
      flag: e.flag || undefined,
    })),
    active_block: block,
    sessions,
    lifts: (d.liftState ?? []).filter((l) => l.active !== false && l.last_date).map((l) => ({
      name: l.name,
      last: `${l.last_date} ${load(l.last_weight, l.last_unit)}`,
      stall_count: l.stall_count,
      sessions_since_change: l.sessions_since_change,
    })),
    weekly_sets: (d.weeklyVolume ?? []).map((v) => `${v.week_start} ${v.muscle} ${v.total_sets}`),
    training_rate: d.trainingRate
      ? { per_week_4w: d.trainingRate.per_week_4w, per_week_8w: d.trainingRate.per_week_8w, last: d.trainingRate.last_session_date }
      : null,
    body_trend: (d.bodyTrend ?? []).map((b) => `${b.week_start} avg ${b.avg_weight}${b.unit} rate_3w ${b.rate_3w ?? '-'}`),
    weigh_ins: (d.bodyMetrics ?? []).slice(0, 20).map((m) => `${m.date} ${load(m.weight, m.unit)}${m.notes ? ` (${m.notes})` : ''}`),
    decisions: (d.decisions ?? []).map((x) => ({ date: x.date, title: x.title, body: x.body })),
    coach_notes: (d.notes ?? []).map((n) => ({ body: n.body, created_at: n.created_at })),
    coach_jobs: (d.jobs ?? []).map((j) => ({ kind: j.kind, status: j.status, error: j.error ?? undefined, created_at: j.created_at })),
    journal: (d.jobs ?? [])
      .filter((j) => j.status === 'done' && /mode=journal/.test(j.instructions ?? ''))
      .slice(0, JOURNAL_TURNS)
      .map((j) => ({
        at: j.created_at,
        question: String(j.instructions ?? '').replace(/^\[[^\]]*\]\s*/, '').slice(0, JOURNAL_CHARS),
        answer: String(j.output_md ?? '').replace(/^<!--[\s\S]*?-->\s*/, '').slice(0, JOURNAL_CHARS),
      })),
    checker_findings: findings,
  };
}
