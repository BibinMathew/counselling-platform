# Phase 9.5 UI/UX acceptance

The selected design is B: crisp white and blue, local system sans-serif typography, consistent controls/cards and a light workspace sidebar. This is presentation over the existing local MVP; provider/clinical policies, messaging, financial remedies and Phase10 are unchanged. No database migration or new dependency is required.

## Entry points

- `/`: public hero, real settings when available, booking steps and verified-role account shortcuts.
- `/counselors` and `/counselors/[id]`: counselor cards, portrait fallback, profile and current available times.
- `/login`, `/complete-profile`, `/profile`: phone/OTP/email/profile forms and current return paths.
- `/customer`, `/bookings`, `/bookings/[bookingId]/feedback`: customer workspace/history/checkout/reschedule/rebooking/private feedback.
- `/counselor`, `/counselor/availability`, `/counselor/appointments/[bookingId]`: assigned sessions, scheduling and private note editor.
- `/admin` and existing subpages: overview/catalog/scheduling/meeting links/payments/notifications/booking oversight/feedback/exceptions.

Navigation is presentation only. Server guards and database authorization remain authoritative. New Phase8/9 surfaces retain their default-disabled local-only gates. No public ratings, fake counselor credentials, invented policy/support links, external fonts or new asset hosts were added. Real prices/duration come from existing settings; missing configuration/data never substitutes the preview's fictional examples.

## Manual visual and interaction checks

1. Open `/` signed out. Check the blue/white hero and clear Find a counselor action, booking steps and footer. There is one phone sign-in link. With a verified session, it changes to one Sign out control and role-appropriate workspace/account links. There must be no signed-out sign-in flash while account navigation loads. The public core also works without local Supabase configuration.
2. Check the directory and a profile. Long names, qualifications and languages must wrap. A failed portrait shows an accessible initial fallback. Empty directory/no available times are honest empty states. The booking flow still uses actual published slots and settings.
3. Sign in as each synthetic role. Public pages keep a compact header; appropriate protected pages show that role's light desktop sidebar. Verify the most specific current destination is highlighted, including admin overview exact-only and counselor availability vs assigned details. Incomplete profiles have Complete profile and Sign out but no workspace sidebar. Disabled Phase9 links must be absent.
4. At390px and320px, use Menu to reveal the nonmodal workspace navigation. Tab moves into ordinary links; Escape closes and returns focus to Menu. Following a link closes it without leaving focus in hidden content. With a sidebar link focused on desktop, resize to phone width: focus should transfer to Menu before the list hides. A focused header Account link remains visible across resize. There is no focus trap.
5. Tab to Skip to main content, activate it and verify main receives focus with its beginning below the sticky header. The root layout supplies one stable main/skip target across pages, errors and404; cached hidden routes must not duplicate its ID. Repeat on the longer narrow homepage, not only a short form page. Header height is measured so wrapping/zoom changes the offset appropriately.
6. Check phone/OTP/email/profile forms for persistent labels, help text, keyboard order, visible focus, readable errors and pending/disabled controls. Next/return-path and selected booking survive header authentication links. Age acknowledgement and existing validation are unchanged.
7. In customer bookings, compare Upcoming/Past/Holds and pagination. Dates/status/payment/actions should be clear. Past still retains Confirmed; held does not mean paid/confirmed. Missing legacy amounts and admin-review evidence must not be turned into success. Join Meet, one-time reschedule, Book Again and private feedback remain governed by existing rules.
8. On a generated synthetic note or case, type an unsaved draft. Cancel a sidebar/header navigation prompt: the draft remains; canceled sidebar navigation leaves Menu open. Cancel Sign out: remain signed in with the draft. Skip to main content within the same page must not ask to discard. Native refresh and explicit reload retain their deliberate discard behavior. Do not test writes on pre-existing private notes.
9. Save/reload, stale-tab conflict, simultaneous writes, ambiguous retry and unreadable-note prevention still work. Pending feedback/case fields stay locked; validation errors retain controlled drafts. Menu/layout changes do not remount protected forms. There is no durable browser Back/crash recovery or localStorage draft cache.
10. On admin screens, check metric grid, filters, active criteria, forms, case status/live source/history separation, long references, plain-text feedback and retained local/simulator notices. Cases remain separate from underlying financial/booking/job facts. Existing privileged actions are unchanged.
11. Inspect desktop, phone and200% zoom: no page-level horizontal overflow, clipped labels or hidden actions. Check readable body/secondary text, contrast and focus. Enable reduced motion; essential information must not depend on animation. Calendar cells remain usable at320px with their text-supported legend.

## Automated checks and evidence

Use Node26.13.1 and pnpm12.21.0. `tests/unit/navigation.test.ts` covers role/gate/active matching and validated authentication return URLs. `tests/e2e/ui-polish.spec.ts` covers shell/landmarks/public layout, actual narrow skip geometry, four identity states, mobile Menu/keyboard/resize focus and real sign-out with generated accounts. Existing note/case journeys additionally cover canceled sign-out and same-page vs real navigation with dirty drafts. The catalog journey checks failed-portrait fallback. The original functional assertions remain; hero/button colors and scoped navigation selectors intentionally reflect the approved UI.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:migrations
PLAYWRIGHT_PORT=3122 pnpm test:e2e tests/e2e/ui-polish.spec.ts --workers=1
```

Run SQL suites separately from live browser fixtures. Pause/restore the owned notification worker around the full race-sensitive browser suite and exclude the older smoke test that mutates the persistent demo customer, as documented in prior guides. Disabled-feature production build and a public-without-Supabase browser run verify graceful configuration behavior. Browser/static configured-secret/private-marker scans must not print the values checked.

Color-pair checks cover main/muted text, primary button, success/warning/error, focus and control borders against their actual backgrounds. Responsive/keyboard/zoom and visual inspection are agent acceptance checks, not accessibility certification or independent human sign-off. Chromium/native Chrome are exercised here; cross-browser/device and assistive-technology certification belong to later hardening.

Generated screenshots and preservation snapshots are ignored under `.test-artifacts/phase9.5/`. Existing private records are compared through database-side fingerprints without printing their content. Do not create screenshots of pre-existing notes, feedback or operational remarks. All app changes remain local and uncommitted unless explicitly requested.
