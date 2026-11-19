# Architecture

## Status

**Implemented:** Phase 0 foundation and Phase 1 Identity & Roles. Phone OTP sign-in uses Supabase Auth; a server-created profile has one canonical database role. A profile without contact email is gated after phone verification to a one-time email-completion page. The email is stored as unverified contact data and is not an authentication factor. Profile and role routes use server-side authorization, the Next.js 16 Proxy refreshes/verifies Supabase claims, and RLS protects profile access and updates. Customer, counselor, and admin routes are role-guarded; the admin route can grant roles through an audited database operation.

**Phase 2:** The catalog module owns admin-managed counselor profiles and public directory/profile pages. Published entries are shown only while the linked account has the counselor role. A public database view exposes catalog fields without account IDs; admin mutations are protected by server guards and RLS and recorded in a catalog audit table. Photos use admin-approved HTTPS links; current pricing comes from `payment_settings`, defaulting to ₹699.

**Phase 3:** The availability module provides counselor/admin calendars, weekly hours, date-specific openings and blocks, and admin scheduling settings. PostgreSQL generates non-overlapping candidate slots from merged openings, omits blocks, applies the notice/advance window, and returns UTC timestamps for display in Asia/Kolkata. Public slot access is limited to published profiles with a current counselor role. Server actions and database functions verify the actor; schedule changes are audited.

**Phase 4:** The booking module preserves a selected slot through phone login and email completion, then creates a pending hold after server and database validation. PostgreSQL exclusion constraints prevent overlapping counselor ranges including buffers and overlapping customer session ranges. A transaction-level lock serializes hold, reschedule, and availability changes; participant rows are rechecked and locked. Customer-owned confirmed appointments can be rescheduled once with at least 24 hours' notice. Phase 5 now supplies verified payment-backed confirmation through a service-only database operation.

**Phase 6:** Manual Meet links, participant access, transactional notification jobs, and local simulated email/WhatsApp delivery are implemented.

**Phase 7:** Customer-owned paginated booking portal and rebooking are implemented locally.

**Phase 8:** Assigned counselor workspace and encrypted private notes are implemented for local synthetic content only. Messaging, message reporting and external notification delivery remain deferred. Phase 9 adds local private feedback and operational administration as described below.

## Boundaries

- `src/app/` owns route composition and layouts; it must not become the home for domain rules.
- `src/modules/<domain>/` will own a module's behavior and domain-specific UI when that module is approved.
- `src/lib/` contains shared, domain-neutral infrastructure. Supabase browser and server client factories are separate.
- Browser code may use only the public Supabase URL and publishable key. Server-side authorization and database RLS both protect privileged data and mutations.
- The canonical one-role-per-account field lives in `profiles.role`; user metadata and profile update APIs cannot change it. Role changes use a server guard plus a database RPC that checks the acting admin and writes an audit event.
- The first admin is bootstrapped only by a restricted operator-side database operation after phone authentication. Counselor role grants require an opaque verification reference. A server-only service client is used narrowly for payment provider operations; no production credentials are present.
- Supabase browser and server clients remain separate. The Proxy refreshes Supabase cookies and verifies claims; it is not the final authorization layer. Protected pages and actions read the profile role server-side, and database RLS applies independently.
- Phone OTP is the only login factor. Email is collected once after the first successful phone verification, remains unverified, and is not used to sign in or recover an account in this phase.
- Database schema is managed through versioned migrations. Phase 1 adds profiles, role-audit events, and the one-time contact-email operation.

See [ADR 0001](docs/architecture/ADR-0001-modular-monolith.md) and [audit conventions](docs/architecture/audit-conventions.md) for the recorded decisions and constraints.

## Planned Module Boundaries

The sequence below follows the requirements and is not a claim that the modules exist:

1. Identity and roles (implemented)
2. Counselor catalog (implemented locally)
3. Availability (implemented locally)
4. Bookings (implemented locally)
5. Payments (implemented locally with simulator; Razorpay Test Mode awaiting credentials)
6. Meet and notifications (implemented locally; external delivery deferred)
7. Customer portal (implemented locally)
8. Counselor workspace and private notes (implemented locally; messaging/reporting deferred)
9. Feedback and administration (local private feedback, dashboard and case tracking)

Phase 9.5 is UI/UX polish (implemented locally). Phase 10A staging support is implemented locally; hosted synthetic staging is deployed; production hardening/launch remain pending.

If multiple simultaneous roles are needed later, replace the single enum column with a `profile_roles(profile_id, role)` membership table, backfill each current role, update server guards and RLS helpers to check membership, and migrate role RPCs/tests before removing `profiles.role`. This is a future migration, not current behavior.

Do not split into services unless later measured needs justify that operational cost.

## Cross-Cutting Risks

- Holds and rescheduling use transactional locking and exclusion constraints; Phase 5 joins the same lock for payment confirmation, late payment handling, and idempotency. The single scheduling lock favors correctness for the initial roster and should be load-tested before scaling.
- A displayed time is not a reservation until a hold succeeds. Active holds and future confirmed appointments prevent conflicting availability changes. Expired holds disappear immediately from public availability; their stored status is transitioned lazily during a later successful booking operation.
- Counseling notes, messages, and booking history require strict authorization, data minimization, and defined retention policies before storing real data.
- The current 18+ self-attestation is a temporary UI/server-action gate, not age verification. Local Auth accepts only fixed test numbers; no production auth or booking is enabled. Resolve age assurance and guardian policy before launch.
- Since email is intentionally unverified, do not send appointment details or other sensitive information to it without a later approved email-verification policy.
- The counselor verification reference records an admin attestation; a full credential review workflow and policy remain future work. Publishing availability is not approval to provide sessions; real paid appointments are not enabled.
- External photo hosts receive visitor requests; approve hosts and privacy implications before production. A published catalog profile is not proof of credential verification or approval to provide sessions.
- Production SMS, crisis response, exception refunds, messaging boundaries, and privacy/legal review remain unresolved launch gates. See `DECISIONS.md` and `PROJECT_REQUIREMENTS.txt`.

## Phase 5 payment boundary

`src/modules/payments/` owns provider transport, HMAC verification, checkout orchestration, simulator state, reconciliation, and customer/admin controls. Next.js route handlers compose the module. Checkout derives identity from the session and price from PostgreSQL, reserving one immutable order per booking. A single creation claim prevents double clicks from creating parallel provider orders. Timeouts remain uncertain; recovery looks up the durable receipt before attaching an existing provider order. It never blindly retries creation.

Callback, signed raw-body webhook, and provider reconciliation all fetch canonical provider order/payment state, then invoke `apply_payment_observation`. The database serializes confirmation with booking/scheduling, protects provider/payment identities, and records event identity plus digest. Captured payment with a paid, matching order can confirm; mere authorization cannot. Late capture rechecks participants, publication, original schedule/range, future start, and counselor/customer conflicts. A confirmed/rescheduled booking is never moved by an event replay.

The simulator stores synthetic external state separately in `payment_simulator_orders`, inaccessible to browser roles. It is gated to development/test and loopback Supabase. It cannot confirm a Razorpay order. Server-only secrets are parsed only where needed; disabled payment mode does not require provider credentials. Webhook/scheduled-reconciliation routes bypass session-refresh Proxy and enforce their own signature/secret boundary. Customer POST handlers require same-origin plus an authenticated complete customer profile.

Customer refreshes are atomically limited to one per order per five seconds. Reconciliation claims up to 20 least-recently-checked orders and skips orders checked within a minute; per-order failures do not abort the batch. Admins see old unresolved exceptions separately from recent orders and can inspect unmatched event references. A deployment must schedule the authenticated POST endpoint; no hosted scheduler is running.

Captured payments already marked for admin review retain that outcome on every replay; no later disappearance of a conflict silently resolves the exception. Unmatched signed event receipts can become linked only after canonical order recovery with the same digest; true identity conflicts remain rejected.

## Phase 6: Meetings and notification outbox

`src/modules/meetings/` owns canonical manual Meet assignment, audited revision history and participant-authorized reads. `src/modules/notifications/` owns local configuration, batch dispatch, provider boundary and admin controls. `MeetingProvider` describes the manual assignment boundary; Google Calendar/OAuth is deferred. The existing booking scheduling lock serializes meeting changes and simulated dispatch with confirmation/rescheduling.

A booking trigger transactionally creates semantic-keyed notification jobs; schedule revisions supersede unfinished old work while preserving delivered history. Service-only RPCs claim bounded, expiring leases and atomically revalidate eligibility, write idempotent synthetic receipts and complete jobs. Per-job errors are isolated; retries are bounded. Reference-only jobs and separate private synthetic previews avoid contact/message data in audit logs. User-facing queries and actions check current canonical roles; RPCs/RLS enforce their own boundaries.

The secret-authenticated worker endpoint bypasses session refresh and trusts no body-controlled recipient, price or app origin. Local simulation requires development/test plus loopback origins; disabled mode pauses processing and previews. No hosted scheduler, external transport or real-provider exactly-once promise exists.

## Phase 7: Customer portal read boundary

`src/modules/customer-portal/` owns query validation, read-model parsing, authenticated access and portal components. `/bookings` composes it; existing mutation RPCs remain authoritative. A security-definer customer-only read function joins only actor-owned bookings/orders and booking-linked payment/meeting data. One stable database timestamp drives all expiry, past/current and reschedule flags. It returns at most20 summaries and a lookahead indicator. No service-role access or new product table is introduced.

An optional validated booking UUID resolves its owner-scoped rank and page within the same read snapshot. Confirmation from Holds and successful rescheduling use that locator to avoid losing old bookings behind newer history. Foreign locators reveal no foreign position/details. Offset navigation otherwise permits page membership to shift after new bookings.

## Phase 8 boundaries

`counselor-workspace` owns authenticated assigned-session reads; `session-notes` owns encrypted note persistence and its editor. Shared `lib/private-content` supplies server-only key configuration and AES-256-GCM utilities. Route files compose the workspace/detail UI. No customer/admin note surface or conversation module is added.

Authenticated workspace RPCs return bounded safe summaries, while private read/save RPCs are service-only and independently recheck complete canonical counselor role and exact confirmed-booking assignment. The server derives actor identity from the verified session. Save reads/decrypts existing ciphertext before replacement; version checks, request receipts and audits are atomic under the established booking lock order. AAD binds record/booking/owner/version. Retained-key HMAC candidates preserve retry identity through rotation. Unreadable ciphertext fails closed.

The default-disabled gate permits development/test plus loopback Supabase only. Content-free audits record authorized reads and saves. Drafts remain in memory through failures/conflicts; editor links, refresh and explicit reload prompt before discard. Browser Back/crashes are not durable draft recovery. Production privacy/retention/consent policies remain deferred. See [local workspace guide](docs/workspace-notes-local-testing.md).

## Phase 9 boundaries

`feedback` owns immutable customer submissions/receipts and private admin review. `admin-operations` owns full-population overview counts, safe paginated booking oversight and source-linked cases/events/receipts. The customer portal gets a separately owner-checked batch of <=20 feedback statuses without changing its database contract. Existing Meet/reconciliation/notification actions retain ownership of their mutations.

Server entry points derive verified actors and enforce default-disabled `FEEDBACK_ADMIN_MODE`; the shared server-only local-operation adapter uses service credentials and validates returned schemas. Every new SQL RPC independently checks complete canonical role and ownership/state. Raw new tables/RPCs deny browser roles; no note privilege is broadened.

Feedback is unique and immutable per ended confirmed booking. Case closure only tracks administration: source FKs and derived linkage are validated, source identity is immutable, versions and stable request receipts prevent concurrent/replayed overwrites, and live source facts remain independent of case history. Actor/booking checks follow the established scheduling lock order. Remarks are restricted history, separate from content-free privileged audits.

Feedback/comments and case remarks are restricted plaintext for local fictional content; Phase 8 encrypted notes retain their own keys. Drafts remain in memory with discard prompts, form reset prevention and fields locked during pending saves. No browser Back/crash recovery or production retention policy is claimed.

## Phase 9.5 presentation boundary

The root layout streams `SessionNavigation` through Suspense independently of page content. It reads the existing verified profile and passes only role/completion/feature-gate presentation data to client `AppNavigation`. Pure navigation models choose segment-safe destinations/current links; client pathname/query state never authorizes a request. The root layout owns the sole stable main/skip target; cached route containers are presentational. The shared header/sidebar does not remount route forms. Existing server/database guards still enforce every operation.

`globals.css` now organizes semantic tokens, native controls, cards, public/identity/workspace and responsive styles in one system. `components/ui` supplies presentation only; home facts reuse separately fallible existing settings and portrait fallback handles failed public catalog images. No database/dependency/provider/asset-host change.

Mobile nonmodal navigation transfers focus before hiding links and supports Escape; measured header height supplies skip/sidebar offsets. Content-free cancelable leave events extend existing memory-only draft guards to global sign-out. Same-page fragments are distinguished from leaving a route. No private content enters global chrome/storage/telemetry. [Manual checks and limits](docs/ui-polish-local-testing.md).

## Phase 10A staging boundary

`src/lib/deployment.ts` validates explicit APP_ENV=staging, Vercel Preview identity, the exact approved Supabase project, exact HTTPS preview origin and user/phone allowlists. Feature readers reuse that boundary with explicit staging private modes; local behavior is retained and production simulation stays refused. Server clients validate the target before credentials are used. Proxy and payment/notification API routes reject other staging request origins. Profile access rejects uninvited sessions; OTP requests cannot create staging accounts. Hosted Auth signup restrictions and platform preview protection must additionally be configured and directly tested; application policy alone does not secure Supabase APIs.

StagingNotice renders at request time without serializing configuration. Service-only synthetic_staging_settings stores one exact preview origin for notification receipts; it is empty by default. Domain booking/payment/notes/case rules and RLS are unchanged. `scripts/staging-tools.mjs` provides read-only schema inventory, explicitly confirmed account provisioning/first-admin/origin setup and bounded manual batches. No autonomous hosted scheduler runs. The authorized staging rollout uses a protected Preview and manual bounded batches.

Phase10A acceptance additionally found the legacy root proxy was not discovered by installed Next with src/app. It now lives at src/proxy.ts; deployment denial runs before session refresh, while public pages still work without backend configuration. Server readers and RLS remain the final authorization boundaries.

Hosted staging verification: all-deployment Vercel authentication protects the canonical branch alias; seventeen encrypted branch-scoped Preview variables provide isolated staging credentials. User-approved operator automation and seven-day tester links supplement, rather than replace, app identity and RLS. Vercel requires a first Production-classified record; the retained record is intentionally failed and contains no app code/credentials. The application itself runs as verified Preview. Main remains the production tracking branch and has not been merged/promoted. Recovery was verified through an encrypted logical snapshot restored into a disposable local database, including private-note decryption.
