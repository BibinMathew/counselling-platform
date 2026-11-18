revoke update on public.counselors from authenticated;
grant update (display_name, bio, qualifications, experience, specialties, languages, photo_url, published)
on public.counselors to authenticated;