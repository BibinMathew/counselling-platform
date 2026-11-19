# Phase 10A Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Prepare locally verified, fail-closed hosted synthetic staging support and an operator deployment handoff without remote writes.

**Architecture:** Central environment policy validates the approved project, preview deployment and HTTPS origin. Domain feature readers consume it; server identity restricts synthetic enrollment and access. Operator commands and runbooks prepare seed/job/recovery work without deployment side effects.

**Tech Stack:** Existing Next16/React19/TypeScript/Supabase/Node26.13.1/pnpm12.21.0. No new dependency.

**Spec:** docs/superpowers/specs/2026-11-19-phase-10a-staging-design.md (approved for local implementation).

## Global Constraints

- Three testers, dedicated project wajqgyhugvcorgxgrdlv, simulated payments, no paid services, no hosted writes/commits/push/deploy in this execution.
- Keep existing local data/keys/workflows; production synthetic features default disabled; test OTPs only for staging accounts.
- Native execution in existing workspace is preserved from user authorization; one independent whole-change review.
- A real preview origin and Auth/provider/platform settings remain rollout inputs. Local tests cannot certify hosted protection or recovery.

## Review Focus

- A production build is not a production deployment: staging preview must work with NODE_ENV=production; production Vercel environment must reject it (Task1).
- Trusted credentials to the wrong project must never be used; a lookalike host/path/origin and partial staging config must fail (Task1/3).
- Uninvited users or arbitrary phone submissions must not obtain server access or initiate signup, including at the direct Auth boundary during hosted acceptance (Task2/3).
- UI must label simulation honestly without serializing staging IDs/keys or altering local draft guards (Task2/4).
- Job/seed commands must not follow redirects or mutate unapproved targets; recovery must distinguish code rollback from database restore (Task3/4).

## Task1: Environment and feature boundary

Files: src/lib/deployment.ts; existing payment/notification/workspace/feedback feature readers; tests/unit/staging.test.ts.
Interfaces: readDeployment(env) returns local|production|staging with staging appOrigin and allowedUserIds; requireSyntheticRuntime(env) permits original local development or fully validated staging; isStagingUserAllowed(env,id) validates identity membership. Staging config uses APP_ENV=staging, VERCEL_ENV=preview, exact project URL, STAGING_APP_ORIGIN matching HTTPS VERCEL_BRANCH_URL or VERCEL_URL, STAGING_ALLOWED_USER_IDS validated UUID list. APP_ENV=production or deployed production rejects synthetic modes. Feature modes explicitly opt into staging (workspace/feedback=staging; payment/notification=simulator).

- [x] Write and run failing behavior matrix against existing feature readers: valid preview support and invalid runtime/project/origin/config/production denial.
- [x] Implement central policy, integrate readers and server/service client setup so wrong targets cannot receive credentials.
- [x] Run focused and full unit suites; retain all old local/default-disabled cases.

## Task2: Identity and honest staging presentation

Files: identity actions/access; mode consumers in app/modules; root layout and new staging notice; tests/unit staging identity and browser acceptance.
Interfaces: staging phone request policy accepts only preconfigured synthetic numbers (STAGING_ALLOWED_PHONES list) and sets shouldCreateUser=false; verified user membership is checked before any profile mutation/read. Other environments retain existing behavior.

- [x] Write RED behavior tests for allowed/unknown phone and user, malformed/empty allowlists, conflicting feature modes and browser-visible notice.
- [x] Enforce phone/user policy, origin restriction on staging proxy requests (`src/proxy.ts`, beside src/app) and staging feature visibility; render a Suspense-owned server notice that exposes no configuration values. Update simulator/local-only wording to synthetic where appropriate.
- [x] Read installed Next proxy/metadata/connection docs before framework edits. Run affected tests and full unit suite.

## Task3: Operator preparation and deployment handoff

Files: scripts/staging-tools.mjs and focused shared policy import if needed; .env.staging.example, .gitignore; docs/staging-deployment.md; tests/unit/staging-tools.test.ts.
Interfaces: staging tools validate exact project and app origin before any request. Default check command is read-only; seed and jobs require explicit command and target confirmation. Use env-file locally (ignored); provision credentials out of chat. No code-reset or delete command. Seed accounts by stable synthetic phone/metadata version, check conflicts and report only IDs/roles; use existing admin catalog/scheduling UI for counselor setup and payment simulator for bookings rather than forging payment facts.

- [x] RED command tests: missing/invalid target/confirmation aborts before network; unknown command rejected; check never writes; seed reruns skip existing owned synthetic accounts and refuse conflicting ownership. Test via controlled local adapter only, never hosted project.
- [x] Implement safe preflight, idempotent account provisioning and manual bounded job runner with redirect/error/timeouts. Read-only migration/schema inspection is an explicit operator step; block seed on absent expected migration/schema and unexpected data.
- [x] Document exact secure setup, Auth disabled signup/test-phone verification, Vercel protected preview sharing, Git path/runtime and manual seed setup, fresh keys, backup/isolated restore/code rollback. Include remaining eligibility/budget/access checks with no success claims.

## Task4: Verification, review and records

Files: tests/e2e/staging.spec.ts; standard docs, approved design/impact/plan status and ignored ledger.

- [x] Run lint/types/unit/format; SQL integration/replay serial with browser fixtures; safe full browser regression and disabled production build. Validate production-mode preview build against inert configuration without contacting hosted Supabase; show fail-closed invalid config checks. Scan browser assets for configured secrets/private markers.
- [x] Independent whole-change review, reproduce/fix material findings RED->GREEN; no hosted deployment/access/recovery certification.
- [x] Preserve original local data fingerprint; restore owned worker after race tests; update docs with actual results and pending cloud handoff. No commit/push/deploy or later phase.

## Self-review

All approved design sections map to Tasks1–4; hosted access/DNS/platform/account settings cannot be locally proved and remain explicit rollout acceptance. Operator setup uses supported catalog/scheduling/payment flows and precreated Auth accounts, not arbitrary direct booking writes. Future automated scheduling and production integrations remain out of scope.
