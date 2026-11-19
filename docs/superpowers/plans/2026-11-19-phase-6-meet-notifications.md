# Phase 6 Meet and Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. The user selected native execution in the current workspace with independent review on 19 November 2026.

**Goal:** Add unique manual Meet links and a durable, fully local simulation of customer email, counselor WhatsApp alerts and customer reminders.

**Architecture:** PostgreSQL booking triggers atomically enqueue revisioned jobs. A service-only leased worker persists idempotent synthetic delivery receipts under the same scheduling lock as rescheduling and meeting edits. Next.js modules enforce role checks and render participant views and admin operations.

**Tech Stack:** Existing Next.js 16.4.6, React 19.3.0, TypeScript, Supabase PostgreSQL, Zod, Vitest, pgTAP and Playwright; Node 26.13.1 and pnpm 12.21.0. No new package or external service is needed.

**Spec:** `docs/superpowers/specs/2026-11-19-phase-6-meet-notifications-design.md`

## Global Constraints

- No external message delivery, Google API calls, new authentication factor, production connection, or real customer data is included.
- Do not modify previous migrations or reset the local database.
- Configuration defaults to disabled. Simulator dispatch/preview requires development/test runtime and HTTP loopback Supabase.
- No commit without explicit instruction. Preserve demo accounts, bookings and settings; create temporary synthetic test fixtures.
- Follow `AGENTS.md`, read relevant installed Next.js guides before editing application code, and retain existing booking advisory lock `70324004` and participant protections.
- Reminder thresholds are 24 hours and 1 hour; skip already-reached thresholds at enqueue time and skip unsent reminders once the session starts.
- Manual retries reuse logical delivery identity. Superseded jobs cannot be revived. No real-provider exactly-once delivery claim.
- Read the whole approved design before implementation; the details there apply to every task.

## Review Focus

- Interrupted polling/lease expiry must recover work without duplicate receipts; exercised in Task 3.
- Link replacement while work is leased must not deliver stale meeting revisions; exercised in Tasks 2–3.
- Rescheduling after an old notification was delivered must preserve truthful history and replace only unfinished work; exercised in Task 3.
- Revoked participant roles must immediately lose meeting access and suppress delivery; exercised in Tasks 2–3.
- Disabled/production runtimes must never expose previews or mark messages simulated-delivered; exercised in Tasks 1 and 4.

---

### Task 1: Local configuration and shared notification contracts

**Files:** Create `src/modules/notifications/config.ts`, `src/modules/notifications/model.ts`, `src/modules/meetings/model.ts`, `tests/unit/notifications.test.ts`, `tests/unit/meetings.test.ts`; modify `.env.example`.

**Interfaces:**

- `readNotificationConfig(env: Record<string, string | undefined>): { mode: "disabled" | "simulator"; appOrigin: string }` validates local runtime/Supabase/app origins; disabled mode needs no secrets.
- `canonicalMeetingUrl(input: string): string` accepts the spec's exact Google Meet URL shape and rejects credentials, alternate hosts, query, fragment and extra path segments.
- Shared Zod schemas define safe meeting rows, job summaries and receipt previews consumed by server/UI tasks. Template names: `confirmation`, `link_update`, `schedule_update`, `reminder_24h`, `reminder_1h`, `counselor_booking`, `counselor_schedule_update`.

- [x] Write failing unit cases: disabled config, local simulator success, hosted Supabase/app rejection, production rejection, unknown mode, accepted canonical URL and malformed/credential/query/fragment/lookalike-host URLs.
- [x] Run `pnpm exec vitest run tests/unit/notifications.test.ts tests/unit/meetings.test.ts`; confirm expected missing-module failures.
- [x] Implement the three contracts and `.env.example` placeholders for `NOTIFICATION_MODE`, `NOTIFICATION_APP_ORIGIN`, `NOTIFICATION_WORKER_SECRET`; worker secret minimum 32 characters.
- [x] Run the focused unit command and confirm all cases pass.

### Task 2: Meeting assignments, participant access and transactional enqueue

**Files:** Create `supabase/migrations/20261123000000_meetings_notifications.sql`, `supabase/tests/meetings_notifications.test.sql`; modify `src/types/database.types.ts`.

**Consumes:** Task 1 URL/template rules. Existing `bookings`, `profiles`, `counselors`, role helpers and audit conventions.

**Produces:**

- Tables `booking_meetings`, `meeting_url_reservations`, `notification_jobs`, `notification_simulator_receipts`, `meeting_notification_audit_events` with explicit grants/RLS and indexes on due-job scans, booking and semantic identity.
- `set_booking_meeting(p_booking_id uuid, p_url text) returns void`: authenticated admin, future confirmed booking, SQL URL validation, unique historical reservation, no-op same URL, revisioned link update and safe audit.
- `get_accessible_booking_meetings() returns table(booking_id uuid, meeting_url text, revision integer)`: current customer owner, assigned counselor or admin only.
- `get_assigned_confirmed_bookings() returns table(id uuid, start_at timestamptz, end_at timestamptz, meeting_url text)`: assigned canonical counselor only; no customer contact/payment fields.
- `get_admin_confirmed_bookings() returns table(id uuid, counselor_name text, start_at timestamptz, meeting_url text)`: admin-only future confirmed appointments.
- Private `enqueue_booking_notifications()` trigger and helper: distinguish actual first confirmation, schedule change and irrelevant payment replay. Unique `(booking_id, recipient_id, template, schedule_revision, link_revision)` semantic identity with normalized non-null revisions.

- [x] Write transactional pgTAP cases asserting RPC existence, RLS/direct-write denial, forbidden role mutations/reads, unique URL history and canonical validation; then run database suite to capture failure before the migration.
- [x] Implement meeting tables/RPCs, notification tables, role-aware policies and enqueue helpers, then enable booking trigger. Acquire scheduling advisory lock before booking/job/meeting row locks in mutators. Restrict `search_path` and function execution explicitly.
- [x] Enqueue confirmation/counselor alert and future reminders atomically; skip held/expired/payment-review and past bookings. Backfill future confirmed bookings once. Store only references in jobs; synthetic previews live in separate receipts.
- [x] Add SQL cases for payment-event replay, first confirmation, exact thresholds/70-minute booking, reschedule replacement, link replacement/no-op, revoked roles, backfill idempotency and historical link reuse denial.
- [x] Apply only the new migration incrementally to local Supabase, update matching generated database types, run `pnpm test:integration` and `pnpm test:migrations`; confirm existing assertions and new cases pass without resetting data.

### Task 3: Leased simulation worker and recovery

**Files:** Create `supabase/migrations/20261123000001_notification_worker.sql`, `supabase/tests/notification_worker.test.sql`, `src/modules/notifications/provider.ts`, `src/modules/notifications/server.ts`, `tests/unit/notification-worker.test.ts`.

**Consumes:** Task 2 jobs, participant eligibility and revision semantics; Task 1 config.

**Produces:**

- Service-only `claim_notification_jobs(p_limit integer default 20) returns table(id uuid, lease_token uuid)`; maximum 20, skip-locked claims, expired lease recovery, attempt increment, bounded due time scan.
- Service-only `dispatch_simulated_notification(p_job_id uuid, p_lease_token uuid, p_app_origin text) returns text`: atomic revalidation, rendering, fail-next-attempt handling, idempotent receipt and completion. Returns `delivered`, `retrying`, `failed`, `skipped` or `superseded`; stale tokens cannot complete.
- Admin-only `retry_notification(p_job_id uuid)` and `fail_next_notification_attempt(p_job_id uuid)` RPCs. Retry validates current booking/revision and preserves stable identity; delivered/superseded jobs cannot be revived.
- `NotificationProvider` has `dispatch(job: { id: string; leaseToken: string }): Promise<string>`; simulator calls the atomic RPC, future real adapters remain absent.
- `dispatchNotifications(): Promise<{ checked: number; delivered: number; failed: number }>` enforces local config before claim, handles per-job errors and leaves crashed work recoverable.

- [x] Add failing unit/SQL cases for claim bounds, simultaneous claims, expired leases, stale completion tokens, receipt replay, crash recovery and per-job failure isolation.
- [x] Implement claim/dispatch RPCs and server/provider wrappers. Use scheduling lock before row locks during dispatch to serialize with reschedule/link edits. Do not lock jobs then request scheduling lock. Retry delays: 1, 5, 15, 60 minutes, maximum five attempts; terminal failures stay visible.
- [x] Render generic synthetic email subject and date/time plus authenticated `/bookings` URL; WhatsApp renders date/time plus `/counselor` URL and no customer identifiers/Meet URL. Resolve contact data only during atomic synthetic receipt creation.
- [x] Test reschedule versus claim/dispatch, replacement link revision, delivered-history retention, revoked roles, reminder past session start, manual retry rejection for stale work, and duplicate completion. Use independent SQL sessions for meaningful concurrency assertions.
- [x] Apply migration incrementally; run focused unit, full database and isolated migration replay checks and confirm passing output.

### Task 4: Authenticated operations, participant UI and local runner

**Files:** Create `src/modules/meetings/server.ts`, `src/modules/meetings/actions.ts`, `src/modules/meetings/components/meeting-form.tsx`, `src/modules/notifications/actions.ts`, `src/modules/notifications/components/admin-notifications.tsx`, `src/app/admin/appointments/page.tsx`, `src/app/admin/notifications/page.tsx`, `src/app/api/notifications/dispatch/route.ts`, `scripts/notification-tools.mjs`, `tests/unit/notification-http.test.ts`; modify `proxy.ts`, `package.json`, `src/app/admin/page.tsx`, `src/app/bookings/page.tsx`, `src/app/counselor/page.tsx`, `src/app/globals.css`, `src/lib/supabase/service.ts`.

**Consumes:** All earlier RPCs/schemas and `dispatchNotifications()`.

**Produces:**

- Role-guarded `getAdminAppointments()`, `getAccessibleMeetings()`, `getAssignedAppointments()` in meetings server module; explicit Zod parsing.
- Admin meeting server action `saveMeeting(previousState, formData)` validates UUID/URL, invokes user-scoped RPC and revalidates participant/admin paths.
- Admin notification actions for run-batch, fail-next-attempt and retry; local simulator checks precede mutations/preview reads. Safe result messages never include secrets or provider payloads.
- Worker POST uses constant-time comparison against separate bearer secret (minimum 32 characters), no body-controlled origin/recipient/job data, no session-refresh proxy. Disabled mode reports paused without claiming/delivering.
- `pnpm notifications:local run` dispatches one batch; `pnpm notifications:local poll` repeats with a five-second nonoverlapping interval and graceful shutdown. CLI validates loopback app URL, never prints bearer tokens.

- [x] Read installed Next.js guides for server actions, route handlers, `connection`, revalidation and `useActionState` before writing UI/route code.
- [x] Write failing worker-handler unit checks: missing/wrong/short secret, disabled/production simulation, body cannot choose recipient/origin, safe 503 on worker failure.
- [x] Implement module server/actions and POST route; add proxy exclusion only for exact notification dispatch path. Make service-client missing-config error domain-neutral.
- [x] Add responsive admin appointments/missing-link queue and notification status/preview/recovery pages. Clearly label all receipts simulated; show paused mode. Follow existing accessible action-state forms.
- [x] Add meeting link/pending message to confirmed customer entries and minimal assigned appointments to counselor area; no wider portal/workspace features. Use safe external-link attributes.
- [x] Add CLI/package script and focused runner checks for nonoverlap, error output and signal handling; run unit, lint and typecheck commands and confirm success.

### Task 5: Browser integration, regression evidence and operating guide

**Files:** Create `tests/e2e/notifications.spec.ts`, `docs/notifications-local-testing.md`; modify `README.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DEVELOPMENT.md`, `DECISIONS.md`, `PROGRESS.md`, `supabase/README.md`, applicable `.github/workflows/ci.yml` steps and this plan's checkboxes.

**Consumes:** Implemented local workflows. Reuse payment browser fixture cleanup patterns, not persistent demo customer OTP tests.

- [x] Write and run the browser journey against an isolated test app: synthetic payment confirms, missing-link queue appears, admin attaches/replaces link, customer/assigned counselor see it, foreign roles are denied, same-link save produces no duplicate job. Include narrow/mobile controls.
- [x] Exercise batch delivery, synthetic previews, fail/retry/replay, rescheduling and unchanged receipt history; verify account/fixture cleanup in `finally` blocks. Ensure tests initially fail before the matching unfinished surface is completed.
- [x] Run pinned versions: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:migrations`, `PLAYWRIGHT_PORT=3111 pnpm test:e2e --grep-invert 'local customer can sign in and is denied the admin area' --workers=1`, `NOTIFICATION_MODE=disabled PAYMENT_MODE=disabled NEXT_DIST_DIR=.next-phase6-build pnpm build`, `pnpm format:check`, `git diff --check`. Fix actual failures, rerun affected checks, and record exact totals/limits.
- [x] Scan browser JS for configured server-secret values without printing them. Confirm temporary fixtures are removed and original demo counts/identities preserved.
- [x] Update operating docs with setup/gates, simulator status terminology, Meet-link admin procedure, local worker commands, failure/recovery examples, skipped reminder rules and deferred external policies. Update Phase 6 approval/implementation/verification records truthfully. Do not claim real delivery or hosted scheduling.
- [x] Start the approved local simulator worker with newly generated ignored worker configuration only as necessary; preserve unrelated `.env.local` settings. Verify app/API/worker readiness and report running process/log location.
- [x] Request one independent whole-change review, resolve material findings with reproducing tests, and repeat only affected checks. Leave changes uncommitted for user review; summarize delivered behavior and any unresolved evidence.

## Plan self-review

All approved design sections map to Tasks 1–5. Meeting URL history, all confirmation paths/backfill, skipped reminders, rescheduling revisions, lease/crash recovery, role revocation, paused/local gates, admin recovery and documentation each have explicit implementation and verification steps. UI/SQL contracts use the same names. No later-phase implementation, external delivery, dependency installation or commit is authorized by this plan.
