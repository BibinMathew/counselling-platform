# Phase 9.5: Clear and Contemporary UI/UX

Status: Approved by the user for in-place implementation with independent review on 19 November 2026. The user selected visual direction **B: crisp white and blue** from the approved interactive preview. This document specifies how that direction applies to the existing application; technical defaults below are the builder's proposals for document approval.

## Intent and scope

Make the existing local MVP feel coherent, legible and easy to navigate across public discovery, identity, customer bookings, counselor work and administration. Keep the current **Counseling Platform** name and all approved product rules. This is a visual and interaction polish pass over implemented features, not a new business module.

Preserve current sessions, roles, return paths, data/keys, local feature gates, service-only boundaries, form actions, draft protection, request identities and concurrency behavior. No database migration, new provider, production policy, attendance status, messaging/reporting, refund/credit, forced booking change or public rating is included. No commit, deployment or Phase10 work. Existing Phase8/9 changes remain uncommitted and preserved.

## Approaches and selected direction

The user compared the same homepage, appointment and admin screens in three directions:

- A: warm cream/deep teal with serif headings — welcoming and more editorial.
- **B, selected:** crisp white/cool blue with sans-serif typography — structured, practical and easy to scan.
- C: olive/peach with rounded editorial shapes — softer and more expressive.

Implement B with the existing React/CSS stack and shared presentational components. This is the sensible fit for the current modular app: an additional UI framework would add a second component/styling system without a requirement that needs it. No dependency, remote font, stock image service or external icon kit is required. The preview is a visual reference, not production markup or sample data to copy into the app.

## Visual system

Proposed tokens follow B's preview:

| Token        | Value / treatment                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Canvas       | `#f3f6fb`, with white primary surfaces                                                                                             |
| Main text    | `#182b49`; muted text `#53647e` with contrast checked against its actual background                                                |
| Primary blue | `#2d57b5`; darker hover/pressed blue, white text                                                                                   |
| Soft blue    | `#eaf0fc` for selected filters and informative surfaces                                                                            |
| Borders      | `#dce3ef`, with stronger control borders where needed for recognition                                                              |
| Status       | Distinct green/amber/red plus readable text/icon; never color alone                                                                |
| Type         | Local system sans-serif stack; no remote font requests                                                                             |
| Scale        | Body at least16px, secondary text generally14px; readable line heights; larger responsive public hero and clear workspace headings |
| Spacing      | Shared4/8px-based spacing scale; generous page sections, more compact operational rows                                             |
| Shape        | Mostly8–12px radii, light borders and restrained shadows; no decorative gradients behind private work                              |

Use semantic CSS custom properties for surfaces, ink, accent, border, status, spacing and focus. Replace duplicated incremental rules with a coherent base plus domain-specific styles; do not append another contradictory theme layer. Keep calendar dimensions/selected states and existing mobile wrapping behavior intact while changing their tokens.

Buttons and link actions have primary, secondary and quiet variants with consistent hover, focus, active, disabled and pending treatment. Keep external Meet links distinguishable and preserve their current target/rel/referrer policy. Use simple local CSS/SVG decorative marks only where helpful; no emoji as the core icon system. Decorative graphics are hidden from assistive technology.

## Shared navigation and page structure

Introduce a shared branded header, main-content skip link and small footer. Navigation is generated from verified current profile/role plus existing feature gates; client pathname state only controls presentation, never authority. Missing public Supabase configuration must still permit the public homepage. Use request-time rendering within the installed Next Suspense/connection model; do not statically cache user navigation.

- Signed out: brand Home link, public counselor directory and one **Sign in with phone** link.
- Signed in: public directory, role workspace link, Profile and one working **Sign out** action, using the existing server action.
- Incomplete profile: Complete profile and Sign out, with no complete-role workspace links. Existing guards remain authoritative.
- Complete customer workspace: customer area, bookings and profile.
- Complete counselor workspace: counselor area, availability and profile; assigned session details stay within this context.
- Complete admin workspace: admin overview, counselors, scheduling, meeting links, payments, notifications and profile; booking oversight/private feedback/exceptions appear only while the Phase9 gate permits them.

Public pages keep a compact horizontal header, even for signed-in users; workspace navigation is appropriate only on protected role areas and shared profile/booking-flow pages for that complete role. Desktop workspaces use a light sidebar and a bounded, flexible content region. Public discovery pages stay full-width within their public container. Highlight the most specific matching navigation destination, with admin Overview exact-only; a counselor detail must not accidentally activate availability. All required existing destinations stay reachable. Exact DOM/component decomposition and breakpoint mechanics are left to the builder, subject to the behavior below.

At tablet/phone widths, collapse workspace navigation behind an explicitly named Menu button with `aria-expanded` and `aria-controls`. Use a nonmodal disclosure containing ordinary links, not a dialog or focus trap: Tab reaches the links, Escape closes it and returns focus to the trigger, navigation closes it, and focus is never left inside hidden content. On a direct desktop-to-mobile resize, hide the list only after moving focus to its trigger when needed. At desktop width the link list is available without an extra click.

Keep one `<main id="main-content">` per actual page, plus a banner/header and appropriately named navigation landmarks. Root layout must not wrap existing mains with a second main. Loading/error/not-found states retain a valid landmark/skip target. The verified-account loading fallback must not flash a phone sign-in link for a signed-in user. Reserve suitable shell space to limit layout jumps.

Keep homepage **Your account** shortcuts, but remove duplicated sign-in/sign-out controls when the global header owns them. Preserve their role-specific destinations and incomplete-profile behavior. Tests should scope navigation/main landmarks where repeated, legitimate destinations exist rather than retaining hidden duplicate UI to satisfy old global selectors.

Footer links target only existing valid routes/sections. Do not invent Terms/Privacy/Support pages, policy text or contact details. Existing local/simulator and fictional-content notices remain visible in their applicable flows.

## Public and identity journeys

Homepage uses B's clean split hero, restrained blue geometric illustration made in CSS/SVG, a clear **Find a counselor** action and a concise three-step explanation of the implemented booking journey. Proposed hero copy from the preview is **Space to pause. Someone to talk to.** The product name remains in the header/title. Update tests deliberately for changed hero hierarchy; do not retain an invisible duplicate heading.

Explain the real flow: choose a counselor/time, verify phone and pay to confirm, then join using the assigned Meet link when available. Do not imply Meet is generated instantly or that a hold is confirmed. Price/session duration, if shown, come from existing settings inside a separately fallible dynamic section. If configuration/data is unavailable, omit those facts and offer the directory link; do not hardcode illustrative preview prices. The homepage's core content remains usable without the local stack.

Counselor directory cards use coherent portrait proportions, name/qualification hierarchy, languages/specializations and a clear profile action. Render only existing catalog fields. Detail pages group profile information and the existing date/time availability into readable sections. Provide an in-app portrait fallback for missing/failed images without introducing new hosts; preserve meaningful alt text and avoid artificial credentials or ratings. Long names/languages and no-slot/empty-directory states must fit.

Phone sign-in, OTP, email completion and profile forms become consistent contained panels with persistent labels, clear help, field spacing, full-width mobile controls and visible status/pending states. Preserve exact hidden inputs, names, actions, autocomplete/inputMode, next/return paths and age acknowledgement. No new authentication, contact-change, age or legal policy. Do not introduce a misleading second OTP, resend behavior or password flow.

## Customer and counselor workspaces

Customer area becomes a clear workspace entry with booking/discovery/profile actions. Appointment cards emphasize counselor, date/time and actual status, then payment/Meet/reschedule/rebooking/feedback actions in a consistent hierarchy. Filters keep existing URLs, semantics and active states; pagination remains visible. Make the primary valid next action obvious while keeping all existing permitted alternatives reachable.

Past retains **Confirmed** and a separate Past appointment label; it never becomes Completed. Holds remain explicitly unconfirmed. Admin-review payment evidence is not visually presented as payment confirmation. Current prices, stored payment snapshots and missing legacy data keep their existing semantics. Feedback entry/receipt privacy and immutable-submission behavior remain unchanged.

Counselor workspace uses the same shell/cards/filters with appropriate density, availability entry points and assigned-session details. Calendar controls gain coherent spacing, selected/focus state and a text-supported legend without changing slot generation or scheduling interactions. The private note editor gets a clear heading, saved version/status region, instructions and primary Save / secondary Reload controls. Preserve every fictional-content acknowledgement, unreadable-note block, conflict result and memory-only draft guard. Do not expose note existence/content in a global header/sidebar or other roles.

## Admin workspace

Use grouped sidebar navigation and a responsive grid of overview metrics, each retaining its exact definition/reference time and existing destination. The UI must not confuse active cases with unresolved source issues or infer attendance, revenue or refunds.

Polish all existing admin routes: role assignment/catalog/availability, booking oversight, meeting links, payments/reconciliation, notifications, feedback and operational cases. Group filters, form fields, results and secondary instructions; make long UUID/provider references readable and wrappable. Use cards or grid rows that become stacked mobile cards rather than imposing a wide table. Keep opaque references visible where existing specialist tools lack deep links. Filter values currently applied should remain evident without changing URL behavior.

Case detail visually separates live source facts, case status/actions and restricted history. Keep closure/reopen guidance and source issue semantics visible. Feedback comments and operational remarks remain safe plain text. Simulator controls remain clearly distinguished from actual administrative actions. Domain modules continue owning all server/actions/state; do not replace them with generic forms that omit acknowledgement or concurrency fields.

## Interaction states and accessibility

- Shared visual patterns for loading, empty, error, success, warning and informational states, with accurate existing copy and meaningful retry/navigation. Avoid full-page skeletons that obscure useful static content.
- Labels stay programmatically associated; long help/error content does not collide with controls. Preserve native semantics, `role="status"`/alerts and `aria-current`/pressed states where meaningful. Never convey state using only color.
- Controls aim for44px touch targets except inherently dense calendar cells, which must remain usable at320px width. Avoid icon-only controls without accessible names.
- WCAG AA contrast checks on actual token pairs; visible keyboard focus with sufficient contrast, readable body text, no clipped text at200% zoom and no horizontal page overflow at320/390px widths. Dense references wrap locally.
- Respect `prefers-reduced-motion`; short optional transitions only, no necessary animation, parallax or automatic carousel.
- Keep forms mounted through ordinary presentation changes, retain values on validation/conflict/transport failure, preserve stable request UUIDs, and lock already-protected pending fields. No storage/analytics of private drafts. Navigation/disclosure components must not interfere with discard prompts or move focus onto hidden links.

## Technical boundaries and verification

No backend/domain-policy change is intended. Route files compose shared presentation; modules own behavior; shared UI accepts data/children without acquiring new privileged access. Read the installed Next layout/navigation/Suspense/server action/error guidance before edits. Keep the pinned Node26.13.1/pnpm12.21.0/Next16.4.6 stack and existing dependencies.

Add targeted tests for new navigation selection/disclosure behavior, role/incomplete-profile/sign-out consistency, unique main/skip landmarks and draft-preserving shell navigation. Update existing UI selectors only for intentional headings/landmarks and preserve their functional assertions. Test representative pages at desktop,390px and320px, keyboard/Escape focus, reduced motion, zoom/long content, portrait fallback and enabled/disabled modes. Visually inspect all major screen families with synthetic fixtures; do not screenshot existing private notes/comments.

Run lint/types/unit, full transactional SQL and isolated migration replay to show existing contracts remain valid, full safe browser regression, disabled-feature production build and configured-secret/private-marker scan. SQL/live fixtures run separately; pause/restore the owned local notification poller for race-sensitive regressions. Preserve original user/counselor IDs, full booking/settings snapshots and private-note records; only generated disposable fixtures may be removed. Record actual checks/limits and independently review the implementation, correcting material findings before completion.

Update the standard project documentation and a UI/manual acceptance guide. This design covers the whole existing interface, but does not promise production accessibility certification, policy readiness, real provider delivery or a new feature. All work stays local and uncommitted unless explicitly requested otherwise.

## Builder discretion

Choose concrete file/component boundaries, token names, route-aware layout mechanics, responsive breakpoints, presentational icons, minor copy refinements and test fixture organization. Contrast/legibility may require small color adjustments to the preview. Keep selected B's visual character, all existing capabilities and the constraints above. Ask only if a decision would change product policy, data access, branding or approved scope.
