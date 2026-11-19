-- Preserve existing counselor-list Meet access and explicit aggregate order.
create or replace function public.get_counselor_workspace(p_view text default 'upcoming',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); checked_at timestamptz:=now(); view_name text:=case when p_view='past' then 'past' else 'upcoming' end; page_number integer:=case when p_page between 0 and 999999 then p_page else 0 end; result jsonb;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and role='counselor' and email is not null) then raise exception using errcode='42501',message='Counselor authentication required';end if;
 with page as (
  select b.id,b.start_at,b.end_at,b.status,coalesce(nullif(p.preferred_name,''),'Customer') as customer_name,m.meeting_url,
   row_number() over(order by case when view_name='upcoming' then b.start_at end asc,case when view_name='past' then b.start_at end desc,b.id) as position,
   b.end_at<=checked_at as is_past,b.start_at<=checked_at and b.end_at>checked_at as in_progress
  from public.bookings b join public.counselors c on c.id=b.counselor_id join public.profiles p on p.id=b.customer_id left join public.booking_meetings m on m.booking_id=b.id
  where c.profile_id=actor and b.status='confirmed' and ((view_name='past' and b.end_at<=checked_at) or(view_name='upcoming' and b.end_at>checked_at))
  order by case when view_name='upcoming' then b.start_at end asc,case when view_name='past' then b.start_at end desc,b.id
  limit 21 offset page_number*20
 ) select jsonb_build_object('as_of',checked_at,'has_more',(select count(*)>20 from page),'items',coalesce((select jsonb_agg(to_jsonb(p)-'position' order by position) from(select * from page order by position limit 20)p),'[]'::jsonb)) into result;
 return result;
end; $$;
