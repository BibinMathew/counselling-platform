-- Empty by default: existing local behavior is preserved on every deployment.
create table public.synthetic_staging_settings (
 id boolean primary key default true check(id),
 app_origin text not null check(app_origin ~ '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?[.]vercel[.]app$')
);
alter table public.synthetic_staging_settings enable row level security;
revoke all on public.synthetic_staging_settings from public,anon,authenticated;
grant select,insert,update on public.synthetic_staging_settings to service_role;
create function public.is_simulated_notification_origin(p_origin text)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(p_origin ~ '^http://(127[.]0[.]0[.]1|localhost|\[::1\])(:[0-9]{1,5})?$'
 or exists(select 1 from public.synthetic_staging_settings s where s.id and s.app_origin=p_origin),false);
$$;
revoke all on function public.is_simulated_notification_origin(text) from public,anon,authenticated;
grant execute on function public.is_simulated_notification_origin(text) to service_role;
create or replace function public.dispatch_simulated_notification(p_job_id uuid,p_lease_token uuid,p_app_origin text)
returns text language plpgsql security definer set search_path='' as $$
declare j public.notification_jobs; b public.bookings; target public.profiles; counselor_user uuid; current_link integer; message text; destination text; checked_at timestamptz; delay_minutes integer;
begin
 if not public.is_simulated_notification_origin(p_app_origin) then raise exception 'Approved synthetic origin required'; end if;
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
