# Phase 6 acceptance — 19 November 2026

Status: Agent-performed UI acceptance and targeted regression validation passed locally. This records the agent's observations; it is not a claim of independent human sign-off or real provider delivery.

## Five targeted coverage additions

| Coverage request                             | Evidence                                                                                                                                                                                                           | Result |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Successful due and delayed reminder delivery | `supabase/tests/notification_targeted.test.sql`: both reminder templates claimed, delivered, and rendered with authenticated bookings link; one due time deliberately 20 minutes past while session remains future | Passed |
| Exact retry intervals                        | Same SQL file: each real failed dispatch has next-attempt time bounded around dispatch time plus exactly 1, 5, 15, or 60 minutes                                                                                   | Passed |
| Five abandoned leases                        | Same SQL file: five distinct claims expire; sixth claim returns none; job is failed with five attempts and safe reason; stale completion produces no receipt                                                       | Passed |
| Additional authorization failures            | Same SQL file: unrelated counselor cannot read/list another counselor appointment; known-ID retry/failure injection denied to counselor/customer; anonymous function grants denied                                 | Passed |
| Valid worker request with database failure   | `tests/unit/notification-http.test.ts`: valid simulator request invokes failing dependency, returns generic HTTP 503 with no secret details; subsequent retry succeeds                                             | Passed |

The new SQL file adds 29 assertions. Full suite: 30 unit tests and 285 database assertions across nine SQL files. These are test additions against existing implemented behavior; no artificial production failure was introduced to make them fail first.

## UI acceptance walkthrough

Performed through the native Chrome UI against `http://127.0.0.1:3000`, independently of the Playwright journey. The local poller was paused during failure injection and restored afterward.

| Scenario                                      | Observed result                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| Customer local phone OTP sign-in              | Signed in as existing demo customer; preferred name/email unchanged           |
| Select slot, hold, simulated captured payment | Confirmed; missing-link message remained visible                              |
| Customer opens admin notifications            | Redirected to access-unavailable page                                         |
| Admin local phone OTP sign-in                 | Admin profile and meeting-link workflow accessible                            |
| Missing-link queue                            | Temporary confirmed appointment listed until URL assignment                   |
| Invalid URL submission                        | Accessible validation message; invalid URL not saved                          |
| Canonical URL assignment and same-URL resave  | Saved; missing queue count reduced; only one link-update job                  |
| Fail-next-attempt and manual batch            | Link update became retrying; other immediate jobs delivered                   |
| Manual retry and batch                        | Link update delivered with synthetic preview                                  |
| Preview privacy                               | Time, login-required bookings link, synthetic destination; no direct Meet URL |
| Customer returns to booking                   | Join Meet visible for correct appointment                                     |
| Customer reschedules once                     | New time shown, same Meet link, second reschedule link absent                 |
| Assigned counselor signs in                   | Rescheduled appointment and correct Join Meet visible                         |

The walkthrough found stale Phase 4 checkout guidance claiming payment was unavailable. A browser regression reproduced it after waiting for the streamed form to render. The guidance now states that holds are temporary and confirmation requires verified payment. The complete safe browser suite passed after the correction.

## Fixture preservation and limits

The baseline at the start of this acceptance run was six accounts, four counselors and three bookings. One temporary opening and one new simulated booking were used for UI acceptance. Exact-ID/owner/counselor/time/baseline guards were used for the separately approved cleanup; pre-existing booking IDs were excluded.

No external messages, real payments or Google API calls occurred. Meet URL structure was checked; a Google call was not joined. Real delivery, provider configuration and launch policies remain deferred as documented in `notifications-local-testing.md`.

## Final verification

- Unit: 9 files, 30 tests passed.
- Database: 9 files, 285 assertions passed; transactional fixtures rolled back.
- Browser: 6 safe journeys passed; older persistent-customer profile mutation test excluded.
- Lint, typecheck and isolated production build with both simulators disabled passed.
- Formatting/diff checks and preserved baseline record identities are recorded in `PROGRESS.md`.
