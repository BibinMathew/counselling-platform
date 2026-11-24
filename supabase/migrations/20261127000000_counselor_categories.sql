alter table public.counselors
  add column category text not null default 'consultant_psychologist';
alter table public.counselors alter column category drop default;
alter table public.counselors
add constraint counselors_category_check
check (category in ('consultant_psychologist', 'clinical_psychologist', 'sexual_health', 'psychiatrist'));

create or replace view public.public_counselors as
select counselors.id, counselors.display_name, counselors.bio, counselors.qualifications,
  counselors.experience, counselors.specialties, counselors.languages, counselors.photo_url,
  counselors.category
from public.counselors
join public.profiles on profiles.id = counselors.profile_id
where counselors.published and profiles.role = 'counselor';
