-- A rules document without rotation.complete_fraction no longer falls back to a
-- built-in 0.6: a partial session then simply does not count as complete.
create or replace view rotation_next with (security_invoker = true) as
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
  select user_id, (body_json -> 'rotation' ->> 'complete_fraction')::numeric as cf
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
         and f.cf is not null
         and c.logged_slots::numeric / c.slot_count >= f.cf)
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
