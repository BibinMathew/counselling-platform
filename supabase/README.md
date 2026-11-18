# Supabase local development

`config.toml` is for the local Supabase stack only. Its fixed OTPs and placeholder SMS provider credentials must never be pushed to a hosted project. Remove `[auth.sms.test_otp]` and the placeholder SMS section before any future hosted configuration work.

Apply new versioned migrations to an existing local database with `supabase migration up`; run database authorization, availability, and booking tests with `pnpm test:integration`. `supabase db reset` destroys local database contents and reapplies migrations; use it only when discarding synthetic local data is intended. No project link or production credential is used by Phases 1–4.
