# Database

## Current State

**Implemented in Phase 1:** `supabase/migrations/20261117000000_identity_and_roles.sql` creates `public.profiles`, the `profile_role` enum, and `profile_role_audit_events`. `supabase/migrations/20261118000000_capture_contact_email_once.sql` adds the authenticated, self-only `set_own_contact_email` operation. A trigger provisions each phone-authenticated profile with the `customer` role and ignores client-supplied role metadata. Existing phone-auth users are backfilled. Profile phones are stored as E.164; local Indian national numbers are normalized to `+91`.

**RLS and privileges:** Authenticated users can read their own profile and update only `preferred_name`. Email, phone, timestamps, and role are not client-updatable. There is no public profile insert, no authenticated access to role audit rows, and no anonymous profile access. The admin role RPC verifies the current profile role and writes an audit record. Counselor grants require a verification reference. First-admin bootstrap is restricted to the service role/operator path, requires an existing phone-confirmed customer profile, only works when no admin exists, and records the promoted account as actor.

**Not implemented:** Booking, counselor activation, credential review workflow, email verification or change flow, age verification, production Auth/SMS/email configuration, and any hosted project connection.

## Migration Rules

- Add schema changes as reviewed, ordered SQL migrations under `supabase/migrations/` within the approved module that owns them.
- Define foreign keys, indexes, unique constraints, RLS policies, access boundaries, and deletion/retention behavior with each relevant schema change.
- Keep generated TypeScript database types synchronized with the approved schema and migration state.
- Keep local-only test data synthetic. Do not put real counseling or customer data in seeds, fixtures, logs, or CI.
- Never expose a Supabase service-role key to browser code. Server-side access does not remove the need for authorization checks and RLS.

## Phase 1 Tables

- `profiles`: auth user ID, preferred name, E.164 phone, nullable contact email, canonical single role, and timestamps. Email is null until a phone-authenticated account completes the one-time contact-email step.
- `profile_role_audit_events`: actor/subject IDs, old/new role, operation, reason, optional opaque counselor-verification reference, and timestamp. The bootstrap event attributes the promoted initial account as actor because it is a restricted operator-side first-account operation.

Authenticated clients cannot directly update email. `set_own_contact_email(text)` checks `auth.uid()`, validates and normalizes the address, writes only the caller's profile, and is idempotent for the same value. It rejects changing the address after capture. The email is not verified and is not an Auth identity.

The role audit table is not readable through client APIs. It contains no identity documents or verification details. The supplied counselor reference must be an opaque internal record ID, not personal or clinical content.

## Future Data Model Proposals

The following entities are **proposals from the requirements, not implemented schema**: profiles, counselors, availability rules and exceptions, slot holds, appointments, payments and payment events, notifications, messages, session notes, feedback, and audit events. Their columns and relationships still require migration-level design and review.

Before implementing bookings, decide and test the database mechanism that prevents overlapping counselor appointments and overlapping customer bookings, including slot holds and expiry. Payment-event uniqueness, idempotent confirmation, reschedule limits, and authorization must also be enforced outside client-only logic.

Before storing notes or messages, resolve consent, access, retention, deletion, incident response, and counselor-switching policies. Do not infer these from the proposed table list.

## Local Supabase

Phase 1 is tested against local Supabase only. The local config contains three fixed phone OTPs and placeholder Twilio settings required by local Auth; these do not send SMS. No email OTP is configured or sent. Never push this config to a hosted project. No production project is linked.

`pnpm test:integration` runs the pgTAP RLS suite against the local database. Resetting with `supabase db reset` destroys local database contents and reapplies migrations; use only for synthetic local data.
