create view public.public_session_settings as
select session_minutes, buffer_minutes, min_notice_minutes, max_advance_days
from public.availability_settings where id;
revoke all on public.public_session_settings from public;
grant select on public.public_session_settings to anon, authenticated;