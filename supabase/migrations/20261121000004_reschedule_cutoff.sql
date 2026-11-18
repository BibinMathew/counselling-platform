create function public.is_reschedule_in_time(p_start_at timestamptz, p_checked_at timestamptz)
returns boolean language sql immutable set search_path = ''
as $$
  select p_start_at >= p_checked_at + interval '24 hours';
$$;
revoke all on function public.is_reschedule_in_time(timestamptz, timestamptz) from public, anon, authenticated;

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
  if not public.is_reschedule_in_time(original.start_at, locked_at) then raise exception using errcode = '23514', message = 'Rescheduling requires at least 24 hours notice'; end if;
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