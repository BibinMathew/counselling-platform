# Phase 6: Meet and local notifications

Status: Approved by the user on 19 November 2026. The user selected local simulated delivery. Implemented locally; see `PROGRESS.md` for verification and limits.

## Intent and constraints

Extend payment-confirmed bookings with admin-managed Google Meet links, customer email notifications, counselor WhatsApp alerts, and reminders. Preserve the modular Next.js/Supabase monolith, existing booking locks, payment idempotency, role checks, and demo data. No external message delivery, Google API calls, new authentication factor, production connection, or real customer data is included.

Phase 5 has local simulator verification; real Razorpay delivery remains unverified. Contact emails remain unverified. Phase 6 uses synthetic local messages only and does not settle the email-verification, WhatsApp-consent, Google-account ownership, or live delivery policies needed before launch.

## Approaches

1. **Manual Meet links with local simulated delivery — selected.** Admin supplies a unique link; durable local jobs exercise confirmation, updates, alerts, reminders, failures and retries without provider credentials.
2. **External delivery providers now.** Adds provider setup, verified sending domains, consent decisions and real delivery testing. Deferred by the user's selection.

Automatic Calendar integration is deferred by the MVP requirement. Define a narrow `MeetingProvider` boundary for the manual workflow and future integration; do not implement OAuth or create pretend meeting URLs.

## Proposed behavior

- Verified transition to `confirmed` atomically creates one customer confirmation job, one counselor new-booking alert, and eligible customer 24-hour/1-hour reminder jobs. Held/expired bookings and captured payments requiring admin review create none. Callback/webhook/reconciliation replays cannot duplicate jobs.
- Confirmation does not wait for a meeting link. The booking shows “Meeting link will follow.” The admin operations page continuously lists future confirmed bookings missing a link; this persistent queue is the local admin alert until resolved.
- Admin may attach or replace a canonical `https://meet.google.com/xxx-xxxx-xxx` URL to a future confirmed booking. Reject credentials, query strings, fragments, other hosts, invalid paths and reuse of any link previously assigned to another booking. Re-saving the current link is a no-op. Record actor and revision in an audit event without copying the URL into logs.
- Only the owning customer, assigned counselor and admin may read a meeting link. Add a small assigned-confirmed-bookings list for counselors so they can access their calls; broader counselor workspace features remain Phase 8. Add Join Meet on existing customer booking entries; broader history and Book Again remain Phase 7.
- Link attachment/replacement creates one customer link-update email per revision. Pending reminders render from the current booking/link at dispatch. Customers may inspect current details after phone login even when a simulated notification is still queued or failed.
- Successful one-time rescheduling increments a notification schedule revision, supersedes old pending/retry reminder jobs, and creates a customer schedule-update email and counselor schedule-change WhatsApp alert. Schedule replacement reminders for the new time; preserve the same unique meeting link. Payment replay must never restore the prior reminder schedule.
- Reminder due times are session start minus 24 hours and minus 1 hour, based on database UTC and displayed in Asia/Kolkata. At booking/reschedule time, skip thresholds already reached; never send a catch-up reminder for those thresholds. A booked session 70 minutes away receives only the 1-hour reminder. A job scheduled in advance can run late while the session remains future; skip it once the session starts.
- Simulated email includes a generic subject, current date/time, and a login-required bookings-page link. Direct Meet URLs remain inside the authenticated app. Counselor simulated WhatsApp contains date/time and a login-required counselor-page link, without customer name, phone, email, counseling reason or meeting URL. Subjects and audit/error metadata omit counseling details. Preview UI explains that delivery is simulated.

## Database and authorization

Add incremental migrations for meeting assignment/history, durable notification jobs, simulator delivery receipts, and minimal privileged audit events. Do not modify previous migrations or reset the local database.

- Meetings are keyed by booking, with revision and globally unique canonical URL reservations across assignment history. Admin mutation RPC validates role, confirmed/future state, uniqueness and input format. Participant reads recheck current canonical roles and assignment; revoked roles lose access.
- Jobs carry booking ID, recipient profile ID, channel, template, schedule revision, optional link revision, due time, status, attempt count, next retry time, lease token/expiry, and safe error code. Unique semantic keys enforce one logical job per event/recipient/revision. Do not persist rendered message bodies or recipient contact details in ordinary jobs or audits.
- Simulator receipts store the synthetic rendered message, channel, synthetic destination and job key in a separate service/admin-only local outbox. Repeated dispatch with the same job key returns the existing receipt. A simulated receipt is explicitly distinct from a real delivery receipt.
- Use RLS and explicit grants/revokes. Customers/counselors cannot read jobs, other participants' contacts, previews or delivery receipts, nor write meetings or jobs. Admin sees operational summaries and local synthetic previews. Leases/dispatch completion and simulator receipt functions are service-only. Every admin action also checks session role server-side; database RPC checks provide a second boundary.
- A booking trigger enqueues jobs in the same transaction as actual confirmation/rescheduling, under the existing scheduling protocol. It also covers fixtures and all trusted confirmation paths without adding a non-atomic application hook. Define enqueue helpers before enabling the trigger.
- Backfill future confirmed demo bookings exactly once on migration: enqueue confirmation/alert and only future reminders; never enqueue for past sessions. Preserve accounts, booking/payment identities and existing settings.

## Worker, local gates and recovery

Notifications belong in `src/modules/notifications/`; meetings in `src/modules/meetings/`. Route files compose handlers and UI. Reuse the server-only Supabase service client with narrowly scoped RPCs.

- Configuration defaults to disabled. Simulator dispatch/preview requires development/test runtime and HTTP loopback Supabase, matching payment simulation. No SMTP, WhatsApp network calls or provider credentials are added. Disabled mode leaves jobs durable and explicitly shows delivery as paused; it never reports them sent.
- Provide a secret-authenticated POST worker endpoint excluded from session-refresh interception, a local CLI for one batch, and an explicitly launched local polling command. Start the local worker only after approval/implementation, report its status, and document restart commands. No hosted cron is claimed.
- Claim at most 20 due jobs using row locks/skip-locked plus expiring leases. Increment attempts on claim; complete only with the current lease token. Isolate each job failure. Reclaim expired leases after a crash.
- Before rendering/delivery, revalidate confirmed/future booking, recipient eligibility, current schedule/link revision and due time. Serialize dispatch eligibility and simulated receipt persistence with booking/link edits using the established lock order. A completed old delivery remains truthful history; stale unfinished work is superseded. Rescheduling cannot produce a newly delivered old-time reminder after its transaction commits.
- Use stable job IDs as provider idempotency keys; local receipt persistence and delivery completion are atomic, so a crash/replay cannot create duplicate simulated messages. Do not promise exactly-once real-provider delivery for future adapters.
- Retry transient simulated failures with bounded backoff (proposed 1, 5, 15, 60 minutes; maximum five attempts including the initial one). Skip reminders at session start. Terminal failures stay visible to admin. Manual retry is audited, revalidates current booking/revision and reuses the same semantic delivery key; superseded jobs cannot be revived.
- Include local-only per-job “fail next attempt” controls to demonstrate retries without changing demo bookings or exposing secrets. Missing links stay an independent admin issue; notification delivery never changes payment/booking confirmation.

## Surfaces

- `/admin/appointments`: future confirmed booking details, missing-link queue, attach/replace Meet link with validation and accessible feedback.
- `/admin/notifications`: queued/retrying/delivered/failed/skipped/superseded summaries, synthetic previews, run-batch, fail-next-attempt and safe retry controls. Label all simulator statuses clearly.
- Existing `/bookings`: participant-authorized link or pending-link message.
- Existing `/counselor`: minimal assigned confirmed appointments and meeting access, without payment details or expanded workspace features.

Use existing responsive styles and role guards; no redesign is included. Exact names/layout are builder choices.

## Verification and delivery

Write meaningful failing tests before implementation. Cover URL normalization/rejection/uniqueness, participant/admin authorization and direct-write denial, revoked roles, confirmation replay, no jobs for holds/payment exceptions, late captured confirmation, and missing-link recovery. Test exact reminder boundaries and 70-minute bookings, delayed workers, started sessions, rescheduling invalidation and dispatch races, concurrent workers, crash/lease recovery, stale completion tokens, bounded retries, manual retry and simulated receipt deduplication. Verify disabled/local-only gates and worker secret rejection.

Run pinned-version lint, typecheck, unit tests, transactional database tests, isolated migration replay, relevant synthetic browser journeys, formatting/diff checks, and isolated production build with simulation disabled. Browser journeys cover admin link assignment, customer/counselor isolation, notification previews/retries and mobile controls. Use temporary accounts/fixtures and preserve demo data. Check browser assets do not expose configured secrets.

Update README, ARCHITECTURE, DATABASE, DEVELOPMENT, DECISIONS, PROGRESS, Supabase guidance, `.env.example` and a Phase 6 local testing guide with implemented behavior, commands/results, and limits. Leave PROJECT_REQUIREMENTS unchanged. No commit without explicit instruction.

## Decisions proposed for approval

The user selected local simulated delivery. The URL rules, login-required message links, link retention across rescheduling, minimal counselor list, migration backfill, persistent missing-link queue, and retry defaults above are proposed design choices, not prior user decisions. External email/WhatsApp, Google account/access policy, consent and email-verification decisions remain deferred launch work. No messaging, clinical notes, feedback, cancellation/refund policy or other later-phase feature is included.
