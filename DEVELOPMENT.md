# Development

## Toolchain

- macOS, Git, and Homebrew
- Node.js `26.13.1`, pinned in `.node-version`
- pnpm `12.21.0`, pinned in `package.json`
- Next.js `16.4.6`, React `19.3.0`, TypeScript `5.9.3`
- Vitest `5.1.0`, Playwright `1.65.1`, and Prettier `3.10.1`
- Supabase CLI `3.2.0` and Docker Desktop are required for local Auth/RLS integration tests.
- No production Supabase project or SMS provider is configured.

## Install and Run

Install and activate `fnm`, then install the pinned Node and pnpm versions:

```sh
brew install fnm
eval "$(fnm env --use-on-cd --shell zsh)"
fnm install 26.13.1
fnm use 26.13.1
npm install --global pnpm@12.21.0
```

Add `eval "$(fnm env --use-on-cd --shell zsh)"` to `~/.zshrc`. In a new terminal opened at the project:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The homepage works without `.env.local`. The counselor catalog and identity routes require the local Supabase stack and the local URL/publishable key; no service-role key is used by the app.

## Local Auth and Database

Start Docker Desktop, then start the local Supabase services. Redact the CLI's printed local keys in the terminal:

```sh
setopt pipefail
supabase start 2>&1 | sed -E 's/(ANON_KEY|SERVICE_ROLE_KEY|SECRET_KEY|JWT_SECRET|PUBLISHABLE_KEY).*/\1=[REDACTED]/g'
supabase db reset
pnpm test:integration
```

Export only the local API URL and publishable key before running the application or auth E2E tests:

```sh
eval "$(supabase status --output env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL --override-name auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | sed -n '/^NEXT_PUBLIC_SUPABASE_URL=/p; /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/p')"
export NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
pnpm dev
```

The same environment command can precede `pnpm test:e2e`. Only fixed phone/OTP pairs in `supabase/config.toml` work locally; the local SMS provider uses placeholders and sends no SMS. Do not copy test OTP configuration or local service keys to any hosted environment.

After the first successful phone OTP, a profile without contact email is sent to `/complete-profile`. Enter a synthetic address such as `local.customer@example.test`; it is stored once and is not verified. Accounts that already have a contact email are not prompted again. Email OTP is not part of this flow.

To bootstrap the first local admin, first sign in normally with a configured local test phone. Then, as the local project operator, look up that synthetic account's ID in `auth.users` and run the restricted operation:

```sh
supabase db query "select public.bootstrap_first_admin('AUTH_USER_UUID', 'First local admin bootstrap');"
```

This operation is not exposed to browser/authenticated roles. It works only when no admin exists and the target has a confirmed phone. No production bootstrap has been performed.

For local catalog management, sign in as an admin, grant the counselor role to a separate phone-authenticated test account using an opaque verification reference, then open `/admin/counselors`. Enter that account ID, profile information, and an admin-approved HTTPS image URL. A profile starts as a draft unless Published is checked. `/counselors` displays published profiles only. Use synthetic data locally. External image hosts receive requests directly from visitors; do not use a host without appropriate privacy review.

Counselors manage their own calendar at `/counselor/availability`. Admins open a counselor's availability from `/admin/counselors` and change global session, buffer, notice, advance, and hold-duration settings at `/admin/availability`. Weekly hours and date exceptions use Asia/Kolkata; blocks override openings, including the buffer. Slots are shown on published counselor profile pages. Active holds and confirmed appointments prevent conflicting availability changes. A catalog entry cannot be deleted while referenced by schedules or bookings.

Select a published slot, sign in as a customer and complete contact email if needed, then select **Hold this time**. The private `/bookings` page displays the hold and expiry; payment is not available, and a hold is not a confirmed appointment. Synthetic database fixtures exercise confirmed rescheduling only in tests; no public operation fakes payment or confirmation. Expired holds become publicly available immediately and are transitioned to expired on a later successful booking operation.

Apply newly added migrations to an existing local database with `supabase migration up`; unlike `supabase db reset`, this does not intentionally delete existing local data. The catalog and booking Playwright tests create and remove synthetic local accounts and obtain their local-only service key from `supabase status`; they refuse a non-local API URL. The application itself does not use this key. The older OTP customer browser test updates the existing fixed test customer's preferred name, so preserve that data before running the full browser suite locally.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm format:check
```

Playwright starts the development server automatically. Install Chromium once per machine. GitHub Actions runs lint, typecheck, unit tests, local Supabase RLS tests, the Chromium E2E suite, and the production build. Formatting is checked locally.

## Module Workflow

1. Read the full requirements and current project docs; identify the next approved module and its unresolved decisions.
2. Define its scope, interfaces, migration impact, authorization boundaries, and acceptance tests before implementation.
3. Implement only that module, with synthetic local test data and no live provider credentials unless explicitly approved.
4. Run relevant lint, typecheck, tests, and build checks; add or update tests to cover the module's acceptance criteria.
5. Update `ARCHITECTURE.md`, `DATABASE.md`, `DEVELOPMENT.md`, `DECISIONS.md`, `PROGRESS.md`, and `README.md` where relevant. Record actual test commands and results.
6. Summarize changed files, security considerations, failures or limitations, and unresolved decisions. Stop for human review; do not start the next module or commit unless requested.
