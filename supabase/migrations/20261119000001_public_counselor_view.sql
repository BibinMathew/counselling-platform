drop policy counselors_public_read on public.counselors;
revoke select on public.counselors from anon;
revoke execute on function public.is_catalog_counselor(uuid) from anon;

create view public.public_counselors as
select id, display_name, bio, qualifications, experience, specialties, languages, photo_url
from public.counselors
where published and public.is_catalog_counselor(profile_id);

revoke all on public.public_counselors from public;
grant select on public.public_counselors to anon, authenticated;