# Phase 8 Workspace and Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, native in-place execution as previously selected by the user. Track checkbox steps; no commits.

**Goal:** Implement the user-approved reduced Phase8 workspace and encrypted counselor-only notes; messaging/reporting deferred.

**Architecture:** Authenticated read RPCs scope session summaries to assigned counselor; service-only private note RPCs recheck the session-derived actor. Server actions validate local mode, encrypt/authenticate content and use atomic optimistic versions/request receipts. Disabled mode preserves the old counselor page.

**Tech Stack:** Existing Next16.4.6/React/TypeScript/Supabase/Zod/Node crypto; Node26.13.1, pnpm12.21.0. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-19-phase-8-counselor-workspace-design.md`, approved by user with messaging deferred.

## Global Constraints

- Local synthetic content only; default disabled; no messages or message reports.
- Keep existing payment/booking/Meet/availability/portal/home functionality and demo data.
- 20-row pages, database-time categories, no new booking statuses.
- Owner-only encrypted notes,20000 Unicode points, explicit acknowledgement, conflict-safe versioning and idempotency.
- Server-only keys/service credentials; raw browser access denied; safe errors and content-free audit.
- Read installed Next guides before edits; incremental migrations, no resets or commits.

## Review Focus

- Lost-response retry after a later save must not overwrite current content (Task2–4).
- Key rotation retains decryptability and retry identity while old key exists (Tasks1–4).
- Unreadable stored ciphertext cannot be overwritten through a forged save (Tasks2–4).
- Customer/admin/foreign counselor cannot learn note content/existence (Tasks2–4).
- Disabled/production routes cannot bypass local gates through server actions or raw RPC (Tasks2–4).

### Task1: Local configuration and crypto

**Files:** `src/lib/private-content/config.ts`, `crypto.ts`, `tests/unit/private-content.test.ts`, `.env.example`.
**Contracts:** `readWorkspaceMode(env)` -> disabled/local; `readContentKeys(env)` -> active ID/keyring; `sealNote(text,keys,binding)`, `openNote(envelope,keys,binding)`, `noteDigests(text,expectedVersion,keys,bookingId,actorId)`.

- [x] Add failing unit tests for gates/keys and crypto identity/version/tamper/rotation/Unicode limits.
- [x] Implement strict envelope validation and purpose-separated crypto with no content in errors; unit suite green.

### Task2: Scoped database workspace and notes

**Files:** `supabase/migrations/20261125000000_workspace_notes.sql`, `supabase/tests/workspace_notes.test.sql`, types.
**Contracts:** `get_counselor_workspace(view,page)` safe paged JSON; `get_counselor_session(booking)` safe JSON/null. Service-only `read_session_note(actor,booking)` audited encrypted envelope/null; `save_session_note(actor,booking,noteId,expectedVersion,requestId,envelope,digestCandidates,activeKeyId,acknowledged)` -> accepted/current versions + replay flag.

- [x] Add transactional authority/state/version/receipt tests (pre-migration SQL RED evidence was not retained).
- [x] Implement raw-table RLS denial, narrowly granted functions and actor/assignment rechecks; scope summaries to counselor only. Save lock order and receipts atomic, no backfill.
- [x] Apply incrementally/record schema version; run SQL and isolated replay green.

### Task3: Workspace and editor UI

**Files:** `src/modules/counselor-workspace/**`, `src/modules/session-notes/**`, counselor route/detail page, CSS.

- [x] Add browser fixture covering assigned/past pages, details, acknowledgement, save/reload, stale tab and foreign roles; run to expose missing surface.
- [x] Read installed Next server-action/connection/form guides. Preserve basic view when disabled; local mode adds filters/details.
- [x] Server derives actor, authorizes details, audits read/decrypt, refuses overwrite of unreadable note; save action returns safe structured states. Editor preserves draft on conflict/failure, uses stable UUID until acknowledged success and explicit reload.
- [x] Verify mobile/keyboard and no contact/provider or private metadata leaks; unit/lint/types green.

### Task4: Full validation, independent review and documentation

**Files:** e2e/workspace test, local guide and project docs.

- [x] Exercise real concurrent/stale saves and duplicate retries, persistence ciphertext, rotation and unreadable-note protection; regenerate disposable fixtures only.
- [x] Pause owned local poller for race-sensitive suite; run unit/SQL/full safe browser/replay/disabled build, format/diff and secret/static-marker checks; restore poller.
- [x] Independent review; material findings get reproducing test then fix and affected checks.
- [x] Record actual counts, key handling/limits, deferred messaging/reporting, native/agent UI acceptance and preserved demo IDs. Enable only ignored local config with generated keys, never print them. Leave changes uncommitted.

## Self-review

Every reduced-scope design requirement maps to Tasks1–4. Crypto is domain-neutral; database authorization is independent of server checks; note-save replay and conflict semantics are explicit. Prior local/in-place authorization persists. No messaging, reporting, production policy or later phase is included.
