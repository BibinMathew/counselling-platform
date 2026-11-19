# Phase 9 Feedback and Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. User approved implementation here with independent review; execute natively without another permission checkpoint. Track steps with checkboxes. No commits.

**Goal:** Deliver the approved local private feedback, operational dashboard/booking oversight and audited exception tracking.

**Architecture:** Modular Next.js app using server-derived actors, default-disabled local gate and service-only RPCs that independently authorize current roles/ownership. Add immutable feedback and source-linked versioned cases without changing booking/payment facts or private-note privileges.

**Tech Stack:** Node26.13.1, pnpm12.21.0, Next16.4.6/React19/TypeScript/Zod/Supabase PostgreSQL; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-19-phase-9-feedback-admin-design.md`, approved 19 November 2026.

## Global Constraints

- Local fictional content only, `FEEDBACK_ADMIN_MODE=disabled` default; enabled only development/test with strict HTTP loopback Supabase.
- Preserve uncommitted Phase8 work, six users/four counselors/three demo bookings, existing RPCs and provider evidence; no reset/backfill/commit.
- Service-only new functions derive actor at trusted server boundary and recheck canonical complete role/ownership in SQL; raw new tables unavailable to browser roles.
- Feedback after confirmed booking end, 1–5 integer, optional2000 Unicode code points, immutable per booking, explicit acknowledgement.
- Case status independent of source facts; Open/In progress/Closed and explicit reopen,1000-code-point remarks, optimistic version, stable update request UUID.
  -20-item deterministic pages, validated page0–999999, explicit DB reference time; no notes/contacts in operational summaries/audits.
- No messaging/reporting, refunds/credits/forced changes, production policy or Phase9.5 redesign.

## Review Focus

- Lost-response case retry after later update returns conflict without overwrite (Task3/5).
- Customer feedback end-time/role/booking race shares existing lock order (Task2/5).
- Closing cases cannot hide source issues or change payment/booking/job facts (Task3/5).
- Page limits cannot be bypassed by raw RPC; source IDs/relationships cannot be forged (Tasks2–3/5).
- Disabled mode calls no private RPCs and preserves prior customer/admin tools; secrets/content stay out of browser bundles/logs (Tasks1/4–5).

### Task1: Validation and local mode

**Files:** `src/lib/local-features.ts`, `src/modules/feedback/model.ts`, `src/modules/admin-operations/model.ts`, `tests/unit/feedback-admin.test.ts`, `.env.example`.
**Interfaces:** `readFeedbackAdminMode(env)->disabled|local`; Zod feedback/case input schemas, strict list query parser and shared paged-result contracts. Use server-only configuration separately from browser-safe models.

- [x] Write/run failing tests for disabled/local/prod/host URL gates,1–5 integer ratings,2000/1000 Unicode limits, acknowledgement, strict UUID/page/filter validation and case action requirements.
- [x] Implement the contracts; run focused unit suite green.

### Task2: Feedback persistence and scoped reads

**Files:** `supabase/migrations/20261126000000_feedback.sql`, `supabase/tests/feedback_admin.test.sql`, `src/modules/feedback/server.ts`, `actions.ts`.
**Interfaces:** service RPCs `phase9_feedback_page(actor,booking)`, `phase9_feedback_summaries(actor,bookingIds<=20)`, `phase9_submit_feedback(actor,booking,rating,comment,ack)`, `phase9_feedback_list(actor,state,counselor,page)`, `phase9_review_feedback(actor,id)` return bounded explicit JSON. `phase9_assert_role(actor,role)` locks/checks complete profile; all new RPCs service-only. Server `feedbackRpc`/actions derive session actor, gate mode and parse outputs; no browser actor.

- [x] Write/run SQL tests before migration (missing RPC RED), covering ownership/role, exact end time/status, acknowledgement/limits, immutable retry/conflict/review/audit and direct grants.
- [x] Implement additive private feedback/audit schema and functions under existing advisory/participant lock order; apply incrementally and register local migration.
- [x] Implement server/action adapters with safe errors and draft-preserving results; focused SQL green.

### Task3: Operational queries and exception workflow

**Files:** `supabase/migrations/20261126000001_admin_operations.sql`, same SQL test, `src/modules/admin-operations/server.ts`, `actions.ts`.
**Interfaces:** service RPCs `phase9_overview(actor)`, `phase9_bookings(actor,view,counselor,booking,page)`, `phase9_cases(actor,state,page)`, `phase9_case_detail(actor,id,page)`, `phase9_open_case(actor,sourceType,sourceId,remark,ack)`, `phase9_update_case(actor,id,expected,request,action,remark,ack)`; paged envelopes/as_of, update returns accepted/current versions and replay flag.

- [x] Add failing SQL cases for absent RPCs, source uniqueness/validation, statuses/version/replay/stale/changed payload/closure/reopen, role/direct grants, audit secrecy, full counts and>20 stable pages.
- [x] Implement private case/events/receipt/audit with exact-one-source FKs, source-derived linkage/live facts, immutable source and atomic changes. No source mutation. Apply incremental migration.
- [x] Implement trusted adapters/actions; run complete new SQL suite green, including unchanged source snapshots.

### Task4: Customer/admin UI

**Files:** feedback editor/review components, operations components, new `/bookings/[bookingId]/feedback`, `/admin/feedback`, `/admin/bookings`, `/admin/exceptions[/caseId]`; modify portal/admin/home composition, CSS, types; shared `src/components/draft-guard.ts` for memory-only discard prompts.
**Interfaces:** existing portal gets batch feedback summary map without changing SQL contract. New typed server adapters feed forms/lists; action states saved/existing/conflict/error preserve input/request IDs. Existing admin heading/links remain; new links available only enabled and matching role.

- [x] Read installed Next connection/forms/server-actions/error docs. Add generated browser fixture/test with expected feedback form/dashboard/cases; observe missing UI RED.
- [x] Implement composing pages and module-owned forms/lists/filters/counts/case history/status actions; safe unavailable/retry states. Exact source IDs visible for existing specialist tools.
- [x] Protect dirty drafts on links/unload/explicit reload; keyboard/mobile/plain-text output, service-key-free client code; focused browser green.

### Task5: Validation, review and records

**Files:** `tests/e2e/feedback-admin.spec.ts`, local guide, all standard project docs, plan ledger.

- [x] Expand real browser/live DB acceptance for concurrent feedback/case changes, ambiguous retries/stale requests, exact counts/pages and source facts unchanged; cross-role/direct/raw denial; disabled mode and existing regression.
- [x] Run lint/typecheck/unit, all SQL and isolated migration replay, safe full browser (pause/restore owned poller), disabled production build, formatting/diff/secret/static marker checks. Inspect mobile and keyboard journey. Preserve all demo IDs/settings; only exact disposable fixtures cleaned up.
- [x] Independent whole-change review, material finding RED->GREEN fixes; no re-review loop unless needed to clarify a finding.
- [x] Document actual results, manual testing, RPC/route information, local-only plaintext feedback/remarks vs encrypted notes, defaults/limits and deferred work. Enable ignored local flag only; no keys printed. Leave changes uncommitted.

## Self-review

Spec sections map to Tasks1–5; SQL ownership and narrow grants remain independent of server checks. Customer portal contract remains intact, aggregate definitions and case/source facts remain distinct, and replay/current-version distinction is explicit. Validation is native in-place per user instruction; no further design or execution-method question is needed.
