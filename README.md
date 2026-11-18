# Counseling Platform

A responsive counseling booking platform built as a modular Next.js monolith. Phase 0 foundation and Phase 1 identity/roles are implemented. Contact email is captured once after phone OTP, without email verification or email OTP. Catalog, availability, bookings, payments, messaging, notes, and session operations remain unimplemented.

## Requirements

- macOS with the Xcode Command Line Tools
- Node.js `26.13.1` (pinned in `.node-version`)
- pnpm `12.21.0` (pinned in `package.json`)
- Git
- Docker Desktop and Supabase CLI `3.2.0` for local Auth and RLS tests

Docker is needed only for local Supabase services. The public page, lint, typecheck, unit tests, and build do not require it.

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

The app is one Next.js App Router application with domain modules added incrementally under `src/modules/`. Phase 1 implements phone OTP, one-time contact-email capture, customer-default profiles, a single canonical role, server-side role guards, and database RLS. The Supabase browser/server clients are separate; the Next.js 16 Proxy refreshes claims, while server data access and RLS independently authorize requests. No service-role client, production credentials, live SMS, or production connection is configured.

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
│   │   │   └── page.tsx
│   │   ├── counselor/
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
│   │   └── 20261118000000_capture_contact_email_once.sql
│   ├── tests/
│   │   └── identity_rls.test.sql
│   ├── config.toml
│   └── README.md
├── tests/
│   ├── e2e/
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
