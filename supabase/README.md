# Supabase local development

`config.toml` is for the local Supabase stack only. Its fixed OTPs and placeholder SMS provider credentials must never be pushed to a hosted project. Remove `[auth.sms.test_otp]` and the placeholder SMS section before any future hosted configuration work.

Apply new versioned migrations to an existing local database with `supabase migration up`; run database authorization, availability, and booking tests with `pnpm test:integration`. `supabase db reset` destroys local database contents and reapplies migrations; use it only when discarding synthetic local data is intended. No project link or production credential is used by Phases 1–4.

Phase 5 adds payment migrations `20261122000000`–`20261122000002`. Apply incrementally with `supabase migration up`; do not reset existing demo data. See [payment local testing](../docs/payments-local-testing.md). `pnpm test:integration` executes transactional SQL assertions through the local container; `LOCAL_SUPABASE_RANCHER=1` selects Rancher Desktop transport. `pnpm test:migrations` uses an isolated disposable database. Service-role payment ingestion and simulator RPCs are never granted to browser roles.
