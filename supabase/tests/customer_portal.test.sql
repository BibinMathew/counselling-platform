begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,aud,role,phone,phone_confirmed_at,raw_user_meta_data,raw_app_meta_data) values
 ('f7000000-0000-4000-8000-000000000001','authenticated','authenticated','+919577770001',now(),'{}','{}'),
 ('f7000000-0000-4000-8000-000000000002','authenticated','authenticated','+919577770002',now(),'{}','{}'),
 ('f7000000-0000-4000-8000-000000000003','authenticated','authenticated','+919577770003',now(),'{}','{}'),
 ('f7000000-0000-4000-8000-000000000004','authenticated','authenticated','+919577770004',now(),'{}','{}');
update public.profiles set email='synthetic@example.test' where id::text like 'f7000000-%';
update public.profiles set role='admin' where id='f7000000-0000-4000-8000-000000000001';
update public.profiles set role='counselor' where id='f7000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','f7000000-0000-4000-8000-000000000001',true);
insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,category,specialties,languages,photo_url,published)
values('f7100000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000002','Portal Fixture','Test','Test','Test','consultant_psychologist','Test','English','https://example.test/a.png',true);
create temp table nf(n integer primary key,b uuid);
grant all on nf to authenticated;
create function pg_temp.make_booking(n integer,t timestamptz default null,s text default 'confirmed') returns uuid language plpgsql as $$
declare booking uuid:=gen_random_uuid(); start_time timestamptz:=coalesce(t,now()+interval '2 days'+n*interval '2 hours');
begin
 insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,hold_expires_at,status)
 values(booking,'f7000000-0000-4000-8000-000000000003','f7100000-0000-4000-8000-000000000001',start_time,start_time+interval '45 minutes',start_time+interval '1 hour',now()+interval '10 minutes',s);
 insert into nf values(n,booking); return booking;
end; $$;

select has_function('public','get_customer_portal','portal read exists');
select ok(not has_function_privilege('anon','public.get_customer_portal(text,integer,uuid)','execute'),'anonymous cannot read portal');
select pg_temp.make_booking(1,now()+interval '24 hours');
select pg_temp.make_booking(2,now()+interval '26 hours');
select pg_temp.make_booking(3,now()-interval '10 minutes');
select pg_temp.make_booking(4,now()-interval '3 hours');
select pg_temp.make_booking(5,now()+interval '4 hours','held');
select pg_temp.make_booking(6,now()+interval '6 hours');
update public.bookings set customer_id='f7000000-0000-4000-8000-000000000004' where id=(select b from nf where n=6);
select public.set_booking_meeting((select b from nf where n=1),'https://meet.google.com/por-tala-bcd');
select public.set_booking_meeting((select b from nf where n=6),'https://meet.google.com/oth-erus-erx');
create function pg_temp.items(v text default 'all',p integer default 0) returns setof jsonb language sql as $$ select jsonb_array_elements(public.get_customer_portal(v,p)->'items'); $$;
select set_config('request.jwt.claim.sub','f7000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*)::int from pg_temp.items()),5,'customer sees only owned bookings');
select is((select count(*)::int from pg_temp.items('upcoming')),3,'upcoming includes current and future confirmed appointments');
select is((select count(*)::int from pg_temp.items('past')),1,'past contains ended confirmed appointments');
select is((select count(*)::int from pg_temp.items('holds')),1,'holds contains pending checkout');
select is((select (i->>'can_reschedule')::boolean from pg_temp.items() i where i->>'id'=(select b::text from nf where n=1)),true,'exact24-hour threshold allows rescheduling');
select is((select (i->>'in_progress')::boolean from pg_temp.items() i where i->>'id'=(select b::text from nf where n=3)),true,'started but unended session is in progress');
select is((select i->>'status' from pg_temp.items('past') i),'confirmed','past retains confirmed status');
select is((select i->>'meeting_url' from pg_temp.items() i where i->>'id'=(select b::text from nf where n=1)),'https://meet.google.com/por-tala-bcd','authorized meeting returned');
select ok(not exists(select 1 from pg_temp.items() i where i->>'meeting_url'='https://meet.google.com/oth-erus-erx'),'foreign meeting never joined');
select is((select i->>'amount_paise' from pg_temp.items('past') i),null,'legacy confirmed booking has no invented paid amount');
select is((public.get_customer_portal()->>'as_of')::timestamptz,now(),'one stable database reference time');
reset role;
update public.bookings set start_at=start_at-interval '1 second',end_at=end_at-interval '1 second',buffer_end_at=buffer_end_at-interval '1 second' where id=(select b from nf where n=1);
select is((select (i->>'can_reschedule')::boolean from pg_temp.items() i where i->>'id'=(select b::text from nf where n=1)),false,'23h59m59s cannot reschedule');
update public.bookings set reschedule_count=1 where id=(select b from nf where n=2);
select is((select (i->>'can_reschedule')::boolean from pg_temp.items() i where i->>'id'=(select b::text from nf where n=2)),false,'second reschedule is not offered');
update public.bookings set start_at=now(),end_at=now()+interval '45 minutes',buffer_end_at=now()+interval '1 hour' where id=(select b from nf where n=3);
select is((select (i->>'in_progress')::boolean from pg_temp.items() i where i->>'id'=(select b::text from nf where n=3)),true,'exact start belongs to in-progress');
update public.bookings set start_at=now()-interval '45 minutes',end_at=now(),buffer_end_at=now() where id=(select b from nf where n=3);
select is((select count(*)::int from pg_temp.items('past')),2,'exact end belongs to past');
update public.bookings set hold_expires_at=now() where id=(select b from nf where n=5);
select is((select i->>'status' from pg_temp.items('holds') i),'expired','exact hold deadline derives expired without write');
select is((select status from public.bookings where id=(select b from nf where n=5)),'held','portal read does not mutate expiry');
update public.counselors set published=false where id='f7100000-0000-4000-8000-000000000001';
select is((select (i->>'counselor_bookable')::boolean from pg_temp.items('past') i limit 1),false,'unpublished counselor has directory fallback');
select is((select count(*)::int from pg_temp.items()),5,'unpublishing preserves own history');
update public.counselors set published=true where id='f7100000-0000-4000-8000-000000000001';
update public.profiles set role='customer' where id='f7000000-0000-4000-8000-000000000002';
select is((select (i->>'counselor_bookable')::boolean from pg_temp.items('past') i limit 1),false,'revoked counselor role cannot be rebooked');
update public.profiles set role='counselor' where id='f7000000-0000-4000-8000-000000000002';
-- Snapshot stays independent of current configured price and failed later attempts.
insert into public.payment_orders(id,booking_id,customer_id,provider,amount_paise,currency,confirmed_payment_id)
values('f7200000-0000-4000-8000-000000000001',(select b from nf where n=1),'f7000000-0000-4000-8000-000000000003','simulator',60000,'INR','portal_paid'),
('f7200000-0000-4000-8000-000000000002',(select b from nf where n=5),'f7000000-0000-4000-8000-000000000003','simulator',69900,'INR',null);
insert into public.payment_transactions(order_id,booking_id,provider,payment_id,state,amount_paise,currency,outcome,reason,updated_at) values
('f7200000-0000-4000-8000-000000000001',(select b from nf where n=1),'simulator','portal_old_failed','failed',60000,'INR','failed',null,now()),
('f7200000-0000-4000-8000-000000000002',(select b from nf where n=5),'simulator','portal_review','captured',69900,'INR','admin_review','slot_conflict',now()-interval '1 hour'),
('f7200000-0000-4000-8000-000000000002',(select b from nf where n=5),'simulator','portal_newfailed','failed',69900,'INR','failed',null,now());
select is((select (i->>'amount_paise')::integer from pg_temp.items() i where i->>'id'=(select b::text from nf where n=1)),60000,'paid snapshot amount retained');
select is((select i->>'payment_state' from pg_temp.items() i where i->>'id'=(select b::text from nf where n=1)),'confirmed','failed attempt cannot downgrade paid order');
select is((select i->>'payment_state' from pg_temp.items('holds') i),'admin_review','captured exception survives newer failed attempt');
select is((select i->>'review_reason' from pg_temp.items('holds') i),'slot_conflict','captured exception retains safe reason');
--25 extra nonoverlapping synthetic past appointments exercise deterministic ties/pages.
select pg_temp.make_booking(n,now()-interval '40 days'+n*interval '2 hours') from generate_series(10,34)n;
select is((select jsonb_array_length(public.get_customer_portal('past',0)->'items')),20,'first page is bounded to twenty');
select is((public.get_customer_portal('past',0)->>'has_more')::boolean,true,'lookahead detects another page');
select is((select jsonb_array_length(public.get_customer_portal('past',1)->'items')),7,'second page contains remaining history');
select ok(not exists(select 1 from pg_temp.items('past',0)a join pg_temp.items('past',1)b on a->>'id'=b->>'id'),'stable pages do not overlap');
select is(public.get_customer_portal('invalid',-1),public.get_customer_portal('all',0),'SQL also normalizes invalid arguments');
select is(public.get_customer_portal('all',0)#>>'{items,0,id}',(select min(id::text) from public.bookings where customer_id='f7000000-0000-4000-8000-000000000003'),'equal creation timestamps sort by ID deterministically');

-- An old confirmed booking locator must select its actual page, not page zero.
select is((public.get_customer_portal('all',0,(select b from nf where n=1))->>'page')::integer,
 (select ((count(*) filter(where id::text<(select b::text from nf where n=1)))/20)::integer from public.bookings where customer_id='f7000000-0000-4000-8000-000000000003'),
 'booking locator chooses the owner-scoped page');
select ok(exists(select 1 from jsonb_array_elements(public.get_customer_portal('all',0,(select b from nf where n=1))->'items')i where i->>'id'=(select b::text from nf where n=1)),'located confirmed booking is actually included');
select is((public.get_customer_portal('all',0,(select b from nf where n=6))->>'page')::integer,0,'foreign booking locator reveals no position');
update public.profiles set email=null where id='f7000000-0000-4000-8000-000000000003';
select throws_ok($$select public.get_customer_portal()$$,'42501','Customer authentication required','incomplete customer denied');
update public.profiles set email='fixture@example.test',role='counselor' where id='f7000000-0000-4000-8000-000000000003';
select throws_ok($$select public.get_customer_portal()$$,'42501','Customer authentication required','revoked customer role denied');
select set_config('request.jwt.claim.sub','f7000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.get_customer_portal()$$,'42501','Customer authentication required','admin cannot browse customer portal');
select set_config('request.jwt.claim.sub','f7000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.get_customer_portal()$$,'42501','Customer authentication required','counselor cannot browse customer portal');
select set_config('request.jwt.claim.sub','f7000000-0000-4000-8000-000000000004',true);
select is((select count(*)::int from pg_temp.items()),1,'different customer sees only their own booking');
select * from finish();rollback;
