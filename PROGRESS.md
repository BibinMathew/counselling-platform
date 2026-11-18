# Progress

## Current Status

**Phase 5: implemented and verified locally; ready for human review.** The user approved the payment design, late-payment policy and retry behavior. Do not begin Phase 6 without approval.

## Implemented

- Next.js App Router, TypeScript, ESLint, pnpm scripts, and exact Node/pnpm pins.
- Customer, counselor, and admin placeholder routes with no business behavior.
- Environment validation and separate Supabase browser/server client factories using public configuration only.
- Supabase local configuration and versioned identity, role, and one-time contact-email migrations; no production connection.
- Vitest unit-test setup, Playwright homepage smoke test, Prettier configuration, and GitHub Actions CI.
- Modular-monolith ADR, audit-event conventions, README setup instructions, and project documentation.
- Only the approved contact-email statements in `PROJECT_REQUIREMENTS.txt` were updated.

## Phase 1 Implemented

- Supabase phone OTP sign-in for all roles, local fixed test OTPs only, `+91` E.164 input normalization, and a server-enforced 18+ self-attestation before requesting an OTP.
- Auth-triggered profiles with one database-controlled role defaulting to `customer`; client APIs cannot insert profiles or update role, phone, email, or timestamps.
- Server-verified `getClaims()` profile lookup, role guards on customer/counselor/admin routes, and Next.js 16 Proxy cookie refresh.
- Own-profile preferred-name update and a one-time, post-phone-OTP contact-email completion gate. Email OTP is not sent; captured addresses remain unverified.
- Restricted first-admin bootstrap and admin role-assignment RPCs with audit rows. Counselor role assignments require an opaque verification reference.
- Local Supabase Auth config with fixed test numbers, no live SMS provider, local pgTAP authorization suite, unit tests, and OTP E2E coverage.

## Phase 1 Deferred

- Production SMS provider/configuration, production or staging Supabase, actual age verification/guardian consent, counselor credential-review workflow, booking, email verification, and contact-email changes.
- Multi-role accounts. The migration path is documented in `DECISIONS.md` and `ARCHITECTURE.md`.

## Phase 2 Implemented

- Admin-managed counselor profiles linked to counselor-role accounts, with draft/published state and approved HTTPS image links.
- Public directory and profile pages expose only published counselor details, while database RLS and a restricted public view protect account IDs and draft data. A revoked counselor role hides the public entry.
- Admin changes are recorded in a catalog audit table. The catalog initially displayed ₹699 and 45 minutes; Phase 3 adds configurable duration and availability.

## Phase 3 Implemented

- Counselor-owned and admin-managed month calendars with recurring weekly hours, date-specific openings, and partial/all-day blocks.
- Admin-configurable session, buffer, notice, and advance limits; defaults are 45 minutes, 15 minutes, 60 minutes, and 10 days.
- Database-generated UTC slots displayed in Asia/Kolkata on published counselor profiles; overlapping openings merge and blocks override sessions and buffers.
- Server role checks, ownership-aware database functions, RLS for private schedules, and audit records for schedule and settings changes.
- At Phase 3 completion, slots were informational only; Phase 4 adds holds and booking protections.

## Phase 4 Implemented

- Visitors select a published slot and return to it after phone login and one-time contact-email completion. Customers can create temporary holds and view their own pending or expired holds.
- Admin-configurable hold duration defaults to 10 minutes. A hold is not paid or confirmed; payment integration and public confirmation are not implemented.
- PostgreSQL transaction locking, participant row locks, and exclusion constraints prevent overlapping counselor/buffer and customer session ranges. Active holds and confirmed appointments protect their availability from conflicting schedule changes.
- Confirmed appointments can be rescheduled once, with the same counselor, at least 24 hours before the original start; only synthetic local tests create confirmed fixtures in Phase 4.
- Booking lifecycle changes are audited; expired holds are hidden immediately and transitioned during a later successful booking operation.

## Planned, Not Implemented

- Notifications/Meet workflow, full customer portal, counselor workspace, messaging, notes, feedback, broader admin operations, and launch hardening.
- Production SMS/email providers, email verification/change flow, production/staging Supabase environments, age verification, and counselor credential-review workflow.

## Phase 0 Verification Record

Run on 2026-11-17 with Node.js `26.13.1` and pnpm `12.21.0`:

| Command/check                    | Result                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed; lockfile up to date.                                                      |
| `pnpm lint`                      | Passed.                                                                           |
| `pnpm typecheck`                 | Passed; Next route types generated and `tsc --noEmit` clean.                      |
| `pnpm test`                      | Passed; 1 file, 2 tests.                                                          |
| `pnpm format:check`              | Passed.                                                                           |
| `pnpm test:e2e`                  | Passed; homepage smoke test, 1 test.                                              |
| `pnpm build`                     | Passed; static routes generated for `/`, `/customer`, `/counselor`, and `/admin`. |

The editor reported no diagnostics at final Phase 0 validation. Phase 0 is pushed to `main` at `cdeb8f707caf3196f9c15404bbbf7f97437db7a1` (`origin/main`). GitHub Actions run [CI #1](https://github.com/BibinMathew/counselling-platform/actions/runs/44118466469) for Phase 0 completed successfully.

## Phase 1 Verification Record

Run locally on 2026-11-18 with Node.js `26.13.1`, pnpm `12.21.0`, Supabase CLI `3.2.0`, and Docker Desktop. Supabase was unlinked and local-only; fixed test phone numbers were used, no SMS was sent, and no real counseling data was used.

| Command/check                    | Result                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed; lockfile up to date.                                                                                               |
| `supabase config validate`       | Passed; local Auth config valid.                                                                                           |
| `supabase db reset`              | Passed; applied identity/role and one-time email migrations to the local database.                                         |
| `pnpm lint`                      | Passed without warnings.                                                                                                   |
| `pnpm typecheck`                 | Passed; Next route types generated and `tsc --noEmit` clean.                                                               |
| `pnpm test`                      | Passed; 2 files, 5 tests.                                                                                                  |
| `pnpm test:integration`          | Passed; 1 pgTAP file, 27 RLS/role/email assertions.                                                                        |
| `pnpm test:e2e`                  | Passed; 3 tests including fixed-OTP login, one-time email capture, profile update, role denial, and age-attestation block. |
| `pnpm build`                     | Passed; public/login/unauthorized pages static, protected pages partially prerendered with dynamic server checks.          |
| `pnpm format:check`              | Passed.                                                                                                                    |

GitHub Actions run [CI #1](https://github.com/BibinMathew/counselling-platform/actions/runs/44118466469) passed for Phase 0 commit `cdeb8f7`. The Phase 1 workflow includes local Supabase/RLS and formatting checks but has not run remotely because Phase 1 changes have not been pushed. No Phase 1 commit or push was made.

## Phase 2 Verification Record

Run locally on 2026-11-18 with the pinned Node and pnpm versions and local Supabase. Migrations were applied with `supabase migration up` without resetting existing local data.

| Command/check                                    | Result                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `pnpm lint`                                      | Passed.                                                                    |
| `pnpm typecheck`                                 | Passed.                                                                    |
| `pnpm test`                                      | Passed; 2 files, 5 tests.                                                  |
| `pnpm test:integration`                          | Passed; 2 pgTAP files, 42 assertions.                                      |
| `pnpm test:e2e`                                  | Passed; 4 tests, including catalog draft, publication, mobile, and delete. |
| `NEXT_DIST_DIR=.next-playwright-3106 pnpm build` | Passed; isolated production build.                                         |
| `pnpm format:check` and `git diff --check`       | Passed.                                                                    |

The catalog E2E uses synthetic local accounts and cleans them up. The configured photo link in that test is synthetic; an actual photo host has not been approved or tested. No production service was connected. The CI reset step was corrected locally; remote CI has not been verified for these changes.

## Phase 3 Verification Record

Run locally on 2026-11-18 with Node.js `26.13.1`, pnpm `12.21.0`, and local Supabase. Applied the two availability migrations with `supabase migration up`, preserving existing local data.

| Command/check                                    | Result                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `pnpm lint` and `pnpm typecheck`                 | Passed.                                                               |
| `pnpm test`                                      | Passed; 2 files, 5 tests.                                             |
| `pnpm test:integration`                          | Passed; 3 pgTAP files, 73 assertions.                                 |
| `pnpm test:e2e`                                  | Passed; 4 tests including counselor schedule and mobile slot display. |
| `NEXT_DIST_DIR=.next-playwright-3106 pnpm build` | Passed; isolated production build.                                    |
| `pnpm format:check` and `git diff --check`       | Passed after removing build-generated TypeScript include entries.     |

Desktop settings and mobile calendar screenshots were inspected. The E2E test uses and removes synthetic local accounts and schedule records. No production service or real customer data was used. Booking, appointment overlap enforcement, and confirmed-booking protections remain unimplemented and are required in Phase 4. Remote CI has not been verified for these changes.

### Additional Availability Coverage

On 2026-11-18, expanded the transactional database tests to cover weekly-hour and blocked-period edits, deleting an opening, exact notice and advance boundaries, and invalid schedule inputs. The synthetic browser journey now covers invalid settings, an admin creating, editing, and deleting weekly and date-specific availability, and a published directory that already contains other profiles.

- `pnpm test:integration`: passed; 3 files, 91 assertions.
- `pnpm exec playwright test tests/e2e/catalog.spec.ts`: passed; 1 browser test using temporary local accounts.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (5 unit tests), `pnpm format:check`, and `git diff --check`: passed.
- The complete browser suite was not rerun because its customer journey changes the existing local test customer's preferred name. No production build or remote CI run was performed for this test-only change.
- Observed usability issue: after a weekly-hours validation error, the form resets the selected day. The browser test reselects it; this behavior has not been changed.

## Phase 4 Verification Record

Run locally on 2026-11-18 with Node.js `26.13.1`, pnpm `12.21.0`, and local Supabase. Applied booking migrations incrementally with `supabase migration up`; the existing local database was not reset.

| Command/check                                                                                                   | Result                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm lint` and `pnpm typecheck`                                                                                | Passed.                                                                                                            |
| `pnpm test`                                                                                                     | Passed; 2 files, 9 unit tests, including OTP action return-path validation.                                        |
| `pnpm test:integration`                                                                                         | Passed; 5 pgTAP files, 127 assertions.                                                                             |
| `pnpm exec playwright test --grep-invert 'local customer can sign in and is denied the admin area' --workers=1` | Passed; 4 browser tests, including synthetic booking and concurrency checks.                                       |
| `pnpm exec playwright test tests/e2e/booking.spec.ts --repeat-each=3 --workers=1`                               | Passed three runs; covers simultaneous same-slot requests, same-customer overlap, and schedule-change versus hold. |
| `NEXT_DIST_DIR=.next-playwright-3106 pnpm build`                                                                | Passed; isolated production build.                                                                                 |
| `pnpm format:check` and `git diff --check`                                                                      | Passed after removing build-generated TypeScript include entries.                                                  |

The original customer OTP browser test was excluded because it changes the existing local test customer's preferred name. Booking browser tests use temporary local accounts and synthetic confirmed fixtures, not real SMS or payment; OTP return-path behavior is unit tested. Desktop/mobile booking layout was checked locally. Remote CI and a fresh-database migration replay have not been verified. No hosted service or real customer data was used.

Phase 5 must implement verified payment, immutable pricing/payment linkage, idempotent confirmation, duplicate and late payment handling, and reconciliation. Hold abuse controls, retention, privacy, and recovery procedures remain launch gates. The Phase 3 weekly-hours form reset after validation remains unresolved.

### Additional Booking Coverage

On 2026-11-18, added database checks for anonymous and unauthorized access, incomplete profiles, invalid hold durations and ungenerated slots, protected availability deletion, and attempts to reschedule another customer's known booking ID. Failed rescheduling is checked not to consume the allowed reschedule. The availability suite isolates existing local bookings within a transaction that rolls back.

- `pnpm test:integration`: passed; 5 files, 142 assertions.
- `pnpm test`: passed; 2 files, 9 tests.
- The safe browser suite passed 4 tests, including synthetic booking concurrency and admin scheduling. The existing customer OTP test remained excluded to preserve local customer data.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and `git diff --check`: passed. A fresh migration replay and remote CI remain unverified.

## Review Handoff

Phase 5 design was approved by the user on 18 November 2026. Review the Phase 5 delivery and verification record before approving Phase 6.

## Phase 5 implemented

- Added payment/pricing tables, owner/admin RLS, service-only ingestion and audited database confirmation under the existing booking lock.
- Added Razorpay Test Mode provider transport, raw-body webhook signature checks, callback verification, captured/paid canonical-state checks, durable order creation claims and uncertain-order recovery.
- Added explicitly local payment simulator with persistent synthetic provider state, checkout controls, replay tools, missed-delivery recovery, and bounded reconciliation.
- Added customer payment/recheck controls and admin pricing, old exception visibility and reconciliation; current prices are shown consistently and existing orders retain their snapshot.
- Preserved original hold deadlines across retries; late captured payment confirms only a free, valid future slot, otherwise admin review. Rescheduling preserves payment linkage.
- Corrected malformed CI database-reset command and added payment browser checks and isolated migration replay. No production service, real customer data, real payment, or provider credentials were used.

### Phase 5 verification — final local record

- Baseline: 9 unit tests passed.
- `pnpm test`: passed, 5 files and 18 unit tests, including payment signatures, captured/paid checks, provider request contracts/timeouts, body limits, and public-host origin checks.
- `pnpm test:integration`: passed, 6 SQL files and 203 assertions (61 payment assertions); fixtures rolled back.
- Simulator browser journey passed: retry, capture, refresh persistence, unauthorized ownership, invalid signature, missed-delivery recovery, signed event replay, mobile overflow, concurrent late captures, callback/reconciliation idempotency, admin exceptions/reconciliation.
- `pnpm test:migrations`: passed, all 17 migrations replayed in an isolated disposable database.
- `PLAYWRIGHT_PORT=3110 pnpm test:e2e --grep-invert 'local customer can sign in and is denied the admin area' --workers=1`: passed, 5 browser tests. The excluded older test changes the persistent demo customer profile.
- `PAYMENT_MODE=disabled NEXT_DIST_DIR=.next-payment-build pnpm build`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed after excluding isolated generated Next build/test outputs.
- `pnpm format:check` and `git diff --check`: passed.
- `pnpm payments:local reconcile`: passed against the running app (`checked: 0`, `failed: 0` after fixture cleanup).
- Browser bundle scan: no configured server-secret values appeared in static JS bundles.
- Bugs exposed and corrected during testing: Next.js runtime export incompatibility, audit-actor cleanup ordering, internal/public Host mismatch in origin validation, JSONB array lookup, and captured transaction amount transition.
- Razorpay dashboard/Checkout/Test Mode webhook delivery remains unverified because Test Mode keys are not available. Remote CI has not been run.

### Independent review and corrections

One fresh reviewer inspected payment security, state transitions, concurrency, provider recovery and tests. No Critical issue was found. Two Important recovery findings were reproduced in failing database tests and corrected: captured admin-review outcomes are now terminal under duplicate delivery, and same-digest unmatched events can safely become linked after uncertain-order recovery.

The review also exposed weak origin-only ownership evidence and missing persisted pending/failed status. These were treated as important verification/customer-flow issues: browser tests now supply a valid Origin and compare owner versus foreign-order refresh, and payment-attempt summaries survive refresh. The browser also verifies exact receipt recovery without creating a second simulated provider order. No review finding is deferred.

The first interrupted browser run left one synthetic fixture; it and its four generated accounts were removed using an exact fixture ID plus identity/count guards. Final browser runs cleaned their own fixtures. Existing six demo accounts and four published demo counselor profiles were preserved.

Known non-blocking output: existing Next.js image loading/performance hints and runner color-environment warnings. No real Razorpay checkout, dashboard setup, remote CI or hosted reconciliation schedule was claimed as verified.
