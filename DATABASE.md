# Database

The counselor category migration backfills existing profiles with the approved Consultant Psychologist category through a temporary column default, without issuing counselor updates or fabricating audit actors. Follow-up migrations preserve anonymous access to the limited public view and allow authenticated category updates subject to existing admin RLS. See `PROGRESS.md` for local verification and migration status.

## Current State

**Implemented in Phase 1:** `supabase/migrations/20261117000000_identity_and_roles.sql` creates `public.profiles`, the `profile_role` enum, and `profile_role_audit_events`. `supabase/migrations/20261118000000_capture_contact_email_once.sql` adds the authenticated, self-only `set_own_contact_email` operation. A trigger provisions each phone-authenticated profile with the `customer` role and ignores client-supplied role metadata. Existing phone-auth users are backfilled. Profile phones are stored as E.164; local Indian national numbers are normalized to `+91`.

**RLS and privileges:** Authenticated users can read their own profile and update only `preferred_name`. Email, phone, timestamps, and role are not client-updatable. There is no public profile insert, no authenticated access to role audit rows, and no anonymous profile access. The admin role RPC verifies the current profile role and writes an audit record. Counselor grants require a verification reference. First-admin bootstrap is restricted to the service role/operator path, requires an existing phone-confirmed customer profile, only works when no admin exists, and records the promoted account as actor.

**Not implemented:** Production payment collection, counselor activation, credential review workflow, email verification or change flow, age verification, production Auth/SMS/email configuration, and any hosted project connection.

**Phase 2:** Catalog migrations add `counselors`, `counselor_catalog_audit_events`, and the `public_counselors` view. Admins can create, edit, publish, and delete entries linked to counselor-role accounts. Each counselor has one required category from the controlled catalog list. The category migration maps existing profiles to `consultant_psychologist` per the product owner's instruction; new admin-created profiles must select a category. Anonymous and authenticated visitors use the view, which excludes drafts, account IDs, and profiles whose linked role is no longer counselor. Under RLS, admins can read catalog entries and counselors can read their own entry. Catalog writes record actor, entry ID, operation, and time, without profile content in audit metadata. Images are HTTPS links chosen by admins; no image storage is added.

**Phase 3:** `availability_rules` stores recurring weekday/local-time openings; `availability_exceptions` stores date-specific openings and blocks, including all-day blocks; `availability_settings` stores global session, buffer, notice, and window settings; `availability_audit_events` records schedule and settings mutations. Recurring schedules use Asia/Kolkata local dates/times, while generated concrete slots are returned as UTC timestamps. The public settings view exposes only scheduling settings. Public slot calculation exposes slots only for published counselors with an active counselor role. Authorized RPCs and RLS restrict schedule reads and writes to the linked counselor or an admin; only admins change settings. Catalog entries with schedule records cannot be deleted until those records are removed.

The slot algorithm merges overlapping or adjacent openings per local date, starts candidate slots at each merged opening, advances by session length plus buffer, requires the entire block to fit, and excludes any block touching the session or buffer. The configured minimum notice and maximum advance apply to slot start times; Phase 4 also hides slots overlapping active holds and confirmed appointments.

**Phase 4:** `bookings` stores customer/counselor IDs, UTC session and buffer intervals, hold expiry, status, and reschedule count. `booking_settings` stores an admin-configurable hold duration (default 10 minutes); `booking_audit_events` stores lifecycle events without counseling content or payment secrets. Customer RLS allows only own booking reads; writes use role-checked functions. A global transaction lock coordinates booking and availability changes, participant rows are locked/rechecked, and GiST exclusion constraints prevent overlapping active counselor/buffer ranges and customer session ranges. Expired holds are hidden immediately and transitioned/audited when a later successful hold or reschedule operation performs cleanup. Active holds and future confirmed appointments block schedule changes that invalidate their slots. Rescheduling retains the booking row, is limited to once with 24 hours' notice, and requires the same counselor. Phase 5 now adds verified payment, immutable pricing/payment linkage, idempotent confirmation, and late-payment reconciliation.

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

## Public Table Inventory

| Table                            | Columns                                                                                                                                                     | Purpose                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `profiles`                       | `id`, `preferred_name`, `phone`, `email`, `role`, `created_at`, `updated_at`                                                                                | Account profile; `id` references Supabase `auth.users`. Email is contact data, not verified identity.           |
| `profile_role_audit_events`      | `id`, `actor_user_id`, `subject_user_id`, `previous_role`, `assigned_role`, `action`, `reason`, `counselor_verification_reference`, `occurred_at`           | Records privileged role changes.                                                                                |
| `counselors`                     | `id`, `profile_id`, `display_name`, `category`, `bio`, `qualifications`, `experience`, `specialties`, `languages`, `photo_url`, `published`, `created_at`, `updated_at` | Admin-managed counselor catalog profile linked to an account.                                                   |
| `counselor_catalog_audit_events` | `id`, `actor_user_id`, `counselor_id`, `action`, `occurred_at`                                                                                              | Records catalog changes.                                                                                        |
| `availability_rules`             | `id`, `counselor_id`, `weekday`, `start_time`, `end_time`                                                                                                   | Recurring weekly availability in Asia/Kolkata.                                                                  |
| `availability_exceptions`        | `id`, `counselor_id`, `local_date`, `kind`, `all_day`, `start_time`, `end_time`                                                                             | Date-specific openings and blocks.                                                                              |
| `availability_settings`          | `id`, `session_minutes`, `buffer_minutes`, `min_notice_minutes`, `max_advance_days`                                                                         | Global session and slot-window settings.                                                                        |
| `availability_audit_events`      | `id`, `actor_user_id`, `counselor_id`, `object_type`, `operation`, `occurred_at`                                                                            | Records scheduling and scheduling-setting changes.                                                              |
| `bookings`                       | `id`, `customer_id`, `counselor_id`, `start_at`, `end_at`, `buffer_end_at`, `status`, `hold_expires_at`, `reschedule_count`, `created_at`, `updated_at`     | Customer holds and confirmed-appointment records; confirmation is controlled by the verified-payment operation. |
| `booking_settings`               | `id`, `hold_minutes`                                                                                                                                        | Global temporary-hold duration.                                                                                 |
| `booking_audit_events`           | `id`, `actor_user_id`, `booking_id`, `action`, `old_start_at`, `new_start_at`, `occurred_at`                                                                | Records booking lifecycle and hold-setting actions.                                                             |

`public_counselors` and `public_session_settings` are views, not additional tables. Supabase separately manages `auth.users` and other internal tables. Payment tables are listed below; Phase 8 private-note tables are described below.

## Future Data Model Proposals

The following entities are **proposals from the requirements, not implemented schema**: messages, message reports, and booking/financial remedy workflows. Their columns and relationships still require migration-level design and review.

Phase 5 payment tables and operations implement these guarantees at the trusted server/database boundary.

Before storing real notes or messages, resolve production consent, access, retention, deletion, incident response, and counselor-switching policies. Do not infer these from the proposed table list.

## Local Supabase

Phase 1 is tested against local Supabase only. The local config contains three fixed phone OTPs and placeholder Twilio settings required by local Auth; these do not send SMS. No email OTP is configured or sent. Never push this config to a hosted project. No production project is linked.

`pnpm test:integration` runs the pgTAP RLS suite against the local database. Resetting with `supabase db reset` destroys local database contents and reapplies migrations; use only for synthetic local data.

## Phase 5 schema

| Table                      | Purpose                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_settings`         | Public current INR price; admin-only audited update. Default 69900 paise.                                                                      |
| `payment_orders`           | One per booking; immutable owner, provider, price, currency and established provider order/payment linkage; creation and reconciliation state. |
| `payment_transactions`     | Provider payment identity, canonical observed state/amount, confirmation or admin-review outcome. One confirmed transaction per booking.       |
| `payment_events`           | Unique provider/event identity, SHA-256 body digest and durable outcome; no raw webhook/card/contact payload.                                  |
| `payment_audit_events`     | Price and payment operation audit references.                                                                                                  |
| `payment_simulator_orders` | Local-only synthetic provider state; never accessible to customer/counselor roles.                                                             |

Migrations `20261122000000`–`20261122000002` add these tables, privileges, and operations. Authenticated customers reserve only their own active hold via `reserve_payment_order`; browser roles cannot write payment rows or invoke ingestion/simulation functions. Owner/admin RLS permits safe order/transaction reads. Admin exception RPCs expose bounded records, not raw payloads. Service-only claims serialize provider creation/refresh/reconciliation.

`apply_payment_observation` uses advisory lock `70324004`, verifies immutable event/payment identities, expires stale holds, locks participants, and uses existing overlap constraints. Captured payment applied to a valid free future slot sets the original booking to confirmed atomically. A second capture, amount/currency mismatch, started session, changed schedule, or participant/conflict problem retains payment evidence as admin review. Failed/authorized events cannot downgrade capture. Replays after rescheduling preserve the paid booking and its new time. Customer retries cannot extend hold expiry.

Use `pnpm test:integration` for transactional TAP checks and `pnpm test:migrations` for an isolated fresh schema replay. Neither resets the application database.

Captured payments already marked for admin review retain that outcome on every replay; no later disappearance of a conflict silently resolves the exception. Unmatched signed event receipts can become linked only after canonical order recovery with the same digest; true identity conflicts remain rejected.

## Phase 6: Meet and notification schema

Migrations `20261123000000`–`20261123000001` add `booking_meetings`, historical unique `meeting_url_reservations`, `notification_jobs`, private `notification_simulator_receipts`, and `meeting_notification_audit_events`. Booking deletion cascades only its dependent local workflow records. Existing demo data is preserved; future confirmed bookings receive idempotent backfill jobs.

Raw meeting reads/writes are denied to browser roles. Participant RPCs return only authorized meeting URLs; assigned-counselor listings omit customer contact/payment details. Admin-only RPCs assign links and audit changes. Job summaries have admin-only RLS; browser roles cannot read simulator receipts. Claim/dispatch functions are service-only; all definer functions pin `search_path`. Semantic job keys and receipt primary keys deduplicate replay. Schedule/link revisions, lease tokens, current-role checks and the scheduling advisory lock protect dispatch against stale work.

Reminders use database UTC time, skip past thresholds when scheduled, and never deliver after the session starts. Automatic attempts stop after five failures; manual admin retry is audited. No clinical content or real provider payload is stored by this phase.

## Phase 7: Portal read model

Migrations `20261124000000` and `20261124000001` add owner/creation and owner/start indexes plus `get_customer_portal(text,integer,uuid)`. The second incremental migration replaces the initial two-argument read function with an optional owner-scoped booking locator and resolved page. No booking data or lifecycle status is changed. Legacy `get_my_bookings` remains unchanged.

The RPC requires an authenticated complete customer profile, pins `search_path`, denies anonymous execution and explicitly scopes every private join to the actor's booking/order. It returns safe20-row summaries, actual snapshot amounts, durable confirmed/admin-review payment precedence and one database reference time. Existing RLS/mutation grants remain unchanged.

## Phase 8 local workspace and notes

Migrations `20261125000000_workspace_notes.sql` and `20261125000001_workspace_read_links.sql` add counselor-scoped paginated summary/detail reads and private note persistence without a status change or demo backfill. The second migration preserves authorized upcoming Meet links and explicitly orders JSON aggregation.

`session_notes` stores one encrypted envelope per booking/counselor, with immutable note identity and increasing version. `session_note_save_requests` stores opaque request identities, expected/accepted versions, keyed digests and fictional-content acknowledgement time. `session_note_audit_events` stores only actor/booking/note IDs, opened/saved action, version and timestamp. These tables enable RLS and revoke raw anon/authenticated/public privileges, including ordinary admins.

`get_counselor_workspace` and `get_counselor_session` verify the current complete counselor and assignment. `read_session_note` and `save_session_note` are service-only; their private authorization helper is not browser callable. They independently recheck actor role, assignment and confirmed state under participant/booking locks. Reads audit before decryption. Saves atomically validate version/request identity, persist ciphertext/receipt and audit once. An old accepted replay returns its accepted version plus the current version, allowing the app to report conflict without overwriting.

Private RPCs accept encrypted envelopes only from trusted server code; envelope authentication and retained-key digest generation are application responsibilities. No browser key/service credential is introduced. Retention/deletion remains explicit local operator cleanup; fixture bookings cascade to their notes/receipts/audits. Keys must be backed up separately and retained for old ciphertext and retries. See [workspace testing and limits](docs/workspace-notes-local-testing.md).

## Phase 9 feedback and operational cases

Migrations `20261126000000_feedback.sql` and `20261126000001_admin_operations.sql` add `appointment_feedback`, `operational_cases`, `operational_case_events`, `operational_case_receipts` and `phase9_audit_events`. New tables enable RLS and revoke raw public/anon/authenticated privileges. New `phase9_*` RPCs and helpers are service-only; trusted app entry points derive the actor and enforce the local feature gate. RPCs independently check complete canonical roles/owner/state and bounded inputs under the existing scheduling lock before participant/booking/case locks.

Feedback has one immutable booking-unique row, integer 1–5 rating and optional 2,000-code-point comment, acknowledgement and optional one-time review metadata. Matching normalized retries reuse the receipt; changed payloads cannot overwrite. End-time eligibility uses database time and never marks attendance/completion.

Cases have exactly one typed source FK (booking/order/event/job), canonical unique source identity and derived nullable booking linkage. State/version, restricted remark history, request digest/accepted-version receipt and content-free audit commit atomically. Replays return accepted/current versions; stale/changed identities cannot overwrite. Source deletion cascades fixture dependencies, and the product exposes no source/case deletion. Case closure cannot mutate payment/booking/job evidence or hide source issues.

Admin/own-feedback reads are audited without content. Audit holds opaque IDs, fixed actions, old/new status/version and timestamps; no rating/comment/remark, contacts, ciphertext or credentials. Local comments/remarks are restricted plaintext rather than note-keyring ciphertext. No production retention, refund or real-data policy is introduced. [Operating and RPC guide](docs/feedback-admin-local-testing.md).

## Phase 9.5 UI-only changes

No schema, RPC, grants, RLS or database policy changed for the visual polish. The same25 migrations and all existing authorization/concurrency assertions remain the validation baseline. Preservation checks compare exact original identities/bookings/settings and database-side fingerprints of private notes/feedback/cases without printing their content.
