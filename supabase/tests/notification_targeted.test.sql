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

-- Keep pre-existing jobs out of all claim scans without changing them after rollback.
update public.notification_jobs set next_attempt_at=clock_timestamp()+interval '10 days' where status in ('queued','retrying');
update public.notification_jobs set lease_until=clock_timestamp()+interval '10 days' where status='processing';

-- 1. Both actual reminder templates deliver when due, including a delayed dispatch.
select pg_temp.make_booking(1);
update public.notification_jobs set status='superseded' where booking_id=(select b from nf where n=1) and template not in ('reminder_24h','reminder_1h');
update public.notification_jobs set due_at=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' where booking_id=(select b from nf where n=1) and template='reminder_24h';
update public.notification_jobs set due_at=clock_timestamp()-interval '20 minutes',next_attempt_at=clock_timestamp()-interval '20 minutes' where booking_id=(select b from nf where n=1) and template='reminder_1h';
create temp table reminder_claims as select * from public.claim_notification_jobs(20);
select is((select count(*)::int from reminder_claims),2,'both due reminder types are claimed');
select is(public.dispatch_simulated_notification(c.id,c.lease_token,'http://127.0.0.1:3000'),'delivered',j.template||' successfully delivers while appointment remains future') from reminder_claims c join public.notification_jobs j on j.id=c.id;
select is((select count(*)::int from public.notification_simulator_receipts r join public.notification_jobs j on j.id=r.job_id where j.booking_id=(select b from nf where n=1)),2,'both reminders have durable receipts');
select ok(not exists(select 1 from public.notification_simulator_receipts r join public.notification_jobs j on j.id=r.job_id where j.booking_id=(select b from nf where n=1) and (r.body not like 'Appointment reminder.%' or r.body not like '%Asia/Kolkata. Sign in: http://127.0.0.1:3000/bookings' or r.body like '%meet.google.com%')),'due and delayed reminder previews contain safe current appointment details');

-- 2. Assert every retry delay against bounds captured around the real dispatch.
select pg_temp.make_booking(2);
update public.notification_jobs set status='superseded' where booking_id=(select b from nf where n=2) and template<>'confirmation';
create temp table retry_evidence(attempt integer,delay_minutes integer,before_at timestamptz,after_at timestamptz,next_at timestamptz,outcome text);
do $$ declare job uuid; token uuid; before_at timestamptz; outcome text; expected_minutes integer; begin
 select id into job from public.notification_jobs where booking_id=(select b from nf where n=2) and template='confirmation';
 for attempt in 1..4 loop
  update public.notification_jobs set next_attempt_at=clock_timestamp()-interval '1 second',fail_next=true where id=job;
  select c.lease_token into token from public.claim_notification_jobs(20) c where c.id=job;
  before_at=clock_timestamp();
  outcome=public.dispatch_simulated_notification(job,token,'http://127.0.0.1:3000');
  expected_minutes=case attempt when 1 then 1 when 2 then 5 when 3 then 15 else 60 end;
  insert into retry_evidence select attempt,expected_minutes,before_at,clock_timestamp(),next_attempt_at,outcome from public.notification_jobs where id=job;
 end loop;
end $$;
select is(outcome,'retrying','failure attempt '||attempt||' remains retryable') from retry_evidence order by attempt;
select ok(next_at between before_at+make_interval(mins=>delay_minutes) and after_at+make_interval(mins=>delay_minutes),'attempt '||attempt||' schedules exactly '||delay_minutes||' minute backoff') from retry_evidence order by attempt;
select is((select count(*)::int from public.notification_simulator_receipts r join public.notification_jobs j on j.id=r.job_id where j.booking_id=(select b from nf where n=2)),0,'failed attempts create no premature receipt');
update public.notification_jobs set status='superseded' where booking_id=(select b from nf where n=2);

-- 3. Repeated real claims with expired leases model five crashed workers.
select pg_temp.make_booking(3);
update public.notification_jobs set status='superseded' where booking_id=(select b from nf where n=3) and template<>'confirmation';
create temp table crash_tokens(attempt integer,job uuid,token uuid);
grant select on crash_tokens to authenticated;
do $$ declare j uuid; token uuid; begin
 select id into j from public.notification_jobs where booking_id=(select b from nf where n=3) and template='confirmation';
 for attempt in 1..5 loop
  select c.lease_token into token from public.claim_notification_jobs(20) c where c.id=j;
  insert into crash_tokens values(attempt,j,token);
  update public.notification_jobs set lease_until=clock_timestamp()-interval '1 second' where id=j;
 end loop;
end $$;
select is((select count(distinct token)::int from crash_tokens),5,'each crashed worker receives a new lease token');
select is((select count(*)::int from public.claim_notification_jobs(20)),0,'fifth abandoned lease cannot be claimed a sixth time');
select is((select status from public.notification_jobs where booking_id=(select b from nf where n=3) and template='confirmation'),'failed','fifth abandoned lease is terminal');
select is((select attempts from public.notification_jobs where booking_id=(select b from nf where n=3) and template='confirmation'),5,'crash exhaustion preserves five attempts');
select is((select error_code from public.notification_jobs where booking_id=(select b from nf where n=3) and template='confirmation'),'attempts_exhausted','crash exhaustion has a safe operational reason');
select is(public.dispatch_simulated_notification(job,token,'http://127.0.0.1:3000'),'stale','crashed worker cannot deliver after exhaustion') from crash_tokens where attempt=5;
select is((select count(*)::int from public.notification_simulator_receipts where job_id in(select job from crash_tokens)),0,'repeated crashes create no receipt');

-- 4. A different canonical counselor is still not an appointment participant.
select pg_temp.make_booking(4);
select public.set_booking_meeting((select b from nf where n=4),'https://meet.google.com/ggg-hhhh-iii');
update public.profiles set role='counselor' where id='f6000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000004',true);
select is((select count(*)::int from public.get_accessible_booking_meetings() where booking_id=(select b from nf where n=4)),0,'unrelated counselor cannot read another counselor meeting');
select is((select count(*)::int from public.get_assigned_confirmed_bookings() where id=(select b from nf where n=4)),0,'unrelated counselor cannot list another counselor appointment');
-- Known IDs bypass RLS obscurity and exercise actual RPC authorization.
select throws_ok($$select public.retry_notification((select job from crash_tokens limit 1))$$,'42501','Administrator required','known job retry denied to unrelated counselor');
select throws_ok($$select public.fail_next_notification_attempt((select job from crash_tokens limit 1))$$,'42501','Administrator required','known job failure injection denied to unrelated counselor');
select set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.retry_notification((select job from crash_tokens limit 1))$$,'42501','Administrator required','customer cannot retry a notification');
select throws_ok($$select public.fail_next_notification_attempt((select job from crash_tokens limit 1))$$,'42501','Administrator required','customer cannot inject a failure');
reset role;
select ok(not has_function_privilege('anon','public.retry_notification(uuid)','execute'),'anonymous cannot invoke retry');
select ok(not has_function_privilege('anon','public.fail_next_notification_attempt(uuid)','execute'),'anonymous cannot inject failure');
select * from finish();
rollback;
