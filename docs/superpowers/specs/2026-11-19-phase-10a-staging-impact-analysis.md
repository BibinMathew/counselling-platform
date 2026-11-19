# Phase 10A staging impact analysis

Status: discovery and proposed approach; not approved for implementation or deployment.

## User inputs

- GitHub origin: https://github.com/BibinMathew/counselling-platform.git (matches local origin).
- Vercel account/team: bibinmathews-projects, Hobby plan.
- Supabase endpoint: https://wajqgyhugvcorgxgrdlv.supabase.co, user-reported region ap-southeast-1.
- Domain not purchased; no custom staging domain requested. Use an assigned vercel.app URL.
- Three invited testers, fixed test OTPs initially; real SMS later.
- No Razorpay credentials; user wants to test existing behavior.
- Budget unspecified; no paid resources or upgrades authorized.

## Approaches to choose

Recommended: restricted synthetic staging with explicit staging-only simulation for payments/notifications and explicit hosted staging gates for notes/feedback/admin. This preserves the local demonstration journeys, requires more engineering than disabled features, and must not relax production restrictions globally.

Alternative: smaller hosted core with payments/notifications/notes/feedback/operational admin disabled. This is faster but cannot exercise a new payment-confirmed appointment end to end. Preseeded fictional bookings may demonstrate existing appointment views without representing a real transaction.

## Impact

Runtime configuration currently enforces development/test and loopback Supabase for simulation/private features. A deployment cannot reuse local environment variables unchanged. Changes would affect environment classification, exact hosted-project/origin restrictions, server route checks, identity enrollment restrictions, private-content key configuration, seed tooling, deployment configuration, migration workflow, tests and documentation. Domain modules retain behavior; RLS/role checks remain authoritative. Production stays default-disabled for synthetic features.

A Vercel deployment URL is not an access boundary. Select and verify a protection method suitable for three testers under the actual plan. Vercel built-in password protection is unavailable on Hobby; authenticated previews and any proposed app-side gate need explicit design. App protection alone does not protect direct Supabase Auth/Data APIs: restrict staging signup/accounts and retain RLS. Fixed OTPs are synthetic credentials, not real phone verification. No real counseling content or live payments.

Hosted workers cannot rely on the local infinite polling process. Either implement authenticated staging job execution compatible with the selected host or explicitly defer automated delivery and document manual batch acceptance. Simulated notifications never send real messages.

Before remote mutations, verify the supplied Supabase project is dedicated to fictional staging and inspect its migration/data state read-only. Do not reset, overwrite or import local data. Generate fresh staging encryption/secrets; never upload local private notes or keys. No credentials go into this document or source control.

Validate local/staging/production configuration boundaries, exact project/origin checks, uninvited enrollment/access denial, role/RLS isolation, fake-payment idempotency, key secrecy, hosted browser journeys, migration replay and rollback/restore procedures. Avoid claiming private staging until protection is tested from an anonymous browser.

## Remaining inputs

User confirmed the project is dedicated to staging with no data and selected full online simulated payments. Read-only hosted verification still precedes remote writes. Establish a spending limit before any paid resource. Select secure credential provisioning during implementation. No commit/push/deployment or hosted data mutation has occurred in this discovery step.
