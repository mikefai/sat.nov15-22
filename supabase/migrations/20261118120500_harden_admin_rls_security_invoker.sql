-- RLS-protected public.admin_users table (SELECT own row only; zero client write privileges)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  reason text not null default 'email_allowlist'
);

alter table public.admin_users enable row level security;

grant select on public.admin_users to authenticated;

create policy "admin_users_select_own"
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into public.admin_users (user_id, reason)
select u.id, 'email_allowlist'
from auth.users u
join private.admin_emails ae
  on lower(trim(coalesce(u.email, ''))) = lower(trim(ae.email))
on conflict (user_id) do nothing;

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
    insert into public.admin_users (user_id, reason)
    values (new.id, 'email_allowlist')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.is_my_account_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
  );
$$;

create or replace function public.claim_instructor_admin(passcode text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.is_my_account_admin() and passcode is not null;
$$;

alter policy "profiles_select_own"
  on public.profiles
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.admin_users au where au.user_id = (select auth.uid())
    )
  );

alter policy "course_progress_select_own"
  on public.course_progress
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.admin_users au where au.user_id = (select auth.uid())
    )
  );
