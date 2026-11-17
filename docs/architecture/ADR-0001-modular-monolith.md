# ADR 0001: Modular monolith

- Status: Accepted for the MVP foundation
- Decision: Build one Next.js application with domain modules, backed by one Supabase PostgreSQL project.
- Boundaries: Route files compose pages; domain modules own their rules and use cases; shared infrastructure stays in `src/lib`.
- Trust boundary: Browser code may use only the public Supabase URL and anon key. Privileged operations and secrets remain server-side. Database row-level security complements server authorization.
- Integrations: Keep provider access behind server-side adapters when those modules are approved. Phase 0 does not connect external services.
- Consequences: The initial roster can be supported without distributed-service operations. Modules can be split later only if measured needs justify it.
