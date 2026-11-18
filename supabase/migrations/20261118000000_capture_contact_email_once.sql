create function public.set_own_contact_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  existing_email text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if normalized_email is null
    or pg_catalog.char_length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'A valid contact email is required';
  end if;

  select email into existing_email
  from public.profiles
  where id = actor_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;

  if existing_email is not null then
    if existing_email = normalized_email then
      return;
    end if;

    raise exception using errcode = '23514', message = 'Contact email has already been captured';
  end if;

  update public.profiles
  set email = normalized_email
  where id = actor_id;
end;
$$;

revoke all on function public.set_own_contact_email(text) from public, anon;
grant execute on function public.set_own_contact_email(text) to authenticated;