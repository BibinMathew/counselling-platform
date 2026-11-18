create table public.counselors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  bio text not null check (char_length(btrim(bio)) between 1 and 3000),
  qualifications text not null check (char_length(btrim(qualifications)) between 1 and 1000),
  experience text not null check (char_length(btrim(experience)) between 1 and 500),
  specialties text not null check (char_length(btrim(specialties)) between 1 and 1000),
  languages text not null check (char_length(btrim(languages)) between 1 and 500),
  photo_url text not null check (char_length(photo_url) <= 2048 and photo_url ~ '^https://[^[:space:]]+$'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.counselor_catalog_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  counselor_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  occurred_at timestamptz not null default now()
);

create function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create function public.is_catalog_counselor(profile_uuid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = profile_uuid and role = 'counselor');
$$;

create function public.audit_counselor_catalog()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.counselor_catalog_audit_events (actor_user_id, counselor_id, action)
    values (auth.uid(), old.id, 'deleted');
    return old;
  end if;
  insert into public.counselor_catalog_audit_events (actor_user_id, counselor_id, action)
  values (auth.uid(), new.id, case when tg_op = 'INSERT' then 'created' else 'updated' end);
  return new;
end;
$$;

create trigger counselors_updated_at before update on public.counselors
for each row execute function public.update_profile_updated_at();
create trigger counselors_audit after insert or update or delete on public.counselors
for each row execute function public.audit_counselor_catalog();

alter table public.counselors enable row level security;
alter table public.counselor_catalog_audit_events enable row level security;
revoke all on public.counselors from public, anon, authenticated;
grant select on public.counselors to anon, authenticated;
grant insert, update, delete on public.counselors to authenticated;
revoke all on public.counselor_catalog_audit_events from public, anon, authenticated;

revoke all on function public.is_catalog_admin() from public, anon;
grant execute on function public.is_catalog_admin() to authenticated;
revoke all on function public.is_catalog_counselor(uuid) from public;
grant execute on function public.is_catalog_counselor(uuid) to anon, authenticated;
revoke all on function public.audit_counselor_catalog() from public, anon, authenticated;

create policy counselors_public_read on public.counselors for select to anon, authenticated
using (published and public.is_catalog_counselor(profile_id));
create policy counselors_admin_read on public.counselors for select to authenticated
using ((select public.is_catalog_admin()));
create policy counselors_admin_insert on public.counselors for insert to authenticated
with check ((select public.is_catalog_admin()) and public.is_catalog_counselor(profile_id));
create policy counselors_admin_update on public.counselors for update to authenticated
using ((select public.is_catalog_admin()))
with check ((select public.is_catalog_admin()) and (not published or public.is_catalog_counselor(profile_id)));
create policy counselors_admin_delete on public.counselors for delete to authenticated
using ((select public.is_catalog_admin()));