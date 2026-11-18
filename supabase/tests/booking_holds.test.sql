begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, aud, role, phone, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data)
values
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', '+919555555501', now(), '{}', '{}'),
  ('77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', '+919555555502', now(), '{}', '{}'),
  ('88888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', '+919555555503', now(), '{}', '{}'),
  ('99999999-9999-4999-8999-999999999999', 'authenticated', 'authenticated', '+919555555504', now(), '{}', '{}');
update public.profiles set role = 'admin', email = 'admin@example.test' where id = '66666666-6666-4666-8666-666666666666';
update public.profiles set role = 'counselor', email = 'counselor@example.test' where id = '77777777-7777-4777-8777-777777777777';
update public.profiles set email = 'customer@example.test' where id in ('88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999');
set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
insert into public.counselors (id, profile_id, display_name, bio, qualifications, experience, specialties, languages, photo_url, published)
values ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', '77777777-7777-4777-8777-777777777777', 'Booking Test', 'Bio', 'Degree', 'Experience', 'Specialty', 'English', 'https://example.test/photo.jpg', true);
select lives_ok($$select public.set_booking_hold_minutes(5)$$, 'admin can configure hold duration');
select throws_ok($$select public.set_booking_hold_minutes(0)$$, '23514', null, 'zero-minute holds are rejected');
select throws_ok($$select public.set_booking_hold_minutes(61)$$, '23514', null, 'hold duration above 60 minutes is rejected');
select throws_ok($$select public.set_booking_hold_minutes(null)$$, '23502', null, 'null hold duration is rejected');
select ok(not has_function_privilege('anon', 'public.create_booking_hold(uuid,timestamptz)', 'EXECUTE'), 'anonymous users cannot create holds');
select public.save_availability_exception('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', null, (now() at time zone 'Asia/Kolkata')::date + 2, 'opening', false, '10:00', '13:00');
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
select throws_ok($$select public.create_booking_hold('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata')$$, '42501', 'Customer authentication required', 'counselors cannot create customer holds');
reset role;
update public.profiles set email = null where id = '99999999-9999-4999-8999-999999999999';
set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select throws_ok($$select public.create_booking_hold('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata')$$, '42501', 'Customer authentication required', 'incomplete customer profiles cannot create holds');
reset role;
update public.profiles set email = 'customer@example.test' where id = '99999999-9999-4999-8999-999999999999';
set local role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select throws_ok($$select public.create_booking_hold('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:30') at time zone 'Asia/Kolkata')$$, '23514', 'Slot unavailable', 'a time that is not a generated slot cannot be held');
select is((select count(*)::integer from public.booking_settings), 0, 'customers cannot read private booking settings');
select ok(not has_table_privilege('authenticated', 'public.booking_audit_events', 'SELECT'), 'customers cannot read private booking audit events');
select ok(not has_table_privilege('authenticated', 'public.bookings', 'INSERT'), 'customers cannot insert bookings directly');
select ok(not has_table_privilege('authenticated', 'public.bookings', 'DELETE'), 'customers cannot delete bookings directly');
select lives_ok($$select public.create_booking_hold('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata')$$, 'customer can hold a published available slot');
select is((select count(*)::integer from public.bookings), 1, 'customer can see their hold');
select ok((select hold_expires_at - created_at >= interval '5 minutes' and hold_expires_at - created_at < interval '6 minutes' from public.bookings limit 1), 'new hold uses the configured duration');
select set_config('test.original_hold_expiry', (select hold_expires_at::text from public.bookings limit 1), true);
select is((select counselor_name from public.get_my_bookings() limit 1), 'Booking Test', 'customer can see the counselor name for their hold');
select is((select count(*)::integer from public.get_public_availability('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')), 2, 'active hold hides its slot');
select lives_ok($$select public.create_booking_hold('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata')$$, 'retrying the same hold is idempotent');
select is((select hold_expires_at::text from public.bookings limit 1), current_setting('test.original_hold_expiry'), 'retry does not extend the hold');
select is((select count(*)::integer from public.bookings), 1, 'retry does not create another hold');
select throws_ok($$update public.bookings set status = 'confirmed'$$, '42501', null, 'customer cannot confirm a booking directly');
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select is((select count(*)::integer from public.bookings), 0, 'another customer cannot see the hold');
select is((select count(*)::integer from public.get_my_bookings()), 0, 'customer booking summary excludes other customers');
select throws_ok($$select public.create_booking_hold('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata')$$, '23514', 'Slot unavailable', 'another customer cannot hold the same slot');
reset role;
update public.bookings set hold_expires_at = now() - interval '1 second' where customer_id = '88888888-8888-4888-8888-888888888888';
set local role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select is((select status from public.get_my_bookings() limit 1), 'expired', 'an expired hold is displayed as expired before cleanup');
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select lives_ok($$select public.create_booking_hold('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata')$$, 'expired hold can be replaced');
reset role;
select is((select count(*)::integer from public.bookings where status = 'expired' and customer_id = '88888888-8888-4888-8888-888888888888'), 1, 'expired hold transitions before the replacement');
select is((select count(*)::integer from public.booking_audit_events where action = 'expired' and booking_id in (select id from public.bookings where customer_id = '88888888-8888-4888-8888-888888888888')), 1, 'hold expiration is audited');
update public.profiles set role = 'counselor' where id = '99999999-9999-4999-8999-999999999999';
select throws_ok($$insert into public.bookings (customer_id, counselor_id, start_at, end_at, buffer_end_at, hold_expires_at) values ('99999999-9999-4999-8999-999999999999', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', now() + interval '4 days', now() + interval '4 days 45 minutes', now() + interval '4 days 1 hour', now() + interval '10 minutes')$$, '42501', 'Customer authentication required', 'booking write rechecks the customer role');
update public.profiles set role = 'customer' where id = '99999999-9999-4999-8999-999999999999';
update public.counselors set published = false where id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
select throws_ok($$insert into public.bookings (customer_id, counselor_id, start_at, end_at, buffer_end_at, hold_expires_at) values ('99999999-9999-4999-8999-999999999999', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', now() + interval '4 days', now() + interval '4 days 45 minutes', now() + interval '4 days 1 hour', now() + interval '10 minutes')$$, '23514', 'Slot unavailable', 'booking write rechecks counselor publication');
select * from finish();
rollback;