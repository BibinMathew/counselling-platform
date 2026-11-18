# Progress

## Current Status

**Phase 1: implemented locally, verified, and awaiting human review.** Do not begin Phase 2 until review and explicit approval.

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

- Production SMS provider/configuration, production or staging Supabase, actual age verification/guardian consent, counselor credential-review workflow, counselor session activation, booking, email verification, and contact-email changes.
- Multi-role accounts. The migration path is documented in `DECISIONS.md` and `ARCHITECTURE.md`.

## Planned, Not Implemented

- Counselor catalog, availability, bookings, payments, notifications/Meet workflow, customer portal, counselor workspace, messaging, notes, feedback, broader admin operations, and launch hardening.
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

## Review Handoff

Review Phase 1 files, security boundaries, documentation, and final test record before approving Phase 2. Record any requested corrections here, preserve the current phase boundary, and wait for explicit approval before implementing the next module.
