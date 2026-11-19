# Phase 9: Local private feedback and administration

Status: Approved by the user on 19 November 2026 for in-place implementation with independent review. User selected feedback after a confirmed appointment's end time and the feedback/dashboard/exception-tracking approach. The defaults below are approved as part of this document.

## Intent and scope

Finish the local operational MVP with customer feedback, an admin overview, booking oversight and auditable exception tracking. Reuse existing counselor, scheduling, pricing, Meet, notification and reconciliation tools. Preserve Phase 8 and existing demo records. Continue in the current workspace without commits or resets.

User decisions:

- A customer may submit feedback once their own confirmed appointment has reached its end time. This does not certify attendance, change Confirmed to Completed or introduce No-show.
- Implement feedback, a dashboard and operational exception tracking. Defer refunds, credits and forced booking changes.
- Messaging and message reporting remain deferred. A separate UI/UX polish pass follows Phase 9, before Phase 10.

No production services, real clinical/customer content, public ratings, counselor access to feedback, financial remedies, counselor transfer, cancellation, attendance workflow or private-note admin access. No email or WhatsApp notification on feedback/case updates. Standard responsive/accessibility work belongs here; visual redesign belongs to Phase 9.5.

## Approaches considered

1. **Chosen:** private feedback plus operational dashboard and exception tracking, using existing tools for specialist actions. A case records administrative follow-up independently of the booking/payment facts. This delivers visibility and accountability while preserving the existing rules.
2. Add booking/financial remedies and attendance controls now. That would need unresolved cancellation, no-show, refund/credit authority and support policy. The user selected approach 1.

## Proposed defaults

These are design choices for approval, not additional user requirements: one immutable feedback submission per booking; optional comment limited to 2,000 Unicode code points; admin review acknowledgement; 20-row pages; manually opened source-linked operational cases with Open/In progress/Closed and explicit reopen; bounded fictional operational remarks; default-disabled local-only feature mode. Their exact behavior follows.

## Customer feedback

`/bookings` adds a feedback link/status only for owned confirmed past appointments when the local feature is enabled. The existing All/Upcoming/Past/Holds contract, locator, payment/reschedule logic and Book Again remain unchanged. The portal requests feedback summaries for only its current page's booking IDs through a separately owner-checked batch read; no per-row network queries or counselor/customer role leakage.

`/bookings/[bookingId]/feedback` shows the counselor display name, appointment time in Asia/Kolkata and either the form or the customer's own immutable receipt. Current complete customer role and exact ownership are required for reads and writes; foreign IDs return the same unavailable result as missing IDs. Before the end time, a genuine owner sees that feedback opens after the appointment ends. Held/expired bookings cannot accept feedback. Unpublishing/revoking the counselor does not prevent feedback about an existing owned confirmed appointment.

Form: required integer 1–5 rating, optional plain-text comment, and explicit fictional-content acknowledgement. Trim comment; empty becomes null; maximum 2,000 Unicode code points in both trusted application validation and SQL. No HTML/Markdown rendering, clinical prompts, attachments or contact collection. Invalid input preserves the draft with a useful error. Clearly state that feedback is visible to platform admins and the submitting customer, not public or available to counselors.

Eligibility is checked again at mutation time using database `now()`, confirmed state and current actor role/ownership. Acquire the existing scheduling advisory lock before participant/booking row locks so rescheduling and role changes cannot invalidate checks midway. No grace period or submission deadline beyond end time.

A unique booking constraint and atomic insert enforce one immutable submission. A retry with the same normalized rating/comment returns the same receipt without another audit; a changed payload returns Already submitted without replacing it. Two concurrent submissions create one row. No edit/delete UI or mutable history in Phase 9. After a successful or ambiguous save, the customer can reload their receipt; confirm before intentionally discarding a changed form draft. No plaintext drafts in localStorage, logs or analytics; browser Back/crash recovery is not promised.

## Admin feedback review

`/admin/feedback` lists submissions newest first, filter All/Unreviewed/Reviewed, with optional exact counselor filter and 20-row deterministic timestamp/ID pages. Show rating, optional comment, counselor name, booking reference/time, submission time and review status. Omit customer phone/email and private-note information. Customer identity is represented by an opaque customer ID if needed for operational linkage; no customer name is required here.

An admin may acknowledge review once. Record reviewer and reviewed time; repeated requests return the current acknowledgement without duplicate audit. Review does not change the rating/comment, create a case automatically, contact anyone or represent complaint resolution. Historical submissions remain readable by current complete admins even if the author/counselor later changes role. Customers see only their own submission; counselors/public see neither individual feedback nor aggregates.

Feedback reads/details are audited with opaque IDs/fixed actions only. A paged admin review read writes one content-free page-access event rather than logging each comment. Submission/review mutations also audit atomically. No comment/rating/body/contact is copied into audit metadata or operational case remarks automatically.

## Admin overview and booking oversight

Enhance `/admin`, retaining its Admin area heading, role-assignment form and existing specialist links. In enabled local mode show one database-reference timestamp and explicit counts:

- Upcoming/current confirmed: `end_at > as_of`.
- Today's confirmed appointments: `start_at` falls on the current Asia/Kolkata calendar date, independent of attendance.
- Future confirmed missing Meet: `start_at > as_of` and no assigned link, matching the existing Meet queue.
- Payment orders with `review_reason` present; unmatched payment events whose outcome is currently `unmatched_order`.
- Terminal failed notification jobs (`status='failed'`), with retries/queued work excluded.
- Unreviewed feedback; active cases (Open or In progress).

Each count links to the corresponding existing tool or new filtered list. Counts come from the full eligible population, not the first page. Cases and underlying issue counts are separate and explicitly labeled. No revenue/profit, completed-session or clinical-quality metrics inferred from these counts.

Add `/admin/bookings` with All/Upcoming/Past/Holds/Expired, optional exact counselor and booking UUID filters, 20-row deterministic pages. Upcoming/Past include confirmed rows split at end time; Holds includes active held rows with `hold_expires_at > as_of`; expired holds are displayed consistently as expired even if lazy expiry has not persisted. All uses effective displayed status. Show booking ID, counselor name, customer opaque ID, dates/status and reschedule count, plus operational references/links. Do not join notes, feedback comments, contacts or raw provider payloads. Past/unpublished/revoked counselor records remain visible to current complete admins.

`/admin/appointments` continues to own future Meet assignment; `/admin/payments` retains reconciliation/evidence; notifications retain retry. Booking oversight links to these pages rather than duplicating their mutations. Exact booking references remain visible when a specialist page has no deep-link filter. Empty, unavailable and retry states must be explicit. Offset pages may move between requests after new records; each response is internally consistent.

## Exception tracking

`/admin/exceptions` has All/Open/In progress/Closed filters and 20-row pages. `/admin/exceptions/[caseId]` shows the linked operational source, current case status/version and a paged event history. Admins can open a case from booking oversight or via a form that selects a source type and exact UUID.

Sources are existing `booking`, `payment_order`, `payment_event` or `notification_job` records. Source category is fixed by type: Booking support, Payment follow-up, Unmatched event follow-up or Notification follow-up. Validate source existence and derive booking linkage on the server/database; never trust a posted booking/source relationship. Payment-event cases may lack a booking. Missing-Meet follow-up uses the booking source. A customer/counselor has no create/read/update case API.

One case per exact source, including closed cases. A uniqueness constraint on canonical type/source identity deduplicates concurrent/retried creates; a repeat open returns the existing case without overwriting it or automatically reopening it. Closed cases have an explicit Reopen action so recurrence is deliberate. No background case creation, automatic closure or case-per-page-read side effects.

States: new Open; Open may become In progress or Closed; In progress may become Open or Closed; Closed may become Open only through Reopen. Closing or reopening requires a fictional operational remark; other updates may include an optional remark. Remarks are trimmed plain text, at most 1,000 Unicode code points; no medical, contact, credential or payment instrument data. Every mutation requires the fictional-content acknowledgement, current complete admin role and an expected version. Source identity cannot change.

Use a stable request UUID per update and a unique case/request receipt containing normalized payload identity. Same request and payload replays its accepted result once; changed payload under the same UUID is rejected. Stale expected versions return conflict and preserve the draft. A replay after a later revision returns accepted/current versions without overwriting or presenting an old revision as current. Create retries deduplicate by source; changed create remarks cannot replace the original case. A case cannot be deleted through the app.

Case detail displays current source facts as a separate live read: booking effective status, payment review reason/current event outcome, or notification state as applicable. A case's Closed label means administrative follow-up is closed, not that an underlying payment/notification/Meet issue disappeared. Closing a case never clears payment review evidence, changes booking/payment/job state or removes an item from a source issue queue. Technical state changes remain with existing verified workflows. If source data is unavailable, retain case identity/history with an unavailable-source message.

Operational remarks form a restricted case-event history. A separate privileged audit records only opaque actor/case/source IDs, fixed action, old/new status/version and timestamps. No remark or feedback text in audit. Case mutations and their history/receipt/audit commit atomically. Source deletion cascades disposable test case/history/receipt/audit rows; no source deletion is exposed by this module. Case source type uses explicit nullable foreign keys plus an exactly-one-source constraint rather than an unchecked polymorphic ID.

## Data, APIs and authorization

New `feedback` module owns customer submissions/receipts and admin review. New `admin-operations` module owns overview, booking oversight and cases. Routes compose module UI. Shared mode/configuration stays domain-neutral. No new dependency or service split.

Incremental migrations introduce feedback, operational cases, case events/request receipts and content-free audit tables, with foreign keys, bounded data, uniqueness and useful filter/order indexes. They preserve all prior contracts and records, with no demo backfill. Raw new tables enable RLS and revoke anon/authenticated/public reads/writes; only trusted narrow functions expose data. Do not extend admin privileges to session-note tables/functions.

New Phase 9 RPCs are service-only. Server entry points verify the session, derive the actor ID and check the local feature gate before using them; each RPC independently verifies current complete canonical role, owner/source/state, limits and payload. No browser-supplied actor or role. Service credentials remain server-only. Read and mutation RPCs use explicit fields, fixed search paths and narrowly scoped grants; no arbitrary table/filter/SQL access.

Logical contracts (the builder may settle exact function names/types):

- Customer feedback page/summary read(actor, booking or bounded <=20 booking IDs) -> safe owner data, eligibility/reference time and own receipt/status.
- Submit feedback(actor, booking, rating, normalized comment, acknowledgement) -> saved/existing/conflict or safe validation/authority result.
- Admin feedback list(actor, filter, counselor, page) -> as_of/items/has_more; acknowledge review(actor, feedback) -> current review status.
- Admin overview(actor) -> as_of and defined full-population counts; booking list(actor, view, counselor, exact booking, page) -> safe paged rows.
- Admin case list/detail/history(actor, filter/ID, page), open case(actor, typed source, initial remark, acknowledgement), update case(actor, case, expected version, request UUID, action, remark, acknowledgement).

UUIDs, enum filters, integer pages (0–999999), text/code-point limits and page sizes are validated in both trusted app and RPC boundaries. Use 21-row lookahead for 20-item pages, deterministic tie breaks, one DB timestamp per response and no unbounded lists. Role/participant locks protect mutations against concurrent revocation; case updates lock the case after role checks and use a consistent lock order.

Feedback comments and operational remarks are stored as restricted plain text in the local database, not with the note keyring; app-level AES encryption remains specific to Phase 8 notes. This is a proposed local synthetic-content choice, not approval for real clinical information. No text is rendered as HTML, logged, placed in query strings/audit metadata or sent to external providers. Existing note keys are neither reused nor exposed.

## Local mode and failure behavior

`FEEDBACK_ADMIN_MODE=disabled` by default. Local mode requires development/test runtime and HTTP loopback Supabase using the same strict URL policy as other local features. Missing/invalid mode fails closed. New UI/routes/actions perform no Phase 9 private RPCs while disabled; existing admin/customer tools remain usable. Production build uses disabled mode. No new content keys are required.

Safe validation and conflict states preserve draft input. Ambiguous requests retain their identity until acknowledged or explicitly reloaded. Unavailable reads show retry/navigation without serializing service/database errors. All protected reads/actions check the current role; already-rendered data cannot be recalled after a role change. No feedback/case content in toast/debug/error telemetry. Use existing Next Suspense/connection/form/error guidance for the installed version before implementation.

## Acceptance and verification

- Customer sees feedback only on their own ended confirmed bookings; exact end-time boundary, active/ended/expired held records, reschedule race, unpublished counselor and role changes are enforced in SQL.
- Ratings 0/6/fractional/missing and oversized comments fail; Unicode boundaries, blank normalization and script-like plain text are tested. Concurrent and lost-response retry create one immutable submission and one submission audit.
- Customer cannot read another receipt; counselors/public cannot read feedback/aggregates; non-admins cannot use dashboard/case RPCs or raw tables. Incomplete/revoked admins are denied. Prior notes remain inaccessible to admin.
- Review acknowledgement and source-linked case creates/updates are audited and idempotent; stale/concurrent updates preserve one winner, changed retry payloads fail, explicit reopen works and source relationships cannot be forged.
- Closing cases preserves exact payment/booking/job facts and source issue counts. Live source changes do not rewrite case history. Full counts and deterministic pages exceed 20 records in tests.
- Unit validation/mode checks, transactional SQL tests and live browser journeys precede/verify implementation. Run lint/types/unit/SQL, isolated migration replay, safe full browser regression, disabled-mode acceptance/build, mobile/keyboard inspection and secret/static text checks with the pinned toolchain.
- Preserve current demo IDs/settings and Phase 8 changes. Only disposable generated fixtures may be cleaned up. Pause/restore the owned notification poller around race-sensitive regressions. Independent implementation review and fixes before reporting completion.
- Update README/architecture/database/development/decisions/progress and add manual testing/endpoint/local-mode guidance. Record actual counts/limits, review findings and deferred work. No commit/push or Phase 9.5 work without further instruction.

## Builder discretion

Choose file/component decomposition, exact RPC/table/index names, fixed error codes, supporting SQL helper functions and test-fixture structure while retaining these contracts. Use additive migrations, existing modular conventions and pinned dependencies. Settle minor implementation details independently; do not invent business remedies, public rating policies, attendance claims or real-data permissions.
