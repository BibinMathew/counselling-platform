# Architecture

## Status

**Implemented:** Phase 0 is a Next.js App Router application using TypeScript, React, and a modular-monolith structure. The application builds as a production bundle. The customer, counselor, and admin routes are static placeholders only.

**Planned:** Domain modules will be introduced one at a time under `src/modules/` as their phases are approved. Authentication, booking, payments, notifications, messaging, notes, roles, and admin workflows are not implemented.

## Boundaries

- `src/app/` owns route composition and layouts; it must not become the home for domain rules.
- `src/modules/<domain>/` will own a module's behavior and domain-specific UI when that module is approved.
- `src/lib/` contains shared, domain-neutral infrastructure. Supabase browser and server client factories are separate.
- Browser code may use only the public Supabase URL and anon key. Server-side authorization and database RLS must both protect privileged data and mutations.
- No service-role client, production credentials, or external provider connection is configured.
- Database schema is managed through versioned Supabase migrations. Phase 0 contains no application schema.

See [ADR 0001](docs/architecture/ADR-0001-modular-monolith.md) and [audit conventions](docs/architecture/audit-conventions.md) for the recorded decisions and constraints.

## Planned Module Boundaries

The sequence below follows the requirements and is not a claim that the modules exist:

1. Identity and roles
2. Counselor catalog
3. Availability
4. Bookings
5. Payments
6. Meet and notifications
7. Customer portal
8. Counselor workspace
9. Feedback and administration
10. Hardening and launch

Do not split into services unless later measured needs justify that operational cost.

## Cross-Cutting Risks

- Booking and payment state must be made concurrency-safe and idempotent at the server/database boundary.
- Counseling notes, messages, and booking history require strict authorization, data minimization, and defined retention policies before storing real data.
- Minors, counselor eligibility, crisis response, exception refunds, messaging boundaries, and privacy/legal review remain unresolved launch gates. See `DECISIONS.md` and `PROJECT_REQUIREMENTS.txt`.
