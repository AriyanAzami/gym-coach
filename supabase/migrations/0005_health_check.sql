-- Health check: a scheduled and on-demand check of the whole system.
--
-- Runs start as a queued row, inserted either by the hourly cron job (for every
-- user whose schedule has come round) or by request_health_run() from the app.
-- An insert trigger tells the health-check edge function the run id and nothing
-- else; the function claims the row queued -> running, so a replayed or guessed
-- id finds nothing to claim. No secret is shared between the two.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table health_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  enabled boolean not null default true,
  cadence text not null default 'weekly' check (cadence in ('daily','weekly','fortnightly','monthly')),
  run_weekday int not null default 6 check (run_weekday between 0 and 6),
  run_hour int not null default 19 check (run_hour between 0 and 23),
  timezone text not null default 'UTC',
  primary_model text not null default 'nvidia/nemotron-3-ultra-550b-a55b',
  fallback_model text default 'mistralai/mistral-large-4-1t-a52b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table health_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  trigger text not null check (trigger in ('schedule','manual')),
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  findings jsonb not null default '[]',
  ai_summary_md text,
  ai_model text,
  ai_error text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index health_runs_recent on health_runs (user_id, created_at desc);

alter table health_settings enable row level security;
create policy "health_settings_select" on health_settings for select using (user_id = auth.uid());
create policy "health_settings_insert" on health_settings for insert with check (user_id = auth.uid());
create policy "health_settings_update" on health_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "health_settings_delete" on health_settings for delete using (user_id = auth.uid());

-- Written only by the edge function and the definer functions below.
alter table health_runs enable row level security;
create policy "health_runs_select" on health_runs for select using (user_id = auth.uid());

create function health_settings_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger health_settings_touch before update on health_settings
for each row execute function health_settings_touch();

-- The most recent slot the schedule has passed, and whether it still needs a
-- run. Weekly-based cadences share the weekday and hour; fortnightly and monthly
-- also need enough days since the last scheduled run. A settings change counts
-- as a fresh start, so turning the check on does not fire for a slot that went
-- by before it was switched on.
create view health_due with (security_invoker = true) as
with local as (
  select
    s.*,
    now() at time zone s.timezone as local_now
  from health_settings s
  where s.enabled
    and s.timezone in (select name from pg_timezone_names)
),
slots as (
  select
    l.*,
    case
      when l.cadence = 'daily' then
        date_trunc('day', l.local_now) + make_interval(hours => l.run_hour)
        - case when date_trunc('day', l.local_now) + make_interval(hours => l.run_hour) > l.local_now
               then interval '1 day' else interval '0' end
      else
        date_trunc('week', l.local_now) + make_interval(days => l.run_weekday, hours => l.run_hour)
        - case when date_trunc('week', l.local_now) + make_interval(days => l.run_weekday, hours => l.run_hour) > l.local_now
               then interval '7 days' else interval '0' end
    end as slot_local
  from local l
),
last_runs as (
  select user_id, max(created_at) as last_run_at
  from health_runs
  where trigger = 'schedule'
  group by user_id
)
select
  s.user_id,
  s.cadence,
  s.slot_local at time zone s.timezone as slot_at,
  r.last_run_at,
  (s.slot_local at time zone s.timezone) > greatest(coalesce(r.last_run_at, '-infinity'), s.updated_at)
  and (
    r.last_run_at is null
    or s.cadence in ('daily','weekly')
    or (s.cadence = 'fortnightly' and (s.slot_local at time zone s.timezone) >= r.last_run_at + interval '13 days')
    or (s.cadence = 'monthly' and (s.slot_local at time zone s.timezone) >= r.last_run_at + interval '27 days')
  ) as due
from slots s
left join last_runs r on r.user_id = s.user_id;

create function enqueue_due_health_runs() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  insert into health_runs (user_id, trigger)
  select user_id, 'schedule' from health_due where due;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function enqueue_due_health_runs() from public, anon, authenticated;

-- "Run now" from the app. One run per five minutes keeps a double tap, or a
-- loop, from spending the model's request allowance.
create function request_health_run() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  run_id uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if exists (
    select 1 from health_runs
    where user_id = uid and created_at > now() - interval '5 minutes'
  ) then
    raise exception 'a health check already ran in the last five minutes';
  end if;
  insert into health_runs (user_id, trigger) values (uid, 'manual') returning id into run_id;
  return run_id;
end $$;

revoke execute on function request_health_run() from public, anon;
grant execute on function request_health_run() to authenticated;

-- The project URL is a public identifier, the same one app/js/config.js holds.
create function health_runs_wake() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://pdioiedbpiryccrtrynn.supabase.co/functions/v1/health-check',
    body := jsonb_build_object('run_id', new.id),
    headers := '{"content-type": "application/json"}'::jsonb
  );
  return new;
end $$;

create trigger health_runs_wake after insert on health_runs
for each row execute function health_runs_wake();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'health_runs'
     ) then
    alter publication supabase_realtime add table health_runs;
  end if;
end $$;

select cron.schedule('health-check-hourly', '0 * * * *', 'select public.enqueue_due_health_runs()');
