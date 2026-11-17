<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Working Rules

- Read `PROJECT_REQUIREMENTS.txt` before starting a module. Treat it as the product source of truth and do not modify it unless explicitly asked.
- Work on one approved phase or module at a time. Before coding, state the local plan and unresolved decisions. Do not start a later module without approval.
- Treat `PROGRESS.md` as the implementation record. Distinguish implemented behavior from planned or proposed behavior, record commands and outcomes, and stop for review after each module.
- After each approved module, update the relevant parts of `ARCHITECTURE.md`, `DATABASE.md`, `DEVELOPMENT.md`, `DECISIONS.md`, `PROGRESS.md`, and `README.md` as applicable. Never mark a planned feature implemented unless it exists and has been verified.
- Keep the application a modular monolith. Route files compose pages; domain modules own their behavior; shared infrastructure stays domain-neutral.
- Keep privileged logic and credentials server-side. Browser code may use only explicitly public configuration. Enforce authorization in trusted server logic and database RLS; do not trust browser-provided roles or customer IDs.
- Add database changes through versioned migrations. Do not create product tables, policies, or workflows ahead of the approved module.
- Keep sensitive counseling content, credentials, OTPs, and payment secrets out of logs, audit metadata, and public environment variables.
- Use the exact Node.js and pnpm versions pinned in `.node-version` and `package.json`. Run the relevant lint, typecheck, unit, integration, and end-to-end checks for the changed module and record their results.
- Before changing Next.js code, follow the generated Next.js rule above and read the relevant guide under `node_modules/next/dist/docs/` for the installed version.
- Do not connect production services, use real customer data, or implement an unapproved business feature. Do not commit unless explicitly requested.

- When I request a requirement change or new module, analyze the impact first. Identify affected modules, database, APIs, security, and tests. Present a plan and wait for approval. Then update documentation, implement, test, and commit. Never silently change existing product decisions.
