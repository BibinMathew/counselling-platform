# Architecture

## Status

**Implemented:** Phase 0 foundation and Phase 1 Identity & Roles. Phone OTP sign-in uses Supabase Auth; a server-created profile has one canonical database role. A profile without contact email is gated after phone verification to a one-time email-completion page. The email is stored as unverified contact data and is not an authentication factor. Profile and role routes use server-side authorization, the Next.js 16 Proxy refreshes/verifies Supabase claims, and RLS protects profile access and updates. Customer, counselor, and admin routes are role-guarded; the admin route can grant roles through an audited database operation.

**Phase 2:** The catalog module owns admin-managed counselor profiles and public directory/profile pages. Published entries are shown only while the linked account has the counselor role. A public database view exposes catalog fields without account IDs; admin mutations are protected by server guards and RLS and recorded in a catalog audit table. Photos use admin-approved HTTPS links; current pricing comes from `payment_settings`, defaulting to ₹699.

**Phase 3:** The availability module provides counselor/admin calendars, weekly hours, date-specific openings and blocks, and admin scheduling settings. PostgreSQL generates non-overlapping candidate slots from merged openings, omits blocks, applies the notice/advance window, and returns UTC timestamps for display in Asia/Kolkata. Public slot access is limited to published profiles with a current counselor role. Server actions and database functions verify the actor; schedule changes are audited.

**Phase 4:** The booking module preserves a selected slot through phone login and email completion, then creates a pending hold after server and database validation. PostgreSQL exclusion constraints prevent overlapping counselor ranges including buffers and overlapping customer session ranges. A transaction-level lock serializes hold, reschedule, and availability changes; participant rows are rechecked and locked. Customer-owned confirmed appointments can be rescheduled once with at least 24 hours' notice. Phase 5 now supplies verified payment-backed confirmation through a service-only database operation.

**Planned:** Notifications/Meet workflow, full customer portal, counselor workspace, messaging, notes, feedback, and broader administration remain unimplemented.

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
6. Meet and notifications
7. Customer portal
8. Counselor workspace
9. Feedback and administration
10. Hardening and launch

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
