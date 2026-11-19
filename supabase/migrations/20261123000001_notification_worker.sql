create function public.claim_notification_jobs(p_limit integer default 20)
returns table(id uuid,lease_token uuid) language plpgsql security definer set search_path='' as $$
begin
 -- A fifth abandoned lease is terminal rather than an infinite crash loop.
 update public.notification_jobs j set status='failed',error_code='attempts_exhausted',lease_token=null,lease_until=null
 where j.status='processing' and j.lease_until<=clock_timestamp() and j.attempts>=5;
 return query with candidates as (
  select j.id from public.notification_jobs j where j.due_at<=clock_timestamp() and j.attempts<5
  and ((j.status in ('queued','retrying') and j.next_attempt_at<=clock_timestamp()) or (j.status='processing' and j.lease_until<=clock_timestamp()))
  order by j.next_attempt_at,j.id for update skip locked limit greatest(0,least(coalesce(p_limit,20),20))
 ) update public.notification_jobs j set status='processing',attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
 from candidates c where j.id=c.id returning j.id,j.lease_token;
end; $$;
create function public.dispatch_simulated_notification(p_job_id uuid,p_lease_token uuid,p_app_origin text)
returns text language plpgsql security definer set search_path='' as $$
declare j public.notification_jobs; b public.bookings; target public.profiles; counselor_user uuid; current_link integer; message text; destination text; checked_at timestamptz; delay_minutes integer;
begin
 if p_app_origin is null or p_app_origin !~ '^http://(127[.]0[.]0[.]1|localhost|\[::1\])(:[0-9]{1,5})?$' then raise exception 'Local origin required'; end if;
 perform pg_advisory_xact_lock(70324004);
 select * into j from public.notification_jobs where id=p_job_id for update;
 if j.id is null then raise exception 'Unknown job'; end if;
 if j.status='delivered' then return 'delivered'; end if;
 if j.status<>'processing' or j.lease_token is distinct from p_lease_token or j.lease_until<=clock_timestamp() then return 'stale'; end if;
 checked_at=clock_timestamp();
 select * into b from public.bookings where id=j.booking_id;
 select profile_id into counselor_user from public.counselors where id=b.counselor_id;
 select * into target from public.profiles where id=j.recipient_id for share;
 select coalesce(max(revision),0) into current_link from public.booking_meetings where booking_id=b.id;
 if b.status<>'confirmed' or b.reschedule_count<>j.schedule_revision or (j.template='link_update' and j.link_revision<>current_link) then
  update public.notification_jobs set status='superseded',lease_token=null,lease_until=null where id=j.id; return 'superseded';
 end if;
 if b.start_at<=checked_at or j.due_at>checked_at or
    (j.channel='email' and (target.id is distinct from b.customer_id or target.role<>'customer' or target.email is null)) or
    (j.channel='whatsapp' and (target.id is distinct from counselor_user or target.role<>'counselor' or target.email is null)) or
    not exists(select 1 from public.profiles p where p.id=b.customer_id and p.role='customer' and p.email is not null) or
    not exists(select 1 from public.profiles p where p.id=counselor_user and p.role='counselor' and p.email is not null)
 then
  update public.notification_jobs set status='skipped',error_code='booking_or_recipient_ineligible',lease_token=null,lease_until=null where id=j.id; return 'skipped';
 end if;
 if j.fail_next then
  delay_minutes=case j.attempts when 1 then 1 when 2 then 5 when 3 then 15 else 60 end;
  update public.notification_jobs set status=case when attempts>=5 then 'failed' else 'retrying' end,
   fail_next=false,error_code='simulated_transient_failure',next_attempt_at=checked_at+make_interval(mins=>delay_minutes),lease_token=null,lease_until=null where id=j.id;
  return case when j.attempts>=5 then 'failed' else 'retrying' end;
 end if;
 message=case j.template
  when 'confirmation' then 'Your appointment is confirmed.'
  when 'link_update' then 'Your meeting details have been updated.'
  when 'schedule_update' then 'Your appointment time has changed.'
  when 'counselor_booking' then 'A new appointment is confirmed.'
  when 'counselor_schedule_update' then 'An appointment time has changed.'
  else 'Appointment reminder.' end;
 message=message||' '||to_char(b.start_at at time zone 'Asia/Kolkata','DD Mon YYYY HH24:MI')||' Asia/Kolkata. Sign in: '||p_app_origin||case when j.channel='email' then '/bookings' else '/counselor' end;
 -- Synthetic destinations deliberately do not copy unverified real contact data.
 destination=case when j.channel='email' then 'synthetic-email:' else 'synthetic-whatsapp:' end||target.id::text;
 insert into public.notification_simulator_receipts(job_id,channel,destination,subject,body)
 values(j.id,j.channel,destination,'Appointment update',message) on conflict(job_id) do nothing;
 update public.notification_jobs set status='delivered',error_code=null,lease_token=null,lease_until=null where id=j.id;
 return 'delivered';
end; $$;
create function public.retry_notification(p_job_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare j public.notification_jobs; b public.bookings; link_rev integer;
begin
 if not public.is_catalog_admin() then raise exception using errcode='42501',message='Administrator required'; end if;
 perform pg_advisory_xact_lock(70324004);
 select * into j from public.notification_jobs where id=p_job_id for update;
 select * into b from public.bookings where id=j.booking_id;
 select coalesce(max(revision),0) into link_rev from public.booking_meetings where booking_id=b.id;
 if j.id is null or j.status not in ('failed','retrying') or b.status<>'confirmed' or b.start_at<=clock_timestamp() or b.reschedule_count<>j.schedule_revision or (j.template='link_update' and link_rev<>j.link_revision) then
  raise exception using errcode='23514',message='Current failed or retrying job required';
 end if;
 update public.notification_jobs set status='queued',attempts=0,next_attempt_at=greatest(due_at,clock_timestamp()),error_code=null,lease_token=null,lease_until=null where id=j.id;
 insert into public.meeting_notification_audit_events(booking_id,actor_id,action) values(b.id,auth.uid(),'notification_retry');
end; $$;
create function public.fail_next_notification_attempt(p_job_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_catalog_admin() then raise exception using errcode='42501',message='Administrator required'; end if;
 perform pg_advisory_xact_lock(70324004);
 update public.notification_jobs set fail_next=true where id=p_job_id and status in ('queued','retrying');
 if not found then raise exception using errcode='23514',message='Pending job required'; end if;
 insert into public.meeting_notification_audit_events(booking_id,actor_id,action) select booking_id,auth.uid(),'notification_fail_next' from public.notification_jobs where id=p_job_id;
end; $$;
revoke all on function public.claim_notification_jobs(integer),public.dispatch_simulated_notification(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_notification_jobs(integer),public.dispatch_simulated_notification(uuid,uuid,text) to service_role;
revoke all on function public.retry_notification(uuid),public.fail_next_notification_attempt(uuid) from public,anon;
grant execute on function public.retry_notification(uuid),public.fail_next_notification_attempt(uuid) to authenticated;
