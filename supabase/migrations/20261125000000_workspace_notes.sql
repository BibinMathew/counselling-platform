-- Local app features are server-gated; private RPCs are never browser-executable.
create table public.session_notes (
 id uuid primary key,
 booking_id uuid not null references public.bookings(id) on delete cascade,
 counselor_id uuid not null references public.profiles(id),
 version integer not null check(version>0),
 envelope jsonb not null check(jsonb_typeof(envelope)='object' and octet_length(envelope::text)<=150000),
 updated_at timestamptz not null default now(),
 unique(booking_id,counselor_id)
);
create table public.session_note_save_requests (
 booking_id uuid not null references public.bookings(id) on delete cascade,
 counselor_id uuid not null references public.profiles(id),
 request_id uuid not null,
 note_id uuid not null references public.session_notes(id) on delete cascade,
 expected_version integer not null,
 accepted_version integer not null,
 digest_key_id text not null,
 request_digest text not null check(request_digest ~ '^[a-f0-9]{64}$'),
 acknowledged_at timestamptz not null default now(),
 primary key(booking_id,counselor_id,request_id)
);
create table public.session_note_audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 booking_id uuid not null references public.bookings(id) on delete cascade,
 note_id uuid,
 action text not null check(action in ('opened','saved')),
 version integer not null,
 occurred_at timestamptz not null default now()
);
alter table public.session_notes enable row level security;
alter table public.session_note_save_requests enable row level security;
alter table public.session_note_audit_events enable row level security;
revoke all on public.session_notes,public.session_note_save_requests,public.session_note_audit_events from public,anon,authenticated;
grant all on public.session_notes,public.session_note_save_requests,public.session_note_audit_events to service_role;
create index session_note_audit_booking_idx on public.session_note_audit_events(booking_id,occurred_at);

create function public.get_counselor_workspace(p_view text default 'upcoming',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); checked_at timestamptz:=now(); view_name text:=case when p_view='past' then 'past' else 'upcoming' end; page_number integer:=case when p_page between 0 and 999999 then p_page else 0 end; result jsonb;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and role='counselor' and email is not null) then raise exception using errcode='42501',message='Counselor authentication required';end if;
 with page as (
  select b.id,b.start_at,b.end_at,b.status,coalesce(nullif(p.preferred_name,''),'Customer') as customer_name,
   b.end_at<=checked_at as is_past,b.start_at<=checked_at and b.end_at>checked_at as in_progress
  from public.bookings b join public.counselors c on c.id=b.counselor_id join public.profiles p on p.id=b.customer_id
  where c.profile_id=actor and b.status='confirmed' and ((view_name='past' and b.end_at<=checked_at) or(view_name='upcoming' and b.end_at>checked_at))
  order by case when view_name='upcoming' then b.start_at end asc,case when view_name='past' then b.start_at end desc,b.id
  limit 21 offset page_number*20
 ) select jsonb_build_object('as_of',checked_at,'has_more',(select count(*)>20 from page),'items',coalesce((select jsonb_agg(to_jsonb(p)) from(select * from page limit 20)p),'[]'::jsonb)) into result;
 return result;
end; $$;
create function public.get_counselor_session(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and role='counselor' and email is not null) then raise exception using errcode='42501',message='Counselor authentication required';end if;
 select jsonb_build_object('id',b.id,'customer_name',coalesce(nullif(p.preferred_name,''),'Customer'),'start_at',b.start_at,'end_at',b.end_at,'status',b.status,'is_past',b.end_at<=now(),'in_progress',b.start_at<=now() and b.end_at>now(),'meeting_url',m.meeting_url) into result
 from public.bookings b join public.counselors c on c.id=b.counselor_id join public.profiles p on p.id=b.customer_id left join public.booking_meetings m on m.booking_id=b.id
 where b.id=p_booking_id and b.status='confirmed' and c.profile_id=actor;
 return result;
end; $$;

create function public.assert_session_note_owner(p_actor_id uuid,p_booking_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(70324004);
 perform 1 from public.profiles p join public.counselors c on c.profile_id=p.id join public.bookings b on b.counselor_id=c.id
 where p.id=p_actor_id and p.role='counselor' and p.email is not null and b.id=p_booking_id and b.status='confirmed'
 for share of p,c,b;
 if not found then raise exception using errcode='42501',message='Assigned confirmed appointment required';end if;
end; $$;
create function public.read_session_note(p_actor_id uuid,p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.session_notes;
begin
 perform public.assert_session_note_owner(p_actor_id,p_booking_id);
 select * into n from public.session_notes where booking_id=p_booking_id and counselor_id=p_actor_id;
 insert into public.session_note_audit_events(actor_id,booking_id,note_id,action,version) values(p_actor_id,p_booking_id,n.id,'opened',coalesce(n.version,0));
 if n.id is null then return null;end if;
 return jsonb_build_object('id',n.id,'booking_id',n.booking_id,'counselor_id',n.counselor_id,'version',n.version,'envelope',n.envelope);
end; $$;
create function public.save_session_note(p_actor_id uuid,p_booking_id uuid,p_note_id uuid,p_expected_version integer,p_request_id uuid,p_envelope jsonb,p_digest_candidates jsonb,p_active_key_id text,p_acknowledged boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.session_notes; r public.session_note_save_requests; actual_version integer; digest_value text;
begin
 perform public.assert_session_note_owner(p_actor_id,p_booking_id);
 if p_acknowledged is not true then raise exception using errcode='23514',message='Synthetic acknowledgement required';end if;
 if p_expected_version is null or p_expected_version<0 or p_expected_version>1000000000 or p_note_id is null or p_request_id is null then raise exception using errcode='23514',message='Invalid note request';end if;
 select * into n from public.session_notes where booking_id=p_booking_id and counselor_id=p_actor_id for update;
 actual_version=coalesce(n.version,0);
 select * into r from public.session_note_save_requests where booking_id=p_booking_id and counselor_id=p_actor_id and request_id=p_request_id;
 if r.request_id is not null then
  if r.expected_version<>p_expected_version or (p_digest_candidates->>r.digest_key_id) is distinct from r.request_digest then raise exception using errcode='23514',message='Note request identity conflict';end if;
  return jsonb_build_object('accepted_version',r.accepted_version,'current_version',actual_version,'replayed',true);
 end if;
 if actual_version<>p_expected_version then raise exception using errcode='40001',message='Note version conflict';end if;
 digest_value=p_digest_candidates->>p_active_key_id;
 if digest_value is null or digest_value !~ '^[a-f0-9]{64}$' or p_active_key_id is null or p_active_key_id !~ '^[A-Za-z0-9_-]{1,40}$' or p_envelope is null or jsonb_typeof(p_envelope)<>'object' or
  (p_envelope->>'format') is distinct from '1' or (p_envelope->>'key_id') is distinct from p_active_key_id or not (p_envelope ?& array['iv','tag','ciphertext']) or octet_length(p_envelope::text)>150000 then raise exception using errcode='23514',message='Invalid encrypted note';end if;
 if n.id is null then
  insert into public.session_notes(id,booking_id,counselor_id,version,envelope) values(p_note_id,p_booking_id,p_actor_id,1,p_envelope) returning * into n;
 else
  if p_note_id<>n.id then raise exception using errcode='23514',message='Note identity conflict';end if;
  update public.session_notes set version=version+1,envelope=p_envelope,updated_at=clock_timestamp() where id=n.id returning * into n;
 end if;
 insert into public.session_note_save_requests(booking_id,counselor_id,request_id,note_id,expected_version,accepted_version,digest_key_id,request_digest) values(p_booking_id,p_actor_id,p_request_id,n.id,p_expected_version,n.version,p_active_key_id,digest_value);
 insert into public.session_note_audit_events(actor_id,booking_id,note_id,action,version) values(p_actor_id,p_booking_id,n.id,'saved',n.version);
 return jsonb_build_object('accepted_version',n.version,'current_version',n.version,'replayed',false);
end; $$;
revoke all on function public.get_counselor_workspace(text,integer),public.get_counselor_session(uuid) from public,anon;
grant execute on function public.get_counselor_workspace(text,integer),public.get_counselor_session(uuid) to authenticated;
revoke all on function public.assert_session_note_owner(uuid,uuid) from public,anon,authenticated;
revoke all on function public.read_session_note(uuid,uuid),public.save_session_note(uuid,uuid,uuid,integer,uuid,jsonb,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.read_session_note(uuid,uuid),public.save_session_note(uuid,uuid,uuid,integer,uuid,jsonb,jsonb,text,boolean) to service_role;
