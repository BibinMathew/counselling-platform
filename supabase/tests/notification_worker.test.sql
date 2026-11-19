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
insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,specialties,languages,photo_url,published)
values('f6100000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000002','Notification Fixture','Test','Test','Test','Test','English','https://example.test/a.png',true);
create temp table nf(n integer primary key,b uuid);
grant all on nf to authenticated;
create function pg_temp.make_booking(n integer,t timestamptz default null,s text default 'confirmed') returns uuid language plpgsql as $$
declare booking uuid:=gen_random_uuid(); start_time timestamptz:=coalesce(t,now()+interval '2 days'+n*interval '2 hours');
begin
 insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,hold_expires_at,status)
 values(booking,'f6000000-0000-4000-8000-000000000003','f6100000-0000-4000-8000-000000000001',start_time,start_time+interval '45 minutes',start_time+interval '1 hour',now()+interval '10 minutes',s);
 insert into nf values(n,booking); return booking;
end; $$;
-- Isolate the transactional fixture from the user's due jobs.
update public.notification_jobs set next_attempt_at=now()+interval '10 days' where status in ('queued','retrying');
select pg_temp.make_booking(1);
create temp table nc as select * from public.claim_notification_jobs(20);
select is((select count(*)::int from nc),2,'only due confirmation and counselor alert claimed');
select is((select count(*)::int from public.claim_notification_jobs(20)),0,'overlapping workers cannot reclaim live leases');
select is(public.dispatch_simulated_notification((select id from nc limit 1),gen_random_uuid(),'http://127.0.0.1:3000'),'stale','wrong token cannot complete');
select is((select count(*)::int from public.notification_simulator_receipts where job_id in(select id from nc)),0,'wrong token creates no receipt');
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc;
select is((select count(*)::int from public.notification_simulator_receipts where job_id in(select id from nc)),2,'claimed jobs persist receipts');
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc;
select is((select count(*)::int from public.notification_simulator_receipts where job_id in(select id from nc)),2,'completion replay cannot duplicate receipt');
select ok(not exists(select 1 from public.notification_simulator_receipts where job_id in(select id from nc) and (body like '%meet.google.com%' or body like '%synthetic@example.test%')),'messages contain no Meet URL or personal contacts');
update public.bookings set start_at=start_at+interval '1 hour',end_at=end_at+interval '1 hour',buffer_end_at=buffer_end_at+interval '1 hour',reschedule_count=1 where id=(select b from nf where n=1);
select is((select count(*)::int from public.notification_simulator_receipts where job_id in(select id from nc)),2,'rescheduling preserves delivered history');
select is((select count(*)::int from public.notification_jobs where id in(select id from nc) and status='delivered'),2,'delivered history remains delivered');
create temp table nc2 as select * from public.claim_notification_jobs(20);
update public.notification_jobs set lease_until=now()-interval '1 second' where id in(select id from nc2);
create temp table nc3 as select * from public.claim_notification_jobs(20);
select is((select count(*)::int from nc3),2,'expired leases can be reclaimed');
select is(public.dispatch_simulated_notification((select id from nc2 limit 1),(select lease_token from nc2 limit 1),'http://127.0.0.1:3000'),'stale','old completion token rejected after reclaim');
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc3;
select pg_temp.make_booking(2);
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
select public.fail_next_notification_attempt(id) from public.notification_jobs where booking_id=(select b from nf where n=2) and template='confirmation';
create temp table nc4 as select * from public.claim_notification_jobs(20);
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc4;
select is((select status from public.notification_jobs where booking_id=(select b from nf where n=2) and template='confirmation'),'retrying','simulated transient failure retries');
select ok((select next_attempt_at>now()+interval '59 seconds' from public.notification_jobs where booking_id=(select b from nf where n=2) and template='confirmation'),'first retry waits one minute');
select public.retry_notification(id) from public.notification_jobs where booking_id=(select b from nf where n=2) and template='confirmation';
create temp table nc5 as select * from public.claim_notification_jobs(20);
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc5;
select is((select count(*)::int from public.notification_simulator_receipts r join public.notification_jobs j on j.id=r.job_id where j.booking_id=(select b from nf where n=2) and j.template='confirmation'),1,'manual retry retains one delivery identity');
select throws_ok($$select public.retry_notification(id) from public.notification_jobs where booking_id=(select b from nf where n=2) and template='confirmation'$$,'23514','Current failed or retrying job required','delivered job cannot be retried');
select pg_temp.make_booking(3);
create temp table nc6 as select * from public.claim_notification_jobs(20);
update public.bookings set start_at=start_at+interval '1 hour',end_at=end_at+interval '1 hour',buffer_end_at=buffer_end_at+interval '1 hour',reschedule_count=1 where id=(select b from nf where n=3);
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc6;
select is((select count(*)::int from public.notification_simulator_receipts where job_id in(select id from nc6)),0,'claimed old schedule cannot deliver after rescheduling');
select pg_temp.make_booking(4);
create temp table nc7 as select * from public.claim_notification_jobs(20);
update public.profiles set role='customer' where id='f6000000-0000-4000-8000-000000000002';
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc7;
select is((select count(*)::int from public.notification_simulator_receipts where job_id in(select id from nc7)),0,'revoked counselor suppresses unfinished messages');
select ok(not has_function_privilege('authenticated','public.claim_notification_jobs(integer)','execute'),'browser cannot claim jobs');
select ok(not has_function_privilege('authenticated','public.dispatch_simulated_notification(uuid,uuid,text)','execute'),'browser cannot forge deliveries');

update public.profiles set role='counselor' where id='f6000000-0000-4000-8000-000000000002';
select pg_temp.make_booking(5);
select public.set_booking_meeting((select b from nf where n=5),'https://meet.google.com/aaa-bbbb-ccc');
create temp table nc8 as select * from public.claim_notification_jobs(20);
select public.set_booking_meeting((select b from nf where n=5),'https://meet.google.com/ddd-eeee-fff');
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc8;
select is((select count(*)::int from public.notification_simulator_receipts r join public.notification_jobs j on j.id=r.job_id where j.booking_id=(select b from nf where n=5) and j.template='link_update'),0,'claimed stale link update is not delivered');
-- Exhaust five actual failed attempts with deterministic eligibility between attempts.
do $$ declare j uuid; token uuid; begin
 select id into j from public.notification_jobs where booking_id=(select b from nf where n=5) and template='link_update' and status='queued';
 for attempt in 1..5 loop
  update public.notification_jobs set next_attempt_at=now(),fail_next=true where id=j;
  select c.lease_token into token from public.claim_notification_jobs(20) c where c.id=j;
  perform public.dispatch_simulated_notification(j,token,'http://127.0.0.1:3000');
 end loop;
end $$;
select is((select status from public.notification_jobs where booking_id=(select b from nf where n=5) and template='link_update' and link_revision=2),'failed','fifth failed attempt becomes terminal');
select is((select attempts from public.notification_jobs where booking_id=(select b from nf where n=5) and template='link_update' and link_revision=2),5,'automatic retry is bounded to five attempts');
select pg_temp.make_booking(6);
create temp table nc9 as select * from public.claim_notification_jobs(20);
-- Move the fixture into the past without enqueuing a new revision; worker checks time at dispatch.
alter table public.bookings disable trigger bookings_notifications;
update public.bookings set start_at=now()-interval '2 hours',end_at=now()-interval '75 minutes',buffer_end_at=now()-interval '1 hour' where id=(select b from nf where n=6);
alter table public.bookings enable trigger bookings_notifications;
select public.dispatch_simulated_notification(id,lease_token,'http://127.0.0.1:3000') from nc9;
select is((select count(*)::int from public.notification_simulator_receipts r join public.notification_jobs j on j.id=r.job_id where j.booking_id=(select b from nf where n=6)),0,'no notification delivered after session starts');
-- A supplied large limit still returns at most 20 independent claims.
insert into public.notification_jobs(booking_id,recipient_id,channel,template,schedule_revision,due_at,next_attempt_at)
select (select b from nf where n=5),'f6000000-0000-4000-8000-000000000003','email','confirmation',n,now(),now() from generate_series(20,49) n;
select is((select count(*)::int from public.claim_notification_jobs(1000)),20,'claim size capped at twenty');

select * from finish(); rollback;
