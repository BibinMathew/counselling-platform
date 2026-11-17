# Development

## Toolchain

- macOS, Git, and Homebrew
- Node.js `26.13.1`, pinned in `.node-version`
- pnpm `12.21.0`, pinned in `package.json`
- Next.js `16.4.6`, React `19.3.0`, TypeScript `5.9.3`
- Vitest `5.1.0`, Playwright `1.65.1`, and Prettier `3.10.1`
- Docker Desktop is not required unless and until local Supabase development is approved.

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

The current placeholder app is available at <http://localhost:3000>. It does not need `.env.local` or a Supabase connection. `.env.example` contains local placeholder values only.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm format:check
```

Playwright starts the development server automatically. Install Chromium once per machine. GitHub Actions runs lint, typecheck, unit tests, the Chromium smoke test, and the production build. Formatting is currently available as a local check.

## Module Workflow

1. Read the full requirements and current project docs; identify the next approved module and its unresolved decisions.
2. Define its scope, interfaces, migration impact, authorization boundaries, and acceptance tests before implementation.
3. Implement only that module, with synthetic local test data and no live provider credentials unless explicitly approved.
4. Run relevant lint, typecheck, tests, and build checks; add or update tests to cover the module's acceptance criteria.
5. Update `ARCHITECTURE.md`, `DATABASE.md`, `DEVELOPMENT.md`, `DECISIONS.md`, `PROGRESS.md`, and `README.md` where relevant. Record actual test commands and results.
6. Summarize changed files, security considerations, failures or limitations, and unresolved decisions. Stop for human review; do not start the next module or commit unless requested.
