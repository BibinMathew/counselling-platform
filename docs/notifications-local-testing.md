# Phase 6: Meet and local notifications

Phase 6 uses manual Google Meet links and a local durable notification simulator. No email, WhatsApp or Google API call is made. A simulated delivery is a database receipt, not evidence that a person received anything. Customer email remains unverified; external delivery policies and providers remain launch work.

## Start and inspect

Use Node `26.13.1`, pnpm `12.21.0`, the existing local Supabase and ignored `.env.local`. Preserve existing settings and demo data. Apply new migrations incrementally; never reset the demo database. Rancher Desktop connection/forwarding guidance is in [payment local testing](payments-local-testing.md).

Configure these additional server-only values in `.env.local`:

```dotenv
NOTIFICATION_MODE=simulator
NOTIFICATION_APP_ORIGIN=http://127.0.0.1:3000
NOTIFICATION_WORKER_SECRET=<random secret of at least 32 characters>
```

Generate the secret locally with `openssl rand -hex 32`; never commit it. Simulation requires a development/test runtime, HTTP loopback Supabase, and an HTTP loopback app origin. Configuration defaults to `disabled`; disabled mode pauses delivery and hides synthetic previews. A production build must use `NOTIFICATION_MODE=disabled` and `PAYMENT_MODE=disabled`.

```sh
pnpm dev --hostname 127.0.0.1
pnpm notifications:local run
pnpm notifications:local poll
```

`run` processes one batch of at most 20 due jobs. `poll` runs a nonoverlapping batch every five seconds; stop with Ctrl-C. The runner uses the local secret-authenticated `POST /api/notifications/dispatch` endpoint. It refuses hosted app URLs and redirects, and has a 15-second request timeout. The worker must be restarted after a machine/app restart. No hosted cron is configured. Admins can also run a batch from the Notifications page.

## Manual meeting workflow

1. Confirm a future synthetic booking using the Phase 5 payment simulator.
2. Sign in as the local admin and open `/admin/appointments`.
3. The missing-link queue lists future confirmed bookings until a link is saved. Create a unique Meet link manually using an authorized Google account outside this app; account ownership/access policy is still an operational launch decision.
4. Save a canonical `https://meet.google.com/abc-defg-hij` URL. Query strings, fragments, credentials, alternate hosts and malformed codes are rejected. The app does not contact Google or verify that the supplied code is an active meeting.
5. Open `/bookings` as its customer or `/counselor` as its assigned counselor to see Join Meet. Unassigned accounts cannot read the URL. Links open with no referrer.

Confirmation stays confirmed while a link is missing; the customer sees “Meeting link will follow.” Assigning/replacing a link adds a customer link-update job. Re-saving the current URL does nothing. A URL used on another booking, including a previous URL that was replaced, cannot be reused. Rescheduling retains the current unique link.

## Synthetic notification behavior

First confirmation queues customer email, counselor WhatsApp, and future 24-hour/1-hour customer reminders. All are recorded transactionally with the booking transition. Payment retries/replays cannot duplicate them. Holds and captured-payment exceptions create none. The migration backfills only future confirmed bookings.

Already-reached reminder thresholds are skipped at booking/reschedule time. A booking 70 minutes away gets only the 1-hour reminder. An already scheduled reminder may be delivered late while the appointment remains future; it is skipped after the session starts. UTC storage and database clock determine timing; UI and message time is Asia/Kolkata.

One-time rescheduling supersedes unfinished old-schedule work, queues customer/counselor updates, and recreates eligible reminders for the new time. Delivered receipts remain unchanged. Leased old work cannot deliver after the reschedule transaction commits. Link changes supersede unfinished older link updates; reminder messages always use the current appointment details.

All message subjects are generic. Synthetic email bodies contain time and an authenticated `/bookings` link; counselor WhatsApp bodies contain time and `/counselor`, without customer identity or a Meet URL. Destinations are synthetic profile references, not copied email addresses or phone numbers. Rendered previews are stored separately from reference-only jobs; browser database roles cannot read receipts directly. Admin preview access passes server role and local simulation gates.

## Failure and recovery

Open `/admin/notifications` to inspect jobs and synthetic previews:

- `queued`: awaiting its due time; `processing`: leased for up to two minutes.
- `delivered`: synthetic receipt persisted atomically with completion.
- `retrying`: transient simulated failure; retry delays are 1, 5, 15 and 60 minutes.
- `failed`: five attempts exhausted; needs admin attention.
- `skipped`: appointment started or recipient/booking no longer eligible.
- `superseded`: a schedule/link revision replaced this unfinished work.

Select **Fail next attempt** on a pending job, then run a batch to see retry behavior. **Retry notification** brings eligible failed/retrying work forward and resets its attempt budget, with an audit event. It reuses the same job identity. Delivered/superseded jobs cannot be manually replayed. Due times remain respected.

Expired leases can be reclaimed after interruption. A stale completion token cannot deliver; duplicate simulator completion reuses the same receipt. Concurrent workers claim disjoint jobs. A failure in one job does not abort the batch. Missing meeting links remain a separate persistent admin queue and never change payment state.

## Verification

```sh
pnpm test
pnpm test:integration
pnpm test:migrations
NOTIFICATION_MODE=simulator NOTIFICATION_APP_ORIGIN=http://127.0.0.1:3111 PLAYWRIGHT_PORT=3111 pnpm test:e2e --grep-invert 'local customer can sign in and is denied the admin area' --workers=1
NOTIFICATION_MODE=disabled PAYMENT_MODE=disabled NEXT_DIST_DIR=.next-phase6-build pnpm build
```

Use only temporary synthetic accounts; the browser fixture removes its own records. The older persistent-customer OTP test is excluded to preserve demo profile data. Database tests roll back; migration replay uses a randomly named disposable database. See `PROGRESS.md` for actual results and limits. Real delivery, Google Calendar integration, hosted scheduling, WhatsApp consent/templates and an email-verification/delivery policy are not verified or configured by this phase.
