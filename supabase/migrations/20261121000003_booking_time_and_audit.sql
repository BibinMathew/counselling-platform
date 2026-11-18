alter table public.booking_audit_events drop constraint booking_audit_events_action_check;
alter table public.booking_audit_events add constraint booking_audit_events_action_check
  check (action in ('held', 'expired', 'confirmed', 'rescheduled', 'settings_changed'));

create function public.audit_booking_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.booking_audit_events (actor_user_id, booking_id, action, old_start_at, new_start_at)
  values (auth.uid(), new.id, new.status, old.start_at, new.start_at);
  return new;
end;
$$;
create trigger bookings_status_audit after update of status on public.bookings
for each row when (old.status is distinct from new.status)
execute function public.audit_booking_status();
revoke all on function public.audit_booking_status() from public, anon, authenticated;

create or replace function public.create_booking_hold(p_counselor_id uuid, p_start_at timestamptz)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  locked_at timestamptz;
  selected_end timestamptz;
  selected_buffer integer;
  notice_minutes integer;
  advance_days integer;
  hold_duration integer;
  existing_id uuid;
  result_id uuid;
begin
  if actor_id is null or not exists (
    select 1 from public.profiles where id = actor_id and role = 'customer' and email is not null
  ) then raise exception using errcode = '42501', message = 'Customer authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(70324004);
  locked_at := pg_catalog.clock_timestamp();
  update public.bookings set status = 'expired', updated_at = locked_at
  where status = 'held' and hold_expires_at <= locked_at;

  select id into existing_id from public.bookings
  where customer_id = actor_id and counselor_id = p_counselor_id
    and start_at = p_start_at and status = 'held' and hold_expires_at > locked_at;
  if existing_id is not null then return existing_id; end if;

  select buffer_minutes, min_notice_minutes, max_advance_days into selected_buffer, notice_minutes, advance_days
  from public.availability_settings where id;
  if p_start_at < locked_at + pg_catalog.make_interval(mins => notice_minutes)
    or p_start_at > locked_at + pg_catalog.make_interval(days => advance_days)
  then raise exception using errcode = '23514', message = 'Slot unavailable'; end if;
  select slots.end_at into selected_end from public.get_public_availability(p_counselor_id) slots
  where slots.start_at = p_start_at;
  if selected_end is null then raise exception using errcode = '23514', message = 'Slot unavailable'; end if;
  select hold_minutes into hold_duration from public.booking_settings where id;
  insert into public.bookings (customer_id, counselor_id, start_at, end_at, buffer_end_at, hold_expires_at)
  values (actor_id, p_counselor_id, p_start_at, selected_end,
    selected_end + pg_catalog.make_interval(mins => selected_buffer),
    locked_at + pg_catalog.make_interval(mins => hold_duration)) returning id into result_id;
  insert into public.booking_audit_events (actor_user_id, booking_id, action, new_start_at)
  values (actor_id, result_id, 'held', p_start_at);
  return result_id;
end;
$$;

create or replace function public.reschedule_booking(p_booking_id uuid, p_counselor_id uuid, p_start_at timestamptz)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  locked_at timestamptz;
  original public.bookings%rowtype;
  selected_end timestamptz;
  selected_buffer integer;
  notice_minutes integer;
  advance_days integer;
begin
  if actor_id is null or not exists (
    select 1 from public.profiles where id = actor_id and role = 'customer' and email is not null
  ) then raise exception using errcode = '42501', message = 'Customer authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(70324004);
  locked_at := pg_catalog.clock_timestamp();
  update public.bookings set status = 'expired', updated_at = locked_at
  where status = 'held' and hold_expires_at <= locked_at;
  select * into original from public.bookings where id = p_booking_id and customer_id = actor_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found'; end if;
  if original.status <> 'confirmed' then raise exception using errcode = '23514', message = 'Only confirmed appointments can be rescheduled'; end if;
  if original.reschedule_count <> 0 then raise exception using errcode = '23514', message = 'Appointment already rescheduled'; end if;
  if original.start_at < locked_at + interval '24 hours' then raise exception using errcode = '23514', message = 'Rescheduling requires at least 24 hours notice'; end if;
  if p_counselor_id <> original.counselor_id then raise exception using errcode = '23514', message = 'Rescheduling must keep the same counselor'; end if;
  select buffer_minutes, min_notice_minutes, max_advance_days into selected_buffer, notice_minutes, advance_days
  from public.availability_settings where id;
  if p_start_at < locked_at + pg_catalog.make_interval(mins => notice_minutes)
    or p_start_at > locked_at + pg_catalog.make_interval(days => advance_days)
  then raise exception using errcode = '23514', message = 'Slot unavailable'; end if;
  select slots.end_at into selected_end from public.get_public_availability(p_counselor_id) slots where slots.start_at = p_start_at;
  if selected_end is null then raise exception using errcode = '23514', message = 'Slot unavailable'; end if;
  update public.bookings set start_at = p_start_at, end_at = selected_end,
    buffer_end_at = selected_end + pg_catalog.make_interval(mins => selected_buffer),
    reschedule_count = 1, updated_at = locked_at where id = p_booking_id;
  insert into public.booking_audit_events (actor_user_id, booking_id, action, old_start_at, new_start_at)
  values (actor_id, p_booking_id, 'rescheduled', original.start_at, p_start_at);
  return p_booking_id;
end;
$$;