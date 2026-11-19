# Phase 7 Customer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution in the current workspace, as selected by the user. Follow checkbox steps; no commits without explicit instruction.

**Goal:** Expand `/bookings` into the approved paginated customer portal with safe history and fresh rebooking.

**Architecture:** A customer-authorized PostgreSQL read RPC returns safe page summaries and one database reference time. Domain components compose the existing payment component and navigation; all existing trusted mutation contracts remain unchanged.

**Tech Stack:** Existing Next.js 16.4.6, React, TypeScript, Supabase, Zod, Vitest, pgTAP and Playwright; Node 26.13.1, pnpm 12.21.0; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-19-phase-7-customer-portal-design.md` (approved 19 November 2026).

## Global Constraints

- Preserve demo data, existing mutation RPCs, notification URLs and local-only simulator boundaries.
- All/Upcoming/Past/Holds; 20 rows per page, deterministic ordering, database-time eligibility.
- Past means session ended, not attended/completed. No new booking statuses or feedback/messaging/notes.
- Book Again creates no state; it links to current public availability. New checkout uses current price and new payment/meeting identities.
- No new product table, dependency, service-role portal read, external service or production connection.
- Read installed Next.js guides before application edits. Leave requirements unchanged and work uncommitted.

## Review Focus

- Payment success while viewing Holds must keep the confirmed booking discoverable (Task 3/browser).
- Historical synthetic bookings without payment orders must not show today's price as paid (Tasks 2–4).
- Unpublished/revoked counselors must not create broken Book Again links (Tasks 2–4).
- Pagination/filter joins must never expose another customer's meeting/payment data (Tasks 2–4).
- Exact expiry/end/24-hour boundaries use one database reference time (Task 2).

### Task 1: Portal contracts

**Files:** `src/modules/customer-portal/model.ts`, `tests/unit/customer-portal.test.ts`.

**Interfaces:** `parsePortalQuery({view?,page?}) -> {view:"all"|"upcoming"|"past"|"holds",page:number}`; `portalPageSchema` validates `{as_of,has_more,items}`. Each row includes booking identity/time/status/eligibility, optional payment snapshot/order/outcome/review reason, and optional authorized meeting URL. `bookAgainHref(row)` returns eligible counselor profile or directory.

- [x] Write failing tests for malformed query, safe page range, correct Book Again target and missing snapshot parsing.
- [x] Run focused Vitest; observe missing contract failures.
- [x] Implement validation/read schemas and navigation helper; rerun unit suite to green.

### Task 2: Scoped paginated read model

**Files:** `supabase/migrations/20261124000000_customer_portal.sql`, `supabase/tests/customer_portal.test.sql`, `src/types/database.types.ts`.

**Interface:** `get_customer_portal(p_view text default 'all',p_page integer default 0) returns jsonb` contains stable `as_of`, at most20 items and `has_more`. Views/ordering/flags follow approved design. `get_my_bookings` unchanged. Unauthorized/incomplete roles raise42501. Use stable transaction `now()` for exact boundary fixtures and consistent response time.

- [x] Write schema/ownership/classification tests before migration; run to establish missing RPC failure.
- [x] Implement explicit actor/role check, owner-constrained joins, safe JSON fields, SQL argument normalization, 21-row lookahead and existing payment-state semantics. Add owner/time and owner/created indexes if needed for bounded queries.
- [x] Test mixed lifecycle and exact boundaries; tie/pagination beyond20; missing optional rows; unpublished/revoked counselors; snapshot retention/payment exceptions and foreign join denial; anon/customer/counselor/admin/incomplete role privileges.
- [x] Apply migration incrementally, record local migration version and reload schema. Run all transactional tests and disposable replay.

### Task 3: Portal UI and payment continuity

**Files:** `src/modules/customer-portal/server.ts`, `src/modules/customer-portal/components/portal.tsx`, `src/app/bookings/page.tsx`, `src/app/customer/page.tsx`, `src/modules/payments/components/checkout.tsx`, `src/app/globals.css`.

**Interfaces:** `getCustomerPortal(query)` uses authenticated server client + RPC + Zod parsing and returns normalized query/page. `CustomerPortal` server component owns filters, pagination and cards. Existing `BookingPayment` gains optional `confirmedHref` to preserve navigation after confirmation from a disappearing Holds card.

- [x] Write browser fixture/test for new views, history, missing price, Book Again, Holds payment and foreign access; run before product UI to see missing surface failure.
- [x] Implement responsive links with `aria-current`, current/past labels, start/end times, snapshot-only historical price and legacy/no-order behavior. Reuse existing payment controls; retain exact critical test labels and same-counselor rescheduling links.
- [x] On confirmed payment in Holds replace navigation with All so appointment remains visible; preserve existing refresh/message behavior elsewhere. Default All preserves checkout redirects.
- [x] Improve customer landing navigation. Read-only navigation must never create holds/orders. Run unit, lint and typecheck checks.

### Task 4: Regression, acceptance and independent review

**Files:** `tests/e2e/customer-portal.spec.ts`, applicable existing browser tests, operating/acceptance docs.

- [x] Test refresh/back/filter and >20 pagination; Book Again creates fresh hold/payment with current price; choosing another counselor creates separate booking; upcoming Meet/pending; legacy past no price; unpublished fallback; mobile/keyboard and authorization.
- [x] Use only generated synthetic accounts and fixture IDs, preserving demo IDs/counts. Existing explicit local disposable fixture cleanup test patterns remain applicable; do not delete user data.
- [x] Pause only the owned local poller during race-sensitive browser runs, then restore it. Run full safe browser suite excluding only the documented persistent-profile OTP test.
- [x] Run lint, typecheck, unit, database, replay, disabled-simulator isolated production build, format/diff and secret-asset checks. Inspect screenshots and record actual results.
- [x] Obtain independent whole-change review; reproduce/fix material findings with focused tests and rerun affected checks. Do not silently weaken old assertions.

### Task 5: Documentation and handoff

**Files:** README, ARCHITECTURE, DATABASE, DEVELOPMENT, DECISIONS, PROGRESS, Supabase README, `docs/customer-portal-local-testing.md`, approved spec and this plan.

- [x] Record user-approved design/native execution, implemented vs deferred scope, commands and limitations. Update manual acceptance instructions and preserved fixture counts.
- [x] Verify local app/backend/poller readiness, leave changes uncommitted and report Phase7 delivery plus subsequent phases.

## Self-review

The five tasks cover every approved design section, reuse existing mutation contracts and keep new read data narrowly customer-scoped. Payment continuity, missing snapshots, eligibility revocation, ownership, timing and pagination have explicit test owners. No external provider or later-phase policy is included.
