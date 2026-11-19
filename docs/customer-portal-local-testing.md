# Phase 7: Customer portal local testing

The canonical customer page remains `http://127.0.0.1:3000/bookings`. Use the existing local phone OTP accounts and simulators; no real payments or messages are enabled. Native Chrome acceptance is agent-performed, not independent human sign-off.

## Views and actions

- **All:** own bookings, newest creation first. **Upcoming:** confirmed appointments that have not ended, soonest first; a started session is marked In progress.
- **Past:** ended confirmed appointments, latest start first. Past is a time classification, not evidence of attendance/completion. The original Confirmed status remains.
- **Holds:** active/expired checkout records, including any payment exception needing attention. An expired hold is not proof that no payment was captured; inspect its payment status.
- Views show20 records per page and preserve their filter in Previous/Next links. Invalid query values safely default. All ordering has an ID tie-breaker. New data can shift offset pages between requests.
- All times use one database reference per response; display is Asia/Kolkata. Existing database mutations revalidate eligibility, even if the page was open when a threshold passed.
- Upcoming/current confirmed cards show the authorized meeting link or pending-link message. Past cards omit Join Meet and the future-link promise.
- Past cards show Book Again only while the counselor remains published and eligible. Otherwise they link to the directory. Rebooking opens current availability; no state is created until a new hold is submitted. Current prices and fresh payment/meeting identities apply.
- Historical payment totals come only from stored snapshots. Legacy/synthetic confirmed bookings without payment orders show no invented paid amount.

## Manual walkthrough

1. Sign in as customer `+919000000001`, local OTP `123456`, without changing the profile.
2. Open Your bookings and switch All, Upcoming, Past and Holds. Refresh and browser Back should retain the URL-selected view. Compare the confirmed booking state with its separate Past/In progress label.
3. On a past eligible card select Book Again. Check that current public availability opens. Browse another counselor to create a separate future appointment if desired; this does not switch the counselor on an existing paid appointment.
4. For a new synthetic hold, select Holds and pay using Simulate captured payment. Confirmation should navigate to the exact booking using `/bookings?booking=<id>` even if it is older than20 newer records. The page displays the database-resolved page and a confirmation message.
5. Reschedule an eligible appointment once. The exact appointment remains visible after submission through the same owner-scoped locator. Existing>=24-hour and same-counselor rules remain enforced.
6. As another account, confirm that private history, meeting URLs and payment details are not visible. Use only disposable synthetic accounts for destructive fixture cleanup.
7. Use narrow/mobile view and keyboard Enter on filters/pagination. Focus and the active view should remain visible.

The optional booking locator is an untrusted UUID, not authorization. The database locates only owned bookings; foreign IDs cannot reveal their page or details. On ordinary All/Upcoming pagination, positions can shift after new records are created; locator resolution and the returned page use one response snapshot.

## Automated verification

```sh
pnpm test
pnpm test:integration
pnpm test:migrations
NOTIFICATION_MODE=simulator NOTIFICATION_APP_ORIGIN=http://127.0.0.1:3111 PLAYWRIGHT_PORT=3111 pnpm test:e2e --grep-invert 'local customer can sign in and is denied the admin area' --workers=1
NOTIFICATION_MODE=disabled PAYMENT_MODE=disabled NEXT_DIST_DIR=.next-phase7-build pnpm build
```

Pause the owned local notification poller before race-sensitive browser verification, then restore `pnpm notifications:local poll`. Browser fixtures generate accounts and remove only their own records. The older persistent-customer profile mutation test remains excluded. Database fixtures roll back; migration replay uses a disposable database. See PROGRESS for actual counts and outcomes.

Phase 8 counselor messaging/notes, Phase 9 feedback/admin operations and Phase 10 launch hardening remain future modules. External email/WhatsApp, real Razorpay testing, Google account/admission policy and other launch gates retain their existing limitations.
