-- Private schema for internal auth triggers (not exposed via PostgREST Data API)
create schema if not exists private;

-- 1. Student profiles linked 1:1 with auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  target_score integer not null default 1400 check (target_score between 400 and 1600),
  exam_date date not null default '2026-12-05',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Cloud-synced SAT 1400+ course progress (1:1 with auth.users)
create table if not exists public.course_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_version integer not null default 1,
  last_route_hash text not null default '#/overview',
  solved_questions integer not null default 0,
  correct_questions integer not null default 0,
  completed_steps integer not null default 0,
  mastered_words integer not null default 0,
  error_log_count integer not null default 0,
  progress_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Updated-at timestamp trigger function
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create trigger trg_course_progress_updated_at
  before update on public.course_progress
  for each row execute function private.touch_updated_at();

-- Automatic profile + progress bootstrap when a user signs up via Google or Email
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived_name text;
  derived_avatar text;
begin
  derived_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, 'student'), '@', 1)
  );
  derived_avatar := coalesce(
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'picture'), '')
  );

  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email, derived_name, derived_avatar)
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = pg_catalog.now();

  insert into public.course_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.course_progress enable row level security;

-- Explicit Data API grants for authenticated role
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.course_progress to authenticated;

-- RLS Policies for public.profiles (using cached `(select auth.uid())` pattern)
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- RLS Policies for public.course_progress
create policy "course_progress_select_own"
  on public.course_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "course_progress_insert_own"
  on public.course_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "course_progress_update_own"
  on public.course_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "course_progress_delete_own"
  on public.course_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
