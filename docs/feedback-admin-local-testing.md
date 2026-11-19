# Local feedback and administration

For the approved hosted synthetic Preview, use [staging access and deployment](staging-deployment.md). The fixture commands below remain local-only; never point them at the hosted project.

Phase 9 uses fictional test content only. The ignored local configuration enables `FEEDBACK_ADMIN_MODE=local`; `.env.example` defaults to `disabled`. Local mode requires development/test runtime and HTTP loopback Supabase. Restart the app after configuration changes. No content keys are needed: feedback comments and case remarks are restricted plain text in the local database. Phase 8 session notes retain their separate encryption and counselor-only access.

Apply migrations `20261126000000_feedback.sql` and `20261126000001_admin_operations.sql` incrementally using `supabase migration up`. Never reset an existing demo database to apply them. No feedback/cases are backfilled. Production uses disabled mode. Existing customer/admin tools remain available when disabled; new routes show a disabled message and perform no Phase 9 private reads.

## Routes and trusted endpoints

| Route                            | Who             | Purpose                                                                  |
| -------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `/bookings?view=past`            | Customer        | Own ended confirmed appointments, Leave private feedback / View feedback |
| `/bookings/[bookingId]/feedback` | Owning customer | Eligibility, one submission or own receipt                               |
| `/admin`                         | Admin           | Operational counts and existing specialist tools                         |
| `/admin/feedback`                | Admin           | All/Unreviewed/Reviewed, counselor filter and review acknowledgement     |
| `/admin/bookings`                | Admin           | All/Upcoming/Past/Holds/Expired, exact counselor/booking filters         |
| `/admin/exceptions`              | Admin           | Open case and paged All/Open/In progress/Closed lists                    |
| `/admin/exceptions/[caseId]`     | Admin           | Current source facts, versioned case actions and history                 |

GET list parameters are `view`, zero-based `page` (0–999999), and where applicable `counselor`/`booking` UUIDs. Lists return 20 rows with lookahead; ordering is deterministic. Dates display Asia/Kolkata. Invalid filters show a safe error/retry state.

Mutations are Next Server Actions, POSTed through their forms with framework-generated action identifiers and CSRF protections. There is no new public REST mutation endpoint. Authenticated browser RPC access and raw new tables are denied. The server checks the session, derives actor identity and checks local mode before calling service-only RPCs. Each RPC independently rechecks current complete database role, ownership, state and limits.

| Service-only RPC                                    | Purpose                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `phase9_feedback_page`, `phase9_feedback_summaries` | Own feedback page / bounded <=20-booking summary          |
| `phase9_submit_feedback`                            | Atomic immutable submission or matching retry/conflict    |
| `phase9_feedback_list`, `phase9_review_feedback`    | Private admin review and acknowledgement                  |
| `phase9_overview`, `phase9_bookings`                | Full-population counts and bounded booking oversight      |
| `phase9_cases`, `phase9_case_detail`                | Case lists, current source facts and paged history        |
| `phase9_open_case`, `phase9_update_case`            | Deduplicated source case and version/request-safe updates |

Do not call these with browser credentials or expose the service key. The `phase9_assert_role`, `phase9_check_page`, `phase9_source` and `phase9_case_json` helpers are also unavailable to browser roles.

## Customer manual acceptance

1. Use a disposable synthetic customer/booking. Sign in, visit `/bookings?view=past` and open Leave private feedback on an ended confirmed appointment. Future/held/expired bookings must not offer submission. End time permits feedback about the booking experience; it does not record attendance or completion.
2. Choose 1–5 stars and optional fictional feedback up to 2,000 Unicode code points. Submit without acknowledgement: validation must retain rating/comment. Check fictional content and submit: the immutable receipt appears. Reload and verify rating/comment persist. Script-like text must display as text and never execute.
3. The past card now offers View feedback. Same normalized submission retry returns the existing receipt; a different submission cannot replace it. There is no edit/delete UI. The receipt is visible to its current customer owner and complete admins, not counselors/public/other customers.
4. Before saving, change a draft, follow a link and cancel the discard prompt. Draft remains. Cancel native refresh warning and verify it remains; accept Reload receipt to discard deliberately. Drafts stay in memory; browser Back/crash/forced termination have no durable recovery.
5. A counselor's later unpublication/role change must not prevent historical feedback. A customer's role revocation/incomplete profile does prevent customer operations.

## Admin manual acceptance

1. Sign in as synthetic admin and open `/admin`. Check overview counts and specialist links. Upcoming/current uses confirmed `end_at > as_of`; today's uses start date in Asia/Kolkata; missing Meet uses future confirmed starts. Payment review, unmatched events, terminal failed jobs, unreviewed feedback and active cases are separate full-population counts. Counts never claim attendance, revenue or financial resolution.
2. Open `/admin/feedback`. Check comments/ratings and filters, acknowledge review and verify Reviewed after reload. Repeated acknowledgement must not duplicate the audit. Customers/counselors cannot use this page. Customer phone/email and private notes are absent.
3. Open `/admin/bookings`, test filters and exact booking/counselor IDs. Over 20 matches must paginate. Expired holds display as expired even before lazy persistence. Confirmed past records remain confirmed. Existing Meet/payment/notification links lead to the specialist tools; copy the visible booking reference when the tool lacks a deep filter.
4. On a disposable booking choose Open operational case. Its source type/ID are prefilled. Add a fictional operational remark, acknowledge and open. The form supplies a View case link. Repeating create for the same source returns the existing case, including when Closed; it never changes the first remark or reopens automatically.
5. Case actions are Open -> In progress/Closed, In progress -> Open/Closed, Closed -> explicit Reopen. Closing/reopening requires a nonblank remark, capped at 1,000 Unicode code points. Each mutation requires fictional-content acknowledgement and records versioned restricted history plus a separate content-free audit.
6. Open a case in two tabs, save in one, then save the stale tab. The latter must conflict and retain its draft. Reload case explicitly before retrying. Ambiguous retries keep their request UUID; old accepted replay after a newer revision cannot overwrite it. Real simultaneous updates allow one winner.
7. Close a case and verify booking/payment/job data and source issue queues remain unchanged. Closed means administrative follow-up closed. Live source facts may change through existing verified tools; history remains. No refund/credit, booking reassignment, cancellation or forced reschedule is implemented.
8. Source types are booking/payment order/payment event/notification job, each requiring its existing UUID. Source booking linkage is derived, never posted as trusted data. Payment events can be unlinked. Cases are manual; alerts do not create cases automatically. No public/counselor/customer case API, sharing or deletion exists.
9. Test phone-sized layout, long UUID/text wrapping, Tab/Shift+Tab focus, labels and submit status. Use only fictional content; never put clinical/contact/credential/payment instrument data in case remarks.

## Automated validation

Use Node 26.13.1 / pnpm 12.21.0 and the local Supabase stack. Run SQL suites separately from browser/live-fixture runs: those fixtures change the same database while SQL suites assert counts. SQL fixtures roll back; browsers remove only their own generated identities and records.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:migrations
FEEDBACK_ADMIN_MODE=local PLAYWRIGHT_PORT=3119 pnpm test:e2e tests/e2e/feedback-admin.spec.ts --workers=1
FEEDBACK_ADMIN_MODE=disabled PLAYWRIGHT_PORT=3120 pnpm test:e2e tests/e2e/feedback-admin.spec.ts --grep 'disabled feedback/admin' --workers=1
```

For full safe browser regression, pause the owned local notification poller to avoid consuming race-test jobs, set local simulator origins to the selected browser port, exclude the older smoke test that mutates the persistent demo customer, then restore the poller. Use separate Next build directories. Build with feedback/workspace/payment/notification modes disabled.

Feedback/remarks persist until deliberate operator cleanup; no automatic retention/export/delete policy is implemented. Read/mutation audit stores only opaque IDs, actions, versions/status and time. Source/test deletion cascades restricted dependent fixture records; no product source-delete workflow is added. Real data, production retention/consent, public ratings, messaging/reporting, financial remedies and Phase 9.5 visual redesign remain deferred.
