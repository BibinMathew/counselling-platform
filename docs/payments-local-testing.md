# Phase 5: local payment setup and testing

For the approved hosted synthetic Preview, use [staging access and deployment](staging-deployment.md). The fixture commands below remain local-only; never point them at the hosted project.

The implementation includes a local simulator and a Razorpay Test Mode adapter. The simulator is configured in this workspace and collects no money. Real Razorpay checkout/webhook delivery has not been verified because Test Mode credentials are not available. Live keys are rejected. Meet links and notifications belong to Phase 6.

## 1. Start the local environment

From `counselling-platform`, use Node `26.13.1` and pnpm `12.21.0`:

```sh
fnm use 26.13.1
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1
```

Open <http://127.0.0.1:3000>. This workspace already has local Supabase, migrations, and ignored `.env.local` settings. Do not overwrite that file with `.env.example`.

For a new local installation, start Docker/Supabase using the project README, apply `supabase migration up`, then put these values in ignored `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
SUPABASE_SERVICE_ROLE_KEY=<local service-role key; server only>
PAYMENT_MODE=simulator
PAYMENT_SIMULATOR_SECRET=<random value of at least 32 characters>
PAYMENT_RECONCILE_SECRET=<different random value of at least 32 characters>
LOCAL_SUPABASE_RANCHER=1
```

Use your local Supabase status/configuration for the local keys; do not use a hosted project's key. Generate each random secret separately with `openssl rand -hex 32`. Never commit `.env.local` or put service/provider secrets in `NEXT_PUBLIC_*`. The locally generated operator key used in this workspace expires after 30 days; replace it with a valid local service-role key when needed.

The simulator requires `NODE_ENV=development` or `test` and an HTTP loopback Supabase URL. `next dev` supplies development mode. It intentionally refuses to run when serving a production build. Default `PAYMENT_MODE=disabled` allows the rest of the application without payment credentials.

### Rancher Desktop notes

Rancher Desktop is the Docker installation on this Mac. Its engine is available inside the VM even if the host socket/port forward stops responding. The database test scripts support `LOCAL_SUPABASE_RANCHER=1` and use `rdctl shell` directly. Normal Docker Desktop users should leave that flag unset or `0`.

Check the app-facing API:

```sh
curl --fail http://127.0.0.1:54321/auth/v1/health
rdctl shell -- docker ps --filter name=supabase
```

If containers are healthy but localhost fails, restore Rancher Desktop forwarding before testing payment/login. This session uses a background SSH forward for port `54321` through Rancher Desktop's existing VM connection. It must stay running along with the app. Do not restart Docker while unrelated local workloads are running without considering them. Optional Studio/logging containers are not required by the app and remain stopped in this workspace.

## 2. Prepare a bookable session

1. Sign in as admin `+919000000003`, OTP `345678`. Complete contact email if prompted.
2. Open `/admin/counselors`. Use an existing published demo counselor and open their availability.
3. Add a future date opening, for example two days ahead from 10:00 to 14:00. Existing buffer and booking-window rules still apply. Avoid changing global settings during a pending booking.
4. Sign out. Sign in as customer `+919000000001`, OTP `123456`, and complete contact email if needed.
5. Open `/counselors`, select that counselor/time, and click **Hold this time**.
6. On `/bookings`, note the original hold deadline and click **Pay ₹699.00** (or the current admin-set price).

The new demo counselors with phone endings `004`–`006` are catalog fixtures. Fixed SMS OTPs are configured only for `001`–`003`; use admin scheduling for the other demo profiles. No real SMS is sent.

## 3. Manual simulator scenarios

| Action                                                            | Expected result                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Simulate captured payment                                         | Verified appointment becomes **Confirmed**; refresh preserves it.          |
| Simulate failed attempt                                           | Failure is recorded; retry is allowed until the original deadline.         |
| Close checkout and reopen                                         | Same order and original price/deadline are reused.                         |
| Simulate authorized payment                                       | Remains pending; authorization alone never confirms.                       |
| Capture without delivery, then close checkout and Recheck payment | Provider capture is recovered and confirms exactly once.                   |
| Change session price as admin after starting checkout             | Existing checkout retains its snapshot; a new checkout uses the new price. |
| Sign in as a different customer                                   | Cannot see or pay someone else's booking/order.                            |

Rechecks are limited to one per order per five seconds. If a request was just made, wait briefly before rechecking. Failed attempts and closing checkout do not extend the hold. A captured payment with a conflict is displayed for admin review; do not pay again. There are no automatic refunds.

## 4. Late payments, event replay, and reconciliation

Find a checkout's internal order UUID on `/admin/payments`. Use only a synthetic local checkout for these tools:

```sh
# Expire a held local simulated checkout; does not change a confirmed appointment.
pnpm payments:local expire ORDER_UUID

# Store a captured provider payment without delivering its webhook/callback.
pnpm payments:local capture ORDER_UUID

# Deliver a signed event through the actual webhook endpoint.
pnpm payments:local replay ORDER_UUID

# Same event identity twice must have no duplicate effect.
PAYMENT_REPLAY_EVENT_ID=manual-replay-001 pnpm payments:local replay ORDER_UUID
PAYMENT_REPLAY_EVENT_ID=manual-replay-001 pnpm payments:local replay ORDER_UUID

# Run one authenticated reconciliation batch through the application endpoint.
pnpm payments:local reconcile
```

Use a new event ID when replaying a different body. Reusing an ID for changed content is rejected. All CLI payment tools require simulator mode plus localhost application/Supabase URLs. `LOCAL_APP_URL` can select a different local app port.

For late success with a free slot: start checkout, expire its hold, capture, then replay. Its original future slot must still be published/offered and free for both counselor and customer; then it confirms. The minimum-notice cutoff is not reapplied to an already purchased late payment, but a session that has started never confirms.

For late success with a conflict: expire an original checkout, create a replacement hold for another synthetic customer on that slot, then capture/replay the original. The original becomes an admin-review payment and cannot displace the replacement hold. Once captured payment is marked for admin review, later replay/reconciliation does not silently clear it even if the conflict disappears; manual investigation is required. The automated concurrency test exercises two simultaneous late captures without requiring more fixed OTP accounts.

On `/admin/payments`, **Reconcile payments** scans up to 20 eligible orders. A one-minute claim prevents overlapping workers from polling the same order repeatedly. The oldest unchecked orders are considered first; failures stay visible/retryable. Old unresolved exceptions have their own list, and unmatched provider event references are shown separately. There is no hosted scheduler configured. A future deployment must schedule an authenticated `POST /api/payments/reconcile` using `Authorization: Bearer <PAYMENT_RECONCILE_SECRET>` from a trusted scheduler, never browser code.

An external order-creation timeout is deliberately treated as uncertain: retry/reconcile looks up its durable receipt. It does not blindly create another provider order. Zero or multiple matches require further investigation.

## 5. Automated checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:migrations
pnpm exec playwright install chromium
PLAYWRIGHT_PORT=3110 pnpm test:e2e --grep-invert 'local customer can sign in and is denied the admin area' --workers=1
PAYMENT_MODE=disabled NEXT_DIST_DIR=.next-payment-build pnpm build
pnpm format:check
git diff --check
```

The safe browser selection preserves the existing demo customer's name/contact settings. The older excluded OTP customer test intentionally changes its profile; run it only if that is acceptable. Payment/browser tests create temporary synthetic accounts and remove their own fixtures. PostgreSQL tests run inside rollback transactions. Migration replay creates an isolated randomly named database using a schema-only Supabase Auth/extensions baseline, applies every application migration, then drops only that disposable database. It does not reset the application database.

The payment browser test covers failed retry, immutable hold expiry, capture and refresh persistence, cross-customer access denial, invalid signature, missing-delivery recovery, signed event replay, mobile overflow, two concurrent late captures, repeated concurrent observations, and admin exception/reconciliation access. Database tests additionally exercise privilege denial, immutable provider/price/linkage, amount/currency mismatches, unpublished/changed participants, schedule changes, started sessions, and rescheduling after payment.

## 6. Enable Razorpay Test Mode later

1. Create/sign in to your Razorpay account and generate **Test Mode** API keys.
2. Put the Test Mode key ID, API secret and a separate webhook secret in ignored local configuration:

   ```dotenv
   PAYMENT_MODE=razorpay
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=<separate random secret of at least 16 characters>
   ```

3. Configure automatic capture in the test dashboard. The app requires `captured` payment and `paid` order state, not merely `authorized`.
4. Use a **new** booking hold when switching mode. Existing checkout records keep their provider/price and cannot be converted between simulator and Razorpay.
5. Set the webhook destination to `https://YOUR_SUPPORTED_TEST_ENDPOINT/api/payments/webhook`, with the same separate webhook secret. Subscribe to `payment.captured`, `payment.failed`, `payment.authorized`, and `order.paid`.
6. Use only test payment instruments from Razorpay's current official instructions. Never enter real card information into simulator/testing exercises.
7. Verify provider checkout, callback, delivery after closing the browser, duplicate delivery, and reconciliation. Check database/booking outcomes against the provider dashboard.

Razorpay requires a public endpoint for webhook delivery, and currently documents restrictions on several tunnel domains. Its documentation suggests a supported tunnel such as zrok; verify the allowed domain when setting it up. Expose only the webhook route through a restricted reverse proxy/tunnel or use isolated staging; do not expose Supabase administration ports or real counseling data. Do not enable the simulator on a publicly exposed development app.

Sources: [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation and local testing](https://razorpay.com/docs/webhooks/validate-test/), [order receipt lookup](https://github.com/razorpay/markdown-docs/blob/master/api/orders/fetch-all.md).

Provider Test Mode verification, remote CI, production secrets, live collection, refunds/payouts/tax policy, and launch/security gates are separate from verified local simulation.
