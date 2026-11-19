-- Meeting URLs and synthetic delivery state are separate from payment evidence.
create table public.booking_meetings (
 booking_id uuid primary key references public.bookings(id) on delete cascade,
 meeting_url text not null,
 revision integer not null check(revision > 0),
 updated_at timestamptz not null default now()
);
create table public.meeting_url_reservations (
 meeting_url text primary key check(meeting_url ~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'),
 booking_id uuid not null references public.bookings(id) on delete cascade
);
create table public.notification_jobs (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 channel text not null check(channel in ('email','whatsapp')),
 template text not null check(template in ('confirmation','link_update','schedule_update','reminder_24h','reminder_1h','counselor_booking','counselor_schedule_update')),
 schedule_revision integer not null default 0,
 link_revision integer not null default 0,
 due_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','processing','retrying','delivered','failed','skipped','superseded')),
 attempts integer not null default 0 check(attempts >= 0),
 next_attempt_at timestamptz not null,
 lease_token uuid,
 lease_until timestamptz,
 error_code text,
 fail_next boolean not null default false,
 created_at timestamptz not null default now(),
 unique(booking_id,recipient_id,template,schedule_revision,link_revision)
);
create index notification_jobs_due on public.notification_jobs(status,next_attempt_at,lease_until);
create index notification_jobs_booking on public.notification_jobs(booking_id);
create table public.notification_simulator_receipts (
 job_id uuid primary key references public.notification_jobs(id) on delete cascade,
 channel text not null,
 destination text not null,
 subject text not null,
 body text not null,
 created_at timestamptz not null default now()
);
create table public.meeting_notification_audit_events (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid references public.bookings(id) on delete cascade,
 actor_id uuid,
 action text not null check(action in ('meeting_updated','notification_retry','notification_fail_next')),
 revision integer,
 created_at timestamptz not null default now()
);

alter table public.booking_meetings enable row level security;
alter table public.meeting_url_reservations enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_simulator_receipts enable row level security;
alter table public.meeting_notification_audit_events enable row level security;
revoke all on public.booking_meetings,public.meeting_url_reservations,public.notification_jobs,public.notification_simulator_receipts,public.meeting_notification_audit_events from public,anon,authenticated;
grant all on public.booking_meetings,public.meeting_url_reservations,public.notification_jobs,public.notification_simulator_receipts,public.meeting_notification_audit_events to service_role;
grant select on public.notification_jobs to authenticated;
create policy notification_jobs_admin on public.notification_jobs for select to authenticated using((select public.is_catalog_admin()));

create function public.add_notification_job(p_booking_id uuid,p_recipient_id uuid,p_channel text,p_template text,p_schedule integer,p_link integer,p_due timestamptz)
returns void language sql security definer set search_path='' as $$
 insert into public.notification_jobs(booking_id,recipient_id,channel,template,schedule_revision,link_revision,due_at,next_attempt_at)
 values(p_booking_id,p_recipient_id,p_channel,p_template,p_schedule,p_link,p_due,p_due) on conflict do nothing;
$$;
create function public.queue_booking_notifications(p_booking_id uuid,p_rescheduled boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings; counselor_user uuid; checked_at timestamptz:=clock_timestamp();
begin
 select * into b from public.bookings where id=p_booking_id;
 if b.status<>'confirmed' or b.start_at<=checked_at then return; end if;
 select profile_id into counselor_user from public.counselors where id=b.counselor_id;
 -- All unfinished work from an earlier schedule is stale, including failed jobs.
 update public.notification_jobs set status='superseded',lease_token=null,lease_until=null
 where booking_id=b.id and schedule_revision<>b.reschedule_count and status not in ('delivered','skipped','superseded');
 perform public.add_notification_job(b.id,b.customer_id,'email',case when p_rescheduled then 'schedule_update' else 'confirmation' end,b.reschedule_count,0,checked_at);
 perform public.add_notification_job(b.id,counselor_user,'whatsapp',case when p_rescheduled then 'counselor_schedule_update' else 'counselor_booking' end,b.reschedule_count,0,checked_at);
 if b.start_at-interval '24 hours'>checked_at then
  perform public.add_notification_job(b.id,b.customer_id,'email','reminder_24h',b.reschedule_count,0,b.start_at-interval '24 hours');
 end if;
 if b.start_at-interval '1 hour'>checked_at then
  perform public.add_notification_job(b.id,b.customer_id,'email','reminder_1h',b.reschedule_count,0,b.start_at-interval '1 hour');
 end if;
end; $$;
create function public.enqueue_booking_notifications()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' then
  if tg_op='INSERT' then perform public.queue_booking_notifications(new.id,false);
  elsif old.status is distinct from 'confirmed' then perform public.queue_booking_notifications(new.id,false);
  elsif new.start_at is distinct from old.start_at or new.reschedule_count is distinct from old.reschedule_count then
   perform public.queue_booking_notifications(new.id,true);
  end if;
 end if;
 return new;
end; $$;
create trigger bookings_notifications after insert or update of status,start_at,reschedule_count on public.bookings
for each row execute function public.enqueue_booking_notifications();

create function public.set_booking_meeting(p_booking_id uuid,p_url text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings; previous public.booking_meetings; reserved uuid; next_revision integer; canonical text:=btrim(p_url);
begin
 if not public.is_catalog_admin() then raise exception using errcode='42501',message='Administrator required'; end if;
 if canonical is null or canonical !~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$' then raise exception using errcode='23514',message='Invalid Meet URL'; end if;
 perform pg_advisory_xact_lock(70324004);
 select * into b from public.bookings where id=p_booking_id for update;
 if b.id is null or b.status<>'confirmed' or b.start_at<=clock_timestamp() then raise exception using errcode='23514',message='Future confirmed booking required'; end if;
 select * into previous from public.booking_meetings where booking_id=b.id;
 if previous.meeting_url=canonical then return; end if;
 select booking_id into reserved from public.meeting_url_reservations where meeting_url=canonical;
 if reserved is not null and reserved<>b.id then raise exception using errcode='23514',message='Meet link already assigned'; end if;
 insert into public.meeting_url_reservations values(canonical,b.id) on conflict do nothing;
 next_revision=coalesce(previous.revision,0)+1;
 insert into public.booking_meetings values(b.id,canonical,next_revision,clock_timestamp())
 on conflict(booking_id) do update set meeting_url=excluded.meeting_url,revision=excluded.revision,updated_at=excluded.updated_at;
 update public.notification_jobs set status='superseded',lease_token=null,lease_until=null where booking_id=b.id and template='link_update' and status not in ('delivered','skipped','superseded');
 perform public.add_notification_job(b.id,b.customer_id,'email','link_update',b.reschedule_count,next_revision,clock_timestamp());
 insert into public.meeting_notification_audit_events(booking_id,actor_id,action,revision) values(b.id,auth.uid(),'meeting_updated',next_revision);
end; $$;
create function public.get_accessible_booking_meetings()
returns table(booking_id uuid,meeting_url text,revision integer) language sql stable security definer set search_path='' as $$
 select m.booking_id,m.meeting_url,m.revision from public.booking_meetings m
 join public.bookings b on b.id=m.booking_id join public.counselors c on c.id=b.counselor_id
 join public.profiles p on p.id=auth.uid()
 where b.status='confirmed' and p.email is not null and
 (p.role='admin' or (p.role='customer' and b.customer_id=p.id) or (p.role='counselor' and c.profile_id=p.id));
$$;
create function public.get_assigned_confirmed_bookings()
returns table(id uuid,start_at timestamptz,end_at timestamptz,meeting_url text) language sql stable security definer set search_path='' as $$
 select b.id,b.start_at,b.end_at,m.meeting_url from public.bookings b
 join public.counselors c on c.id=b.counselor_id join public.profiles p on p.id=c.profile_id
 left join public.booking_meetings m on m.booking_id=b.id
 where p.id=auth.uid() and p.role='counselor' and p.email is not null and b.status='confirmed' and b.end_at>now() order by b.start_at;
$$;
create function public.get_admin_confirmed_bookings()
returns table(id uuid,counselor_name text,start_at timestamptz,meeting_url text) language sql stable security definer set search_path='' as $$
 select b.id,c.display_name,b.start_at,m.meeting_url from public.bookings b
 join public.counselors c on c.id=b.counselor_id left join public.booking_meetings m on m.booking_id=b.id
 where public.is_catalog_admin() and b.status='confirmed' and b.start_at>now() order by b.start_at;
$$;
revoke all on function public.add_notification_job(uuid,uuid,text,text,integer,integer,timestamptz), public.queue_booking_notifications(uuid,boolean),public.enqueue_booking_notifications() from public,anon,authenticated;
revoke all on function public.set_booking_meeting(uuid,text),public.get_accessible_booking_meetings(),public.get_assigned_confirmed_bookings(),public.get_admin_confirmed_bookings() from public,anon;
grant execute on function public.set_booking_meeting(uuid,text),public.get_accessible_booking_meetings(),public.get_assigned_confirmed_bookings(),public.get_admin_confirmed_bookings() to authenticated;
-- One-time future-only backfill. Semantic keys make enqueue safe to repeat internally.
select public.queue_booking_notifications(id,false) from public.bookings where status='confirmed' and start_at>clock_timestamp();
