begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, aud, role, phone, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated', '+919222222201', now(), '{}', '{}'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'authenticated', 'authenticated', '+919222222202', now(), '{}', '{}'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'authenticated', 'authenticated', '+919222222203', now(), '{}', '{}');
update public.profiles set role = 'admin' where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.profiles set role = 'counselor' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
select lives_ok($$insert into public.counselors (profile_id, display_name, bio, qualifications, experience, specialties, languages, photo_url)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Test Counselor', 'Bio', 'Degree', 'Experience', 'Specialty', 'English', 'https://example.test/photo.jpg')$$, 'admin can create draft');
select is((select count(*)::integer from public.counselors where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 1, 'admin can see draft');
select ok(not has_column_privilege('authenticated', 'public.counselors', 'profile_id', 'UPDATE'), 'linked account cannot be changed through the API');
select ok(not has_table_privilege('authenticated', 'public.counselor_catalog_audit_events', 'SELECT'), 'audit records are private');
select throws_ok($$update public.counselors set photo_url = 'http://example.test/photo.jpg' where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$, '23514', null, 'non-HTTPS image links are rejected');
select throws_ok($$insert into public.counselors (profile_id, display_name, bio, qualifications, experience, specialties, languages, photo_url)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Not Counselor', 'Bio', 'Degree', 'Experience', 'Specialty', 'English', 'https://example.test/photo.jpg')$$, '42501', null, 'admin cannot create catalog entry for customer');
set local role anon;
select ok(not has_table_privilege('anon', 'public.counselors', 'SELECT'), 'anonymous users cannot read private counselor table');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_counselors' and column_name = 'profile_id'), 'public view does not expose account IDs');
select is((select count(*)::integer from public.public_counselors where display_name = 'Test Counselor'), 0, 'draft is not public');
set local role authenticated;
select lives_ok($$update public.counselors set published = true where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$, 'admin can publish counselor');
set local role anon;
select is((select count(*)::integer from public.public_counselors where display_name = 'Test Counselor'), 1, 'published counselor is public');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);
select throws_ok($$insert into public.counselors (profile_id, display_name, bio, qualifications, experience, specialties, languages, photo_url) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Unauthorized', 'Bio', 'Degree', 'Experience', 'Specialty', 'English', 'https://example.test/photo.jpg')$$, '42501', null, 'customer cannot create catalog entries');
update public.counselors set display_name = 'Unauthorized' where display_name = 'Test Counselor';
select is((select count(*)::integer from public.public_counselors where display_name = 'Test Counselor'), 1, 'customer cannot edit catalog');
reset role;
select is((select count(*)::integer from public.counselor_catalog_audit_events where actor_user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 2, 'catalog creation and publication are audited');
update public.profiles set role = 'customer' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role anon;
select is((select count(*)::integer from public.public_counselors where display_name = 'Test Counselor'), 0, 'revoked counselor role hides public profile');
select * from finish();
rollback;