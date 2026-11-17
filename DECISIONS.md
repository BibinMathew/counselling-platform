# Decisions

This log separates confirmed decisions from proposals and unresolved questions. The product requirements remain the source of truth; this file does not override them.

## Confirmed

| Decision                                                                  | Status                    | Notes                                                                              |
| ------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| Build a responsive web-first MVP as a modular monolith                    | Confirmed                 | No native app or premature microservices.                                          |
| Use Next.js App Router, React, and TypeScript                             | Confirmed                 | Versions currently pinned in the project manifest/lockfile.                        |
| Use Supabase PostgreSQL and Auth                                          | Confirmed for the product | Phase 0 config/client scaffolding only; no production connection.                  |
| Keep trusted mutations, secrets, and privileged authorization server-side | Confirmed                 | RLS is an additional database boundary.                                            |
| Use Node.js `26.13.1` and pnpm `12.21.0` for this project setup           | Approved for Phase 0      | Exact versions are pinned in `.node-version` and `package.json`.                   |
| Use Vitest, Playwright, and GitHub Actions checks                         | Approved for Phase 0      | Unit test and homepage smoke-test scaffolds are in place.                          |
| Do not require Docker until local Supabase development is needed          | Approved for Phase 0      | No local Supabase services are started.                                            |
| Preserve `PROJECT_REQUIREMENTS.txt` unchanged                             | Confirmed                 | Treat as the requirements source; record amendments separately if later requested. |

## Proposed, Not Yet Implemented

- Product-specific table shapes and status lifecycle are starting proposals only; design and review migrations when their modules are approved.
- A 10-minute booking hold is proposed in the requirements, not a finalized decision.
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
- Customer email verification, timezone/slot publication details, and support/complaint contact.
