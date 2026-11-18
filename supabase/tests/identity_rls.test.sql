begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

update public.profiles set role = 'customer' where role = 'admin';

insert into auth.users (
  id,
  aud,
  role,
  phone,
  phone_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    '+919111111101',
    pg_catalog.now(),
    '{"preferred_name":"Local Admin","role":"admin"}'::jsonb,
    '{}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    '+919111111102',
    pg_catalog.now(),
    '{"preferred_name":"Local Customer","role":"admin"}'::jsonb,
    '{}'::jsonb
  );

select is(
  (select role::text from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'customer',
  'new auth accounts receive only the customer role'
);
select is(
  (select preferred_name from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Local Admin',
  'profile creation copies a bounded preferred name'
);
select is(
  (select role::text from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'customer',
  'user metadata cannot assign an admin role'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated clients have no column privilege to change roles'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'),
  'email remains server-managed until the booking flow'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous clients cannot read profiles'
);
select ok(
  not has_function_privilege('authenticated', 'public.bootstrap_first_admin(uuid,text)', 'EXECUTE'),
  'authenticated clients cannot bootstrap an administrator'
);
select ok(
  has_function_privilege('service_role', 'public.bootstrap_first_admin(uuid,text)', 'EXECUTE'),
  'the restricted service role can invoke first-admin bootstrap'
);
select ok(
  has_function_privilege('authenticated', 'public.set_own_contact_email(text)', 'EXECUTE'),
  'authenticated users can invoke the self-only contact email operation'
);
select ok(
  not has_function_privilege('anon', 'public.set_own_contact_email(text)', 'EXECUTE'),
  'anonymous users cannot set a contact email'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'authenticated users can see only their own profile'
);
select is(
  (select count(*)::integer from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'authenticated users cannot read another profile'
);
select lives_ok(
  $$update public.profiles set preferred_name = 'Updated Name' where id = auth.uid()$$,
  'authenticated users can update their own preferred name'
);
select is(
  (select preferred_name from public.profiles where id = auth.uid()),
  'Updated Name',
  'profile updates persist for the current user'
);
select lives_ok(
  $$select public.set_own_contact_email(' Local.Customer@Example.Test ')$$,
  'authenticated users can capture their own contact email'
);
select is(
  (select email from public.profiles where id = auth.uid()),
  'local.customer@example.test',
  'contact email is trimmed and normalized to lowercase'
);
select throws_ok(
  $$select public.set_own_contact_email('different@example.test')$$,
  '23514',
  'Contact email has already been captured',
  'contact email can only be captured once'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501',
  null,
  'authenticated users cannot escalate their role'
);
select throws_ok(
  $$select public.grant_profile_role(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'counselor',
    'self-service attempt',
    'not-verified'
  )$$,
  '42501',
  'Administrator role required',
  'non-admin users cannot grant counselor roles'
);

reset role;

select public.bootstrap_first_admin(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Local test bootstrap'
);
select is(
  (select role::text from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'admin',
  'restricted bootstrap grants the first administrator role'
);
select is(
  (select count(*)::integer from public.profile_role_audit_events
   where action = 'first_admin_bootstrap'
     and subject_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'first-admin bootstrap is audited'
);
select is(
  (select actor_user_id::text from public.profile_role_audit_events
   where action = 'first_admin_bootstrap'
     and subject_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'first-admin bootstrap audit identifies the promoted account as actor'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select lives_ok(
  $$select public.grant_profile_role(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'counselor',
    'Credential review completed',
    'LOCAL-VERIFICATION-001'
  )$$,
  'an administrator can grant counselor role with a verification reference'
);
reset role;

select is(
  (select role::text from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'counselor',
  'trusted role operation updates the target profile'
);
select is(
  (select counselor_verification_reference from public.profile_role_audit_events
   where subject_user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
   order by occurred_at desc limit 1),
  'LOCAL-VERIFICATION-001',
  'counselor verification reference is included in the audit event'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  true
);
select throws_ok(
  $$select public.grant_profile_role(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'counselor',
    'Missing verification reference',
    null
  )$$,
  '22023',
  'Counselor verification reference is required',
  'counselor role grant requires verification evidence'
);
select throws_ok(
  $$select public.grant_profile_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'customer',
    'Attempt to remove final admin',
    null
  )$$,
  '23514',
  'Cannot remove the last administrator',
  'the last administrator cannot be demoted'
);
reset role;

select * from finish();
rollback;