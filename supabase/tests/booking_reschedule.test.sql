begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, aud, role, phone, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data)
values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'authenticated', 'authenticated', '+919666666601', now(), '{}', '{}'),
  ('bbbbbbbb-2222-4222-8222-222222222222', 'authenticated', 'authenticated', '+919666666602', now(), '{}', '{}'),
  ('cccccccc-3333-4333-8333-333333333333', 'authenticated', 'authenticated', '+919666666603', now(), '{}', '{}'),
  ('dddddddd-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '+919666666604', now(), '{}', '{}');
update public.profiles set role = 'admin', email = 'admin@example.test' where id = 'aaaaaaaa-1111-4111-8111-111111111111';
update public.profiles set role = 'counselor', email = 'counselor@example.test' where id = 'bbbbbbbb-2222-4222-8222-222222222222';
update public.profiles set email = 'customer@example.test' where id in ('cccccccc-3333-4333-8333-333333333333', 'dddddddd-4444-4444-8444-444444444444');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-4111-8111-111111111111', true);
insert into public.counselors (id, profile_id, display_name, bio, qualifications, experience, category, specialties, languages, photo_url, published)
values ('eeeeeeee-5555-4555-8555-555555555555', 'bbbbbbbb-2222-4222-8222-222222222222', 'Reschedule Test', 'Bio', 'Degree', 'Experience', 'consultant_psychologist', 'Specialty', 'English', 'https://example.test/photo.jpg', true);
select public.save_availability_exception('eeeeeeee-5555-4555-8555-555555555555', null, (now() at time zone 'Asia/Kolkata')::date + 2, 'opening', false, '10:00', '13:00');
select lives_ok($$select public.set_booking_hold_minutes(10)$$, 'admin can set hold duration');
select set_config('request.jwt.claim.sub', 'cccccccc-3333-4333-8333-333333333333', true);
select throws_ok($$select public.set_booking_hold_minutes(10)$$, '42501', 'Administrator required', 'customer cannot change hold duration');
select public.create_booking_hold('eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata');
select set_config('test.target_booking_id', (select id::text from public.bookings limit 1), true);
select throws_ok($$select public.reschedule_booking((select id from public.bookings limit 1), 'eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '11:00') at time zone 'Asia/Kolkata')$$, '23514', 'Only confirmed appointments can be rescheduled', 'unpaid holds cannot be rescheduled');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-4111-8111-111111111111', true);
select throws_ok($$select public.save_availability_exception('eeeeeeee-5555-4555-8555-555555555555', null, (now() at time zone 'Asia/Kolkata')::date + 2, 'blocked', true, null, null)$$, '23514', 'Change conflicts with an active hold or confirmed appointment', 'admin cannot block an active hold');
select throws_ok($$select public.delete_availability('eeeeeeee-5555-4555-8555-555555555555', (select id from public.availability_exceptions where counselor_id = 'eeeeeeee-5555-4555-8555-555555555555' and kind = 'opening'), 'exception')$$, '23514', 'Change conflicts with an active hold or confirmed appointment', 'admin cannot delete an opening with an active hold');
reset role;
update public.bookings set status = 'confirmed' where customer_id = 'cccccccc-3333-4333-8333-333333333333';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-4444-4444-8444-444444444444', true);
select throws_ok($$select public.reschedule_booking(current_setting('test.target_booking_id')::uuid, 'eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '11:00') at time zone 'Asia/Kolkata')$$, 'P0002', 'Booking not found', 'another customer cannot reschedule the appointment even when its ID is known');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-4111-8111-111111111111', true);
select throws_ok($$select public.save_availability_exception('eeeeeeee-5555-4555-8555-555555555555', null, (now() at time zone 'Asia/Kolkata')::date + 2, 'blocked', true, null, null)$$, '23514', 'Change conflicts with an active hold or confirmed appointment', 'admin cannot block a confirmed appointment');
select throws_ok($$select public.delete_availability('eeeeeeee-5555-4555-8555-555555555555', (select id from public.availability_exceptions where counselor_id = 'eeeeeeee-5555-4555-8555-555555555555' and kind = 'opening'), 'exception')$$, '23514', 'Change conflicts with an active hold or confirmed appointment', 'admin cannot delete an opening with a confirmed appointment');
select throws_ok($$select public.set_availability_settings(30, 15, 60, 10)$$, '23514', 'Change conflicts with an active hold or confirmed appointment', 'settings cannot invalidate a confirmed appointment');
select set_config('request.jwt.claim.sub', 'cccccccc-3333-4333-8333-333333333333', true);
select throws_ok($$select public.reschedule_booking((select id from public.bookings limit 1), 'ffffffff-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '11:00') at time zone 'Asia/Kolkata')$$, '23514', 'Rescheduling must keep the same counselor', 'rescheduling cannot switch counselors');
select throws_ok($$select public.reschedule_booking(current_setting('test.target_booking_id')::uuid, 'eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '10:00') at time zone 'Asia/Kolkata')$$, '23514', 'Slot unavailable', 'rescheduling to an unavailable time is rejected');
select is((select reschedule_count from public.bookings limit 1), 0, 'a rejected reschedule does not consume the reschedule allowance');
select lives_ok($$select public.reschedule_booking((select id from public.bookings limit 1), 'eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '11:00') at time zone 'Asia/Kolkata')$$, 'owner can reschedule a confirmed appointment once');
select is((select reschedule_count from public.bookings limit 1), 1, 'reschedule count is recorded');
select throws_ok($$select public.reschedule_booking((select id from public.bookings limit 1), 'eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '12:00') at time zone 'Asia/Kolkata')$$, '23514', 'Appointment already rescheduled', 'a second reschedule is rejected');
reset role;
insert into public.bookings (id, customer_id, counselor_id, start_at, end_at, buffer_end_at, status, hold_expires_at)
values ('ffffffff-6666-4666-8666-666666666666', 'dddddddd-4444-4444-8444-444444444444', 'eeeeeeee-5555-4555-8555-555555555555', now() + interval '23 hours 59 minutes', now() + interval '24 hours 44 minutes', now() + interval '24 hours 59 minutes', 'confirmed', now());
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-4444-4444-8444-444444444444', true);
select throws_ok($$select public.reschedule_booking('ffffffff-6666-4666-8666-666666666666', 'eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '12:00') at time zone 'Asia/Kolkata')$$, '23514', 'Rescheduling requires at least 24 hours notice', 'rescheduling at 23 hours 59 minutes is rejected');
reset role;
select ok(public.is_reschedule_in_time('2031-01-02 10:00+00', '2031-01-01 10:00+00'), 'exactly 24 hours satisfies the cutoff');
select ok(not public.is_reschedule_in_time('2031-01-02 09:59:59+00', '2031-01-01 10:00+00'), 'one second below 24 hours fails the cutoff');
update public.bookings set start_at = now() + interval '24 hours 1 minute', end_at = now() + interval '24 hours 46 minutes', buffer_end_at = now() + interval '25 hours 1 minute' where id = 'ffffffff-6666-4666-8666-666666666666';
set local role authenticated;
select lives_ok($$select public.reschedule_booking('ffffffff-6666-4666-8666-666666666666', 'eeeeeeee-5555-4555-8555-555555555555', (((now() at time zone 'Asia/Kolkata')::date + 2) + time '12:00') at time zone 'Asia/Kolkata')$$, 'rescheduling beyond 24 hours is allowed');
reset role;
select is((select count(*)::integer from public.booking_audit_events where action = 'rescheduled' and actor_user_id = 'cccccccc-3333-4333-8333-333333333333'), 1, 'reschedule is audited');
select ok(not has_table_privilege('authenticated', 'public.bookings', 'UPDATE'), 'authenticated clients cannot directly confirm bookings');
select * from finish();
rollback;