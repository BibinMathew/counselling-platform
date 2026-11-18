create function public.claim_payment_refresh(p_order_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.payment_orders set reconciled_at=clock_timestamp()
 where id=p_order_id and (reconciled_at is null or reconciled_at<clock_timestamp()-interval '5 seconds');
 return found;
end; $$;
create function public.get_payment_exceptions()
returns setof public.payment_orders language plpgsql security definer set search_path='' as $$
begin
 if not public.is_catalog_admin() then raise exception using errcode='42501',message='Administrator required'; end if;
 return query select * from public.payment_orders where review_reason is not null order by updated_at limit 100;
end; $$;
create function public.get_unmatched_payment_events()
returns table(provider text,event_id text,outcome text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_catalog_admin() then raise exception using errcode='42501',message='Administrator required'; end if;
 return query select e.provider,e.event_id,e.outcome,e.created_at from public.payment_events e where e.outcome='unmatched_order' order by e.created_at desc limit 100;
end; $$;
revoke all on function public.claim_payment_refresh(uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_refresh(uuid) to service_role;
revoke all on function public.get_payment_exceptions(),public.get_unmatched_payment_events() from public,anon;
grant execute on function public.get_payment_exceptions(),public.get_unmatched_payment_events() to authenticated;
