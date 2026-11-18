# Phase 5 Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement locally testable, verified payment-backed booking confirmation with Razorpay Test Mode support.

**Architecture:** Payment orchestration stays in a domain module. PostgreSQL owns immutable orders, event identity, captured-payment application and scheduling locks. A local provider simulator exercises the same confirmation pipeline; external transport is replaceable only in explicitly local mode.

**Tech Stack:** Node 26.13.1, pnpm 12.21.0, Next.js 16.4.6, Supabase/PostgreSQL 17, TypeScript, Vitest, pgTAP, Playwright.

**Spec:** ../specs/2026-11-18-phase-5-payments-design.md — approved by user.

## Global constraints

- No live keys, production services, real customer data, automatic refunds or later phases.
- Preserve existing demo accounts and data; apply migrations incrementally.
- Confirm late payments only for free, still-valid future slots; retries preserve the original deadline.
- Price defaults to 69900 paise INR and is snapshotted at first checkout.
- Secrets and privileged mutations stay server-side; no card payloads or secrets in logs.
- Update all six main project Markdown documents and provide local testing instructions.

## Review focus

- Uncertain external order creation must block blind duplicate creation and remain recoverable.
- A signed event with a different event ID must not duplicate a payment/booking.
- An expired original hold cannot displace a replacement hold or overlapping customer booking.
- A callback after rescheduling must not restore the original appointment time.
- Local simulator must not accept or confirm Razorpay orders, or operate on hosted services.

## Task 1: Payment boundary and configuration

Files: `src/modules/payments/{config,verification,provider}.ts`, `tests/unit/payments.test.ts`.
Interfaces: `readPaymentConfig(env)`, `verifySignature(body,signature,secret)`, provider order/payment normalized types and `createProvider(config)`.

- [x] Write and run failing tests for strict local/test mode, signature vectors, exact amount/linkage, and captured/paid validation.
- [x] Implement configuration, HMAC validation and bounded Razorpay transport; use fixed HTTPS origin.
- [x] Run unit suite; record results.

## Task 2: Database payment authority

Files: `supabase/migrations/20261122000000_payments.sql`, `supabase/tests/payments.test.sql`, database types.
Interfaces: `reserve_payment_order`, `claim_payment_order`, `attach_payment_order`, `apply_payment_observation`, safe customer/admin views, pricing RPC.

- [x] Add database tests and observe failure before schema/functions exist.
- [x] Add price settings, orders, transactions, event receipts and audit; enforce least privilege and immutable linkage.
- [x] Implement idempotent observation application under scheduling lock and current-time/participant/schedule/overlap checks; preserve rescheduled confirmed bookings.
- [x] Verify migration incrementally and all database regression checks without resetting user data.

## Task 3: Checkout, simulator and reconciliation

Files: payment server orchestration, local simulator storage/handlers, `actions.ts`, API webhook/reconcile routes, `src/lib/supabase/service.ts`, `proxy.ts`.
Interfaces: checkout returns safe public order details; verification/webhook/reconciliation all call the same database operation.

- [x] Add failing orchestration/integration tests covering timeouts, duplicate order creation and invalid observations.
- [x] Implement durable order claims, uncertain-order recovery by receipt, signed webhook ingestion, bounded reconciliation and local simulator with persistent provider state.
- [x] Enforce ownership, local simulator gating, separate secrets, body limits, safe errors and service-only ingestion.
- [x] Verify failure and replay paths against local services.

## Task 4: Customer/admin surfaces and pricing

Files: checkout components, bookings page, admin payments page, catalog price displays, database types, browser tests.

- [x] Add failing browser tests for real hold-to-confirm simulator flow, retries, authorization and admin exceptions.
- [x] Implement accessible checkout/status UI, admin price/reconcile controls and exact current/snapshotted totals.
- [x] Run desktop/mobile browser checks, Phase 1–4 regression suites and concurrency tests with temporary fixtures.

## Task 5: Operational verification and documentation

Files: CI workflow, `.env.example`, `README.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DEVELOPMENT.md`, `DECISIONS.md`, `PROGRESS.md`, `supabase/README.md`, `docs/payments-local-testing.md`.

- [x] Correct malformed CI command; wire Phase 5 checks and simulator configuration.
- [x] Run lint/typecheck/unit/database/browser/format/build and isolated fresh migration replay; record limitations honestly.
- [x] Update documentation with implementation, local commands, test scenarios, credentials setup and unverified Razorpay Test Mode boundary.
- [x] Request one fresh-context whole-change review, address important findings with regression tests, and give the user setup/testing steps. Do not commit or push unless explicitly requested.

## Execution ledger

- User approved the design and instructed execution; proceed inline without another plan approval round.
- Ruling: work in the supplied workspace to keep the running local app available; do not create a worktree or alter the user's branch/commit history.
- Ruling: local simulation is a development-only payment mode; live provider mode is intentionally unavailable.

- Baseline: 9 unit tests passed before changes. New missing-boundary/schema tests failed as expected.
- Implemented payment boundary, database authority, provider adapter, local simulator, checkout/webhook/reconciliation, customer/admin UI.
- Verification so far: 18 unit tests; browser simulator journey including concurrent late captures passed; fresh replay of all 16 migrations passed.
- Regression caught and fixed: browser Host normalization, simulator JSONB lookup, and authoritative captured amount transition.
- Ruling: run PostgreSQL TAP suites directly in the local container to avoid a separate pg_prove image and Rancher socket issues; test assertions still execute in PostgreSQL and roll back.

- Final review findings reproduced RED: captured admin exception could reconfirm after conflict expiry; unmatched signed receipt could not link after uncertain-order recovery. Both fixed in the authoritative RPC and verified GREEN (199 database assertions before added refresh/admin guards).
- Final review regrading: persistent pending/failed status is Important because losing it can encourage a new attempt; authenticated ownership test coverage is Important because origin-only denial does not establish payment authorization. Added persistent summaries, same-origin cross-customer refresh checks and browser regressions.
- Final review: no Critical finding; all four actionable findings are in the fix/verification pass. No deferred minor finding.

- Final checks: 18 unit tests, 203 database assertions, five safe browser tests, 17-migration isolated replay, production build, typecheck, lint, server-secret browser-bundle scan, and documented local reconciliation command passed. Formatting and diff checks passed.
- No commits, pushes, merges, production services, or later-phase work performed. Work remains in the requested workspace.
