create function public.get_my_bookings()
returns table (id uuid, counselor_id uuid, counselor_name text, start_at timestamptz, end_at timestamptz,
  status text, hold_expires_at timestamptz, reschedule_count integer)
language sql stable security definer set search_path = ''
as $$
  select booking.id, booking.counselor_id, counselor.display_name, booking.start_at, booking.end_at,
    case when booking.status = 'held' and booking.hold_expires_at <= pg_catalog.now() then 'expired' else booking.status end,
    booking.hold_expires_at, booking.reschedule_count
  from public.bookings booking join public.counselors counselor on counselor.id = booking.counselor_id
  where booking.customer_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'customer' and email is not null)
  order by booking.start_at desc;
$$;
revoke all on function public.get_my_bookings() from public, anon;
grant execute on function public.get_my_bookings() to authenticated;