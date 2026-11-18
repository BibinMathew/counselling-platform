-- Payment writes are trusted-server operations; booking ownership is checked again in RPCs.
create table public.payment_settings (
  id boolean primary key default true check(id),
  amount_paise integer not null default 69900 check(amount_paise between 100 and 10000000),
  currency text not null default 'INR' check(currency = 'INR')
);
insert into public.payment_settings(id) values(true);
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  customer_id uuid not null references public.profiles(id),
  provider text not null check(provider in ('simulator','razorpay')),
  amount_paise integer not null check(amount_paise > 0),
  currency text not null check(currency = 'INR'),
  external_order_id text,
  creation_state text not null default 'reserved' check(creation_state in ('reserved','creating','ready','uncertain')),
  confirmed_payment_id text,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reconciled_at timestamptz,
  unique(provider, external_order_id)
);
create index payment_orders_reconcile_idx on public.payment_orders(reconciled_at nulls first, created_at);
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id),
  booking_id uuid not null references public.bookings(id),
  provider text not null,
  payment_id text not null,
  state text not null check(state in ('authorized','failed','captured')),
  amount_paise integer not null,
  currency text not null,
  outcome text not null check(outcome in ('pending','failed','confirmed','admin_review')),
  reason text,
  updated_at timestamptz not null default now(),
  unique(provider, payment_id)
);
create unique index payment_transactions_one_confirmation on public.payment_transactions(booking_id) where outcome = 'confirmed';
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check(provider in ('simulator','razorpay')),
  event_id text not null check(length(event_id) between 1 and 200),
  payload_digest text not null check(payload_digest ~ '^[a-f0-9]{64}$'),
  order_id uuid references public.payment_orders(id),
  outcome text not null,
  created_at timestamptz not null default now(),
  unique(provider,event_id)
);
create table public.payment_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  order_id uuid references public.payment_orders(id),
  action text not null,
  occurred_at timestamptz not null default now()
);
-- Contains synthetic provider state only; browser/customer roles have no access.
create table public.payment_simulator_orders (
  id text primary key,
  receipt uuid not null unique references public.payment_orders(id),
  amount integer not null,
  currency text not null,
  status text not null default 'created',
  payments jsonb not null default '[]'::jsonb
);

alter table public.payment_settings enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_audit_events enable row level security;
alter table public.payment_simulator_orders enable row level security;
revoke all on public.payment_settings, public.payment_orders, public.payment_transactions, public.payment_events, public.payment_audit_events, public.payment_simulator_orders from public, anon, authenticated;
grant select on public.payment_settings to anon, authenticated;
create policy payment_settings_public on public.payment_settings for select to anon,authenticated using(true);
grant select on public.payment_orders,public.payment_transactions to authenticated;
create policy payment_orders_owner_admin on public.payment_orders for select to authenticated using(customer_id = (select auth.uid()) or (select public.is_catalog_admin()));
create policy payment_transactions_owner_admin on public.payment_transactions for select to authenticated using(exists(select 1 from public.payment_orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or (select public.is_catalog_admin()))));
grant all on public.payment_settings,public.payment_orders,public.payment_transactions,public.payment_events,public.payment_audit_events,public.payment_simulator_orders to service_role;

create function public.set_payment_price(p_amount_paise integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_catalog_admin() then raise exception using errcode='42501',message='Administrator required'; end if;
  update public.payment_settings set amount_paise=p_amount_paise where id;
  insert into public.payment_audit_events(actor_id,action) values(auth.uid(),'price_changed');
end; $$;

create function public.reserve_payment_order(p_booking_id uuid,p_provider text)
returns public.payment_orders language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; result public.payment_orders%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(70324004);
  select * into b from public.bookings where id=p_booking_id and customer_id=auth.uid() for update;
  if not found or not exists(select 1 from public.profiles where id=auth.uid() and role='customer' and email is not null)
    then raise exception using errcode='42501',message='Customer booking required'; end if;
  if b.status <> 'held' or b.hold_expires_at <= clock_timestamp() or b.start_at <= clock_timestamp()
    then raise exception using errcode='23514',message='Active booking hold required'; end if;
  insert into public.payment_orders(booking_id,customer_id,provider,amount_paise,currency)
    select b.id,b.customer_id,p_provider,amount_paise,currency from public.payment_settings where id
    on conflict(booking_id) do nothing;
  select * into result from public.payment_orders where booking_id=b.id;
  if result.provider <> p_provider then raise exception using errcode='23514',message='Payment provider is already fixed for this booking'; end if;
  return result;
end; $$;

create function public.guard_payment_order_identity()
returns trigger language plpgsql set search_path='' as $$
begin
  if (new.booking_id,new.customer_id,new.provider,new.amount_paise,new.currency) is distinct from
     (old.booking_id,old.customer_id,old.provider,old.amount_paise,old.currency)
    or (old.external_order_id is not null and new.external_order_id is distinct from old.external_order_id)
    or (old.confirmed_payment_id is not null and new.confirmed_payment_id is distinct from old.confirmed_payment_id)
  then raise exception using errcode='23514',message='Payment identity is immutable'; end if;
  new.updated_at=clock_timestamp(); return new;
end; $$;
create trigger payment_orders_identity before update on public.payment_orders for each row execute function public.guard_payment_order_identity();

create function public.claim_payment_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.payment_orders set creation_state='creating' where id=p_order_id and creation_state='reserved';
  return found;
end; $$;
create function public.attach_payment_order(p_order_id uuid,p_external_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_external_id is null or length(p_external_id) not between 1 and 100 then raise exception 'Invalid provider order'; end if;
  update public.payment_orders set external_order_id=p_external_id,creation_state='ready',review_reason=null
    where id=p_order_id and creation_state in ('creating','uncertain','ready');
  if not found then raise exception 'Order cannot be attached'; end if;
end; $$;
create function public.note_payment_order_problem(p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_reason not in ('creation_uncertain','provider_mismatch','multiple_provider_orders','capture_mismatch','provider_state_conflict') then raise exception 'Invalid payment problem'; end if;
  update public.payment_orders set review_reason=p_reason,
    creation_state=case when external_order_id is null then 'uncertain' else creation_state end where id=p_order_id;
end; $$;

create function public.record_unmatched_payment_event(p_provider text,p_event_id text,p_digest text)
returns void language plpgsql security definer set search_path='' as $$
declare previous public.payment_events%rowtype;
begin
  insert into public.payment_events(provider,event_id,payload_digest,outcome) values(p_provider,p_event_id,p_digest,'unmatched_order') on conflict(provider,event_id) do nothing;
  select * into previous from public.payment_events where provider=p_provider and event_id=p_event_id;
  if previous.payload_digest <> p_digest then raise exception using errcode='23514',message='Event identity conflict'; end if;
end; $$;

create function public.apply_payment_observation(p_order_id uuid,p_event_id text,p_digest text,p_payment_id text,p_state text,p_amount integer,p_currency text)
returns text language plpgsql security definer set search_path='' as $$
declare o public.payment_orders%rowtype; b public.bookings%rowtype; prior public.payment_events%rowtype;
  txn public.payment_transactions%rowtype; outcome_value text; reason_value text; checked_at timestamptz; settings public.availability_settings%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(70324004);
  checked_at=clock_timestamp();
  select * into o from public.payment_orders where id=p_order_id for update;
  if not found or o.external_order_id is null then raise exception 'Unknown provider order'; end if;
  if p_state not in ('captured','failed','authorized') or p_state is null or p_payment_id is null or length(p_payment_id) not between 1 and 100 then raise exception 'Invalid payment observation'; end if;
  select * into prior from public.payment_events where provider=o.provider and event_id=p_event_id for update;
  if found then
    if prior.payload_digest <> p_digest or (prior.order_id is not null and prior.order_id <> o.id) then raise exception using errcode='23514',message='Event identity conflict'; end if;
    if prior.order_id is not null then return prior.outcome; end if;
    if prior.outcome <> 'unmatched_order' then raise exception using errcode='23514',message='Event identity conflict'; end if;
  end if;
  select * into txn from public.payment_transactions where provider=o.provider and payment_id=p_payment_id for update;
  if found and txn.order_id <> o.id then raise exception using errcode='23514',message='Payment belongs to another order'; end if;
  if txn.state='captured' then
    if p_state='captured' and (txn.amount_paise is distinct from p_amount or txn.currency is distinct from p_currency) then
      raise exception using errcode='23514',message='Captured payment identity conflict';
    end if;
    outcome_value=txn.outcome;
    reason_value=txn.reason;
  elsif o.confirmed_payment_id=p_payment_id then
    outcome_value='confirmed';
  elsif p_state='captured' then
    update public.bookings set status='expired' where status='held' and hold_expires_at<=checked_at;
    select * into b from public.bookings where id=o.booking_id for update;
    select * into settings from public.availability_settings where id;
    if p_amount is distinct from o.amount_paise or p_currency is distinct from o.currency then reason_value='amount_currency_mismatch';
    elsif o.confirmed_payment_id is not null or b.status='confirmed' then reason_value='duplicate_capture';
    elsif b.start_at<=checked_at then reason_value='session_started';
    else
      perform 1 from public.profiles where id=b.customer_id and role='customer' and email is not null for share;
      if not found then reason_value='customer_ineligible'; end if;
      perform 1 from public.counselors c join public.profiles p on p.id=c.profile_id
        where c.id=b.counselor_id and c.published and p.role='counselor' for share of c,p;
      if not found then reason_value=coalesce(reason_value,'counselor_unavailable'); end if;
      if not exists(select 1 from public.calculate_availability_slots(b.counselor_id,b.start_at-make_interval(mins=>settings.min_notice_minutes)) s
        where s.start_at=b.start_at and s.end_at=b.end_at and s.end_at+make_interval(mins=>settings.buffer_minutes)=b.buffer_end_at)
      then reason_value=coalesce(reason_value,'schedule_changed'); end if;
      if exists(select 1 from public.bookings other where other.id<>b.id and other.status in ('held','confirmed') and
        ((other.counselor_id=b.counselor_id and tstzrange(other.start_at,other.buffer_end_at,'[)') && tstzrange(b.start_at,b.buffer_end_at,'[)'))
          or (other.customer_id=b.customer_id and tstzrange(other.start_at,other.end_at,'[)') && tstzrange(b.start_at,b.end_at,'[)'))))
      then reason_value=coalesce(reason_value,'slot_conflict'); end if;
    end if;
    if reason_value is null then
      begin
        update public.bookings set status='confirmed',updated_at=checked_at where id=b.id;
        outcome_value='confirmed';
        update public.payment_orders set confirmed_payment_id=p_payment_id,review_reason=null where id=o.id;
      exception when exclusion_violation then reason_value='slot_conflict';
      end;
    end if;
    if reason_value is not null then
      outcome_value='admin_review';
      update public.payment_orders set review_reason=reason_value where id=o.id;
    end if;
  else outcome_value=case when p_state='failed' then 'failed' else 'pending' end;
  end if;
  if txn.state is distinct from 'captured' or p_state='captured' then
    insert into public.payment_transactions(order_id,booking_id,provider,payment_id,state,amount_paise,currency,outcome,reason)
      values(o.id,o.booking_id,o.provider,p_payment_id,p_state,p_amount,p_currency,outcome_value,reason_value)
      on conflict(provider,payment_id) do update set state=excluded.state,amount_paise=excluded.amount_paise,currency=excluded.currency,outcome=excluded.outcome,reason=excluded.reason,updated_at=checked_at;
  end if;
  insert into public.payment_events(provider,event_id,payload_digest,order_id,outcome) values(o.provider,p_event_id,p_digest,o.id,outcome_value)
    on conflict(provider,event_id) do update set order_id=excluded.order_id,outcome=excluded.outcome
    where payment_events.order_id is null and payment_events.outcome='unmatched_order' and payment_events.payload_digest=excluded.payload_digest;
  if not found then raise exception using errcode='23514',message='Event identity conflict'; end if;
  insert into public.payment_audit_events(order_id,action) values(o.id,outcome_value);
  return outcome_value;
end; $$;

revoke all on function public.set_payment_price(integer),public.reserve_payment_order(uuid,text) from public,anon;
grant execute on function public.set_payment_price(integer),public.reserve_payment_order(uuid,text) to authenticated;
revoke all on function public.guard_payment_order_identity(),public.claim_payment_order(uuid),public.attach_payment_order(uuid,text),public.note_payment_order_problem(uuid,text),public.record_unmatched_payment_event(text,text,text),public.apply_payment_observation(uuid,text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.claim_payment_order(uuid),public.attach_payment_order(uuid,text),public.note_payment_order_problem(uuid,text),public.record_unmatched_payment_event(text,text,text),public.apply_payment_observation(uuid,text,text,text,text,integer,text) to service_role;
