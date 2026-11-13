-- Volume, training rate, rotation and body trend. Every coaching threshold is
-- read from the current rules document; the literals in coalesce() are only the
-- fallback for a database that has no rules document yet, so a first run returns
-- rows instead of nulls.

-- Weekly sets per muscle. A set counts fully against the exercise's primary
-- muscle and at rules.volume.indirect_factor against each secondary muscle.
-- Partial sets do not count.
create view weekly_muscle_volume with (security_invoker = true) as
with factor as (
  select user_id, coalesce((body_json -> 'volume' ->> 'indirect_factor')::numeric, 0.5) as f
  from current_documents
  where key = 'rules'
),
sets_per_exercise as (
  select
    h.user_id,
    date_trunc('week', h.date)::date as week_start,
    h.exercise_id,
    count(*) filter (where not h.partial) as n
  from lift_history h
  group by h.user_id, date_trunc('week', h.date), h.exercise_id
),
direct as (
  select s.user_id, s.week_start, x.primary_muscle as muscle,
         sum(s.n)::numeric as direct_sets, 0::numeric as indirect_sets
  from sets_per_exercise s
  join exercises x on x.id = s.exercise_id
  group by s.user_id, s.week_start, x.primary_muscle
),
indirect as (
  select s.user_id, s.week_start, m.muscle,
         0::numeric as direct_sets, sum(s.n)::numeric as indirect_sets
  from sets_per_exercise s
  join exercises x on x.id = s.exercise_id
  cross join lateral unnest(x.secondary_muscles) as m(muscle)
  group by s.user_id, s.week_start, m.muscle
),
combined as (
  select * from direct
  union all
  select * from indirect
)
select
  c.user_id,
  c.week_start,
  c.muscle,
  sum(c.direct_sets) as direct_sets,
  sum(c.indirect_sets) as indirect_sets,
  round(sum(c.direct_sets) + sum(c.indirect_sets) * coalesce(f.f, 0.5), 2) as total_sets
from combined c
left join factor f on f.user_id = c.user_id
group by c.user_id, c.week_start, c.muscle, f.f;

-- Sessions actually trained per week over the trailing four and eight weeks.
-- The coach plans volume at the observed rate, not the intended one.
create view training_rate with (security_invoker = true) as
select
  user_id,
  round(count(*) filter (where date > current_date - 28)::numeric / 4, 2) as per_week_4w,
  round(count(*) filter (where date > current_date - 56)::numeric / 8, 2) as per_week_8w,
  max(date) as last_session_date
from sessions
where kind = 'training'
  and status in ('done','partial')
group by user_id;

-- The next day of the active block. A done session always counts as complete; a
-- partial one counts only if it logged the day's first slot and at least
-- rules.rotation.complete_fraction of the day's slots. Rest sessions never count.
create view rotation_next with (security_invoker = true) as
with active_block as (
  select id, user_id from blocks where status = 'active'
),
day_counts as (
  select b.user_id, b.id as block_id, count(d.id) as day_count
  from active_block b
  left join block_days d on d.block_id = b.id
  group by b.user_id, b.id
),
fraction as (
  select user_id, coalesce((body_json -> 'rotation' ->> 'complete_fraction')::numeric, 0.6) as cf
  from current_documents
  where key = 'rules'
),
candidates as (
  select
    s.user_id,
    s.day_index,
    s.date,
    s.created_at,
    s.status,
    (select count(*) from block_slots bs where bs.day_id = d.id) as slot_count,
    (select count(distinct se.slot_id)
       from session_exercises se
       join sets st on st.session_exercise_id = se.id
      where se.session_id = s.id and st.done and se.slot_id is not null) as logged_slots,
    exists (
      select 1
        from session_exercises se
        join sets st on st.session_exercise_id = se.id
        join block_slots bs on bs.id = se.slot_id
       where se.session_id = s.id and st.done and bs.day_id = d.id and bs.position = 0
    ) as first_slot_logged
  from sessions s
  join active_block b on b.id = s.block_id
  left join block_days d on d.block_id = s.block_id and d.day_index = s.day_index
  where s.kind = 'training'
    and s.status in ('done','partial')
),
last_complete as (
  select distinct on (c.user_id) c.user_id, c.day_index
  from candidates c
  left join fraction f on f.user_id = c.user_id
  where c.status = 'done'
     or (c.status = 'partial'
         and c.first_slot_logged
         and c.slot_count > 0
         and c.logged_slots::numeric / c.slot_count >= coalesce(f.cf, 0.6))
  order by c.user_id, c.date desc, c.created_at desc
),
next_day as (
  select
    dc.user_id,
    dc.block_id,
    case
      when dc.day_count = 0 then null
      when lc.day_index is null then 0
      else (lc.day_index + 1) % dc.day_count
    end as day_index,
    case
      when dc.day_count = 0 then 'block has no days'
      when lc.day_index is null then 'first day of the block'
      else 'after the last complete session'
    end as reason
  from day_counts dc
  left join last_complete lc on lc.user_id = dc.user_id
)
select
  n.user_id,
  n.block_id,
  n.day_index,
  n.reason,
  d.id as day_id,
  d.name as day_name,
  d.warmup_note
from next_day n
left join block_days d on d.block_id = n.block_id and d.day_index = n.day_index;

-- Weekly average body weight and the rate of change against three calendar
-- weeks earlier. Joining on the date, not lagging three rows, keeps a missed
-- weigh-in from stretching the window.
create view body_trend with (security_invoker = true) as
with weekly as (
  select
    user_id,
    date_trunc('week', date)::date as week_start,
    avg(weight) as avg_weight,
    (array_agg(unit order by date))[1] as unit,
    count(*) as entries
  from body_metrics
  where weight is not null
  group by user_id, date_trunc('week', date)
)
select
  w.user_id,
  w.week_start,
  round(w.avg_weight, 2) as avg_weight,
  w.unit,
  w.entries,
  round((w.avg_weight - p.avg_weight) / 3, 3) as rate_3w
from weekly w
left join weekly p on p.user_id = w.user_id and p.week_start = w.week_start - 21;
