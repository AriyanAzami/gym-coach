-- Core schema. Every table is owned by one user and readable only by them.
-- Weights are always a numeric value plus a unit column; no bare weight exists
-- anywhere, and block_slots has no weight column at all because a plan never
-- prescribes a load.

create extension if not exists pgcrypto;

create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  increment numeric(6,2) not null,
  unit text not null check (unit in ('lb','kg')),
  load_mode text not null default 'total' check (load_mode in ('total','per_hand')),
  movement_tags text[] not null default '{}',
  cues text,
  flag text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index exercises_name on exercises (user_id, lower(name));

create table blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  starts_on date,
  ends_on date,
  rationale text,
  source_job_id uuid,
  created_at timestamptz not null default now(),
  constraint blocks_dates_ordered check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index blocks_one_active on blocks (user_id) where status = 'active';

create table block_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  block_id uuid not null references blocks (id) on delete cascade,
  day_index int not null check (day_index >= 0),
  name text not null,
  warmup_note text,
  created_at timestamptz not null default now(),
  unique (block_id, day_index)
);

create table block_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  day_id uuid not null references block_days (id) on delete cascade,
  position int not null check (position >= 0),
  exercise_id uuid not null references exercises (id) on delete restrict,
  sets int not null check (sets > 0),
  rep_min int not null check (rep_min > 0),
  rep_max int not null check (rep_max > 0),
  rest_s int not null check (rest_s >= 0),
  non_negotiable boolean not null default false,
  cut_order int,
  notes text,
  created_at timestamptz not null default now(),
  unique (day_id, position),
  constraint block_slots_reps_ordered check (rep_max >= rep_min)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  block_id uuid references blocks (id) on delete set null,
  day_index int check (day_index >= 0),
  kind text not null default 'training' check (kind in ('training','rest')),
  status text not null default 'planned' check (status in ('planned','done','partial','skipped')),
  duration_min int check (duration_min >= 0),
  calories int check (calories >= 0),
  avg_hr int check (avg_hr > 0),
  peak_hr int check (peak_hr > 0),
  hr_zones jsonb,
  effort_1_10 int check (effort_1_10 between 1 and 10),
  pain text not null default 'none',
  notes text,
  source text not null default 'app' check (source in ('app','notion_import')),
  notion_page_id text unique,
  created_at timestamptz not null default now()
);
create index sessions_date on sessions (user_id, date desc);

create table session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  session_id uuid not null references sessions (id) on delete cascade,
  slot_id uuid references block_slots (id) on delete set null,
  exercise_id uuid not null references exercises (id) on delete restrict,
  position int not null check (position >= 0),
  target_weight numeric(7,2),
  target_unit text check (target_unit in ('lb','kg')),
  target_reps int check (target_reps > 0),
  target_sets int check (target_sets > 0),
  deviation_note text,
  created_at timestamptz not null default now(),
  unique (session_id, position),
  constraint session_exercises_target_has_unit check (target_weight is null or target_unit is not null)
);

create table sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  session_exercise_id uuid not null references session_exercises (id) on delete cascade,
  set_no int not null check (set_no > 0),
  weight numeric(7,2),
  unit text check (unit in ('lb','kg')),
  reps int check (reps >= 0),
  partial boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_exercise_id, set_no),
  constraint sets_weight_has_unit check (weight is null or unit is not null)
);

create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  weight numeric(6,2),
  unit text check (unit in ('lb','kg')),
  waist_note text,
  arm_cm numeric(5,2),
  notes text,
  notion_page_id text unique,
  created_at timestamptz not null default now(),
  constraint body_metrics_weight_has_unit check (weight is null or unit is not null)
);
create index body_metrics_date on body_metrics (user_id, date desc);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null default current_date,
  title text not null,
  body text,
  block_id uuid references blocks (id) on delete set null,
  created_at timestamptz not null default now()
);

create table coach_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body text not null,
  consumed_by_job uuid,
  created_at timestamptz not null default now()
);

-- Append-only. The highest version for a key wins; rolling back inserts a new
-- version rather than editing history, which is why there is no update policy.
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  key text not null check (key in ('manual','rules')),
  version int not null check (version > 0),
  body_md text,
  body_json jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, key, version),
  constraint documents_body_matches_key check (
    (key = 'manual' and body_md is not null and body_json is null)
    or (key = 'rules' and body_json is not null and body_md is null)
  )
);

create table ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('block','revise_block','checkin','ask')),
  instructions text,
  target_block_id uuid references blocks (id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  output_md text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index ai_jobs_recent on ai_jobs (user_id, created_at desc);

-- Row level security: a row belongs to exactly one user and nobody else can
-- see it, including with the anon key.

alter table exercises enable row level security;
create policy "exercises_select" on exercises for select using (user_id = auth.uid());
create policy "exercises_insert" on exercises for insert with check (user_id = auth.uid());
create policy "exercises_update" on exercises for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "exercises_delete" on exercises for delete using (user_id = auth.uid());

alter table blocks enable row level security;
create policy "blocks_select" on blocks for select using (user_id = auth.uid());
create policy "blocks_insert" on blocks for insert with check (user_id = auth.uid());
create policy "blocks_update" on blocks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "blocks_delete" on blocks for delete using (user_id = auth.uid());

alter table block_days enable row level security;
create policy "block_days_select" on block_days for select using (user_id = auth.uid());
create policy "block_days_insert" on block_days for insert with check (user_id = auth.uid());
create policy "block_days_update" on block_days for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "block_days_delete" on block_days for delete using (user_id = auth.uid());

alter table block_slots enable row level security;
create policy "block_slots_select" on block_slots for select using (user_id = auth.uid());
create policy "block_slots_insert" on block_slots for insert with check (user_id = auth.uid());
create policy "block_slots_update" on block_slots for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "block_slots_delete" on block_slots for delete using (user_id = auth.uid());

alter table sessions enable row level security;
create policy "sessions_select" on sessions for select using (user_id = auth.uid());
create policy "sessions_insert" on sessions for insert with check (user_id = auth.uid());
create policy "sessions_update" on sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sessions_delete" on sessions for delete using (user_id = auth.uid());

alter table session_exercises enable row level security;
create policy "session_exercises_select" on session_exercises for select using (user_id = auth.uid());
create policy "session_exercises_insert" on session_exercises for insert with check (user_id = auth.uid());
create policy "session_exercises_update" on session_exercises for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "session_exercises_delete" on session_exercises for delete using (user_id = auth.uid());

alter table sets enable row level security;
create policy "sets_select" on sets for select using (user_id = auth.uid());
create policy "sets_insert" on sets for insert with check (user_id = auth.uid());
create policy "sets_update" on sets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sets_delete" on sets for delete using (user_id = auth.uid());

alter table body_metrics enable row level security;
create policy "body_metrics_select" on body_metrics for select using (user_id = auth.uid());
create policy "body_metrics_insert" on body_metrics for insert with check (user_id = auth.uid());
create policy "body_metrics_update" on body_metrics for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "body_metrics_delete" on body_metrics for delete using (user_id = auth.uid());

alter table decisions enable row level security;
create policy "decisions_select" on decisions for select using (user_id = auth.uid());
create policy "decisions_insert" on decisions for insert with check (user_id = auth.uid());
create policy "decisions_update" on decisions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "decisions_delete" on decisions for delete using (user_id = auth.uid());

alter table coach_notes enable row level security;
create policy "coach_notes_select" on coach_notes for select using (user_id = auth.uid());
create policy "coach_notes_insert" on coach_notes for insert with check (user_id = auth.uid());
create policy "coach_notes_update" on coach_notes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "coach_notes_delete" on coach_notes for delete using (user_id = auth.uid());

alter table documents enable row level security;
create policy "documents_select" on documents for select using (user_id = auth.uid());
create policy "documents_insert" on documents for insert with check (user_id = auth.uid());

-- Jobs are created by the dispatch-job edge function with the service-role key,
-- after it has verified the caller's JWT. If the app could insert directly it
-- could leave queued rows that no Action will ever pick up.
alter table ai_jobs enable row level security;
create policy "ai_jobs_select" on ai_jobs for select using (user_id = auth.uid());

-- The app watches job status over realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ai_jobs'
     )
  then
    execute 'alter publication supabase_realtime add table ai_jobs';
  end if;
end $$;

-- Private bucket reserved for future screenshots. No public access, no anon read.
insert into storage.buckets (id, name, public)
values ('shots', 'shots', false)
on conflict (id) do nothing;

create policy "shots_owner_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'shots' and owner = auth.uid())
  with check (bucket_id = 'shots' and owner = auth.uid());
