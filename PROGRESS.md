# Progress

## Current Status

**Phase 3: implemented locally, verified, and awaiting human review.** Phase 2 was accepted by the user. Do not begin Phase 4 without approval.

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
- Slots are informational only. Booking, holds, concurrency protection against appointments, and safeguarding confirmed bookings remain Phase 4 work.

## Planned, Not Implemented

- Bookings, payments, notifications/Meet workflow, customer portal, counselor workspace, messaging, notes, feedback, broader admin operations, and launch hardening.
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

## Review Handoff

Review Phase 3 files, slot rules, authorization, documentation, and test record before approving Phase 4. Record any requested corrections here and wait for explicit approval before implementing bookings.
