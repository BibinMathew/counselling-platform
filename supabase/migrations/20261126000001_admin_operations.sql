create table public.operational_cases(
 id uuid primary key default gen_random_uuid(),source_type text not null,
 booking_source_id uuid references public.bookings(id)on delete cascade,
 order_source_id uuid references public.payment_orders(id)on delete cascade,
 event_source_id uuid references public.payment_events(id)on delete cascade,
 job_source_id uuid references public.notification_jobs(id)on delete cascade,
 source_id uuid generated always as(coalesce(booking_source_id,order_source_id,event_source_id,job_source_id))stored,
 booking_id uuid references public.bookings(id)on delete cascade,
 status text not null default 'open' check(status in('open','in_progress','closed')),version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(source_type,source_id),check(num_nonnulls(booking_source_id,order_source_id,event_source_id,job_source_id)=1),
 check((source_type='booking'and booking_source_id is not null)or(source_type='payment_order'and order_source_id is not null)or(source_type='payment_event'and event_source_id is not null)or(source_type='notification_job'and job_source_id is not null))
);
create index operational_cases_status_idx on public.operational_cases(status,updated_at desc,id);
create table public.operational_case_events(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.operational_cases(id)on delete cascade,
 actor_id uuid not null,action text not null,remark text check(char_length(remark)<=1000),version integer not null,created_at timestamptz not null default now(),unique(case_id,version)
);
create table public.operational_case_receipts(
 case_id uuid not null references public.operational_cases(id)on delete cascade,request_id uuid not null,
 payload_digest text not null,accepted_version integer not null,primary key(case_id,request_id)
);
alter table public.phase9_audit_events add constraint phase9_audit_case_fk foreign key(case_id)references public.operational_cases(id)on delete cascade;
alter table public.operational_cases enable row level security;
alter table public.operational_case_events enable row level security;
alter table public.operational_case_receipts enable row level security;
revoke all on public.operational_cases,public.operational_case_events,public.operational_case_receipts from public,anon,authenticated;
grant all on public.operational_cases,public.operational_case_events,public.operational_case_receipts to service_role;

create function public.phase9_source(p_type text,p_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_type='booking'then select jsonb_build_object('booking_id',b.id,'status',case when b.status='held'and b.hold_expires_at<=now()then 'expired'else b.status::text end,'start_at',b.start_at,'end_at',b.end_at)into result from public.bookings b where b.id=p_id;
 elsif p_type='payment_order'then select jsonb_build_object('booking_id',o.booking_id,'review_reason',o.review_reason,'creation_state',o.creation_state,'confirmed_payment',o.confirmed_payment_id is not null)into result from public.payment_orders o where o.id=p_id;
 elsif p_type='payment_event'then select jsonb_build_object('booking_id',o.booking_id,'outcome',e.outcome,'provider',e.provider)into result from public.payment_events e left join public.payment_orders o on o.id=e.order_id where e.id=p_id;
 elsif p_type='notification_job'then select jsonb_build_object('booking_id',j.booking_id,'status',j.status,'attempts',j.attempts,'error_code',j.error_code)into result from public.notification_jobs j where j.id=p_id;
 end if;return result;
end;$$;
create function public.phase9_overview(p_actor uuid)returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.phase9_assert_role(p_actor,'admin');
 return jsonb_build_object('as_of',now(),
 'upcoming',(select count(*)from public.bookings where status='confirmed'and end_at>now()),
 'today',(select count(*)from public.bookings where status='confirmed'and(start_at at time zone 'Asia/Kolkata')::date=(now()at time zone 'Asia/Kolkata')::date),
 'missing_meet',(select count(*)from public.bookings b where b.status='confirmed'and b.start_at>now()and not exists(select 1 from public.booking_meetings m where m.booking_id=b.id)),
 'payment_review',(select count(*)from public.payment_orders where review_reason is not null),
 'unmatched',(select count(*)from public.payment_events where outcome='unmatched_order'),
 'failed_notifications',(select count(*)from public.notification_jobs where status='failed'),
 'unreviewed',(select count(*)from public.appointment_feedback where reviewed_at is null),
 'active_cases',(select count(*)from public.operational_cases where status in('open','in_progress')));
end;$$;
create function public.phase9_bookings(p_actor uuid,p_view text default 'all',p_counselor uuid default null,p_booking uuid default null,p_page integer default 0)returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 perform public.phase9_assert_role(p_actor,'admin');perform public.phase9_check_page(p_page);
 if p_view is null or p_view not in('all','upcoming','past','holds','expired')then raise exception using errcode='23514',message='Invalid booking view';end if;
 with source as(select b.id,b.customer_id,b.counselor_id,c.display_name as counselor_name,b.start_at,b.end_at,b.reschedule_count,
 case when b.status='held'and b.hold_expires_at<=now()then 'expired'else b.status::text end as status from public.bookings b join public.counselors c on c.id=b.counselor_id where(p_counselor is null or b.counselor_id=p_counselor)and(p_booking is null or b.id=p_booking)),
 page as(select * from source where p_view='all'or(p_view='upcoming'and status='confirmed'and end_at>now())or(p_view='past'and status='confirmed'and end_at<=now())or(p_view='holds'and status='held')or(p_view='expired'and status='expired')order by case when p_view='upcoming'then start_at end asc,case when p_view<>'upcoming'then start_at end desc,id limit 21 offset p_page*20)
 select coalesce(jsonb_agg(to_jsonb(page)order by case when p_view='upcoming'then start_at end asc,case when p_view<>'upcoming'then start_at end desc,id),'[]')into items from page;
 return jsonb_build_object('as_of',now(),'items',case when jsonb_array_length(items)>20 then items-20 else items end,'has_more',jsonb_array_length(items)>20);
end;$$;
create function public.phase9_case_json(c public.operational_cases)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',c.id,'source_type',c.source_type,'source_id',c.source_id,'booking_id',c.booking_id,'status',c.status,'version',c.version,'created_at',c.created_at,'updated_at',c.updated_at);
$$;
create function public.phase9_cases(p_actor uuid,p_state text default 'all',p_page integer default 0)returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 perform public.phase9_assert_role(p_actor,'admin');perform public.phase9_check_page(p_page);
 if p_state is null or p_state not in('all','open','in_progress','closed')then raise exception using errcode='23514',message='Invalid case view';end if;
 select coalesce(jsonb_agg(public.phase9_case_json(r)order by r.updated_at desc,r.id),'[]')into items from(select c.*from public.operational_cases c where p_state='all'or c.status=p_state order by c.updated_at desc,c.id limit 21 offset p_page*20)r;
 insert into public.phase9_audit_events(actor_id,action)values(p_actor,'case_page_read');
 return jsonb_build_object('as_of',now(),'items',case when jsonb_array_length(items)>20 then items-20 else items end,'has_more',jsonb_array_length(items)>20);
end;$$;
create function public.phase9_case_detail(p_actor uuid,p_case uuid,p_page integer default 0)returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.operational_cases;items jsonb;
begin
 perform public.phase9_assert_role(p_actor,'admin');perform public.phase9_check_page(p_page);
 select * into c from public.operational_cases where id=p_case;if not found then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(r)order by version desc),'[]')into items from(select e.id,e.actor_id,e.action,e.remark,e.version,e.created_at from public.operational_case_events e where e.case_id=c.id order by e.version desc limit 21 offset p_page*20)r;
 insert into public.phase9_audit_events(actor_id,case_id,booking_id,action)values(p_actor,c.id,c.booking_id,'case_read');
 return jsonb_build_object('as_of',now(),'case',public.phase9_case_json(c),'source',public.phase9_source(c.source_type,c.source_id),'items',case when jsonb_array_length(items)>20 then items-20 else items end,'has_more',jsonb_array_length(items)>20);
end;$$;
create function public.phase9_open_case(p_actor uuid,p_source_type text,p_source_id uuid,p_remark text,p_ack boolean)returns jsonb language plpgsql security definer set search_path='' as $$
declare facts jsonb;c public.operational_cases;r text:=nullif(btrim(p_remark),'');
begin
 perform public.phase9_assert_role(p_actor,'admin');
 if p_ack is distinct from true then raise exception using errcode='23514',message='Synthetic acknowledgement required';end if;
 if char_length(r)>1000 then raise exception using errcode='23514',message='Invalid operational remark';end if;
 facts:=public.phase9_source(p_source_type,p_source_id);
 if facts is null then raise exception using errcode='23514',message='Operational source unavailable';end if;
 select * into c from public.operational_cases where source_type=p_source_type and source_id=p_source_id;
 if found then return public.phase9_case_json(c)||jsonb_build_object('existing',true);end if;
 insert into public.operational_cases(source_type,booking_source_id,order_source_id,event_source_id,job_source_id,booking_id)values(p_source_type,case when p_source_type='booking'then p_source_id end,case when p_source_type='payment_order'then p_source_id end,case when p_source_type='payment_event'then p_source_id end,case when p_source_type='notification_job'then p_source_id end,(facts->>'booking_id')::uuid)returning * into c;
 insert into public.operational_case_events(case_id,actor_id,action,remark,version)values(c.id,p_actor,'opened',r,1);
 insert into public.phase9_audit_events(actor_id,booking_id,case_id,action,new_status,version)values(p_actor,c.booking_id,c.id,'case_opened','open',1);
 return public.phase9_case_json(c)||jsonb_build_object('existing',false);
end;$$;
create function public.phase9_update_case(p_actor uuid,p_case uuid,p_expected integer,p_request uuid,p_action text,p_remark text,p_ack boolean)returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.operational_cases;receipt public.operational_case_receipts;r text:=nullif(btrim(p_remark),'');digest text;target text;prior text;
begin
 perform public.phase9_assert_role(p_actor,'admin');
 if p_ack is distinct from true then raise exception using errcode='23514',message='Synthetic acknowledgement required';end if;
 if p_request is null or p_expected is null or p_expected not between 1 and 1000000000 or p_action is null or p_action not in('start','reset','close','reopen')or char_length(r)>1000 then raise exception using errcode='23514',message='Invalid case request';end if;
 if p_action in('close','reopen')and r is null then raise exception using errcode='23514',message='Closing or reopening requires a remark';end if;
 select * into c from public.operational_cases where id=p_case for update;
 if not found then raise exception using errcode='42501',message='Case unavailable';end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_array(p_actor,p_expected,p_action,r)::text,'UTF8'),'sha256'),'hex');
 select * into receipt from public.operational_case_receipts where case_id=c.id and request_id=p_request;
 if found then
 if receipt.payload_digest<>digest then raise exception using errcode='23514',message='Request identity conflict';end if;
 return jsonb_build_object('accepted_version',receipt.accepted_version,'current_version',c.version,'replayed',true);end if;
 if c.version<>p_expected then raise exception using errcode='40001',message='Case changed; reload before updating';end if;
 if(c.status='closed'and p_action<>'reopen')or(c.status<>'closed'and p_action='reopen')or(c.status='open'and p_action='reset')or(c.status='in_progress'and p_action='start')then raise exception using errcode='23514',message='Invalid case transition';end if;
 target:=case p_action when 'start'then 'in_progress'when 'close'then 'closed'else 'open'end;prior:=c.status;
 update public.operational_cases set status=target,version=version+1,updated_at=clock_timestamp()where id=c.id returning * into c;
 insert into public.operational_case_events(case_id,actor_id,action,remark,version)values(c.id,p_actor,p_action,r,c.version);
 insert into public.operational_case_receipts values(c.id,p_request,digest,c.version);
 insert into public.phase9_audit_events(actor_id,booking_id,case_id,action,old_status,new_status,version)values(p_actor,c.booking_id,c.id,'case_updated',prior,target,c.version);
 return jsonb_build_object('accepted_version',c.version,'current_version',c.version,'replayed',false);
end;$$;
do $$declare f record;begin for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'phase9_%'loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);end loop;end;$$;
