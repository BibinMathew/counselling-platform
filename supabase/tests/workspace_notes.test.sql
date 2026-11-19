begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,aud,role,phone,phone_confirmed_at,raw_user_meta_data,raw_app_meta_data) values
 ('f8000000-0000-4000-8000-000000000001','authenticated','authenticated','+919588880001',now(),'{}','{}'),
 ('f8000000-0000-4000-8000-000000000002','authenticated','authenticated','+919588880002',now(),'{}','{}'),
 ('f8000000-0000-4000-8000-000000000003','authenticated','authenticated','+919588880003',now(),'{}','{}'),
 ('f8000000-0000-4000-8000-000000000004','authenticated','authenticated','+919588880004',now(),'{}','{}');
update public.profiles set email='synthetic@example.test' where id::text like 'f8000000-%';
update public.profiles set role='admin' where id='f8000000-0000-4000-8000-000000000001';
update public.profiles set role='counselor' where id='f8000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000001',true);
insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,specialties,languages,photo_url,published)
values('f8100000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000002','Workspace Fixture','Test','Test','Test','Test','English','https://example.test/a.png',true);
create temp table nf(n integer primary key,b uuid);
grant all on nf to authenticated;
create function pg_temp.make_booking(n integer,t timestamptz default null,s text default 'confirmed') returns uuid language plpgsql as $$
declare booking uuid:=gen_random_uuid(); start_time timestamptz:=coalesce(t,now()+interval '2 days'+n*interval '2 hours');
begin
 insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,hold_expires_at,status)
 values(booking,'f8000000-0000-4000-8000-000000000003','f8100000-0000-4000-8000-000000000001',start_time,start_time+interval '45 minutes',start_time+interval '1 hour',now()+interval '10 minutes',s);
 insert into nf values(n,booking); return booking;
end; $$;

select pg_temp.make_booking(1);
select pg_temp.make_booking(2,now()-interval '2 days');
select pg_temp.make_booking(3,null,'held');
update public.profiles set role='counselor' where id='f8000000-0000-4000-8000-000000000004';
create function pg_temp.save_note(v integer,req text,digest text default 'a',kid text default 'v1',ack boolean default true) returns jsonb language sql as $$
 select public.save_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=1),'f8200000-0000-4000-8000-000000000001',v,req::uuid,
 jsonb_build_object('format',1,'key_id',kid,'iv','AAAAAAAAAAAAAAAA','tag','AAAAAAAAAAAAAAAAAAAAAA==','ciphertext','ZmljdGlvbmFsLWNpcGhlcnRleHQ='),jsonb_build_object(kid,repeat(digest,64)),kid,ack);
$$;
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000002',true);
select is(jsonb_array_length(public.get_counselor_workspace()->'items'),1,'workspace lists only assigned confirmed upcoming sessions');
select is(jsonb_array_length(public.get_counselor_workspace('past')->'items'),1,'past workspace includes ended confirmed session');
select is(public.get_counselor_session((select b from nf where n=3)),null,'held session detail unavailable');
select is(public.get_counselor_session((select b from nf where n=1))->>'status','confirmed','detail retains actual state');
select ok(not (public.get_counselor_session((select b from nf where n=1)) ?| array['phone','email','envelope','note_id','note_version']),'session metadata has no contact/private note fields');
select is(public.read_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=1)),null,'owner starts without a note');
select throws_ok($$select pg_temp.save_note(0,'f8300000-0000-4000-8000-000000000001','a','v1',false)$$,'23514','Synthetic acknowledgement required','acknowledgement mandatory');
select is(pg_temp.save_note(0,'f8300000-0000-4000-8000-000000000001')->>'accepted_version','1','first save creates version1');
select is(pg_temp.save_note(0,'f8300000-0000-4000-8000-000000000001')->>'replayed','true','lost response retry is idempotent');
select is((select version from public.session_notes where booking_id=(select b from nf where n=1)),1,'retry does not increment version');
select throws_ok($$select pg_temp.save_note(0,'f8300000-0000-4000-8000-000000000001','b')$$,'23514','Note request identity conflict','same request cannot change content digest');
select throws_ok($$select pg_temp.save_note(1,'f8300000-0000-4000-8000-000000000001')$$,'23514','Note request identity conflict','same request cannot change expected version');
select throws_ok($$select pg_temp.save_note(0,'f8300000-0000-4000-8000-000000000002')$$,'40001','Note version conflict','stale tab cannot overwrite');
select is(pg_temp.save_note(1,'f8300000-0000-4000-8000-000000000002','b','v2')->>'current_version','2','new valid save advances to version2');
select is(pg_temp.save_note(0,'f8300000-0000-4000-8000-000000000001')->>'accepted_version','1','old receipt remains accepted at original revision');
select is(pg_temp.save_note(0,'f8300000-0000-4000-8000-000000000001')->>'current_version','2','old receipt reports newer current version without overwrite');
select is((select count(*)::int from public.session_note_audit_events where booking_id=(select b from nf where n=1) and action='saved'),2,'only successful new saves create save audits');
select is(public.read_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=1))->>'version','2','authorized read returns current version');
select ok(exists(select 1 from public.session_note_audit_events where action='opened' and version=2),'content retrieval audited before return');
select ok(not has_table_privilege('authenticated','public.session_notes','select'),'browser roles cannot read ciphertext table');
select ok(not has_table_privilege('authenticated','public.session_notes','update'),'browser roles cannot directly update notes');
select ok(not has_table_privilege('authenticated','public.session_note_save_requests','select'),'request evidence private');
select ok(not has_table_privilege('authenticated','public.session_note_audit_events','select'),'note-existence audit private');
select ok(not has_function_privilege('authenticated','public.read_session_note(uuid,uuid)','execute'),'browser cannot impersonate actor in note read RPC');
select ok(not has_function_privilege('anon','public.read_session_note(uuid,uuid)','execute'),'anonymous cannot read notes');
select ok(not has_function_privilege('authenticated','public.save_session_note(uuid,uuid,uuid,integer,uuid,jsonb,jsonb,text,boolean)','execute'),'browser cannot bypass server save gate');
select throws_ok($$select public.read_session_note('f8000000-0000-4000-8000-000000000001',(select b from nf where n=1))$$,'42501','Assigned confirmed appointment required','ordinary admin cannot read note');
select throws_ok($$select public.read_session_note('f8000000-0000-4000-8000-000000000003',(select b from nf where n=1))$$,'42501','Assigned confirmed appointment required','customer cannot read note');
select throws_ok($$select public.read_session_note('f8000000-0000-4000-8000-000000000004',(select b from nf where n=1))$$,'42501','Assigned confirmed appointment required','unrelated counselor cannot read note');
select throws_ok($$select public.read_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=3))$$,'42501','Assigned confirmed appointment required','held appointment cannot unlock notes');
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000004',true);
select is(jsonb_array_length(public.get_counselor_workspace()->'items'),0,'other counselor sees no assigned records');
select is(public.get_counselor_session((select b from nf where n=1)),null,'other counselor cannot open known session ID');
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000002',true);
update public.counselors set published=false where id='f8100000-0000-4000-8000-000000000001';
select is(public.read_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=1))->>'version','2','unpublishing preserves existing assigned note access');
update public.counselors set published=true where id='f8100000-0000-4000-8000-000000000001';
update public.bookings set start_at=start_at+interval '1 hour',end_at=end_at+interval '1 hour',buffer_end_at=buffer_end_at+interval '1 hour',reschedule_count=1 where id=(select b from nf where n=1);
select is(public.read_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=1))->>'version','2','reschedule preserves note identity/version');
update public.profiles set email=null where id='f8000000-0000-4000-8000-000000000002';
select throws_ok($$select public.read_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=1))$$,'42501','Assigned confirmed appointment required','incomplete actor denied');
update public.profiles set email='fixture@example.test',role='customer' where id='f8000000-0000-4000-8000-000000000002';
select throws_ok($$select public.read_session_note('f8000000-0000-4000-8000-000000000002',(select b from nf where n=1))$$,'42501','Assigned confirmed appointment required','revoked counselor denied');
select throws_ok($$select public.get_counselor_workspace()$$,'42501','Counselor authentication required','revoked role cannot list workspace');
update public.profiles set role='counselor' where id='f8000000-0000-4000-8000-000000000002';
select pg_temp.make_booking(n,now()+interval '10 days'+n*interval '2 hours') from generate_series(10,34)n;
select is(jsonb_array_length(public.get_counselor_workspace()->'items'),20,'workspace page capped at20');
select is((public.get_counselor_workspace()->>'has_more')::boolean,true,'workspace lookahead');
select is(jsonb_array_length(public.get_counselor_workspace('upcoming',1)->'items'),6,'workspace second page remainder');
select * from finish();rollback;
