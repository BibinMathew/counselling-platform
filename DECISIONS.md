# Decisions

This log separates confirmed decisions from proposals and unresolved questions. The product requirements remain the source of truth; this file does not override them.

## Confirmed

| Decision                                                                                   | Status                    | Notes                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------- |
| Build a responsive web-first MVP as a modular monolith                                     | Confirmed                 | No native app or premature microservices.                                                          |
| Use Next.js App Router, React, and TypeScript                                              | Confirmed                 | Versions currently pinned in the project manifest/lockfile.                                        |
| Use Supabase PostgreSQL and Auth                                                           | Confirmed for the product | Phase 1 phone OTP/profile/role foundations use local Supabase only.                                |
| Keep trusted mutations, secrets, and privileged authorization server-side                  | Confirmed                 | RLS is an additional database boundary.                                                            |
| Use Node.js `26.13.1` and pnpm `12.21.0` for this project setup                            | Approved for Phase 0      | Exact versions are pinned in `.node-version` and `package.json`.                                   |
| Use Vitest, Playwright, and GitHub Actions checks                                          | Approved for Phase 0      | Unit test and homepage smoke-test scaffolds are in place.                                          |
| Do not require Docker until local Supabase development is needed                           | Approved for Phase 0      | No local Supabase services are started.                                                            |
| Preserve `PROJECT_REQUIREMENTS.txt` unchanged                                              | Confirmed                 | Treat as the requirements source; record amendments separately if later requested.                 |
| Use phone OTP for every account, initially limited to Indian `+91` numbers stored as E.164 | Approved for Phase 1      | Supabase Auth; local fixed OTP numbers only. The parser can later permit additional country codes. |
| Keep one active role (`customer`, `counselor`, or `admin`) on each profile                 | Approved for Phase 1      | Canonical database enum; client APIs cannot write it.                                              |
| Bootstrap the first admin only through a restricted, audited operation                     | Approved for Phase 1      | Requires an existing phone-confirmed customer profile and no existing admin.                       |
| Grant counselor role only through a trusted admin operation with a verification reference  | Approved for Phase 1      | Reference is an opaque record ID; real session activation is not implemented.                      |
| Require one-time contact-email capture after the first successful phone OTP                | Approved for Phase 1      | No email OTP; email remains unverified contact data and is not an Auth identity.                   |
| Use local deterministic OTPs; leave production SMS provider unselected                     | Approved for Phase 1      | Placeholder Twilio config exists only in local Supabase config.                                    |
| Require an 18+ self-attestation before app OTP request                                     | Temporary Phase 1 gate    | No DOB collected; this is not robust age verification and is not launch approval.                  |
| Catalog profiles link to counselor-role accounts and require admin publication             | Approved for Phase 2      | Revoking the counselor role hides the public profile.                                              |
| Use admin-approved HTTPS image links for counselor photos                                  | Approved for Phase 2      | No upload or image storage; hosts receive requests from visitors.                                  |
| Display ₹699 and 45 minutes for catalog sessions                                           | Approved for Phase 2      | Price stays fixed for now; Phase 3 makes duration configurable.                                    |
| Availability uses Asia/Kolkata and returns concrete slot timestamps in UTC                 | Approved for Phase 3      | Weekly and date-specific schedules are local-time rules.                                           |
| Merge overlapping openings; block times override openings including buffers                | Approved for Phase 3      | Candidate start interval is session duration plus buffer, anchored to merged openings.             |
| Admin-configurable session duration, buffer, notice, and booking window                    | Approved for Phase 3      | Defaults: 45 minutes, 15 minutes, 60 minutes, and 10 days.                                         |
| Use an admin-configurable booking hold, defaulting to 10 minutes                           | Approved for Phase 4      | Holds are pending only; no payment or public confirmation bypass.                                  |
| Protect active holds and confirmed appointments from conflicting schedule changes          | Approved for Phase 4      | Transaction lock and database exclusion constraints enforce conflicts.                             |
| Reschedule once with the same counselor at least 24 hours before the original appointment  | Approved for Phase 4      | Confirmed appointments use local synthetic fixtures until payment verification exists.             |

## Proposed, Not Yet Implemented

- Product-specific table shapes and status lifecycle are starting proposals only; design and review migrations when their modules are approved.
- Manual Meet-link attachment is the MVP recommendation, but the account, ownership, and access process still needs confirmation.

## Unresolved

Do not silently decide these items in code. Resolve them before the feature or launch gate that depends on them:

- Counseling service scope, provider qualifications, verification, and applicable registration/advertising requirements.
- Minimum age, guardian consent, confidentiality, safeguarding, and emergency/crisis escalation for minors.
- Counselor/customer no-show, late arrival, counselor cancellation, technical failure, refunds, disputes, and support SLAs.
- Counselor payout cadence, tax/invoicing treatment, and reconciliation.
- Whether to use manual Meet links or Google Calendar integration, and the authorized account/link-access policy.
- Messaging lifetime, response expectations, emergency disclaimer, abuse reporting, moderation, and retention.
- Session-note consent, access, retention, deletion, export, and incident response.
- OTP, email, and WhatsApp vendors, verification/consent requirements, and operational costs.
- Customer email verification and support/complaint contact; future timezones beyond Asia/Kolkata.
- Production SMS provider, Indian delivery/compliance setup, CAPTCHA/rate-limit tuning, and provider cost.
- Whether and how to replace the temporary adult self-attestation with reviewed age assurance and guardian consent before production.
- The credential-review process, evidence retention, and revocation policy behind counselor verification references.
- Whether/when multiple roles per account are needed. If approved, migrate `profiles.role` to a role-membership table and update RLS, RPCs, server guards, and tests.
- Email verification and safe email-change/recovery policy before sending appointment details or other sensitive content to the captured address.
- Phase 5 payment verification, late/duplicate payment handling, hold-expiry reconciliation, and payment/refund exceptions.

## Role Multiplicity Migration Path

The MVP stores one role in `profiles.role`. If multi-role accounts are later approved, create a `profile_roles` table with a `(profile_id, role)` unique key, backfill each current role, update database helpers and server guards to test membership, adapt the role audit/RPC contract, deploy compatibility reads, then remove the enum column in a later migration. Do not implement this until the product requires it.
