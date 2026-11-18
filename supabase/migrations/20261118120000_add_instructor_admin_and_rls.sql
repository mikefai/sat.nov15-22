-- Enable pgcrypto for bcrypt hashing of the instructor access code
create extension if not exists pgcrypto with schema extensions;

-- Private tables for single-instructor authorization (never exposed via PostgREST Data API)
create table if not exists private.admin_emails (
  email text primary key
);

insert into private.admin_emails (email)
values ('mikeperac@gmail.com')
on conflict (email) do nothing;

create table if not exists private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  reason text not null default 'email_allowlist'
);

insert into private.admin_users (user_id, reason)
select u.id, 'email_allowlist'
from auth.users u
join private.admin_emails ae
  on lower(trim(coalesce(u.email, ''))) = lower(trim(ae.email))
on conflict (user_id) do nothing;

create table if not exists private.admin_passcode_config (
  id integer primary key default 1 check (id = 1),
  passcode_hash text not null,
  updated_at timestamptz not null default now()
);

insert into private.admin_passcode_config (id, passcode_hash)
values (1, extensions.crypt('SAT1400-INSTRUCTOR-2026', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- Update auth.users signup trigger to auto-grant admin when email matches private.admin_emails
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

  if exists (
    select 1
    from private.admin_emails ae
    where lower(trim(ae.email)) = lower(trim(coalesce(new.email, '')))
  ) then
    insert into private.admin_users (user_id, reason)
    values (new.id, 'email_allowlist')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Zero-argument check returning whether the currently authenticated caller is the instructor admin
create or replace function public.is_my_account_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    else exists (
      select 1
      from private.admin_users au
      where au.user_id = (select auth.uid())
    ) or exists (
      select 1
      from auth.users u
      join private.admin_emails ae
        on lower(trim(coalesce(u.email, ''))) = lower(trim(ae.email))
      where u.id = (select auth.uid())
    )
  end;
$$;

-- Server-side bcrypt verification to elevate an authenticated instructor account via passcode
create or replace function public.claim_instructor_admin(passcode text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  cleaned text;
  matched boolean;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    return false;
  end if;

  cleaned := trim(coalesce(passcode, ''));
  if length(cleaned) = 0 then
    return false;
  end if;

  select exists (
    select 1
    from private.admin_passcode_config cfg
    where cfg.id = 1
      and extensions.crypt(cleaned, cfg.passcode_hash) = cfg.passcode_hash
  ) into matched;

  if matched then
    insert into private.admin_users (user_id, reason)
    values (caller_id, 'instructor_passcode')
    on conflict (user_id) do nothing;
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.is_my_account_admin() to authenticated;
grant execute on function public.claim_instructor_admin(text) to authenticated;

-- Extend existing SELECT policies cleanly (keeping a single permissive SELECT policy per table)
alter policy "profiles_select_own"
  on public.profiles
  using ((select auth.uid()) = id or (select public.is_my_account_admin()));

alter policy "course_progress_select_own"
  on public.course_progress
  using ((select auth.uid()) = user_id or (select public.is_my_account_admin()));
