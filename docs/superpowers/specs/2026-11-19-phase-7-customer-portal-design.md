# Phase 7: Customer portal

Status: Approved by the user on 19 November 2026. On 19 November 2026 the user selected expansion of the existing `/bookings` route. Phase 6 targeted testing and agent UI acceptance passed; Phase 7 implemented locally; verification and review evidence are recorded in PROGRESS.md.

## Intent and scope

Give an authenticated customer a clear view of upcoming/current appointments, past appointments, pending checkout and expired holds, plus a safe way to book another session. Preserve existing checkout, verified payment confirmation, manual Meet links, one-time same-counselor rescheduling, notification links and customer ownership enforcement.

The existing Next.js/Supabase modular monolith remains unchanged in shape. There are no new external services, dependencies, paid collections, real notifications, clinical records, cancellation/refund decisions or later-phase functionality. Feedback is Phase 9; messaging and clinical notes are Phase 8. A past confirmed appointment is not evidence of attendance or completion.

## Approaches considered

1. **Expand `/bookings` — selected by user.** Retains URLs used by checkout, notification messages and customer navigation, and improves the existing booking flow in place.
2. **Separate appointments page.** Requires compatibility/navigation work and would split closely related checkout/history behavior. Not selected.

Use existing visual conventions with responsive cards and clear ordinary links for filtering; a separate design system or broad redesign is outside this module.

## Current behavior and impact

- `/bookings` currently lists all customer-owned holds and confirmed bookings with payment controls, a meeting-link/pending message, and eligible rescheduling. It loads all owned payment rows and all accessible meeting links in separate queries.
- `/customer` is a simple role-guarded landing page with links to bookings, discovery and profile.
- `get_my_bookings` returns private owner-scoped summaries, including current counselor display name even when that profile is unpublished. The route computes the displayed reschedule control using the app server clock; the mutation independently enforces eligibility in PostgreSQL.
- `bookings` has only `held`, `expired`, `confirmed`; no completed/no-show state exists. Do not introduce those states or infer them from time in Phase 7.
- Meeting, payment, schedule and booking identities remain stable; this phase primarily adds a read model and portal presentation. Preserve existing query/RPC contracts used by `/book` and tests.

## Proposed customer experience

Keep `/bookings` as the canonical page and retain the existing heading/route compatibility. Add these views using query parameters so refresh/back navigation and shared local URLs work:

- **All** (default): own records, newest booking creation first, including pending checkout and payment exceptions. A newly created hold remains discoverable after the existing `/book` redirect.
- **Upcoming**: confirmed appointments whose end is after the database reference time. Sort by start ascending; an appointment already started but not ended is marked “In progress”.
- **Past**: confirmed appointments whose end is at or before that reference time. Sort by start descending. Clearly label “Past appointment” while preserving actual “Confirmed” status; do not display Completed or No-show.
- **Holds**: active and expired holds, newest creation first. The derived status changes to expired when its deadline is reached, without requiring a cleanup write.

Use pages of 20 records, deterministic ID tie-breakers, and Newer/Older or Previous/Next links. Invalid view/page input falls back safely to All/page zero. Empty states explain the selected view and link to discovery; a customer with no records sees a direct invitation to find a counselor. Filters are accessible links with a visible active state; pagination retains the selected filter.

Cards show counselor display name, session start/end and Asia/Kolkata, actual booking state, eligible actions and relevant payment status. Keep actionable exceptions visible in All/Holds; expired appointments with captured payment under admin review must not disappear into a misleading normal-expiry message. Confirmed entries must not suggest paying again. Historical amounts are shown only from a stored payment snapshot; a legacy/synthetic confirmed fixture without an order must not display today's global price as its paid amount.

Customer landing navigation points clearly to appointments/history, discovery and existing profile management. Reuse the existing profile behavior; email editing/verification and account recovery policies are not added.

## Meeting and rescheduling behavior

- Upcoming/current confirmed appointments retain authorized Join Meet or “Meeting link will follow.” No new early-join window is introduced. External meeting links keep no-referrer and opener protection.
- Past cards do not promote Join Meet or show a misleading future-link promise. This is presentation, not a new access-revocation policy; existing authorized meeting RPC behavior is preserved.
- Reschedule is offered only for confirmed bookings with zero previous reschedules and at least 24 hours before the original start. Derive the portal affordance using the same database reference time as categorization. Existing trusted mutation remains the authority and rejects stale/forged requests.
- The existing rule allows changing time with the same counselor only. No counselor replacement, paid-slot transfer, cancellation, refund or payment reuse is introduced.

## Book Again and counselor choice

- Past confirmed cards offer Book Again when that counselor remains published and still has the canonical counselor role. It navigates to their existing public profile/availability page without creating a hold or copying a slot, order, price, payment or meeting link.
- If that counselor is unpublished or no longer eligible, show that they are currently unavailable and offer the directory instead of linking to a known 404.
- A customer may choose any counselor for a separate new booking through discovery. Make that option clear; it does not alter an existing paid appointment.
- Every new booking goes through current availability, price, overlap/hold rules and a fresh payment flow. No session notes or messages exist in this phase to share across counselors.

## Database, API and module design

Add one incremental migration for a customer-scoped paginated read RPC, with indexes only if its query requires them. No new product table, booking status or mutation is needed. Keep `get_my_bookings` unchanged for existing selection/rescheduling callers.

The new portal read contract accepts only a validated view and page; it never accepts a trusted customer ID. It returns a single stable database `as_of` timestamp, up to 20 safe summaries, a `has_more` indicator and derived action flags. Use the same `as_of` for expiry, upcoming/past boundaries and reschedule eligibility. Time comparisons are UTC; display is Asia/Kolkata.

Summaries include booking/counselor IDs and display name, session times, actual/derived hold state, hold expiry, reschedule count/eligibility, whether the counselor is publicly bookable, and authorized meeting/payment fields required by the card. Resolve payment state deterministically; a captured/confirmed outcome cannot be downgraded by an older failed attempt. Payment exceptions remain explicit. Only return snapshot amounts when a persisted payment order exists.

The RPC checks `auth.uid()`, canonical customer role and required completed contact profile. Every booking/order/transaction/meeting join is explicitly constrained to that customer and booking; security-definer code cannot rely on caller RLS to filter its joins. Pin `search_path`, revoke public/anonymous execution and grant authenticated execution with internal authorization. Preserve raw-table RLS and existing service-only mutation boundaries. Customer, counselor and admin roles cannot use the portal RPC to inspect another customer's history.

`src/modules/customer-portal/` will own URL validation, read-model parsing, data access and portal components. `/bookings` composes those components; `/customer` composes the improved landing/navigation. Reuse payment/booking/meeting components or extract small shared pieces where necessary; do not duplicate payment verification or rescheduling rules. There is no new route handler, hosted job or service-role use for portal reads.

## Concurrency and pagination expectations

Reads never reserve a slot or guarantee that a displayed action will remain eligible. Booking/payment mutations revalidate current state. A session crossing a boundary between requests appears in the view appropriate to the new request's database clock; each single response is internally consistent. Offset pagination is acceptable for the pilot: new bookings may shift page membership between requests, while deterministic ordering prevents ambiguous ordering inside a response. Document this behavior rather than promising a snapshot across navigation.

A customer with many future appointments can use Upcoming to see the soonest first. Existing checkout/verification interactions must keep their booking visible after success: refresh the current card/view, or navigate to an appropriate existing view/page when its state no longer belongs to the selected filter. Do not strand successful payment in an empty Holds view without a confirmation/link to its appointment.

## Verification and acceptance

Write meaningful failing tests before product changes, then run the relevant suites with pinned Node 26.13.1 and pnpm 12.21.0.

- Unit: view/page validation; read-model shape/action derivation where applicable; Book Again destinations; malformed inputs; missing payment snapshots and non-regression of payment status.
- Database: own records only; unrelated customers, counselors, admins, anonymous and incomplete/revoked-role profiles; mixed held/expired/confirmed rows; exact start/end/hold-expiry/24-hour boundaries; current/past classification; stable ties and pagination beyond 20; current counselor publication/role; missing optional meeting/order data; safe payment/exception joins.
- Browser: All/Upcoming/Past/Holds and empty states; back/refresh/pagination; payment within Holds and confirmation after capture; current meeting link/pending message; missing legacy price handling; valid/invalid one-time rescheduling; Book Again chooses a new slot and fresh checkout; unpublished counselor fallback; a separate new booking with another counselor; foreign-account denial; desktop/mobile/keyboard flow.
- Regression: Phase 6 reminders, duplicate confirmation, meeting-link ownership, rescheduling invalidation and worker recovery; all existing safe browser tests must remain meaningful as portal organization changes. Wait for streamed page readiness before negative assertions.
- Run lint, typecheck, full unit/database suites, isolated migration replay, safe browser suite, disabled-simulator production build, formatting/diff checks and configured-secret browser-asset scan. Do not disable existing assertions to accommodate the new page.
- Agent UI acceptance covers the portal's real navigation, history and rebooking flow; distinguish agent acceptance from independent human sign-off. Use disposable synthetic fixtures; arrange any permanent fixture cleanup approval before creating records subject to that approval boundary. Preserve existing demo booking identities and settings.

Update README, ARCHITECTURE, DATABASE, DEVELOPMENT, DECISIONS, PROGRESS, local testing/acceptance guidance and affected Supabase docs. Leave PROJECT_REQUIREMENTS unchanged; no commit/push without explicit request.

## Proposed defaults and approval boundary

User-selected decision: expand `/bookings`. Builder proposals for approval: default All with four views, 20-row pagination, database-time categorization, “In progress”/“Past appointment” presentation without new statuses, past-only Book Again, hiding stale join affordances in past cards, and directory fallback for unavailable counselors. Exact component names, query/index details and spacing are builder choices consistent with this design. No launch policy is silently resolved.

## Implemented review refinement

Independent review exposed old Holds confirmation disappearing behind20 newer records. The read contract now also accepts an optional validated booking UUID, locates its page using the same owner-scoped snapshot, and returns that page. Holds confirmation and rescheduling use the locator; foreign IDs reveal no private position/details. Existing mutation rules are unchanged. See PROGRESS.md for reproducing tests and results.
