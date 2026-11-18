# Counseling Platform

A responsive counseling booking platform built as a modular Next.js monolith. Phase 0 foundation, Phase 1 identity/roles, Phase 2 counselor catalog, and Phase 3 availability are implemented locally. Contact email is captured once after phone OTP, without email verification or email OTP. Bookings, payments, messaging, notes, and session operations remain unimplemented.

## Requirements

- macOS with the Xcode Command Line Tools
- Node.js `26.13.1` (pinned in `.node-version`)
- pnpm `12.21.0` (pinned in `package.json`)
- Git
- Docker Desktop and Supabase CLI `3.2.0` for local Auth and RLS tests

Docker is needed only for local Supabase services. The homepage, lint, typecheck, unit tests, and build do not require it; the catalog and identity workflows require Supabase.

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

Open <http://localhost:3000>. The public page does not require Supabase configuration. For local sign-in and role routes, start Docker Desktop and the local Supabase stack:

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

Visitors can browse `/counselors` and see available times on published profiles. Counselors manage their own weekly hours and date exceptions at `/counselor/availability`; admins manage counselor schedules and global settings from the admin area. Times use Asia/Kolkata. Admins manage profiles at `/admin/counselors`, using counselor-role account IDs and approved HTTPS image links. Unpublished profiles and linked account IDs are not public. External image hosts receive visitors' image requests. Displayed times are not reservations; booking is not implemented.

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

## Architecture

The app is one Next.js App Router application with domain modules added incrementally under `src/modules/`. Phase 1 implements phone OTP, one-time contact-email capture, customer-default profiles, a single canonical role, server-side role guards, and database RLS. Phase 2 adds an audited admin catalog and a limited public counselor view. Phase 3 adds audited schedules and server-generated slots with configurable session and booking-window settings. The Supabase browser/server clients are separate; the Next.js 16 Proxy refreshes claims, while server data access and RLS independently authorize requests. No service-role client, production credentials, live SMS, or production connection is configured in the app.

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
│   │   └── 20261120000001_public_session_settings.sql
│   ├── tests/
│   │   ├── availability.test.sql
│   │   ├── counselor_catalog.test.sql
│   │   └── identity_rls.test.sql
│   ├── config.toml
│   └── README.md
├── tests/
│   ├── e2e/
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
