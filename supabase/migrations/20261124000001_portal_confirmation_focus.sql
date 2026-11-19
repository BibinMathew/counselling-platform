-- Locate a newly confirmed booking within the same owner-scoped read snapshot.
drop function public.get_customer_portal(text,integer);
create function public.get_customer_portal(p_view text default 'all',p_page integer default 0,p_booking_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); checked_at timestamptz:=now(); selected_view text; selected_page integer; result jsonb;
begin
 if actor is null or not exists(select 1 from public.profiles p where p.id=actor and p.role='customer' and p.email is not null) then
  raise exception using errcode='42501',message='Customer authentication required';
 end if;
 selected_view=case when p_booking_id is not null then 'all' when p_view in ('all','upcoming','past','holds') then p_view else 'all' end;
 selected_page=case when p_page between 0 and 999999 then p_page else 0 end;
 with owned as (
  select b.*,case when b.status='held' and b.hold_expires_at<=checked_at then 'expired' else b.status end as shown_status
  from public.bookings b where b.customer_id=actor
 ), selected as (
  select b.*,
   row_number() over(order by
    case when selected_view='upcoming' then b.start_at end asc,
    case when selected_view='past' then b.start_at end desc,
    case when selected_view in ('all','holds') then b.created_at end desc,b.id) as position
  from owned b where selected_view='all'
   or(selected_view='upcoming' and b.shown_status='confirmed' and b.end_at>checked_at)
   or(selected_view='past' and b.shown_status='confirmed' and b.end_at<=checked_at)
   or(selected_view='holds' and b.shown_status in ('held','expired'))
 ), location as (
  select case when p_booking_id is not null then coalesce((select ((position-1)/20)::integer from selected where id=p_booking_id),selected_page) else selected_page end as resolved_page
 ), page as (
  select * from selected order by position limit 21 offset (select resolved_page from location)*20
 ), summaries as (
  select b.position,jsonb_build_object(
   'id',b.id,'counselor_id',b.counselor_id,'counselor_name',c.display_name,
   'start_at',b.start_at,'end_at',b.end_at,'status',b.shown_status,'hold_expires_at',b.hold_expires_at,'reschedule_count',b.reschedule_count,
   'is_past',b.shown_status='confirmed' and b.end_at<=checked_at,
   'in_progress',b.shown_status='confirmed' and b.start_at<=checked_at and b.end_at>checked_at,
   'can_reschedule',b.shown_status='confirmed' and b.reschedule_count=0 and b.start_at>=checked_at+interval '24 hours',
   'counselor_bookable',c.published and cp.role='counselor',
   'meeting_url',case when b.shown_status='confirmed' then m.meeting_url else null end,
   'order_id',o.id,'amount_paise',o.amount_paise,
   'payment_state',case when o.confirmed_payment_id is not null then 'confirmed' else tx.outcome end,
   'review_reason',coalesce(o.review_reason,case when tx.outcome='admin_review' then tx.reason end)
  ) as item
  from page b join public.counselors c on c.id=b.counselor_id
  join public.profiles cp on cp.id=c.profile_id
  left join public.booking_meetings m on m.booking_id=b.id
  left join public.payment_orders o on o.booking_id=b.id and o.customer_id=actor
  left join lateral (
   select t.outcome,t.reason from public.payment_transactions t where t.order_id=o.id and t.booking_id=b.id
   order by case t.outcome when 'confirmed' then 0 when 'admin_review' then 1 else 2 end,t.updated_at desc,t.id limit 1
  )tx on true
 )
 select jsonb_build_object('as_of',checked_at,'page',(select resolved_page from location),'has_more',(select count(*)>20 from page),
  'items',coalesce((select jsonb_agg(item order by position) from (select * from summaries order by position limit 20) items),'[]'::jsonb)) into result;
 return result;
end; $$;
revoke all on function public.get_customer_portal(text,integer,uuid) from public,anon;
grant execute on function public.get_customer_portal(text,integer,uuid) to authenticated;
