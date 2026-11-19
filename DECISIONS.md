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
- Manual Meet-link attachment is implemented locally in Phase 6. Google account ownership and meeting admission/access procedures still need launch review.

## Unresolved

Do not silently decide these items in code. Resolve them before the feature or launch gate that depends on them:

- Counseling service scope, provider qualifications, verification, and applicable registration/advertising requirements.
- Minimum age, guardian consent, confidentiality, safeguarding, and emergency/crisis escalation for minors.
- Counselor/customer no-show, late arrival, counselor cancellation, technical failure, refunds, disputes, and support SLAs.
- Counselor payout cadence, tax/invoicing treatment, and reconciliation.
- Authorized Google account ownership and meeting admission/access policy. Manual links are approved for MVP; Calendar integration remains deferred.
- Messaging lifetime, response expectations, emergency disclaimer, abuse reporting, moderation, and retention.
- Session-note consent, access, retention, deletion, export, and incident response.
- OTP, email, and WhatsApp vendors, verification/consent requirements, and operational costs.
- Customer email verification and support/complaint contact; future timezones beyond Asia/Kolkata.
- Production SMS provider, Indian delivery/compliance setup, CAPTCHA/rate-limit tuning, and provider cost.
- Whether and how to replace the temporary adult self-attestation with reviewed age assurance and guardian consent before production.
- The credential-review process, evidence retention, and revocation policy behind counselor verification references.
- Whether/when multiple roles per account are needed. If approved, migrate `profiles.role` to a role-membership table and update RLS, RPCs, server guards, and tests.
- Email verification and safe email-change/recovery policy before sending appointment details or other sensitive content to the captured address.
- Real Razorpay Test Mode validation (keys pending), production capture/refund operations, and payment-provider launch review.

## Role Multiplicity Migration Path

The MVP stores one role in `profiles.role`. If multi-role accounts are later approved, create a `profile_roles` table with a `(profile_id, role)` unique key, backfill each current role, update database helpers and server guards to test membership, adapt the role audit/RPC contract, deploy compatibility reads, then remove the enum column in a later migration. Do not implement this until the product requires it.

## Phase 5 decisions — approved 18 November 2026

- Implement the local simulator plus Razorpay Test Mode adapter; live keys are rejected. No provider keys were available during implementation.
- Retry failed or closed checkouts until the original hold deadline, without extending it. One durable provider order per booking fixes provider and price on first checkout.
- Confirm a late captured payment only if its original future slot remains offered, participants remain eligible, and counselor/customer ranges remain free. Otherwise retain an admin-review exception. The minimum-notice rule is not reapplied to an already purchased late payment; the session must not have started.
- Use server-controlled global INR price (default ₹699), snapshotted before provider order creation. New prices affect new checkouts only.
- Confirm captured/paid canonical provider state, never browser success or mere authorization. Event identity/digest, payment identity and unique successful booking linkage provide layered idempotency.
- Treat external order-create timeouts as uncertain. Recover by exact durable receipt; zero/multiple matches cannot trigger blind recreation.
- Retain failures/duplicate captures as payment evidence; do not implement automatic refunds, credits, payouts, tax invoices, Meet links, or notifications in this phase.
- Use an explicitly server-only Supabase service client for ingestion/reconciliation. Payment-specific privileged RPCs remain unavailable to authenticated browser roles.
- Keep simulator state separate from application order state so missed delivery can be recovered through the same verification pipeline. Simulator is limited to local development/test and loopback Supabase.
- A five-second customer refresh claim and one-minute reconciliation leases bound provider polling. Deployments must configure their own authenticated reconciliation schedule.

Captured payments already marked for admin review retain that outcome on every replay; no later disappearance of a conflict silently resolves the exception. Unmatched signed event receipts can become linked only after canonical order recovery with the same digest; true identity conflicts remain rejected.

## Phase 6 decisions — approved 19 November 2026

- User approved manual Meet links and local simulated email/WhatsApp, then approved the Phase 6 design and in-place native implementation with independent review.
- Admin assigns unique canonical Meet URLs to future confirmed bookings. Historical links remain reserved to the same booking; rescheduling retains the link. Google API validation/creation is deferred.
- Customer/assigned counselor see their authorized link. A persistent missing-link admin queue supplies local operational alerting.
- Confirmation and rescheduling atomically enqueue deduplicated notifications; only future 24-hour/1-hour thresholds are scheduled. Delivered history persists and stale unfinished work is superseded.
- Local receipts simulate email and WhatsApp only. Message bodies link to authenticated pages; destinations use synthetic profile references and avoid copying unverified contacts.
- Default delivery mode is disabled; simulation requires development/test plus HTTP loopback origins. Secret-authenticated local polling is explicit, not a hosted cron.
- Five automatic attempts use 1/5/15/60-minute backoff; audited manual retry retains the stable delivery identity. No external provider exactly-once guarantee is implied.
- Live email verification/contact-change policy, WhatsApp consent/provider/template approval, Google account/access policy and real delivery remain launch decisions.

## Phase 7 decisions — approved 19 November 2026

- Expand existing `/bookings`; retain existing notification/checkout links and role guards. Native execution continues in the current workspace with independent review.
- All/Upcoming/Past/Holds use20-row pagination and deterministic order. One database timestamp drives view/action flags. Past does not create Completed or No-show status.
- Past-only Book Again navigates to current public availability; unavailable counselors fall back to discovery. New bookings always get current rules/prices and fresh checkout; existing paid appointments keep their counselor.
- Keep optional legacy payment data absent instead of inventing past amounts. Confirmed payment evidence and captured admin exceptions outrank older/newer failed attempts.
- Review refinement: optional owner-scoped booking locator resolves the actual page in one snapshot after Holds confirmation or rescheduling, preventing older appointments from disappearing on default page zero. This adds a read parameter and incremental migration, not a new mutation or privilege.
- Past cards omit obsolete Join Meet affordances without changing the underlying authorized meeting access policy. Feedback, messaging/notes and launch policies remain deferred.

## Phase 8 decisions — approved 19 November 2026

- User reduced the selected local scope: implement counselor workspace and private notes; defer messaging and message reporting. Continue in-place, no commits.
- Workspace exposes only assigned confirmed sessions, paged by 20 with one database reference time. Past retains Confirmed; no completion/no-show state or participant contact/payment fields. Existing Meet and availability behavior stays available.
- One plain-text note per confirmed booking/assigned counselor, before or after the session; trim nonempty input, cap at 20,000 Unicode code points, require fictional-content acknowledgement per save. No autosave, sharing, deletion/export UI or production policy.
- Server-only AES-256-GCM authenticates note/booking/owner/version. Retain old keys for decrypt/retry; encryption and idempotency use purpose-separated keys. Losing keys fails closed. Operators holding keys and DB can technically decrypt.
- Session-derived actor plus independent service-only RPC authorization; raw tables and private functions deny browser roles, including admin. Content-free read/save audits are mandatory.
- Atomic optimistic versions and stable request UUIDs protect concurrent saves and ambiguous retries. Replaying an older accepted save after a newer revision returns conflict without overwrite. Missing/corrupt old ciphertext blocks replacement.
- Default disabled; enable only development/test and loopback Supabase. Existing demo data receives no note backfill. Local notes persist until explicit operator cleanup; real consent/retention/incident policies remain deferred.
- Independent review's draft-loss finding required a failing browser case, then navigation/refresh discard prompts. Drafts remain in memory; browser Back, crashes and forced close are not durable recovery.

## Phase 9 decisions — approved 19 November 2026

- User selected feedback after a confirmed appointment's end time, without attendance/completion claims. One immutable 1–5 submission, optional 2,000 Unicode-point comment, explicit fictional-content acknowledgement; private to author/current complete admins, unavailable to counselors/public. Review acknowledgement is not complaint resolution.
- User selected dashboard, booking oversight and audited operational exception tracking; refunds/credits/forced booking changes remain deferred. Existing specialist tools continue owning their mutations.
- Twenty-row pages and full-population DB-time counts; no source issue/revenue/attendance inference from case closure. Cases use exact typed source FKs and derived linkage, deduplicate even when closed, reopen explicitly and retain restricted 1,000-code-point remark history.
- Optimistic versions and stable request identities allow ambiguous replay without duplicate events or overwriting newer work. Role/owner checks and content-free audits are independent of server authorization. New private tables/RPCs are service-only; note privileges are unchanged.
- Local fictional content only with a default-disabled gate. Feedback/remarks are restricted plaintext locally and do not reuse the note keyring. Production privacy/retention/clinical policy remains deferred.
- UI form resets preserve drafts after rejected submissions, unique labels support retained hidden Next routes, and pending saves lock editable fields after independent review identified a draft race. Browser Back/crash recovery is outside the memory-only draft design.
- Continue approved in-place implementation with independent review and no commit. Messaging/reporting are deferred; Phase 9.5 UI/UX polish precedes Phase 10.

## Phase 9.5 decisions — approved 19 November 2026

- User selected B (crisp white/blue and system sans-serif typography) from visual previews and approved applying it across existing public/customer/counselor/admin flows in place with independent review. Retain Counseling Platform name; no new feature, library, migration, provider, real-data policy or commit.
- Shared request-time verified-role navigation, one global sign-in/sign-out and accessible mobile disclosure replace inconsistent orientation; domain actions/guards remain intact. Validated selected-booking return paths are preserved in header authentication links.
- Reorganize CSS into semantic surfaces/type/control/status tokens rather than layering another conflicting theme. Current settings provide any homepage price/duration; omit unavailable facts and keep public core usable without the backend. No fictional preview data becomes app data.
- Keep page mains unique and focusable, measure header height for skip offsets, preserve focused links across responsive changes and respect reduced motion. Body/status/control contrast pairs are checked against actual token backgrounds.
- Global sign-out uses a cancelable content-free leave event so private note/feedback/case guards can retain drafts. Same-page fragments do not require discard. No form is remounted by opening/closing navigation; pending/version/request safeguards remain unchanged.
- Cross-browser/device/assistive-technology certification and production launch remain Phase10 work. This polish uses agent browser/keyboard/mobile/zoom acceptance and existing full workflow regressions.

## Brand and domain — 19 November 2026

User selected lowercase **littlehello** as the public brand and **littlehello.in** as the intended domain. Header/fallback, footer, page titles and payment checkout display name use the brand. Domain/DNS connection remains deployment work; internal identifiers and database names are unchanged.

## Phase 10A approved local staging implementation — 19 November 2026

User confirmed the dedicated Supabase project is empty and approved online simulated payments, fixed test OTPs initially, fictional workspaces and manual notification batches. They approved local implementation; no remote writes, source publication, deployment, paid plan or production launch are authorized. Use a generated protected Vercel Preview URL; littlehello.in is not purchased. Exact hosted project/origin and explicit environment gates preserve production restrictions; new account enrollment is disabled through both app policy and required hosted Auth settings. Three accounts are provisioned idempotently, then supported audited role/catalog/scheduling/payment flows populate the demo. Hosted eligibility/access settings remain rollout conditions; no claim Hobby is appropriate for commercial staging. See approved Phase10A design and handoff guide.
