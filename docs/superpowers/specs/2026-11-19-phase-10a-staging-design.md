# Phase 10A: littlehello private synthetic staging

Status: approved and implemented locally; the user subsequently explicitly approved and completed the hosted synthetic rollout, project-scoped automation bypass and seven-day tester link. See PROGRESS.md and the staging handoff for verified results and provider bootstrap limitations.

## Intent and agreed inputs

Provide three invited testers with the existing littlehello demonstration journeys online using fictional content, fixed test OTPs and fake payments. Git origin is https://github.com/BibinMathew/counselling-platform.git. Vercel account is bibinmathews-projects, initially on Hobby; the user subsequently upgraded to Pro, verified for the approved hosted rollout. The dedicated staging Supabase endpoint is https://wajqgyhugvcorgxgrdlv.supabase.co (user reports ap-southeast-1; verified empty before provisioning, now populated with fictional test data). No domain is purchased; use a generated vercel.app preview URL. Real SMS, real notifications, Razorpay, live collection, messaging and customer launch are deferred. No additional paid upgrade or expenditure is authorized.

Keep the existing modular monolith, UI, roles, booking/payment facts, encryption and authorization semantics. Preserve local data and local keys. This phase does not establish production privacy/age/clinical readiness.

## Approach and builder calls

The user chose explicit hosted simulation rather than a reduced core with payments disabled. Support named local/staging/production environments through a central domain-neutral validator; domain modules keep their own feature controls and behavior. Do not spoof NODE_ENV or change a production build into a development server.

Staging requires an explicit deployment-class setting, Vercel preview environment, exact approved Supabase endpoint/project reference and exact approved HTTPS app origin. Reject malformed URLs, wrong hosts/projects, credentials, extra paths, incompatible flags and partial configuration. Default deployed production remains disabled for synthetic/private modes. Retain current local gates and tests. New staging authorization supplements RLS, it never substitutes for it. Fail closed on hosting/configuration mismatch. Secrets are server-only.

Expose a clear persistent synthetic-staging banner and explicit fake-payment wording, with no suggestion money or messages are real. Private notes, feedback and case remarks accept fictional content only. Give staging its own newly generated encryption keyring and simulator/worker secrets. Never upload local keys, content, Auth exports or fixtures.

## Access and enrollment

Preferred initial path: Vercel-authenticated preview with one revocable shareable access link for the three testers, plus separate fixed-OTP app accounts and ordinary server/RLS role enforcement. A shareable link is a transferable bearer credential, not individual Vercel identity verification; keep it out of tracked docs/logs/chat and distribute privately. Verify the actual account permits this configuration before publishing a link. Anonymous requests without a protection credential must fail. Verify deployment URLs and branch aliases; do not publish an unprotected production alias.

Hobby allows limited external collaboration and no built-in password protection. Do not promise three individually invited Vercel collaborator seats. If preview link sharing is unavailable or unsuitable, stop hosted rollout and propose an alternative for user approval, keeping local work reviewable. No silent plan upgrade or weakening access protection.

Create synthetic Auth accounts for customer, counselor and admin; three testers can be assigned these demonstration roles, with additional disposable customer fixtures only for automated acceptance. Precreate accounts through operator tooling; disable new public signups and real SMS sending in hosted Auth. Configure only dedicated staging test phone/code pairs, distribute privately and verify unknown-number OTP/signup requests through both app and direct Auth API are rejected. Server access must reject users outside the configured staging user-ID allowlist; role checks and RLS remain in force. Test codes are not phone ownership verification. No credentials in source, UI banners, URLs or test output. Confirm Auth's supported settings achieve these invariants before accepting rollout; no custom production authentication flow is introduced.

## Data, migrations and seed

Inspect hosted migration history/schema read-only before any remote write. User reports this project is empty; unexpected schema/data requires a non-destructive reconciliation decision. Apply committed migrations sequentially to this project only; never run a remote reset. Seed idempotent fictional counselors, availability and representative appointments through supported operator/service boundaries with provenance identifiers. Never invent captured production payments or bypass booking integrity. Synthetic payment states must be produced by the simulator or an explicitly isolated synthetic seed path using existing invariants. No real email delivery/contact information.

Record migration head, seed version and identifiers without private bodies. Repeated seed runs must not duplicate accounts/bookings. Normal cleanup targets only generated staging fixtures. Preserve current local records exactly.

## Payments and notification processing

Adapt simulator endpoints and reconciliation for the strict staging boundary; retain signatures, ownership, same-origin protections, idempotency, late-capture/slot conflict checks and genuine distinctions among held/confirmed/exception states. No Razorpay configuration is required; live provider mode remains unsupported.

Notifications stay a synthetic outbox. Initial acceptance uses authenticated manual batch execution and existing admin retry controls; scheduled autonomous reminders are explicitly deferred within 10A, avoiding the local infinite poller and plan-dependent minute scheduling. Reconciliation can also be triggered manually through the existing authenticated operator endpoint. No public job-trigger button, exposed worker secret, fake automatic-delivery promise or public unauthenticated cron endpoint. Record this functional limitation in the tester guide. This scope choice needs design approval.

## Deployment and source workflow

Prepare a reviewed, secret-scanned source revision and coordinate the already-uncommitted earlier phases without discarding them. Committing/pushing is a distinct concrete handoff unless explicitly authorized; show the exact revision/file scope before publication. Deployment is a preview from reviewed source, not a production promotion. Verify Vercel's root directory from the actual repository root, frozen pnpm lockfile, Node26/pnpm12 toolchain and Next build compatibility. Cloud patch versions can differ from the exact local Node pin; validate and document the deployed runtime rather than claiming an exact cloud patch pin.

Store platform credentials via authenticated CLI/dashboard, not chat or tracked files. Configure preview-scoped environment variables only. Build artifacts/public environment variables must contain no service-role, keyring, simulator or worker secrets. Block or withhold deployment until protection and Auth enrollment restrictions can be configured before tester access. The local application and worker continue separately.

## Verification and recovery

Add configuration matrix tests for local/staging/production and all partial/wrong-project/origin cases. Test uninvited app/Auth enrollment rejection and direct database RLS, not just hidden navigation. Reuse payment/booking/reschedule/notes/feedback/case concurrency, draft and role regressions. Verify secure preview access, all three roles, sign-out, mobile layouts, fake-payment confirmation/conflicts/retries, manual synthetic notification batches and secret/private-marker absence from browser assets and logs. Clean only disposable test fixtures.

Run lint, types, unit, SQL integration, isolated migration replay, relevant browser regression, disabled production build and staging production-mode build. Read installed Next documentation before framework edits. Record hosted results separately from local results. Use a fresh anonymous browser to prove deployment access protection.

Record deployed revision/environment/migration head and recovery runbooks. Application rollback selects a known-good deployment; it does not roll back database migrations. Take and verify an operator-controlled staging backup and test restore to an isolated disposable database/project without overwriting hosted staging. Backup storage and any cloud restore costs require budget authorization; if only local restore can be tested, record the boundary and leave hosted restore explicitly unverified. An empty-project schema-only migration replay is not sufficient backup verification.

## Remaining hosting condition and completion

Vercel documents Hobby for personal non-commercial use. Do not assume a business's staging deployment qualifies merely because payments are fake; user must confirm permitted use or choose an eligible plan/provider before deployment. Paid work requires explicit budget approval. Design and local implementation may proceed independently once approved.

Complete when the approved staging journeys are demonstrable behind verified protection, local/hosted checks pass, source/deployment and data recovery procedures are recorded with practical limits, and the three testers receive access securely. No customer launch, custom domain, real SMS, live payment, automated messaging or production promotion is part of completion.
