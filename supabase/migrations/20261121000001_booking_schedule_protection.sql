create function public.lock_booking_schedule()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(70324004);
  return null;
end;
$$;

create function public.validate_booking_schedule()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.bookings booking cross join public.availability_settings settings
    where settings.id and booking.start_at > pg_catalog.now()
      and (booking.status = 'confirmed' or (booking.status = 'held' and booking.hold_expires_at > pg_catalog.now()))
      and not exists (
        select 1 from public.calculate_availability_slots(booking.counselor_id,
          booking.start_at - pg_catalog.make_interval(mins => settings.min_notice_minutes)) slot
        where slot.start_at = booking.start_at and slot.end_at = booking.end_at
          and slot.end_at + pg_catalog.make_interval(mins => settings.buffer_minutes) = booking.buffer_end_at
      )
  ) then raise exception using errcode = '23514', message = 'Change conflicts with an active hold or confirmed appointment'; end if;
  return null;
end;
$$;

create trigger availability_rules_booking_lock before insert or update or delete on public.availability_rules
for each statement execute function public.lock_booking_schedule();
create trigger availability_rules_booking_check after insert or update or delete on public.availability_rules
for each statement execute function public.validate_booking_schedule();
create trigger availability_exceptions_booking_lock before insert or update or delete on public.availability_exceptions
for each statement execute function public.lock_booking_schedule();
create trigger availability_exceptions_booking_check after insert or update or delete on public.availability_exceptions
for each statement execute function public.validate_booking_schedule();
create trigger availability_settings_booking_lock before update on public.availability_settings
for each statement execute function public.lock_booking_schedule();
create trigger availability_settings_booking_check after update on public.availability_settings
for each statement execute function public.validate_booking_schedule();

create function public.reschedule_booking(p_booking_id uuid, p_counselor_id uuid, p_start_at timestamptz)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  original public.bookings%rowtype;
  selected_end timestamptz;
  selected_buffer integer;
begin
  if actor_id is null or not exists (
    select 1 from public.profiles where id = actor_id and role = 'customer' and email is not null
  ) then raise exception using errcode = '42501', message = 'Customer authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(70324004);
  update public.bookings set status = 'expired', updated_at = pg_catalog.now()
  where status = 'held' and hold_expires_at <= pg_catalog.now();
  select * into original from public.bookings where id = p_booking_id and customer_id = actor_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found'; end if;
  if original.status <> 'confirmed' then raise exception using errcode = '23514', message = 'Only confirmed appointments can be rescheduled'; end if;
  if original.reschedule_count <> 0 then raise exception using errcode = '23514', message = 'Appointment already rescheduled'; end if;
  if original.start_at < pg_catalog.now() + interval '24 hours' then raise exception using errcode = '23514', message = 'Rescheduling requires at least 24 hours notice'; end if;
  if p_counselor_id <> original.counselor_id then raise exception using errcode = '23514', message = 'Rescheduling must keep the same counselor'; end if;
  select slots.end_at into selected_end from public.get_public_availability(p_counselor_id) slots where slots.start_at = p_start_at;
  if selected_end is null then raise exception using errcode = '23514', message = 'Slot unavailable'; end if;
  select buffer_minutes into selected_buffer from public.availability_settings where id;
  update public.bookings set start_at = p_start_at, end_at = selected_end,
    buffer_end_at = selected_end + pg_catalog.make_interval(mins => selected_buffer),
    reschedule_count = 1, updated_at = pg_catalog.now() where id = p_booking_id;
  insert into public.booking_audit_events (actor_user_id, booking_id, action, old_start_at, new_start_at)
  values (actor_id, p_booking_id, 'rescheduled', original.start_at, p_start_at);
  return p_booking_id;
end;
$$;

revoke all on function public.lock_booking_schedule() from public, anon, authenticated;
revoke all on function public.validate_booking_schedule() from public, anon, authenticated;
revoke all on function public.reschedule_booking(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_booking(uuid, uuid, timestamptz) to authenticated;