# Phase 5: Payments design

Status: Approved by the user on 18 November 2026 and implemented locally. This is the approved design; current verification evidence and provider limitations are recorded in `PROGRESS.md`.

## Intent and scope

Extend the existing local booking flow with Razorpay Standard Checkout, verified payment-backed confirmation, durable payment history, and reconciliation. Preserve existing counselor, customer-overlap, buffer, authorization, and rescheduling protections. Deliver a local payment simulator, automated regression coverage, and instructions for testing against Razorpay Test Mode when credentials become available. No real payment collection or production connection is authorized.

## Decisions supplied by the user

- A successful late payment may confirm an expired hold if the slot is still free; otherwise it requires admin review.
- Failed attempts and closing checkout allow retries until the original hold expires. Retries never extend that deadline.
- Implement both a local simulator and Razorpay Test Mode. Razorpay credentials are not available yet.
- Quality test coverage and updates to the project Markdown records are required.

## Existing constraints

- Modular Next.js/Supabase monolith; payment behavior belongs in `src/modules/payments/` and routes compose it.
- Existing booking lifecycle is `held`, `expired`, `confirmed`. Booking status remains separate from gateway/payment status.
- The database serializes booking/schedule mutations with advisory lock `70324004` and exclusion constraints. Confirmation must join that protocol.
- Roles are canonical in `profiles.role`; browser-provided account, role, amount, and payment success claims are untrusted.
- Contact email is required but unverified. Do not change authentication or send notifications in Phase 5.
- Preserve the existing local database and demo accounts; use incremental migrations. Fresh migration replay uses an isolated disposable database.
- Real patient data, production services, automatic refunds, counselor payouts, tax invoices, Meet links, and notifications are outside this phase.

## Approaches considered

1. **Local simulator plus Razorpay Test Mode (selected by user).** Repeatable offline scenarios and a real provider adapter. Requires strict separation between simulator and Razorpay records and an explicit local-only gate.
2. **Razorpay Test Mode only.** Less simulator infrastructure, but needs credentials immediately and cannot deterministically exercise all races and delayed deliveries.

Keep a narrow provider interface rather than scattering mode checks through booking logic. Simulator events must exercise the same verification, persistence, and confirmation pipeline as provider events. Simulator confirmation cannot be enabled in a hosted environment or used for a Razorpay order.

## Proposed payment flow

1. Customer creates an existing database-validated booking hold and opens checkout from `/bookings`.
2. A trusted operation checks ownership, completed profile, active hold, and future appointment; snapshots the server-configured price (default 69900 paise, INR) and provider mode into a payment order record.
3. Create the provider order server-side, binding it to the durable internal order ID. Store its ID before returning public checkout details. Customer UI shows the exact total before payment.
4. Repeated checkout requests reuse the order. A durable claim/lease prevents concurrent external order creation. An ambiguous timeout becomes an uncertain order requiring reconciliation; never blindly create another external order after a potentially successful call. Provider idempotency is not assumed.
5. Standard Checkout handles payment entry. The application never receives card details. Client success is a prompt for verification, not evidence of settlement.
6. The callback verifies the signature using the stored order ID, then fetches authoritative provider state. Confirm only captured payment with paid order, exact order/payment linkage, correct currency and expected amount. Merely authorized payment remains pending. Test Mode will require automatic capture to be configured in Razorpay.
7. A verified webhook or reconciliation can finish the same operation even if the browser closes. Persist receipt and resulting state atomically; acknowledge success only after durable processing. Retryable provider/database failures return retryable responses and do not discard the event.
8. Retryable failures or closing checkout leave the booking held until its original expiry. An older failed event cannot override a captured payment or confirmed booking.
9. The customer can inspect payment status and request a bounded provider status refresh for their own order. Admins can inspect exceptions and run reconciliation.

## Late payment and concurrency rules

- Under the scheduling lock, take current database time and expire stale holds before checking conflicts.
- A captured payment can confirm its original booking only once. A different capture for an already paid booking becomes a duplicate-payment exception; it does not create another appointment or overwrite the original payment linkage.
- For an expired hold, recheck that the session has not started, both participants remain eligible, the counselor remains published, and the original session/buffer range is still offered by the current schedule.
- Do not reapply the minimum-notice window to an already purchased late payment, but require its original future session and duration/buffer to remain valid. Do not move the booking to a different time or counselor.
- Check both counselor overlap (including buffer) and customer overlap against active holds and confirmed bookings. A live replacement hold counts as a conflict. Confirm and record payment in one transaction; exclusion constraints remain the final backstop.
- If any condition fails, retain the captured payment and record an admin-review exception with a reason. Do not silently confirm, automatically refund, or promise a refund.
- A webhook replay, a callback/webhook race, reconciliation replay, and two late captures racing for the same slot must produce at most one confirmation and one confirmation audit event.
- A confirmed booking's subsequent one-time reschedule retains immutable payment linkage and original paid amount. Replayed events must not restore the original time or rerun initial slot validation against the rescheduled booking.

## Data model and security impact

Versioned migrations will add:

- A singleton pricing setting, default 69900 paise/INR, with audited admin-only updates; public reads expose current price only. Snapshot price on first checkout; subsequent retries reuse that amount even after a price change. Update directory/profile displays to use the same setting.
- Payment orders linked to bookings/customers: provider, immutable amount/currency, internal/external IDs, creation state/lease, timestamps, and reconciliation status. Unique external order identity scoped by provider. Prevent switching provider for an order that may have accepted payment.
- Payment transaction/attempt records: immutable provider payment identity and order linkage, observed state, captured amount, and confirmation/exception outcome. Unique provider payment IDs and unique successful booking linkage prevent duplicate confirmation. Preserve failed attempts without allowing them to downgrade success.
- Payment event receipts: provider/event identity, payload digest, processing status/outcome, timestamps, and non-sensitive references. Unique event identity, plus business-level payment uniqueness even when an event is replayed under another ID. Do not retain full webhook payloads or card/contact details in audit logs.
- Payment audit events with narrowly defined actions; extend booking audit only as necessary for verified confirmation.

Use customer-scoped checkout reservation RPCs and narrowly scoped service-only payment ingestion/confirmation RPCs. An explicitly server-only service client is required for webhook/reconciliation processing. It must never be exported from client modules or use `NEXT_PUBLIC_*` secrets. Explicitly revoke privileged function execution from public/anon/authenticated roles. Customer reads return only their own safe payment summaries; counselor reads cannot access payment data; admin reads are limited to payment operations. Raw writes remain denied.

Provider transport must use bounded timeouts, explicit error handling, and a fixed provider origin. Local test transport overrides are accepted only under explicit local simulator configuration. Credentials and HTTP bodies containing sensitive details are not logged.

## Planned surfaces

- Customer checkout and status on `/bookings`, showing held/pending/confirmed/expired/admin-review outcomes, original hold deadline, total, retry controls, and accessible errors.
- An admin payment operations page for reconciliation and exception visibility; no automatic refund buttons in this phase.
- Authenticated checkout/verification server actions or handlers; the exact split follows installed Next.js documentation.
- A raw-body Razorpay webhook route excluded from Supabase session-refresh interception; verify HMAC using the separate webhook secret before accepting event data. Apply request size limits, schema checks, supported-event filtering, and safe errors.
- An authenticated scheduled reconciliation endpoint with a separate server secret, bounded batches, overlap protection, durable cursor/leases as appropriate, and per-order failure isolation. Include a local manual command and deployment scheduler instructions; no claim of a hosted schedule running.
- Server-only payment configuration, `.env.example` placeholders, and local simulator commands. Live Razorpay keys must be rejected for this phase.

## Reconciliation behavior

Recover orders with uncertain creation using a provider-supported reference lookup, validating all identity and amount fields before attaching them. If lookup cannot prove an exact match, leave an explicit exception rather than create another charge opportunity. Revisit pending/captured-unapplied payments and missing webhook cases using provider fetch APIs; feed observations into the same idempotent database operation. Reconciliation must also detect multiple captures, unknown/mismatched orders, amount/currency mismatches, and stale authorized payments without claiming they succeeded. Bounded retries must not make old uncertain orders disappear permanently from operational visibility.

## Test strategy and acceptance evidence

Write meaningful failing tests before implementation and run unit, database, integration, and browser checks appropriate to each layer.

### Unit/provider tests

- Known signature vectors; wrong/missing/malformed signatures; raw-body alteration; stored order ID usage; webhook secret separation.
- Captured versus authorized/failed states; exact amount/currency/order/payment linkage; payload validation and size limits.
- Retry, timeout, uncertain external creation, and concurrent checkout handling without unsafe automatic re-creation.
- Mode isolation, rejection of live keys, and refusal to enable simulator outside local development.
- Reconciliation pagination/bounds, failure isolation, and failure-event non-regression.

### Database and concurrency tests

- Customer ownership, complete profile, correct role, expired-hold checkout denial, direct-write denial, and service-only RPC privileges.
- Immutable pricing/provider/linkage, admin-only price changes, existing-order price preservation.
- Duplicate event IDs and altered payload under reused ID; different event IDs for same capture; conflicting IDs across orders.
- Callback/webhook/reconciliation races produce one capture outcome and one booking confirmation audit.
- Late capture with free slot succeeds; replacement active hold, customer conflict, changed/blocked schedule, unpublished counselor, changed participant role, and started session result in admin review.
- Two concurrent late payments competing for a slot, and payment confirmation racing schedule changes/hold creation, preserve all overlap guarantees.
- Failed events after success cannot downgrade it. Multiple captured payments on one booking are tracked for admin review.
- Existing confirmed rescheduling preserves its original payment and remains idempotent under later events.
- Isolated fresh-database migration replay and regression suites for Phases 1–4.

### Browser/integration tests

- Customer selects a slot, holds it, pays through local simulator, sees pending then confirmed state, and retains confirmation after refresh.
- Failed attempt, close/reopen checkout without deadline extension, repeat click/order reuse, delayed callback, missing webhook recovered by reconciliation.
- Invalid signature cannot confirm; duplicate/out-of-order deliveries cannot duplicate bookings; another customer cannot read/pay the order.
- Admin exception visibility/reconciliation authorization and mobile layout/accessibility smoke checks.
- Use temporary synthetic accounts and records and clean them up; preserve the user's demo accounts and configuration.

### Required commands and reporting

Run pinned-version lint, typecheck, unit tests, database/integration tests, relevant browser suites, formatting/diff checks, and a production build. Correct the malformed existing CI database-reset step and include Phase 5 verification there. Record exact commands/results, counts, environment limitations, and any skipped real-provider checks in `PROGRESS.md`; never equate simulator success with Razorpay end-to-end verification.

## Local testing guidance to deliver

1. Start local Supabase and application; document the existing Rancher Desktop socket/forwarding caveats.
2. Start/enable the explicitly local simulator. Set up temporary counselor availability and customer profile; demonstrate success, failure, close/retry, expiry, late success/free versus occupied slot, duplicate events, and reconciliation.
3. Provide scripts/commands for signed webhook replay and reconciliation, with expected database/UI outcomes and no exposed secrets.
4. When Test Mode keys exist, configure the server-only key ID/secret and separate webhook secret in ignored local configuration, enable automatic capture in the Razorpay test dashboard, and use only official test payment credentials.
5. Use a Razorpay-supported public webhook tunnel or staging endpoint. Current provider guidance requires a public URL and notes that some tunnel domains are blocked; verify the allowed approach when actually setting it up. Do not expose Supabase administration ports.
6. Test provider checkout, callback, webhook, webhook replay, and reconciliation against Test Mode. This remains explicitly unverified until credentials and provider access are available.

References checked for the design: [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation/testing](https://razorpay.com/docs/webhooks/validate-test/). Recheck exact API contracts during implementation, especially external order recovery and test instruments.

## Documentation and completion

Update `README.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DEVELOPMENT.md`, `DECISIONS.md`, `PROGRESS.md`, relevant Supabase documentation, `.env.example`, and a dedicated payment testing guide. Do not modify `PROJECT_REQUIREMENTS.txt`. Clearly distinguish implemented simulator behavior, implemented but unverified Razorpay integration, and deferred live launch work. No later phase or real payment collection is included.

## Builder discretion and remaining approval

The builder may settle exact file names, internal type names, indexed query shapes, the simulator's durable storage mechanism, bounded batch sizes, and UI layout consistent with the existing application. Prefer small server/provider interfaces and reuse existing locking/audit conventions. Do not add unrelated features or silently change the payment policies above.

The admin price setting and late-payment eligibility details above are proposed implementation choices for review, not statements of a separate user decision. The user approved this design and instructed implementation. See `PROGRESS.md` and the local payment testing guide for final delivery evidence.
