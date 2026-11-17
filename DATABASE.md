# Database

## Current State

**Implemented:** `supabase/config.toml` provides local Supabase project configuration, `supabase/migrations/` is reserved for versioned SQL migrations, and `src/types/database.types.ts` is an empty typed database placeholder. The browser and server Supabase client factories read validated public configuration only when called.

**Not implemented:** No application tables, migration SQL, RLS policies, auth configuration, seed data, hosted project connection, or production credentials exist. Phase 0 does not require Docker or start Supabase.

## Migration Rules

- Add schema changes as reviewed, ordered SQL migrations under `supabase/migrations/` within the approved module that owns them.
- Define foreign keys, indexes, unique constraints, RLS policies, access boundaries, and deletion/retention behavior with each relevant schema change.
- Keep generated TypeScript database types synchronized with the approved schema and migration state.
- Keep local-only test data synthetic. Do not put real counseling or customer data in seeds, fixtures, logs, or CI.
- Never expose a Supabase service-role key to browser code. Server-side access does not remove the need for authorization checks and RLS.

## Proposed Data Model

The following entities are **proposals from the requirements, not implemented schema**: profiles, counselors, availability rules and exceptions, slot holds, appointments, payments and payment events, notifications, messages, session notes, feedback, and audit events. Their columns and relationships still require migration-level design and review.

Before implementing bookings, decide and test the database mechanism that prevents overlapping counselor appointments and overlapping customer bookings, including slot holds and expiry. Payment-event uniqueness, idempotent confirmation, reschedule limits, and authorization must also be enforced outside client-only logic.

Before storing notes or messages, resolve consent, access, retention, deletion, incident response, and counselor-switching policies. Do not infer these from the proposed table list.

## Local Supabase

Local Supabase development is deferred. When an approved module needs it, install/use the Supabase CLI and Docker Desktop, start the local stack, apply migrations, generate database types, and test RLS locally. No production project should be linked for Phase 0.
