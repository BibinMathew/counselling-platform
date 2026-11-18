# Supabase local development

`config.toml` is for the local Supabase stack only. Its fixed OTPs and placeholder SMS provider credentials must never be pushed to a hosted project. Remove `[auth.sms.test_otp]` and the placeholder SMS section before any future hosted configuration work.

Apply the versioned schema locally with `supabase db reset`; run database authorization tests with `pnpm test:integration`. No project link or production credential is used by Phase 1.
