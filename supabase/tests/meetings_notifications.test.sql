begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,aud,role,phone,phone_confirmed_at,raw_user_meta_data,raw_app_meta_data) values
 ('f6000000-0000-4000-8000-000000000001','authenticated','authenticated','+919566660001',now(),'{}','{}'),
 ('f6000000-0000-4000-8000-000000000002','authenticated','authenticated','+919566660002',now(),'{}','{}'),
 ('f6000000-0000-4000-8000-000000000003','authenticated','authenticated','+919566660003',now(),'{}','{}'),
 ('f6000000-0000-4000-8000-000000000004','authenticated','authenticated','+919566660004',now(),'{}','{}');
update public.profiles set email='synthetic@example.test' where id::text like 'f6000000-%';
update public.profiles set role='admin' where id='f6000000-0000-4000-8000-000000000001';
update public.profiles set role='counselor' where id='f6000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,category,specialties,languages,photo_url,published)
values('f6100000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000002','Notification Fixture','Test','Test','Test','consultant_psychologist','Test','English','https://example.test/a.png',true);
create temp table nf(n integer primary key,b uuid);
grant all on nf to authenticated;
create function pg_temp.make_booking(n integer,t timestamptz default null,s text default 'confirmed') returns uuid language plpgsql as $$
declare booking uuid:=gen_random_uuid(); start_time timestamptz:=coalesce(t,now()+interval '2 days'+n*interval '2 hours');
begin
 insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,hold_expires_at,status)
 values(booking,'f6000000-0000-4000-8000-000000000003','f6100000-0000-4000-8000-000000000001',start_time,start_time+interval '45 minutes',start_time+interval '1 hour',now()+interval '10 minutes',s);
 insert into nf values(n,booking); return booking;
end; $$;
select pg_temp.make_booking(1);
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1)),4,'confirmation atomically creates four jobs');
select public.queue_booking_notifications((select b from nf where n=1),false);
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1)),4,'enqueue replay deduplicates');
update public.bookings set status='confirmed' where id=(select b from nf where n=1);
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1)),4,'confirmation replay does not add jobs');
select pg_temp.make_booking(2,null,'held');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=2)),0,'holds produce no jobs');
select pg_temp.make_booking(3,now()+interval '70 minutes');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=3) and template='reminder_24h'),0,'70-minute booking skips 24-hour reminder');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=3) and template='reminder_1h'),1,'70-minute booking schedules 1-hour reminder');
select pg_temp.make_booking(4,now()+interval '24 hours');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=4) and template='reminder_24h'),0,'exact 24-hour boundary is skipped');
update public.bookings set status='expired' where id=(select b from nf where n=3);
select pg_temp.make_booking(6,now()+interval '1 hour');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=6) and template='reminder_1h'),0,'exact one-hour boundary is skipped');
select pg_temp.make_booking(5,now()-interval '1 day');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=5)),0,'past bookings produce no jobs');
select ok(not has_table_privilege('authenticated','public.notification_jobs','insert'),'browser cannot create jobs');
select ok(not has_table_privilege('authenticated','public.booking_meetings','select'),'meeting tables have no raw browser reads');
select ok(not has_table_privilege('authenticated','public.notification_simulator_receipts','select'),'synthetic previews are service-only');
select ok(not has_function_privilege('authenticated','public.queue_booking_notifications(uuid,boolean)','execute'),'enqueue is private');
select public.set_booking_meeting((select b from nf where n=1),'https://meet.google.com/abc-defg-hij');
select is((select revision from public.booking_meetings where booking_id=(select b from nf where n=1)),1,'admin assigns first revision');
select public.set_booking_meeting((select b from nf where n=1),'https://meet.google.com/abc-defg-hij');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1) and template='link_update'),1,'same link is a no-op');
select throws_ok($$select public.set_booking_meeting((select b from nf where n=2),'https://meet.google.com/aaa-bbbb-ccc')$$,'23514','Future confirmed booking required','held booking cannot receive a link');
select throws_ok($$select public.set_booking_meeting((select b from nf where n=1),'https://meet.google.com/abc-defg-hij?q=bad')$$,'23514','Invalid Meet URL','SQL rejects noncanonical links');
select public.set_booking_meeting((select b from nf where n=1),'https://meet.google.com/xyz-uvwx-rst');
select throws_ok($$select public.set_booking_meeting((select b from nf where n=4),'https://meet.google.com/abc-defg-hij')$$,'23514','Meet link already assigned','historical URLs cannot cross bookings');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1) and template='link_update' and status='superseded'),1,'replacement supersedes pending link update');
set local role authenticated;
select is((select count(*)::int from public.get_accessible_booking_meetings() where booking_id=(select b from nf where n=1)),1,'admin can read meetings');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.get_accessible_booking_meetings() where booking_id=(select b from nf where n=1)),1,'owning customer can read meeting');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1)),0,'customer cannot read jobs');
select throws_ok($$select public.set_booking_meeting((select b from nf where n=1),'https://meet.google.com/aaa-bbbb-ccc')$$,'42501','Administrator required','customer cannot attach link');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select is((select count(*)::int from public.get_accessible_booking_meetings() where booking_id=(select b from nf where n=1)),0,'foreign customer cannot read meeting');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.get_accessible_booking_meetings() where booking_id=(select b from nf where n=1)),1,'assigned counselor can read meeting');
reset role;
update public.profiles set role='customer' where id='f6000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.get_accessible_booking_meetings() where booking_id=(select b from nf where n=1)),0,'revoked counselor role loses meeting access');
update public.profiles set role='counselor' where id='f6000000-0000-4000-8000-000000000002';
update public.bookings set start_at=start_at+interval '1 hour',end_at=end_at+interval '1 hour',buffer_end_at=buffer_end_at+interval '1 hour',reschedule_count=1 where id=(select b from nf where n=1);
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1) and status='superseded'),6,'rescheduling supersedes all unfinished old work');
select is((select count(*)::int from public.notification_jobs where booking_id=(select b from nf where n=1) and schedule_revision=1),4,'rescheduling schedules updates and replacement reminders');
select is((select meeting_url from public.booking_meetings where booking_id=(select b from nf where n=1)),'https://meet.google.com/xyz-uvwx-rst','rescheduling retains current Meet link');
select * from finish(); rollback;
