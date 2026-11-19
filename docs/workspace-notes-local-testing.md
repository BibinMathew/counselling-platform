# Local counselor workspace and private notes

Phase 8 implements assigned-session views and encrypted counselor-only notes. Messaging and message reporting are deferred. Use fictional test content only; production policies and real counseling data are outside this local implementation.

## Configuration

Apply migrations `20261125000000` and `20261125000001` incrementally with `supabase migration up`. Do not reset an existing demo database. The ignored local configuration is already enabled for this workspace. The default in `.env.example` is disabled.

The server requires `COUNSELOR_WORKSPACE_MODE=local`, development/test runtime, HTTP loopback Supabase, the existing server service-role credential, `PRIVATE_CONTENT_ACTIVE_KEY_ID`, and `PRIVATE_CONTENT_KEYS`. The keyring is a JSON object mapping key IDs to 64 hexadecimal characters (32 random bytes) per key. Generate keys privately, store them only in ignored server configuration, and never print or commit them or put them in `NEXT_PUBLIC_*` variables. Restart the development server after configuration changes.

Preserve a private backup of the keyring alongside the corresponding local database backup. Losing a key makes its notes unreadable. To rotate, add a new independently generated key under a new ID, keep all older IDs/keys, then select the new active ID. New saves use the active key; old notes and request retries need their recorded key. There is no bulk re-encryption or automatic key retirement. Never replace the bytes behind an existing ID. Server encryption is not end-to-end encryption: operators with both keys and data can decrypt content.

Disabled mode retains the existing basic counselor page and Meet links. New session details and note actions are unavailable. Local mode is rejected in a production runtime; production builds use disabled mode. Missing, invalid or lost keys make notes safely unavailable, with no overwrite editor for unreadable notes.

## Manual acceptance

1. Sign in as an existing synthetic counselor at `/login`, then open `/counselor`. Check Upcoming and Past, availability/profile links and any pagination. Dates use Asia/Kolkata. Past appointments retain Confirmed status. Only assigned confirmed appointments appear; holds do not.
2. Open an assigned appointment. Check the customer preferred name, time/state and upcoming Meet link or pending message. Customer phone/email and payment details must be absent. Use a disposable synthetic booking for the remaining save steps; notes persist until explicit operator cleanup.
3. Type a fictional note. Save without the fictional-content checkbox: acknowledgement is required and the draft remains. Check it and save: version 1 is acknowledged. Refresh and verify the text persists. Blank notes and notes over 20,000 Unicode code points are rejected without replacing saved content.
4. Change the draft and click Counselor area, then cancel the discard prompt. The draft must remain. Attempt browser refresh and cancel its native warning; the draft remains. Choose Reload saved note and accept: the saved revision returns. Drafts live only in memory; browser crash, SPA browser Back and forced termination are not recoverable storage. Save before using those paths.
5. Open the same appointment in another tab. Save a change in the first tab, then submit from the stale tab. Expect a conflict, preserved draft and no overwrite. Reload saved note explicitly before editing again. A save failure also preserves the in-memory draft and stable request identity for retry. Changed text under an uncertain request requires reloading before a fresh attempt.
6. Save in two tabs at the same version simultaneously. Exactly one succeeds; the other conflicts. Rescheduling the same booking keeps its saved note. Booking a new session does not copy notes.
7. Sign in separately as a customer, admin and different counselor. Directly opening the original detail URL must deny access or return not found, without a note editor or note content. An unpublished counselor retains assigned-session access while their canonical counselor role remains valid; revoking the role removes access.
8. On a phone-sized viewport, check labels, focus, textarea, checkbox, save/status/reload controls and no horizontal overflow. Use Tab and Shift+Tab to move through the editor.

Successful note reads and saves write content-free audit records. Raw note, receipt and audit tables deny browser-role access. Database inspection should show encrypted envelopes, never plaintext. Do not copy actual private content or keys into screenshots, logs or audit metadata. There is no autosave, sharing/export/delete UI, message thread, reporting page or production retention policy. Existing synthetic notes remain until deliberate operator cleanup; failed decryptions never fall back to plaintext.

## Automated checks

Use the pinned Node 26.13.1 and pnpm 12.21.0. Local tests create disposable synthetic identities and remove only their own fixtures. SQL fixtures roll back.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:migrations
RUN_PRIVATE_NOTES_INTEGRATION=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/unit/session-notes.integration.test.ts
COUNSELOR_WORKSPACE_MODE=local PLAYWRIGHT_PORT=3116 pnpm test:e2e tests/e2e/workspace-notes.spec.ts --workers=1
COUNSELOR_WORKSPACE_MODE=disabled PRIVATE_CONTENT_KEYS=invalid PLAYWRIGHT_PORT=3117 pnpm test:e2e tests/e2e/workspace-notes.spec.ts --grep 'disabled workspace' --workers=1
```

The opt-in integration test calls the real trusted persistence module, database and encryption code. It discards the first response, rotates keys, retries, saves a newer revision and checks the old replay cannot replace it. Its only stub removes the framework's `server-only` import marker for the Node test runner.

For the full safe browser suite, pause the owned notification poller first so it does not consume race-test jobs, then restore it afterward. Exclude the older smoke test that mutates the persistent demo customer's profile, as in the existing portal guide. Use simulator notification mode with its origin matching the isolated browser port. Do not run concurrent Next processes against the same build directory.
