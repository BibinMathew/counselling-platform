# littlehello

A responsive counseling booking platform built as a modular Next.js monolith. Phases 0–9 implement foundation, identity, counselor catalog, availability, booking holds, payment-backed confirmation, manual Meet links, simulated notifications, the customer portal, and the counselor workspace with encrypted private notes, private feedback and operational admin tools locally. Contact email is captured once after phone OTP, without email verification or email OTP. Phase 5 includes a local payment simulator and Razorpay Test Mode adapter; real Razorpay testing awaits keys. Messaging, message reporting and booking/financial remedies remain deferred. Phase 8 accepts fictional content only and stays disabled in production.

## Requirements

- macOS with the Xcode Command Line Tools
- Node.js `26.13.1` (pinned in `.node-version`)
- pnpm `12.21.0` (pinned in `package.json`)
- Git
- Docker Desktop and Supabase CLI `3.2.0` for local Auth and RLS tests

Docker is needed only for local Supabase services. Lint, typecheck, unit tests, and build do not require it; the homepage counselor showcase, catalog and identity workflows require configured Supabase, except for the local-only catalog preview.

## macOS setup

Install Homebrew if it is not already installed, then install `fnm` and the pinned Node version:

```sh
brew install fnm
eval "$(fnm env --use-on-cd --shell zsh)"
fnm install 26.13.1
fnm use 26.13.1
npm install --global pnpm@12.21.0
```

Add this line to `~/.zshrc` so new terminal sessions select the project-pinned Node version:

```sh
eval "$(fnm env --use-on-cd --shell zsh)"
```

From the project directory, install dependencies and start the public app:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. The page shell may render without Supabase, but its counselor showcase requires configuration or the local-only preview described in [DEVELOPMENT.md](DEVELOPMENT.md). For local sign-in and role routes, start Docker Desktop and the local Supabase stack:

`supabase db reset` destroys local database contents. Use `supabase migration up` instead when preserving existing local data.

```sh
supabase start 2>&1 | sed -E 's/(ANON_KEY|SERVICE_ROLE_KEY|SECRET_KEY|JWT_SECRET|PUBLISHABLE_KEY).*/\1=[REDACTED]/g'
supabase db reset
pnpm test:integration
```

Export only the local API URL and publishable key before running the app or auth E2E tests:

```sh
eval "$(supabase status --output env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL --override-name auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | sed -n '/^NEXT_PUBLIC_SUPABASE_URL=/p; /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/p')"
export NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
pnpm dev
```

Local Auth accepts only the fixed test phone/OTP pairs in `supabase/config.toml`; placeholder SMS-provider settings never send SMS. Never push those test OTPs or local service keys to a hosted project. The current 18+ check is a temporary self-attestation, not age verification. Do not deploy this auth flow for real users until age/guardian policy is reviewed. Never put service-role credentials in `NEXT_PUBLIC_*` variables.

After the first successful phone OTP, accounts without a contact email must complete `/complete-profile` before entering protected areas. The email is captured once and is not verified or used to authenticate. No email OTP is sent.

Visitors can browse `/counselors` and select available times on published profiles. Signed-in customers can create temporary holds and see them at `/bookings`; a hold becomes confirmed only after verified captured payment. Configure the local simulator or Razorpay Test Mode using [the payment testing guide](docs/payments-local-testing.md). Counselors manage their own weekly hours and date exceptions at `/counselor/availability`; admins manage schedules and hold settings from the admin area. Times use Asia/Kolkata. Admins manage profiles at `/admin/counselors`, using counselor-role account IDs and approved HTTPS image links. Unpublished profiles and linked account IDs are not public. External image hosts receive visitors' image requests.

The public landing page uses the littlehello design and links to the existing counselor directory, category filters, booking information and FAQs. Counselor details remain sourced from the catalog; fictional profiles are restricted to the explicitly enabled local preview.

The customer bookings and account profile pages also use the littlehello visual style. The profile shows an editable preferred name, read-only sign-in phone and unverified contact email, and account creation date. Customer profiles link to bookings; phone/email changes and account deletion are not implemented. Other workspaces retain their previous styling.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Playwright starts the app automatically. Its OTP journey requires local Supabase configuration; without it, only the homepage smoke test runs. CI starts Supabase locally and runs lint, typecheck, unit/RLS tests, E2E tests, and the production build.

Private hosted staging is only a proposal; no deployment or DNS change has been approved. See the [staging policy](DEVELOPMENT.md#proposed-private-staging-policy) for the Node version conflict, isolation and access requirements, and unresolved deployment gates.

## Architecture

The app is one Next.js App Router application with domain modules added incrementally under `src/modules/`. Phase 1 implements phone OTP, one-time contact-email capture, customer-default profiles, a single canonical role, server-side role guards, and database RLS. Phase 2 adds an audited admin catalog and a limited public counselor view. Phase 3 adds audited schedules and server-generated slots. Phase 4 adds customer-owned pending holds, database-enforced overlap protections, and one-time rescheduling. Phase 5 adds immutable price snapshots, audited payment records, verified confirmation, late-payment checks, and reconciliation. The Supabase browser/server clients are separate; the Next.js 16 Proxy refreshes claims, while server data access and RLS independently authorize requests. Phase 5 adds a server-only service client for payment ingestion and reconciliation; its credentials never reach the browser. No production credentials, live SMS, or production connection is configured.

Database changes belong in versioned SQL migrations under `supabase/migrations/`. Phase 1 adds profiles, role-audit events, and the one-time contact-email operation. See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [DEVELOPMENT.md](DEVELOPMENT.md), [DECISIONS.md](DECISIONS.md), and [PROGRESS.md](PROGRESS.md) for the persistent project record; [ADR 0001](docs/architecture/ADR-0001-modular-monolith.md) and [audit conventions](docs/architecture/audit-conventions.md) capture supporting details. [PROJECT_REQUIREMENTS.txt](PROJECT_REQUIREMENTS.txt) remains the full product specification.

## Project structure

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   └── architecture/
│       ├── ADR-0001-modular-monolith.md
│       └── audit-conventions.md
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── availability/page.tsx
│   │   │   ├── counselors/[id]/availability/page.tsx
│   │   │   ├── counselors/page.tsx
│   │   │   └── page.tsx
│   │   ├── book/page.tsx
│   │   ├── bookings/page.tsx
│   │   ├── counselors/
│   │   │   ├── [id]/page.tsx
│   │   │   └── page.tsx
│   │   ├── counselor/
│   │   │   ├── availability/page.tsx
│   │   │   └── page.tsx
│   │   ├── customer/
│   │   │   └── page.tsx
│   │   ├── complete-profile/
│   │   │   └── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── unauthorized/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── env.ts
│   ├── modules/
│   │   ├── booking/
│   │   │   ├── components/booking-form.tsx
│   │   │   ├── server/bookings.ts
│   │   │   ├── actions.ts
│   │   │   └── return-path.ts
│   │   ├── availability/
│   │   │   ├── components/availability-editor.tsx
│   │   │   ├── server/availability.ts
│   │   │   └── actions.ts
│   │   ├── catalog/
│   │   │   ├── components/counselor-form.tsx
│   │   │   ├── server/catalog.ts
│   │   │   └── actions.ts
│   │   └── identity/
│   │       ├── components/
│   │       │   ├── login-form.tsx
│   │       │   ├── contact-email-form.tsx
│   │       │   ├── profile-form.tsx
│   │       │   └── role-assignment-form.tsx
│   │       ├── server/
│   │       │   └── access.ts
│   │       ├── actions.ts
│   │       ├── phone.ts
│   │       └── roles.ts
│   └── types/
│       └── database.types.ts
├── supabase/
│   ├── migrations/
│   │   ├── 20261117000000_identity_and_roles.sql
│   │   ├── 20261118000000_capture_contact_email_once.sql
│   │   ├── 20261119000000_counselor_catalog.sql
│   │   ├── 20261119000001_public_counselor_view.sql
│   │   ├── 20261119000002_public_counselor_role_filter.sql
│   │   ├── 20261119000003_catalog_update_privileges.sql
│   │   ├── 20261120000000_availability.sql
│   │   ├── 20261120000001_public_session_settings.sql
│   │   ├── 20261121000000_booking_holds.sql
│   │   ├── 20261121000001_booking_schedule_protection.sql
│   │   ├── 20261121000002_booking_customer_list.sql
│   │   ├── 20261121000003_booking_time_and_audit.sql
│   │   ├── 20261121000004_reschedule_cutoff.sql
│   │   └── 20261121000005_booking_participant_locks.sql
│   ├── tests/
│   │   ├── availability.test.sql
│   │   ├── booking_holds.test.sql
│   │   ├── booking_reschedule.test.sql
│   │   ├── counselor_catalog.test.sql
│   │   └── identity_rls.test.sql
│   ├── config.toml
│   └── README.md
├── tests/
│   ├── e2e/
│   │   ├── booking.spec.ts
│   │   ├── catalog.spec.ts
│   │   └── homepage.spec.ts
│   └── unit/
│       ├── env.test.ts
│       └── identity.test.ts
├── .env.example
├── .gitignore
├── .node-version
├── .npmrc
├── .prettierignore
├── .prettierrc.json
├── ARCHITECTURE.md
├── AGENTS.md
├── DATABASE.md
├── DECISIONS.md
├── DEVELOPMENT.md
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── playwright.config.ts
├── proxy.ts
├── PROJECT_REQUIREMENTS.txt
├── PROGRESS.md
├── README.md
├── tsconfig.json
└── vitest.config.mts
```

`src/modules/<domain>/` is created only when that module is approved. Generated files such as `next-env.d.ts` and `*.tsbuildinfo`, plus local artifacts such as `node_modules/`, `.next/`, test reports, and `.env.local`, are ignored by Git.

## Phase 5 payments

Start with [Local payment setup and testing](docs/payments-local-testing.md). The default mode is `disabled`; `simulator` runs only with local Supabase under a development/test runtime, and `razorpay` accepts Test Mode keys only. The current local workspace is configured for the simulator. Admins manage price and exceptions at `/admin/payments`; customers pay or recheck payment from `/bookings`. Failed attempts do not extend the original hold. Late captured payment confirms only a free, valid future slot, otherwise it becomes an admin exception. No automatic refunds or production collection are implemented.

```sh
pnpm test:integration
pnpm test:migrations
pnpm test:e2e --grep-invert 'local customer can sign in and is denied the admin area'
pnpm payments:local reconcile
```

The database test runner uses Docker directly; set `LOCAL_SUPABASE_RANCHER=1` in ignored local configuration for Rancher Desktop. The migration check creates and removes only a randomly named disposable database in the local container. Browser tests use temporary synthetic accounts. The existing customer OTP test changes the persistent customer profile, so exclude it when preserving demo data.

## Phase 6: Meet and simulated notifications

Admins attach unique manual Google Meet links at `/admin/appointments`; confirmed customers and assigned counselors see their authorized Join Meet links. `/admin/notifications` provides the local synthetic outbox, previews and retry controls. Booking confirmation/rescheduling atomically schedule updates and eligible 24-hour/1-hour reminders. No real messages are sent. See [local Meet and notification testing](docs/notifications-local-testing.md) for configuration, worker commands, recovery and launch limitations.

## Phase 7: Customer portal

`/bookings` now offers All, Upcoming, Past and Holds views with20-row pagination, authorized Meet/payment controls, stored payment totals and Book Again for eligible past counselors. Past appointments retain their actual status. Rebooking uses fresh current availability and checkout; successful Holds payment and rescheduling locate the exact booking even on a later page. See [customer portal testing](docs/customer-portal-local-testing.md).

The landing page now adapts to the current server-verified account: signed-out visitors see phone sign-in; signed-in users see Sign out, their profile and links for their customer, counselor or admin role. Accounts missing their required contact email see Complete profile before role navigation. Protected pages independently enforce authorization.

## Phase 8 counselor workspace and private notes

Counselors use `/counselor` for assigned Upcoming/Past sessions and `/counselor/appointments/[bookingId]` for details and their private note. Local notes use server encryption, explicit fictional-content acknowledgement and version/conflict protection. Default disabled mode retains the basic counselor page. Messaging and message reports are deferred. See [workspace and note testing](docs/workspace-notes-local-testing.md) for manual acceptance, local configuration, key rotation and limits.

## Phase 9 private feedback and administration

After a confirmed appointment ends, its customer may submit one private 1–5 rating and optional comment. Admins review feedback, inspect operational counts/bookings and track source-linked cases separately from payment/booking facts. Local fictional content only; no refunds, credits or forced booking changes. See [manual testing, routes and RPCs](docs/feedback-admin-local-testing.md). UI/UX polish is Phase 9.5, followed by Phase 10 hardening.

## Phase 9.5 interface polish

The app uses the approved crisp white/blue visual system across public discovery, identity and all role workspaces. A verified-role header, light desktop sidebar and accessible mobile Menu provide navigation; one global sign-in/sign-out control preserves booking return paths and dirty-draft confirmation. Public pages, appointment/date/status cards, calendars, operational metrics and forms share readable responsive styles. Existing rules/data/local-only gates remain unchanged. See [UI/manual acceptance](docs/ui-polish-local-testing.md). The project owner reports Phase 10 hardening implemented; no production launch is implied while external-provider, privacy, clinical, legal, and operational gates remain unresolved.

## Public counselor discovery

The homepage presents published counselor profiles and browsable categories: Consultant Psychologist, Clinical Psychologist, Sexual Health, and Psychiatrist. Profiles include qualifications and experience, with no individual verification badge; qualifications must be checked operationally before publication. Admins assign one category per counselor. Local UX-only fictional profiles are opt-in, visibly labeled, and non-bookable; set `CATALOG_DEMO_MODE=local` with a loopback Supabase URL for local review. Never enable this mode on hosted environments.
