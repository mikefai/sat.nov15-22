-- SQL-rotatable instructor config readable only by service_role
create table if not exists public.instructor_auth_config (
  id integer primary key default 1 check (id = 1),
  primary_email text not null default 'mikeperac@gmail.com',
  passcode_bcrypt text not null,
  updated_at timestamptz not null default now()
);

alter table public.instructor_auth_config enable row level security;

create policy "instructor_auth_config_service_role_only"
  on public.instructor_auth_config
  for all
  to service_role
  using (true)
  with check (true);

insert into public.instructor_auth_config (id, primary_email, passcode_bcrypt)
select
  1,
  coalesce((select email from private.admin_emails limit 1), 'mikeperac@gmail.com'),
  coalesce(
    (select passcode_hash from private.admin_passcode_config where id = 1),
    extensions.crypt('SAT1400-INSTRUCTOR-2026', extensions.gen_salt('bf'))
  )
on conflict (id) do nothing;

create or replace function public.verify_instructor_passcode(p_passcode text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.instructor_auth_config cfg
    where cfg.id = 1
      and length(trim(coalesce(p_passcode, ''))) > 0
      and extensions.crypt(trim(p_passcode), cfg.passcode_bcrypt) = cfg.passcode_bcrypt
  );
$$;

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

  if new.email_confirmed_at is not null and exists (
    select 1
    from public.instructor_auth_config cfg
    where cfg.id = 1
      and lower(trim(cfg.primary_email)) = lower(trim(coalesce(new.email, '')))
  ) then
    insert into public.admin_users (user_id, reason)
    values (new.id, 'email_allowlist')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function private.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    if exists (
      select 1
      from public.instructor_auth_config cfg
      where cfg.id = 1
        and lower(trim(cfg.primary_email)) = lower(trim(coalesce(new.email, '')))
    ) then
      insert into public.admin_users (user_id, reason)
      values (new.id, 'email_allowlist')
      on conflict (user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function private.handle_user_email_confirmed();
