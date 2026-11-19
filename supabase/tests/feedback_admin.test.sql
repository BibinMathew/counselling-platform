begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,aud,role,phone,phone_confirmed_at,raw_user_meta_data,raw_app_meta_data) values
 ('f9000000-0000-4000-8000-000000000001','authenticated','authenticated','+919588880001',now(),'{}','{}'),
 ('f9000000-0000-4000-8000-000000000002','authenticated','authenticated','+919588880002',now(),'{}','{}'),
 ('f9000000-0000-4000-8000-000000000003','authenticated','authenticated','+919588880003',now(),'{}','{}'),
 ('f9000000-0000-4000-8000-000000000004','authenticated','authenticated','+919588880004',now(),'{}','{}');
update public.profiles set email='synthetic@example.test' where id::text like 'f9000000-%';
update public.profiles set role='admin' where id='f9000000-0000-4000-8000-000000000001';
update public.profiles set role='counselor' where id='f9000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','f9000000-0000-4000-8000-000000000001',true);
insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,specialties,languages,photo_url,published)
values('f9100000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000002','Phase9 Fixture','Test','Test','Test','Test','English','https://example.test/a.png',true);
create temp table nf(n integer primary key,b uuid);
grant all on nf to authenticated;
create function pg_temp.make_booking(n integer,t timestamptz default null,s text default 'confirmed') returns uuid language plpgsql as $$
declare booking uuid:=gen_random_uuid(); start_time timestamptz:=coalesce(t,now()+interval '2 days'+n*interval '2 hours');
begin
 insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,hold_expires_at,status)
 values(booking,'f9000000-0000-4000-8000-000000000003','f9100000-0000-4000-8000-000000000001',start_time,start_time+interval '45 minutes',start_time+interval '1 hour',now()+interval '10 minutes',s);
 insert into nf values(n,booking); return booking;
end; $$;


select pg_temp.make_booking(1,now()-interval '45 minutes');
select pg_temp.make_booking(2);
select pg_temp.make_booking(3,now()-interval '2 days','held');
select is(public.phase9_feedback_page('f9000000-0000-4000-8000-000000000003',(select b from nf where n=1))->>'eligible','true','exact end time eligible');
select is(public.phase9_feedback_page('f9000000-0000-4000-8000-000000000003',(select b from nf where n=2))->>'eligible','false','future confirmed not eligible');
select is(public.phase9_feedback_page('f9000000-0000-4000-8000-000000000004',(select b from nf where n=1)),null,'foreign and missing booking indistinguishable');
select is(public.phase9_feedback_page('f9000000-0000-4000-8000-000000000003',gen_random_uuid()),null,'missing booking indistinguishable');
create function pg_temp.submit(r integer default 5,c text default 'Fictional feedback',ack boolean default true,n integer default 1) returns jsonb language sql as $$
 select public.phase9_submit_feedback('f9000000-0000-4000-8000-000000000003',(select b from nf where n=$4),r,c,ack);
$$;
select throws_ok($$select pg_temp.submit(0)$$,'23514','Invalid feedback','rating zero denied');
select throws_ok($$select pg_temp.submit(6)$$,'23514','Invalid feedback','rating six denied');
select throws_ok($$select pg_temp.submit(5,repeat('😀',2001))$$,'23514','Invalid feedback','Unicode oversized comment denied');
select throws_ok($$select pg_temp.submit(5,'Test',false)$$,'23514','Synthetic acknowledgement required','feedback acknowledgement required');
select throws_ok($$select pg_temp.submit(5,'Test',true,2)$$,'23514','Feedback opens after the confirmed appointment ends','future write denied');
select throws_ok($$select pg_temp.submit(5,'Test',true,3)$$,'23514','Feedback opens after the confirmed appointment ends','held write denied');
select is(pg_temp.submit()->>'result','saved','first feedback saved');
select is(pg_temp.submit()->>'result','existing','same content retry idempotent');
select is(pg_temp.submit(4)->>'result','conflict','different feedback cannot overwrite');
select is((select count(*)::int from public.appointment_feedback),1,'one feedback row');
select is((select count(*)::int from public.phase9_audit_events where action='feedback_submitted'),1,'one submission audit');
select is(public.phase9_feedback_page('f9000000-0000-4000-8000-000000000003',(select b from nf where n=1))#>>'{receipt,rating}','5','customer sees own receipt');
select is(jsonb_array_length(public.phase9_feedback_summaries('f9000000-0000-4000-8000-000000000003',array[(select b from nf where n=1)]) ),1,'bounded owned summary');
select is(jsonb_array_length(public.phase9_feedback_summaries('f9000000-0000-4000-8000-000000000004',array[(select b from nf where n=1)]) ),0,'summary omits foreign booking');
select is(jsonb_array_length(public.phase9_feedback_list('f9000000-0000-4000-8000-000000000001','all',null,0)->'items'),1,'admin feedback visible');
select is(public.phase9_review_feedback('f9000000-0000-4000-8000-000000000001',(select id from public.appointment_feedback))->>'reviewed','true','review acknowledged');
select is(public.phase9_review_feedback('f9000000-0000-4000-8000-000000000001',(select id from public.appointment_feedback))->>'reviewed','true','review retry safe');
select is((select count(*)::int from public.phase9_audit_events where action='feedback_reviewed'),1,'review audited once');
select throws_ok($$select public.phase9_feedback_list('f9000000-0000-4000-8000-000000000002','all',null,0)$$,'42501','Authorized complete account required','counselor cannot review feedback');
select throws_ok($$select public.phase9_feedback_page('f9000000-0000-4000-8000-000000000001',(select b from nf where n=1))$$,'42501','Authorized complete account required','admin cannot impersonate customer');
select ok(not has_table_privilege('authenticated','public.appointment_feedback','select'),'raw feedback denied');
select ok(not has_function_privilege('authenticated','public.phase9_submit_feedback(uuid,uuid,integer,text,boolean)','execute'),'private submit RPC denied');
select ok(not has_function_privilege('anon','public.phase9_feedback_page(uuid,uuid)','execute'),'anonymous private read denied');
select ok(not has_function_privilege('authenticated','public.phase9_assert_role(uuid,text)','execute'),'role helper private');

select is(public.phase9_overview('f9000000-0000-4000-8000-000000000001')->>'active_cases','0','no cases initially');
create temp table case_fixture as select public.phase9_open_case('f9000000-0000-4000-8000-000000000001','booking',(select b from nf where n=1),'Fictional support',true) as result;
select is((select result->>'version'from case_fixture),'1','case opened at version1');
select is(public.phase9_open_case('f9000000-0000-4000-8000-000000000001','booking',(select b from nf where n=1),'Changed remark',true)->>'id',(select result->>'id'from case_fixture),'create retry deduplicates source');
create function pg_temp.change_case(v integer,req integer,a text default 'start',r text default 'Fictional follow-up')returns jsonb language sql as $$
 select public.phase9_update_case('f9000000-0000-4000-8000-000000000001',(select(result->>'id')::uuid from case_fixture),v,('f9300000-0000-4000-8000-'||lpad(req::text,12,'0'))::uuid,a,r,true);
$$;
select is(pg_temp.change_case(1,1)->>'accepted_version','2','update increments');
select is(pg_temp.change_case(1,1)->>'replayed','true','update retry idempotent');
select throws_ok($$select pg_temp.change_case(1,1,'close')$$,'23514','Request identity conflict','same request changed payload denied');
select throws_ok($$select pg_temp.change_case(1,2)$$,'40001','Case changed; reload before updating','stale version denied');
select throws_ok($$select pg_temp.change_case(2,2,'close',' ')$$,'23514','Closing or reopening requires a remark','close remark required');
select is(pg_temp.change_case(2,2,'close')->>'accepted_version','3','close increments');
select is(public.phase9_overview('f9000000-0000-4000-8000-000000000001')->>'active_cases','0','closed excluded from active');
select is(pg_temp.change_case(1,1)->>'current_version','3','old replay reports newer current version');
select throws_ok($$select pg_temp.change_case(3,3,'start')$$,'23514','Invalid case transition','closed needs explicit reopen');
select is(pg_temp.change_case(3,3,'reopen')->>'accepted_version','4','explicit reopen works');
select is((select status::text from public.bookings where id=(select b from nf where n=1)),'confirmed','case updates preserve booking fact');
select is((select count(*)::int from public.operational_case_events),4,'no duplicate event on retry');
select ok(not has_table_privilege('authenticated','public.operational_cases','select'),'raw cases denied');
select ok(not has_table_privilege('authenticated','public.operational_case_receipts','select'),'raw receipts denied');
select throws_ok($$select public.phase9_open_case('f9000000-0000-4000-8000-000000000001','booking',gen_random_uuid(),'',true)$$,'23514','Operational source unavailable','forged source denied');
select throws_ok($$select public.phase9_cases('f9000000-0000-4000-8000-000000000003','all',0)$$,'42501','Authorized complete account required','customer cases denied');
select throws_ok($$select public.phase9_cases('f9000000-0000-4000-8000-000000000001','all',1000000)$$,'23514','Invalid page','raw RPC page limit enforced');
select ok(not (select to_jsonb(a)::text like '%Fictional%' from public.phase9_audit_events a limit 1),'audit omits content');

select is(jsonb_array_length(public.phase9_cases('f9000000-0000-4000-8000-000000000001','all',0)->'items'),1,'case list works');
select is(public.phase9_case_detail('f9000000-0000-4000-8000-000000000001',(select(result->>'id')::uuid from case_fixture),0)#>>'{source,status}','confirmed','live source facts read');
select is(jsonb_array_length(public.phase9_case_detail('f9000000-0000-4000-8000-000000000001',(select(result->>'id')::uuid from case_fixture),0)->'items'),4,'case event history read');
select ok(not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'phase9_%'and(has_function_privilege('authenticated',oid,'execute')or has_function_privilege('anon',oid,'execute'))),'all new RPCs/helpers deny browser roles');
select throws_ok($$select public.phase9_feedback_summaries('f9000000-0000-4000-8000-000000000003',array_fill(gen_random_uuid(),array[21]))$$,'23514','Invalid booking list','batch bounded at20');
update public.profiles set email=null where id='f9000000-0000-4000-8000-000000000001';
select throws_ok($$select public.phase9_overview('f9000000-0000-4000-8000-000000000001')$$,'42501','Authorized complete account required','incomplete admin denied');
update public.profiles set email='admin@example.test',role='customer'where id='f9000000-0000-4000-8000-000000000001';
select throws_ok($$select public.phase9_overview('f9000000-0000-4000-8000-000000000001')$$,'42501','Authorized complete account required','revoked admin denied');
update public.profiles set role='admin'where id='f9000000-0000-4000-8000-000000000001';
update public.profiles set role='counselor'where id='f9000000-0000-4000-8000-000000000003';
select throws_ok($$select pg_temp.submit()$$,'42501','Authorized complete account required','revoked customer cannot submit/replay');
update public.profiles set role='customer'where id='f9000000-0000-4000-8000-000000000003';
select pg_temp.make_booking(n,now()-interval '100 days'+n*interval '2 hours')from generate_series(10,34)n;
select public.phase9_submit_feedback('f9000000-0000-4000-8000-000000000003',b,4,'Fictional paged feedback',true)from nf where n>=10;
select public.phase9_open_case('f9000000-0000-4000-8000-000000000001','booking',b,'Fictional paged case',true)from nf where n>=10;
select is(jsonb_array_length(public.phase9_feedback_list('f9000000-0000-4000-8000-000000000001','all','f9100000-0000-4000-8000-000000000001',0)->'items'),20,'feedback page size20');
select is(public.phase9_feedback_list('f9000000-0000-4000-8000-000000000001','all','f9100000-0000-4000-8000-000000000001',0)->>'has_more','true','feedback lookahead');
select is(jsonb_array_length(public.phase9_feedback_list('f9000000-0000-4000-8000-000000000001','all','f9100000-0000-4000-8000-000000000001',1)->'items'),6,'feedback remainder6');
select is(jsonb_array_length(public.phase9_cases('f9000000-0000-4000-8000-000000000001','all',1)->'items'),6,'case page remainder6');
select is(jsonb_array_length(public.phase9_bookings('f9000000-0000-4000-8000-000000000001','past','f9100000-0000-4000-8000-000000000001',null,0)->'items'),20,'booking page bounded20');
select is(public.phase9_bookings('f9000000-0000-4000-8000-000000000001','past','f9100000-0000-4000-8000-000000000001',null,0)->'items',public.phase9_bookings('f9000000-0000-4000-8000-000000000001','past','f9100000-0000-4000-8000-000000000001',null,0)->'items','booking ordering stable');
select is(public.phase9_overview('f9000000-0000-4000-8000-000000000001')->>'unreviewed','25','overview counts full population');
select is(public.phase9_overview('f9000000-0000-4000-8000-000000000001')->>'active_cases','26','active includes reopened+25');
update public.counselors set published=false where id='f9100000-0000-4000-8000-000000000001';
select is(pg_temp.submit()->>'result','existing','unpublishing does not block historical feedback');
select ok(not exists(select 1 from public.phase9_audit_events a where to_jsonb(a)::text like '%Fictional%'),'all audit events omit content');

insert into public.payment_orders(id,booking_id,customer_id,provider,amount_paise,currency,review_reason)values('f9400000-0000-4000-8000-000000000001',(select b from nf where n=1),'f9000000-0000-4000-8000-000000000003','simulator',69900,'INR','slot_conflict');
insert into public.payment_events(id,provider,event_id,payload_digest,outcome)values('f9400000-0000-4000-8000-000000000002','simulator','fictional-phase9-unmatched',repeat('a',64),'unmatched_order');
insert into public.notification_jobs(id,booking_id,recipient_id,channel,template,link_revision,due_at,next_attempt_at,status,attempts,error_code)values('f9400000-0000-4000-8000-000000000003',(select b from nf where n=1),'f9000000-0000-4000-8000-000000000003','email','confirmation',999,now(),now(),'failed',5,'local_failure');
create temp table source_snapshot as select jsonb_build_object('payment',public.phase9_source('payment_order','f9400000-0000-4000-8000-000000000001'),'event',public.phase9_source('payment_event','f9400000-0000-4000-8000-000000000002'),'job',public.phase9_source('notification_job','f9400000-0000-4000-8000-000000000003'))as facts,public.phase9_overview('f9000000-0000-4000-8000-000000000001')as overview;
select public.phase9_open_case('f9000000-0000-4000-8000-000000000001',t,('f9400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Fictional source follow-up',true)from(values('payment_order',1),('payment_event',2),('notification_job',3))as sources(t,n);
select is((select booking_id::text from public.operational_cases where source_id='f9400000-0000-4000-8000-000000000001'),(select b::text from nf where n=1),'order case derives booking');
select is((select booking_id from public.operational_cases where source_id='f9400000-0000-4000-8000-000000000002'),null,'unmatched event case permits no booking');
select is((select booking_id::text from public.operational_cases where source_id='f9400000-0000-4000-8000-000000000003'),(select b::text from nf where n=1),'job case derives booking');
select public.phase9_update_case('f9000000-0000-4000-8000-000000000001',id,1,gen_random_uuid(),'close','Fictional administrative follow-up closure',true)from public.operational_cases where source_id::text like 'f9400000-%';
select is(public.phase9_source('payment_order','f9400000-0000-4000-8000-000000000001'),(select facts->'payment'from source_snapshot),'closing payment case preserves source facts');
select is(public.phase9_source('payment_event','f9400000-0000-4000-8000-000000000002'),(select facts->'event'from source_snapshot),'closing unmatched event case preserves source facts');
select is(public.phase9_source('notification_job','f9400000-0000-4000-8000-000000000003'),(select facts->'job'from source_snapshot),'closing job case preserves source facts');
select is(public.phase9_overview('f9000000-0000-4000-8000-000000000001')->'payment_review',(select overview->'payment_review'from source_snapshot),'case closure does not hide payment queue');
select is(public.phase9_overview('f9000000-0000-4000-8000-000000000001')->'unmatched',(select overview->'unmatched'from source_snapshot),'case closure does not hide unmatched queue');
select is(public.phase9_overview('f9000000-0000-4000-8000-000000000001')->'failed_notifications',(select overview->'failed_notifications'from source_snapshot),'case closure does not hide failed job queue');
update public.payment_orders set review_reason='provider_mismatch'where id='f9400000-0000-4000-8000-000000000001';
select is(public.phase9_case_detail('f9000000-0000-4000-8000-000000000001',(select id from public.operational_cases where source_id='f9400000-0000-4000-8000-000000000001'),0)#>>'{source,review_reason}','provider_mismatch','detail reflects live source facts');
select is((select count(*)::int from public.operational_case_events where case_id=(select id from public.operational_cases where source_id='f9400000-0000-4000-8000-000000000001')),2,'source change does not rewrite case history');
select ok(not has_function_privilege('authenticated','public.read_session_note(uuid,uuid)','execute'),'Phase9 does not grant private note access');
select * from finish();
rollback;
