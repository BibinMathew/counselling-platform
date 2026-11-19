# Phase 9: Feedback and administration impact analysis

Status: Design discovery. The user requested Phase 9 and chose feedback eligibility after a confirmed appointment's end time. This does not certify attendance or introduce Completed/No-show statuses. The user selected feedback, dashboard and exception tracking, keeping financial remedies deferred; no Phase 9 product code or migrations have been implemented. Messaging/reporting remain deferred; the user selected a separate UI/UX polish pass after Phase 9 and before Phase 10.

## Existing behavior

- The customer portal has owner-scoped All/Upcoming/Past/Holds with 20-row pagination and database-time category flags. Ended confirmed bookings remain Confirmed. There is no attendance workflow.
- Admin tools already manage canonical roles, counselor profiles/publication, scheduling, pricing, manual Meet links, notification retry and payment reconciliation.
- `/admin/appointments` lists future confirmed bookings for Meet assignment; it is not an all-bookings history view. `/admin/payments` shows recent orders and bounded payment exceptions/unmatched provider events.
- Payment review evidence is deliberately persistent. Reconciliation cannot silently convert an already reviewed capture into a successful booking. No refund/credit/cancellation or forced rescheduling mechanism exists.
- Local private notes have independent service-only authorization. Routine admins cannot read them, and Phase 9 must not expose them through dashboards, feedback joins or exceptions.
- Phase 8 changes are uncommitted; preserve them and the existing six accounts, four counselors and three demo bookings. Continue local synthetic testing and incremental migrations without resets or commits.

## Affected boundaries

| Area               | Expected impact                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feedback           | New module, booking-specific 1–5 rating with optional bounded comment; current customer ownership, confirmed status and database end-time authorization         |
| Customer portal    | Feedback entry/status for eligible owned appointments; preserve existing pagination, booking locator, payment/reschedule and Book Again behavior                |
| Admin overview     | Aggregate operational counts with explicit definitions/reference time and links to existing tools; no revenue/profit/attendance claims inferred from bookings   |
| Booking oversight  | Admin-only bounded/paged safe summaries across existing statuses and past/upcoming categories, preserving current Meet editor                                   |
| Exception tracking | Audited operational case status/references without changing money, booking state or underlying provider evidence                                                |
| Database           | Versioned tables/indexes/RLS and narrowly granted reads/mutations, independent canonical-role and owner checks; bounded queries and deterministic ordering      |
| Navigation         | Role-appropriate links from admin and landing account navigation; no customer/counselor feedback review links                                                   |
| Audit/privacy      | Content-free audit fields, no note access, no feedback comments in logs; safe plain-text rendering and current-role authorization                               |
| Verification/docs  | Unit, SQL authority/time/race/idempotency tests, browser acceptance/regressions, isolated migration replay, disabled build, operating guide and project records |

## Decisions and boundaries

User decision: feedback is allowed when an owned confirmed booking has reached its end time. Ratings/comments are private to admin initially, as required; the submitting customer should be able to see their own submitted feedback/receipt. No public or counselor feedback access.

User-selected approach: private feedback plus operational dashboard, booking oversight and auditable exception tracking. Reuse existing specialist tools rather than creating duplicate mutations. An operational case can be tracked or closed without asserting a payment was refunded, a provider issue resolved or a session attended. Existing payment exception evidence remains unchanged and visible.

Alternative: add admin cancellation, booking reassignment, refunds/credits or explicit completion now. This expands financial/attendance rules and depends on unresolved remedies/authority/support policy in PROJECT_REQUIREMENTS.txt; it is not assumed authorized by the phase label.

The written design must settle submission/edit/retry behavior, comment limits, case categories/transitions, source identity/deduplication, reopen behavior, access after role changes and aggregate definitions. Builder choices can cover component decomposition, index names and fixture structure. Production consent, retention, provider integrations and actual financial remedies remain deferred.

## Verification focus

Cross-customer, customer-to-admin and counselor denials; raw table/function permissions; role revocation/incomplete profiles; exact end-time boundary, status changes and reschedule races; duplicate/concurrent feedback submission; invalid ratings/Unicode limits and XSS-safe text; deterministic pages and stable counts; case retry/stale-update/deduplication and audit secrecy; unchanged payment/booking facts after case updates; no private-note or contact leakage. Use disposable synthetic fixtures and preserve demo records.
