# Phase 8: Local counselor workspace and private session notes

Status: Approved with reduced scope by the user on 19 November 2026: implement the workspace and notes; defer messaging. Message reporting is also deferred because it depends on messaging. No conversation tables, routes, send windows, reporting queue or related notifications are included.

## Intent and approach

Expand existing `/counselor` into paginated Upcoming/current and Past confirmed sessions, with a detail page at `/counselor/appointments/[bookingId]` and encrypted, counselor-private session notes. Preserve existing availability, Meet links, booking/payment identities, same-counselor rescheduling and the customer portal. Keep the modular Next.js/Supabase monolith and pinned toolchain; no external service or new dependency.

This follows the user's choice of local synthetic development, narrowed from the earlier full workspace/messages/notes proposal. Only fictional test content is authorized. Production stays disabled; this is not clinical consent, launch approval or a production retention policy.

## Workspace behavior

- Upcoming includes confirmed appointments whose end is after one database reference time; started/unended appointments show In progress. Past includes those ended at/before that time, labelled Past appointment with actual Confirmed status retained.
- 20 rows per page, deterministic timestamp/ID ordering, preserved filter, empty/error states, Asia/Kolkata display and existing availability/profile links.
- Assigned session detail shows times/state, customer preferred name or Customer, upcoming/current Meet link or pending message, and separate private note editor. No customer phone/email, payment-provider fields or private content from other sessions.
- Only current complete counselor-role accounts can list their own assigned confirmed sessions or open their detail pages. Unpublishing does not revoke existing assignment; role revocation does. Knowing IDs does not grant access.
- Existing customer/admin routes gain no note link or note-existence metadata. No new completion/no-show state, counselor transfer, cancellation/refund rule or notification is added.

## Local note policies

One editable note per booking and assigned counselor, available after confirmation and before/after the session. Trimmed nonempty text, maximum20000 Unicode code points, plain-text display only. Require an explicit synthetic-content acknowledgement on each save. Notes remain until explicit operator cleanup; no automatic local purge, share/export/delete UI, versioned plaintext history or production retention claim.

Use optimistic versioning: new note expects0, successful replacement increments the version. Stale tabs keep their draft and see a conflict, with explicit reload of saved content. No autosave, localStorage or analytics containing notes. Refresh/reload discards unsaved text only when the user explicitly chooses it.

Save request UUIDs are stable across ambiguous retries. Same request/content/expected version returns its original accepted revision without an extra save. Changed content or expected version under the same UUID is rejected. If a later revision already exists, acknowledge the earlier accepted save but return the newer current version as a conflict; never overwrite it or treat the old revision as current.

## Encryption and trusted boundaries

Server-side AES-256-GCM with random12-byte nonce and16-byte tag. A local server-only keyring has an active key ID and32-byte keys. Persist envelope format/key ID; retain old keys when selecting a new active key. Authenticate note record ID, booking ID, owning counselor ID and version as associated data. Tampering, unknown/missing keys and invalid ciphertext fail closed, without plaintext fallback or overwriting unreadable existing notes. Server encryption is not end-to-end encryption; operators controlling both keys and data remain technically able to read content.

Use purpose-separated encryption and keyed idempotency digests. A save computes digest candidates using retained keys; the database compares a retry against the digest's recorded key ID, allowing key rotation while that old key remains configured. No public plaintext hashes of notes. A first-save record ID is generated server-side; a matching lost-response retry returns the stored note identity rather than replacing it.

Raw note, request-receipt and audit tables enable RLS and deny all browser-role reads/writes, including admin. Private read/save RPCs are service-only. The server first verifies session/role, derives the actor ID and checks local mode; each private RPC independently verifies current complete counselor role, exact booking assignment and confirmed state. No browser actor/role claims are trusted. Reads are audited at the database authorization point before server decryption; already-rendered plaintext cannot be recalled by later role revocation.

Service RPC mutations use the established scheduling lock before private rows and appropriate actor/assignment row locks. Version check, receipt identity, encrypted save, acknowledgement and content-free audit are atomic. A save first verifies any existing encrypted note is readable before replacing it. Audits contain only opaque actor/booking/note IDs, fixed read/save actions, version and time; no text, ciphertext, contacts, digests or secrets. No ordinary admin/customer/other-counselor note API exists. A new booking with another counselor does not share prior notes.

## Local gating and surfaces

`COUNSELOR_WORKSPACE_MODE=disabled` by default; new details and private operations require local mode, development/test runtime and HTTP loopback Supabase. Keyring configuration is validated server-side for note reads/saves. Missing/invalid keys show safe note-unavailable feedback; no editor may overwrite an unreadable note. Disabled/production mode performs no private reads/decryption and retains the prior basic counselor appointments/Meet/availability page.

`src/modules/counselor-workspace/` owns scoped summary/detail reads and workspace presentation. `src/modules/session-notes/` owns private note reads/saves, request identity and editor. `src/lib/private-content/` contains server-only configuration/crypto helpers with no domain authorization. Server components compose reads; server actions handle saves. No generic public private-content HTTP API, new user role or privileged browser client.

## Database and verification

Incremental migrations add private notes, save receipts and content-free access/mutation audit plus narrow functions/indexes; no demo note backfill or database reset. Read-only authenticated workspace RPCs expose no note metadata to customers/admins. Keep existing booking/Meet APIs intact.

Meaningful failing tests before implementation, then pinned lint/typecheck/unit/SQL/browser/replay/build checks. Cover local/disabled/production configuration, key validation/rotation, encryption roundtrip/randomness/tampering/AAD, code-point limits, assignment/role/state and direct-RPC denial, note read/save auditing, exact page/time boundaries, no plaintext persistence, replay/mismatched UUIDs, stale versions and concurrent saves, unreadable ciphertext protection, reschedule preservation and cross-counselor isolation. Browser acceptance includes reload, conflict/draft preservation, local acknowledgement, customer/admin/foreign denial, mobile/keyboard and existing landing/portal/payment/availability/worker regressions. Inspect ciphertext and static assets without printing content/secrets. Preserve demo IDs/settings and use disposable synthetic test fixtures.

Update project architecture/database/development/decisions/progress/readme, Supabase guidance, `.env.example` and a local testing guide. No commit/push unless requested. Obtain independent review, fix material findings with reproducing tests and record real results/limits. Messaging and message reports remain explicitly unimplemented.
