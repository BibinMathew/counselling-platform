create table public.availability_settings (
  id boolean primary key default true check (id),
  session_minutes integer not null default 45 check (session_minutes between 15 and 180),
  buffer_minutes integer not null default 15 check (buffer_minutes between 0 and 120),
  min_notice_minutes integer not null default 60 check (min_notice_minutes between 0 and 14400),
  max_advance_days integer not null default 10 check (max_advance_days between 1 and 90),
  check (min_notice_minutes <= max_advance_days * 1440)
);
insert into public.availability_settings (id) values (true);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.counselors(id) on delete restrict,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);
create index availability_rules_counselor_weekday on public.availability_rules (counselor_id, weekday);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.counselors(id) on delete restrict,
  local_date date not null,
  kind text not null check (kind in ('opening', 'blocked')),
  all_day boolean not null default false,
  start_time time,
  end_time time,
  check ((all_day and kind = 'blocked' and start_time is null and end_time is null)
    or (not all_day and start_time is not null and end_time is not null and start_time < end_time))
);
create index availability_exceptions_counselor_date on public.availability_exceptions (counselor_id, local_date);

create table public.availability_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  counselor_id uuid,
  object_type text not null,
  operation text not null,
  occurred_at timestamptz not null default now()
);

create function public.can_manage_availability(target_counselor uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles actor
    where actor.id = (select auth.uid()) and (
      actor.role = 'admin' or (actor.role = 'counselor' and exists (
        select 1 from public.counselors counselor
        where counselor.id = target_counselor and counselor.profile_id = actor.id
      ))
    )
  );
$$;

create function public.audit_availability()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  target_counselor uuid;
begin
  if tg_table_name <> 'availability_settings' then
    if tg_op = 'DELETE' then target_counselor := old.counselor_id;
    else target_counselor := new.counselor_id; end if;
  end if;
  insert into public.availability_audit_events (actor_user_id, counselor_id, object_type, operation)
  values (auth.uid(), target_counselor, tg_table_name, lower(tg_op));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger audit_availability_rules after insert or update or delete on public.availability_rules
for each row execute function public.audit_availability();
create trigger audit_availability_exceptions after insert or update or delete on public.availability_exceptions
for each row execute function public.audit_availability();
create trigger audit_availability_settings after update on public.availability_settings
for each row execute function public.audit_availability();

alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.availability_settings enable row level security;
alter table public.availability_audit_events enable row level security;
revoke all on public.availability_rules, public.availability_exceptions, public.availability_settings, public.availability_audit_events from public, anon, authenticated;
grant select on public.availability_rules, public.availability_exceptions, public.availability_settings to authenticated;
create policy availability_rules_read on public.availability_rules for select to authenticated using (public.can_manage_availability(counselor_id));
create policy availability_exceptions_read on public.availability_exceptions for select to authenticated using (public.can_manage_availability(counselor_id));
create policy availability_settings_read on public.availability_settings for select to authenticated using (true);
create policy counselor_self_read on public.counselors for select to authenticated
using (profile_id = (select auth.uid()) and public.can_manage_availability(id));

create function public.save_availability_rule(p_counselor_id uuid, p_id uuid, p_weekday integer, p_start_time time, p_end_time time)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare result_id uuid;
begin
  if not public.can_manage_availability(p_counselor_id) then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_id is null then
    insert into public.availability_rules (counselor_id, weekday, start_time, end_time)
    values (p_counselor_id, p_weekday, p_start_time, p_end_time) returning id into result_id;
  else
    update public.availability_rules set weekday = p_weekday, start_time = p_start_time, end_time = p_end_time
    where id = p_id and counselor_id = p_counselor_id returning id into result_id;
  end if;
  if result_id is null then raise exception using errcode = 'P0002', message = 'Rule not found'; end if;
  return result_id;
end;
$$;

create function public.save_availability_exception(p_counselor_id uuid, p_id uuid, p_local_date date, p_kind text, p_all_day boolean, p_start_time time, p_end_time time)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare result_id uuid;
begin
  if not public.can_manage_availability(p_counselor_id) then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_id is null then
    insert into public.availability_exceptions (counselor_id, local_date, kind, all_day, start_time, end_time)
    values (p_counselor_id, p_local_date, p_kind, p_all_day, p_start_time, p_end_time) returning id into result_id;
  else
    update public.availability_exceptions set local_date = p_local_date, kind = p_kind, all_day = p_all_day, start_time = p_start_time, end_time = p_end_time
    where id = p_id and counselor_id = p_counselor_id returning id into result_id;
  end if;
  if result_id is null then raise exception using errcode = 'P0002', message = 'Exception not found'; end if;
  return result_id;
end;
$$;

create function public.delete_availability(p_counselor_id uuid, p_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_manage_availability(p_counselor_id) then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_kind = 'rule' then delete from public.availability_rules where id = p_id and counselor_id = p_counselor_id;
  elsif p_kind = 'exception' then delete from public.availability_exceptions where id = p_id and counselor_id = p_counselor_id;
  else raise exception using errcode = '22023', message = 'Invalid availability kind'; end if;
  if not found then raise exception using errcode = 'P0002', message = 'Availability not found'; end if;
end;
$$;

create function public.set_availability_settings(p_session_minutes integer, p_buffer_minutes integer, p_min_notice_minutes integer, p_max_advance_days integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_catalog_admin() then raise exception using errcode = '42501', message = 'Administrator required'; end if;
  update public.availability_settings set session_minutes = p_session_minutes, buffer_minutes = p_buffer_minutes,
    min_notice_minutes = p_min_notice_minutes, max_advance_days = p_max_advance_days where id;
end;
$$;

create function public.calculate_availability_slots(p_counselor_id uuid, p_now timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with settings as (select * from public.availability_settings where id),
  dates as (
    select generated::date as local_date
    from settings, pg_catalog.generate_series(
      (p_now at time zone 'Asia/Kolkata')::date::timestamp,
      ((p_now + pg_catalog.make_interval(days => settings.max_advance_days)) at time zone 'Asia/Kolkata')::date::timestamp,
      interval '1 day'
    ) generated
  ),
  openings as (
    select dates.local_date, pg_catalog.tstzrange(
      (dates.local_date + rules.start_time) at time zone 'Asia/Kolkata',
      (dates.local_date + rules.end_time) at time zone 'Asia/Kolkata', '[)') as span
    from dates join public.availability_rules rules on rules.counselor_id = p_counselor_id
      and rules.weekday = extract(dow from dates.local_date)::integer
    union all
    select exceptions.local_date, pg_catalog.tstzrange(
      (exceptions.local_date + exceptions.start_time) at time zone 'Asia/Kolkata',
      (exceptions.local_date + exceptions.end_time) at time zone 'Asia/Kolkata', '[)')
    from public.availability_exceptions exceptions join dates on dates.local_date = exceptions.local_date
    where exceptions.counselor_id = p_counselor_id and exceptions.kind = 'opening'
  ),
  merged as (select local_date, pg_catalog.range_agg(span) as spans from openings group by local_date),
  blocks as (
    select pg_catalog.tstzrange(
      (exceptions.local_date + coalesce(exceptions.start_time, time '00:00')) at time zone 'Asia/Kolkata',
      (exceptions.local_date + coalesce(exceptions.end_time, time '24:00')) at time zone 'Asia/Kolkata', '[)') as span
    from public.availability_exceptions exceptions join dates on dates.local_date = exceptions.local_date
    where exceptions.counselor_id = p_counselor_id and exceptions.kind = 'blocked'
  )
  select slot.start_at, slot.start_at + pg_catalog.make_interval(mins => settings.session_minutes)
  from merged cross join settings cross join lateral pg_catalog.unnest(merged.spans) opening
  cross join lateral pg_catalog.generate_series(
    pg_catalog.lower(opening),
    pg_catalog.upper(opening) - pg_catalog.make_interval(mins => settings.session_minutes + settings.buffer_minutes),
    pg_catalog.make_interval(mins => settings.session_minutes + settings.buffer_minutes)
  ) slot(start_at)
  where slot.start_at >= p_now + pg_catalog.make_interval(mins => settings.min_notice_minutes)
    and slot.start_at <= p_now + pg_catalog.make_interval(days => settings.max_advance_days)
    and not exists (select 1 from blocks where blocks.span && pg_catalog.tstzrange(slot.start_at,
      slot.start_at + pg_catalog.make_interval(mins => settings.session_minutes + settings.buffer_minutes), '[)'))
  order by slot.start_at;
$$;

create function public.get_public_availability(p_counselor_id uuid)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select slots.start_at, slots.end_at from public.calculate_availability_slots(p_counselor_id, pg_catalog.now()) slots
  where exists (select 1 from public.public_counselors where id = p_counselor_id);
$$;

revoke all on function public.can_manage_availability(uuid) from public, anon;
grant execute on function public.can_manage_availability(uuid) to authenticated;
revoke all on function public.audit_availability() from public, anon, authenticated;
revoke all on function public.calculate_availability_slots(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.save_availability_rule(uuid, uuid, integer, time, time) from public, anon;
revoke all on function public.save_availability_exception(uuid, uuid, date, text, boolean, time, time) from public, anon;
revoke all on function public.delete_availability(uuid, uuid, text) from public, anon;
revoke all on function public.set_availability_settings(integer, integer, integer, integer) from public, anon;
grant execute on function public.save_availability_rule(uuid, uuid, integer, time, time),
  public.save_availability_exception(uuid, uuid, date, text, boolean, time, time),
  public.delete_availability(uuid, uuid, text), public.set_availability_settings(integer, integer, integer, integer) to authenticated;
revoke all on function public.get_public_availability(uuid) from public;
grant execute on function public.get_public_availability(uuid) to anon, authenticated;