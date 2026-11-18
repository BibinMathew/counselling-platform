create function public.simulate_payment_attempt(p_order_id uuid,p_result text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders%rowtype; simulated public.payment_simulator_orders%rowtype; payment jsonb;
begin
 select * into o from public.payment_orders where id=p_order_id and provider='simulator';
 if not found or o.external_order_id is null or p_result not in ('captured','failed','authorized') then raise exception 'Invalid simulated order'; end if;
 select * into simulated from public.payment_simulator_orders where id=o.external_order_id for update;
 if not found then raise exception 'Simulated provider order missing'; end if;
 select p into payment from jsonb_array_elements(simulated.payments) p where p->>'status'='captured' limit 1;
 if payment is not null then return payment; end if;
 if jsonb_array_length(simulated.payments)>=50 then raise exception 'Simulator attempt limit reached'; end if;
 payment=jsonb_build_object('id','sim_pay_'||gen_random_uuid(),'order_id',simulated.id,'amount',simulated.amount,'currency',simulated.currency,'status',p_result);
 update public.payment_simulator_orders set payments=payments||jsonb_build_array(payment),status=case when p_result='captured' then 'paid' else 'attempted' end where id=simulated.id;
 return payment;
end; $$;
create function public.claim_payment_reconciliation(p_limit integer,p_provider text)
returns setof public.payment_orders language plpgsql security definer set search_path='' as $$
begin
 if p_limit not between 1 and 50 or p_provider not in ('simulator','razorpay') then raise exception 'Invalid reconciliation batch'; end if;
 return query with selected as (
  select id from public.payment_orders where provider=p_provider and (reconciled_at is null or reconciled_at<clock_timestamp()-interval '1 minute')
  order by reconciled_at nulls first,created_at for update skip locked limit p_limit
 ) update public.payment_orders o set reconciled_at=clock_timestamp() from selected where o.id=selected.id returning o.*;
end; $$;
revoke all on function public.simulate_payment_attempt(uuid,text),public.claim_payment_reconciliation(integer,text) from public,anon,authenticated;
grant execute on function public.simulate_payment_attempt(uuid,text),public.claim_payment_reconciliation(integer,text) to service_role;
