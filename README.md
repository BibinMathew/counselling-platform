# Counseling Platform

A responsive counseling booking platform built as a modular Next.js monolith. This repository currently contains only the Phase 0 foundation; the customer, counselor, and admin routes are placeholders with no business behavior.

## Requirements

- macOS with the Xcode Command Line Tools
- Node.js `26.13.1` (pinned in `.node-version`)
- pnpm `12.21.0` (pinned in `package.json`)
- Git

Docker is not required for the application, linting, unit tests, Playwright smoke test, or build. Install Docker Desktop only when starting local Supabase services in a later phase.

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

From the project directory, install dependencies and start the development server:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. The placeholder application does not require `.env.local` or a Supabase connection. `.env.example` contains local-only placeholder values for later development; replace them only when configuring local Supabase. Do not put service-role keys or other secrets in `NEXT_PUBLIC_*` variables.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Playwright starts the app automatically for its homepage smoke test. The browser installation is needed once per machine. CI runs lint, typecheck, unit tests, the Playwright smoke test, and the production build.

## Architecture

The app is one Next.js App Router application with domain modules added incrementally under `src/modules/`. Each approved module owns its domain behavior and UI; `src/app/` owns route composition, and `src/lib/` contains shared infrastructure. Supabase browser and server clients are separate. Only public Supabase configuration is supported here; no privileged client or production connection is configured.

Database changes belong in versioned SQL migrations under `supabase/migrations/`. Phase 0 intentionally adds no application tables. See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [DEVELOPMENT.md](DEVELOPMENT.md), [DECISIONS.md](DECISIONS.md), and [PROGRESS.md](PROGRESS.md) for the persistent project record; [ADR 0001](docs/architecture/ADR-0001-modular-monolith.md) and [audit conventions](docs/architecture/audit-conventions.md) capture supporting details. [PROJECT_REQUIREMENTS.txt](PROJECT_REQUIREMENTS.txt) remains the full product specification.

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
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── env.ts
│   └── types/
│       └── database.types.ts
├── supabase/
│   ├── migrations/
│   │   └── README.md
│   └── config.toml
├── tests/
│   ├── e2e/
│   │   └── homepage.spec.ts
│   └── unit/
│       └── env.test.ts
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
├── PROJECT_REQUIREMENTS.txt
├── PROGRESS.md
├── README.md
├── tsconfig.json
└── vitest.config.mts
```

`src/modules/<domain>/` is created only when that module is approved. Generated files such as `next-env.d.ts` and `*.tsbuildinfo`, plus local artifacts such as `node_modules/`, `.next/`, test reports, and `.env.local`, are ignored by Git.
