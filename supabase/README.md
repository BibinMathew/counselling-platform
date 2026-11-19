# Supabase local development

`config.toml` is for the local Supabase stack only. Its fixed OTPs and placeholder SMS provider credentials must never be pushed to a hosted project. Remove `[auth.sms.test_otp]` and the placeholder SMS section before any future hosted configuration work.

Apply new versioned migrations to an existing local database with `supabase migration up`; run database authorization, availability, and booking tests with `pnpm test:integration`. `supabase db reset` destroys local database contents and reapplies migrations; use it only when discarding synthetic local data is intended. No project link or production credential is used by Phases 1–4.

Phase 5 adds payment migrations `20261122000000`–`20261122000002`. Apply incrementally with `supabase migration up`; do not reset existing demo data. See [payment local testing](../docs/payments-local-testing.md). `pnpm test:integration` executes transactional SQL assertions through the local container; `LOCAL_SUPABASE_RANCHER=1` selects Rancher Desktop transport. `pnpm test:migrations` uses an isolated disposable database. Service-role payment ingestion and simulator RPCs are never granted to browser roles.

Phase 6 migrations `20261123000000`–`20261123000001` implement unique manual meeting links and a transactional local notification outbox. Apply incrementally without resetting demo data. Worker claim/completion RPCs are service-only; synthetic receipt reads are denied to all browser roles. Database tests cover role isolation, replay, reminder boundaries, revision invalidation and lease/retry recovery. See [notification testing](../docs/notifications-local-testing.md).

Phase 7 migrations `20261124000000`–`20261124000001` add indexed customer-only paginated portal reads and an optional booking locator. No new product table or status is added; owner/role checks and explicit join constraints apply inside the definer RPC. The earlier `get_my_bookings` contract is preserved. See [portal testing](../docs/customer-portal-local-testing.md).
