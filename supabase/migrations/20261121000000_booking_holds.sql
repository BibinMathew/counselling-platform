create extension if not exists btree_gist with schema extensions;

create table public.booking_settings (
  id boolean primary key default true check (id),
  hold_minutes integer not null default 10 check (hold_minutes between 1 and 60)
);
insert into public.booking_settings (id) values (true);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  counselor_id uuid not null references public.counselors(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  buffer_end_at timestamptz not null,
  status text not null default 'held' check (status in ('held', 'confirmed', 'expired')),
  hold_expires_at timestamptz not null,
  reschedule_count integer not null default 0 check (reschedule_count between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at and end_at <= buffer_end_at),
  constraint bookings_no_counselor_overlap exclude using gist (
    counselor_id with =, tstzrange(start_at, buffer_end_at, '[)') with &&
  ) where (status in ('held', 'confirmed')),
  constraint bookings_no_customer_overlap exclude using gist (
    customer_id with =, tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('held', 'confirmed'))
);

create table public.booking_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  booking_id uuid,
  action text not null check (action in ('held', 'expired', 'rescheduled', 'settings_changed')),
  old_start_at timestamptz,
  new_start_at timestamptz,
  occurred_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
alter table public.booking_settings enable row level security;
alter table public.booking_audit_events enable row level security;
revoke all on public.bookings, public.booking_settings, public.booking_audit_events from public, anon, authenticated;
grant select on public.bookings, public.booking_settings to authenticated;
create policy bookings_select_self on public.bookings for select to authenticated using (customer_id = (select auth.uid()));
create policy booking_settings_read on public.booking_settings for select to authenticated using ((select public.is_catalog_admin()));

create function public.create_booking_hold(p_counselor_id uuid, p_start_at timestamptz)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_end timestamptz;
  selected_buffer integer;
  hold_duration integer;
  existing_id uuid;
  result_id uuid;
begin
  if actor_id is null or not exists (
    select 1 from public.profiles where id = actor_id and role = 'customer' and email is not null
  ) then raise exception using errcode = '42501', message = 'Customer authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(70324004);
  update public.bookings set status = 'expired', updated_at = pg_catalog.now()
  where status = 'held' and hold_expires_at <= pg_catalog.now();

  select id into existing_id from public.bookings
  where customer_id = actor_id and counselor_id = p_counselor_id
    and start_at = p_start_at and status = 'held' and hold_expires_at > pg_catalog.now();
  if existing_id is not null then return existing_id; end if;

  select slots.end_at into selected_end from public.get_public_availability(p_counselor_id) slots
  where slots.start_at = p_start_at;
  if selected_end is null then raise exception using errcode = '23514', message = 'Slot unavailable'; end if;
  select buffer_minutes into selected_buffer from public.availability_settings where id;
  select hold_minutes into hold_duration from public.booking_settings where id;
  insert into public.bookings (customer_id, counselor_id, start_at, end_at, buffer_end_at, hold_expires_at)
  values (actor_id, p_counselor_id, p_start_at, selected_end,
    selected_end + pg_catalog.make_interval(mins => selected_buffer),
    pg_catalog.now() + pg_catalog.make_interval(mins => hold_duration)) returning id into result_id;
  insert into public.booking_audit_events (actor_user_id, booking_id, action, new_start_at)
  values (actor_id, result_id, 'held', p_start_at);
  return result_id;
end;
$$;

create or replace function public.get_public_availability(p_counselor_id uuid)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select slots.start_at, slots.end_at from public.calculate_availability_slots(p_counselor_id, pg_catalog.now()) slots
  cross join public.availability_settings settings
  where settings.id and exists (select 1 from public.public_counselors where id = p_counselor_id)
    and not exists (
      select 1 from public.bookings booking where booking.counselor_id = p_counselor_id
        and (booking.status = 'confirmed' or (booking.status = 'held' and booking.hold_expires_at > pg_catalog.now()))
        and pg_catalog.tstzrange(booking.start_at, booking.buffer_end_at, '[)') &&
          pg_catalog.tstzrange(slots.start_at, slots.end_at + pg_catalog.make_interval(mins => settings.buffer_minutes), '[)')
    )
  order by slots.start_at;
$$;

create function public.set_booking_hold_minutes(p_hold_minutes integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_catalog_admin() then raise exception using errcode = '42501', message = 'Administrator required'; end if;
  update public.booking_settings set hold_minutes = p_hold_minutes where id;
  insert into public.booking_audit_events (actor_user_id, action) values (auth.uid(), 'settings_changed');
end;
$$;

revoke all on function public.create_booking_hold(uuid, timestamptz) from public, anon;
grant execute on function public.create_booking_hold(uuid, timestamptz) to authenticated;
revoke all on function public.set_booking_hold_minutes(integer) from public, anon;
grant execute on function public.set_booking_hold_minutes(integer) to authenticated;