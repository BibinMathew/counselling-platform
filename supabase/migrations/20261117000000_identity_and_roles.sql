create type public.profile_role as enum ('customer', 'counselor', 'admin');

create function public.normalize_auth_phone(raw_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := pg_catalog.regexp_replace(raw_phone, '[^0-9+]', '', 'g');
begin
  if digits like '+%' and digits ~ '^\+[1-9][0-9]{7,14}$' then
    return digits;
  end if;

  if digits ~ '^[6-9][0-9]{9}$' then
    return '+91' || digits;
  end if;

  if digits ~ '^[1-9][0-9]{7,14}$' then
    return '+' || digits;
  end if;

  raise exception using errcode = '22023', message = 'Invalid phone number';
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  preferred_name text check (
    preferred_name is null or char_length(btrim(preferred_name)) between 1 and 80
  ),
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or char_length(btrim(email)) <= 254),
  role public.profile_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create table public.profile_role_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  subject_user_id uuid not null,
  previous_role public.profile_role,
  assigned_role public.profile_role not null,
  action text not null check (action in ('first_admin_bootstrap', 'role_assignment')),
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  counselor_verification_reference text check (
    counselor_verification_reference is null
    or char_length(btrim(counselor_verification_reference)) between 1 and 120
  ),
  occurred_at timestamptz not null default now(),
  check (assigned_role = 'counselor' or counselor_verification_reference is null)
);

create index profile_role_audit_subject_idx
  on public.profile_role_audit_events (subject_user_id, occurred_at desc);

create function public.update_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.update_profile_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'preferred_name'), '');
begin
  insert into public.profiles (id, phone, preferred_name)
  values (
    new.id,
    public.normalize_auth_phone(new.phone),
    case
      when pg_catalog.char_length(supplied_name) between 1 and 80 then supplied_name
      else null
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, phone, preferred_name)
select
  users.id,
  public.normalize_auth_phone(users.phone),
  case
    when pg_catalog.char_length(pg_catalog.btrim(users.raw_user_meta_data ->> 'preferred_name'))
      between 1 and 80 then pg_catalog.btrim(users.raw_user_meta_data ->> 'preferred_name')
    else null
  end
from auth.users as users
where users.phone is not null
on conflict (id) do nothing;

create function public.grant_profile_role(
  p_target_user_id uuid,
  p_new_role public.profile_role,
  p_reason text,
  p_counselor_verification_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor_id uuid := auth.uid();
  current_actor_role public.profile_role;
  previous_target_role public.profile_role;
begin
  if current_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select role into current_actor_role
  from public.profiles
  where id = current_actor_id;

  if current_actor_role is distinct from 'admin'::public.profile_role then
    raise exception using errcode = '42501', message = 'Administrator role required';
  end if;

  if p_reason is null or char_length(pg_catalog.btrim(p_reason)) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'A role-change reason is required';
  end if;

  if p_new_role = 'counselor'::public.profile_role then
    if p_counselor_verification_reference is null
      or char_length(pg_catalog.btrim(p_counselor_verification_reference)) not between 1 and 120 then
      raise exception using errcode = '22023', message = 'Counselor verification reference is required';
    end if;
  elsif p_counselor_verification_reference is not null then
    raise exception using errcode = '22023', message = 'Verification reference only applies to counselor roles';
  end if;

  select role into previous_target_role
  from public.profiles
  where id = p_target_user_id
  for update;

  if previous_target_role is null then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;

  if previous_target_role = p_new_role then
    raise exception using errcode = '22023', message = 'Profile already has the requested role';
  end if;

  if previous_target_role = 'admin'::public.profile_role
    and p_new_role <> 'admin'::public.profile_role
    and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception using errcode = '23514', message = 'Cannot remove the last administrator';
  end if;

  update public.profiles
  set role = p_new_role
  where id = p_target_user_id;

  insert into public.profile_role_audit_events (
    actor_user_id,
    subject_user_id,
    previous_role,
    assigned_role,
    action,
    reason,
    counselor_verification_reference
  )
  values (
    current_actor_id,
    p_target_user_id,
    previous_target_role,
    p_new_role,
    'role_assignment',
    pg_catalog.btrim(p_reason),
    nullif(pg_catalog.btrim(p_counselor_verification_reference), '')
  );
end;
$$;

create function public.bootstrap_first_admin(
  p_target_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_target_role public.profile_role;
begin
  if p_reason is null or char_length(pg_catalog.btrim(p_reason)) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'A bootstrap reason is required';
  end if;

  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception using errcode = '23505', message = 'An administrator already exists';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_target_user_id
      and phone_confirmed_at is not null
  ) then
    raise exception using errcode = '23514', message = 'A phone-authenticated account is required';
  end if;

  select role into previous_target_role
  from public.profiles
  where id = p_target_user_id
  for update;

  if previous_target_role is distinct from 'customer'::public.profile_role then
    raise exception using errcode = '23514', message = 'Only a customer profile can be bootstrapped';
  end if;

  update public.profiles
  set role = 'admin'
  where id = p_target_user_id;

  insert into public.profile_role_audit_events (
    actor_user_id,
    subject_user_id,
    previous_role,
    assigned_role,
    action,
    reason
  )
  values (
    p_target_user_id,
    p_target_user_id,
    previous_target_role,
    'admin',
    'first_admin_bootstrap',
    pg_catalog.btrim(p_reason)
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.profile_role_audit_events enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (preferred_name) on public.profiles to authenticated;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke all on public.profile_role_audit_events from public, anon, authenticated;

revoke all on function public.update_profile_updated_at() from public, anon, authenticated;
revoke all on function public.normalize_auth_phone(text) from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.grant_profile_role(uuid, public.profile_role, text, text)
  from public, anon;
grant execute on function public.grant_profile_role(uuid, public.profile_role, text, text)
  to authenticated;
revoke all on function public.bootstrap_first_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin(uuid, text) to service_role;