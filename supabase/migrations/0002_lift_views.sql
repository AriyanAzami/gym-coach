-- Derived lifting state. Nothing here is ever hand-maintained: the app and the
-- coach both read these views, so a logged set changes the next target at once.
-- security_invoker makes each view obey the caller's RLS policies instead of
-- the owner's.

-- The highest stored version of each document wins. Rolling back inserts a new
-- version, so history stays intact.
create view current_documents with (security_invoker = true) as
select distinct on (user_id, key)
  user_id, key, version, body_md, body_json, created_at
from documents
order by user_id, key, version desc;

-- One row per logged working set. Warm-ups are not logged, so every row here is
-- a working set.
create view lift_history with (security_invoker = true) as
select
  s.user_id,
  s.id as session_id,
  s.date,
  se.exercise_id,
  se.id as session_exercise_id,
  st.set_no,
  st.weight,
  st.unit,
  st.reps,
  st.partial
from sessions s
join session_exercises se on se.session_id = s.id
join sets st on st.session_exercise_id = se.id
where s.kind = 'training'
  and s.status in ('done','partial')
  and st.done;

-- One row per exercise per session: the exposure. weight is the top set, which
-- for straight sets is the working weight. full_reps drops partial sets, because
-- a partial never counts toward clearing a rep range.
create view lift_exposures with (security_invoker = true) as
select
  user_id,
  exercise_id,
  session_id,
  date,
  count(*) filter (where not partial) as work_sets,
  max(weight) as weight,
  (array_agg(unit order by set_no))[1] as unit,
  array_agg(reps order by set_no) as reps,
  coalesce(array_agg(reps order by set_no) filter (where not partial), '{}'::int[]) as full_reps
from lift_history
group by user_id, exercise_id, session_id, date;

-- One row per exercise, including exercises with no history at all, so the app
-- can show "first exposure" without a second query.
--   sessions_since_change — consecutive exposures at the same weight as the one
--     before, counting back from the latest.
--   stall_count — consecutive exposures where the weight AND the full-rep
--     pattern both repeated. Stricter than sessions_since_change: adding a rep
--     at the same weight is progress, not a stall.
create view lift_state with (security_invoker = true) as
with ordered as (
  select
    e.user_id,
    e.exercise_id,
    e.session_id,
    e.date,
    e.weight,
    e.full_reps,
    lag(e.weight) over w as prev_weight,
    lag(e.full_reps) over w as prev_full_reps,
    row_number() over (
      partition by e.user_id, e.exercise_id order by e.date desc, e.session_id desc
    ) as rn_desc
  from lift_exposures e
  window w as (partition by e.user_id, e.exercise_id order by e.date, e.session_id)
),
marked as (
  select
    user_id,
    exercise_id,
    rn_desc,
    (prev_weight is not null and weight = prev_weight) as same_weight,
    (prev_weight is not null and weight = prev_weight and full_reps = prev_full_reps) as same_both
  from ordered
),
runs as (
  select
    user_id,
    exercise_id,
    coalesce(min(rn_desc) filter (where not same_weight), count(*) + 1) - 1 as sessions_since_change,
    coalesce(min(rn_desc) filter (where not same_both), count(*) + 1) - 1 as stall_count
  from marked
  group by user_id, exercise_id
),
latest as (
  select distinct on (user_id, exercise_id)
    user_id, exercise_id, date, weight, unit, reps, full_reps, work_sets
  from lift_exposures
  order by user_id, exercise_id, date desc, session_id desc
)
select
  x.user_id,
  x.id as exercise_id,
  x.name,
  x.primary_muscle,
  x.equipment,
  x.load_mode,
  x.flag,
  x.active,
  l.date as last_date,
  l.weight as last_weight,
  l.unit as last_unit,
  l.reps as last_reps,
  l.full_reps as last_full_reps,
  l.work_sets as last_sets,
  coalesce(r.sessions_since_change, 0) as sessions_since_change,
  coalesce(r.stall_count, 0) as stall_count
from exercises x
left join latest l on l.exercise_id = x.id
left join runs r on r.exercise_id = x.id;
