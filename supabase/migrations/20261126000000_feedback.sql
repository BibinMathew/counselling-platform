-- Local synthetic feedback. New functions are service-only; actor is session-derived by the server.
create table public.appointment_feedback(
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id) on delete cascade,
 customer_id uuid not null references public.profiles(id), rating integer not null check(rating between 1 and 5),
 comment text check(char_length(comment)<=2000), acknowledged_at timestamptz not null default now(),
 created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid,
 check((reviewed_at is null)=(reviewed_by is null))
);
create index appointment_feedback_review_idx on public.appointment_feedback(reviewed_at,created_at desc,id);
create table public.phase9_audit_events(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,booking_id uuid references public.bookings(id) on delete cascade,
 feedback_id uuid references public.appointment_feedback(id) on delete cascade,case_id uuid,
 action text not null check(action in ('feedback_read','feedback_summary_read','feedback_page_read','feedback_submitted','feedback_reviewed','case_read','case_page_read','case_opened','case_updated')),
 old_status text,new_status text,version integer,created_at timestamptz not null default now()
);
alter table public.appointment_feedback enable row level security;
alter table public.phase9_audit_events enable row level security;
revoke all on public.appointment_feedback,public.phase9_audit_events from public,anon,authenticated;
grant all on public.appointment_feedback,public.phase9_audit_events to service_role;
create function public.phase9_assert_role(p_actor uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(70324004);
 perform 1 from public.profiles where id=p_actor and role::text=p_role and email is not null for share;
 if not found then raise exception using errcode='42501',message='Authorized complete account required';end if;
end;$$;
create function public.phase9_check_page(p_page integer) returns void language plpgsql security definer set search_path='' as $$
begin if p_page is null or p_page not between 0 and 999999 then raise exception using errcode='23514',message='Invalid page';end if;end;$$;
create function public.phase9_feedback_page(p_actor uuid,p_booking uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings;result jsonb;
begin
 perform public.phase9_assert_role(p_actor,'customer');
 select * into b from public.bookings where id=p_booking and customer_id=p_actor for share;
 if not found then return null;end if;
 insert into public.phase9_audit_events(actor_id,booking_id,action)values(p_actor,b.id,'feedback_read');
 select jsonb_build_object('as_of',now(),'booking_id',b.id,'start_at',b.start_at,'end_at',b.end_at,'counselor_name',c.display_name,
 'eligible',b.status='confirmed' and b.end_at<=now(),'receipt',(select jsonb_build_object('id',f.id,'rating',f.rating,'comment',f.comment,'created_at',f.created_at,'reviewed_at',f.reviewed_at)from public.appointment_feedback f where f.booking_id=b.id)) into result from public.counselors c where c.id=b.counselor_id;
 return result;
end;$$;
create function public.phase9_feedback_summaries(p_actor uuid,p_bookings uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.phase9_assert_role(p_actor,'customer');
 if p_bookings is null or coalesce(array_length(p_bookings,1),0)>20 or array_ndims(p_bookings)>1 then raise exception using errcode='23514',message='Invalid booking list';end if;
 select coalesce(jsonb_agg(jsonb_build_object('booking_id',b.id,'submitted',f.id is not null)),'[]')into result from public.bookings b left join public.appointment_feedback f on f.booking_id=b.id where b.id=any(p_bookings)and b.customer_id=p_actor and b.status='confirmed' and b.end_at<=now();
 insert into public.phase9_audit_events(actor_id,action)values(p_actor,'feedback_summary_read');return result;
end;$$;
create function public.phase9_submit_feedback(p_actor uuid,p_booking uuid,p_rating integer,p_comment text,p_ack boolean)returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings;f public.appointment_feedback;c text:=nullif(btrim(p_comment),'');
begin
 perform public.phase9_assert_role(p_actor,'customer');
 if p_ack is distinct from true then raise exception using errcode='23514',message='Synthetic acknowledgement required';end if;
 if p_rating is null or p_rating not between 1 and 5 or char_length(c)>2000 then raise exception using errcode='23514',message='Invalid feedback';end if;
 select * into b from public.bookings where id=p_booking and customer_id=p_actor for share;
 if not found then raise exception using errcode='42501',message='Owned appointment required';end if;
 if b.status<>'confirmed' or b.end_at>now()then raise exception using errcode='23514',message='Feedback opens after the confirmed appointment ends';end if;
 select * into f from public.appointment_feedback where booking_id=b.id;
 if found then return jsonb_build_object('id',f.id,'result',case when f.rating=p_rating and f.comment is not distinct from c then 'existing'else 'conflict'end);end if;
 insert into public.appointment_feedback(booking_id,customer_id,rating,comment)values(b.id,p_actor,p_rating,c)returning * into f;
 insert into public.phase9_audit_events(actor_id,booking_id,feedback_id,action)values(p_actor,b.id,f.id,'feedback_submitted');
 return jsonb_build_object('id',f.id,'result','saved');
end;$$;
create function public.phase9_feedback_list(p_actor uuid,p_state text default 'all',p_counselor uuid default null,p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 perform public.phase9_assert_role(p_actor,'admin');perform public.phase9_check_page(p_page);
 if p_state is null or p_state not in('all','unreviewed','reviewed')then raise exception using errcode='23514',message='Invalid feedback view';end if;
 with rows as(select f.id,f.booking_id,f.customer_id,f.rating,f.comment,f.created_at,f.reviewed_at,b.counselor_id,c.display_name as counselor_name,b.start_at from public.appointment_feedback f join public.bookings b on b.id=f.booking_id join public.counselors c on c.id=b.counselor_id
 where(p_counselor is null or b.counselor_id=p_counselor)and(p_state='all'or(p_state='reviewed'and f.reviewed_at is not null)or(p_state='unreviewed'and f.reviewed_at is null))order by f.created_at desc,f.id limit 21 offset p_page*20)
 select coalesce(jsonb_agg(to_jsonb(rows)order by created_at desc,id),'[]')into items from rows;
 insert into public.phase9_audit_events(actor_id,action)values(p_actor,'feedback_page_read');
 return jsonb_build_object('as_of',now(),'items',case when jsonb_array_length(items)>20 then items-20 else items end,'has_more',jsonb_array_length(items)>20);
end;$$;
create function public.phase9_review_feedback(p_actor uuid,p_feedback uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.appointment_feedback;
begin
 perform public.phase9_assert_role(p_actor,'admin');
 select * into f from public.appointment_feedback where id=p_feedback for update;
 if not found then raise exception using errcode='42501',message='Feedback unavailable';end if;
 if f.reviewed_at is null then
 update public.appointment_feedback set reviewed_at=now(),reviewed_by=p_actor where id=f.id;
 insert into public.phase9_audit_events(actor_id,booking_id,feedback_id,action)values(p_actor,f.booking_id,f.id,'feedback_reviewed');end if;
 return jsonb_build_object('reviewed',true);
end;$$;
do $$declare f record;begin for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'phase9_%'loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);end loop;end;$$;
