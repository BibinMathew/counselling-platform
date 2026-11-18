create function public.lock_booking_participants()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.profiles
  where id = new.customer_id and role = 'customer' and email is not null
  for share;
  if not found then raise exception using errcode = '42501', message = 'Customer authentication required'; end if;

  perform 1 from public.counselors counselor
  join public.profiles profile on profile.id = counselor.profile_id
  where counselor.id = new.counselor_id and counselor.published and profile.role = 'counselor'
  for share of counselor, profile;
  if not found then raise exception using errcode = '23514', message = 'Slot unavailable'; end if;
  return new;
end;
$$;

create trigger bookings_participant_lock before insert or update of customer_id, counselor_id, start_at, end_at, buffer_end_at
on public.bookings for each row execute function public.lock_booking_participants();
revoke all on function public.lock_booking_participants() from public, anon, authenticated;