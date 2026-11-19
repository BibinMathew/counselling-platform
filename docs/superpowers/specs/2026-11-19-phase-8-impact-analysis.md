# Phase 8: Counselor workspace impact analysis

Status: Scope selection and design pending; no Phase 8 product implementation. The user requested Phase 8 on 19 November 2026. This analysis records existing constraints and affected boundaries, not approval of messaging or clinical-note policy.

## Existing foundation

- `/counselor` already lists assigned future/current confirmed appointments and authorized Meet links, and links to the existing availability editor.
- `/bookings` provides customer-owned appointment views and rebooking. Confirmed appointment identity is stable through the permitted one-time same-counselor reschedule.
- Roles are canonical in `profiles.role`, with server checks and database authorization. A single account has one current role.
- There are no message, session-note or content-report tables/modules. Booking statuses remain held/expired/confirmed; passage of time does not prove completion.
- Development is local, uses synthetic accounts and retains existing demo records. Real clinical data and production integrations remain unauthorized.

## Likely affected modules and surfaces

| Area                  | Impact                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Counselor workspace   | Assigned upcoming/current and past confirmed sessions, pagination, permitted customer display details, booking detail navigation and Meet link |
| Customer portal       | Owner-only entry to the matching appointment conversation                                                                                      |
| Messaging             | Appointment-scoped text history, send authorization/window, current role checks, pagination, bounded input and replay/rate controls            |
| Confidential notes    | Session and counselor ownership, server-only encryption/decryption, save conflict detection, minimal content-free audit                        |
| Reporting             | Participant-initiated report and explicitly limited admin review; no routine note access                                                       |
| Identity/navigation   | Existing role links remain canonical; no multi-role expansion                                                                                  |
| Database              | Incremental tables/indexes/RLS and narrow trusted functions; existing booking/payment locks and identities preserved                           |
| Documentation/testing | Per-feature decisions, local-only configuration and key handling, operating guide, unit/SQL/browser/adversarial acceptance cases               |

## Required design decisions

1. Full local synthetic implementation versus dashboard-first delivery.
2. Conversation ownership: appointment-specific thread versus a persistent customer/counselor pair thread. An appointment-specific thread is a proposed fit for existing booking permissions; not yet a user decision.
3. Exact send/read lifetime around a confirmed appointment, rescheduling behavior and role revocation. These must be enforced by trusted logic, not hidden buttons alone.
4. Response expectations and emergency messaging. Existing requirements prohibit an instant-response promise; no emergency response service is currently implemented.
5. Abuse reporting/moderation boundary: what a participant reports, which content admin can inspect, visibility/audit and how local reports are resolved.
6. Note creation/edit timing, confidentiality, consent gate, encrypted storage and server key handling, retention/deletion/export and access logging. Routine admin/customer access and cross-counselor sharing remain excluded.
7. Local test defaults versus production policies. Synthetic development policies must not silently become launch approval. Production remains disabled until separately reviewed.

## Security and regression focus

- Knowing a booking, message, report or note ID never establishes permission. Recheck current actor/role and exact appointment assignment in server logic and database functions/RLS.
- A customer booking another counselor must not grant that counselor prior conversations or notes. Admin status alone must not expose clinical notes.
- Held/expired/payment-review bookings cannot unlock conversation/note capabilities reserved for confirmed appointments.
- Ciphertext, note content, message bodies, contact information and keys must not appear in audit metadata, generic logs or public bundles. A database record labelled encrypted is insufficient without verified encryption/authentication behavior.
- Concurrent saves need explicit conflict handling; retries must not duplicate messages or overwrite a newer note silently. Reschedule/revocation races must preserve authorization and communication-window rules.
- Keep public/role landing behavior, availability, checkout, portal pagination/confirmation location, meeting ownership and notification worker tests passing.

## Verification outline

Unit input/configuration/encryption tests; transactional SQL actor/assignment/state/window/report/read/write and replay tests; independent-session concurrency tests where locks matter; browser customer/counselor/admin workflows, forbidden access and mobile/keyboard coverage; migration replay, secret scan and disabled-feature build. Record agent-performed UI acceptance separately from independent human sign-off. Preserve demo IDs/settings and use generated disposable fixtures.
