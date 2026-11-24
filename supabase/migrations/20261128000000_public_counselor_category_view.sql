create or replace view public.public_counselors as
select counselors.id, counselors.display_name, counselors.bio, counselors.qualifications,
  counselors.experience, counselors.specialties, counselors.languages, counselors.photo_url,
  counselors.category
from public.counselors
join public.profiles on profiles.id = counselors.profile_id
where counselors.published and profiles.role = 'counselor';
