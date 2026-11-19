# Phase 9.5: UI/UX polish impact analysis

Status: User requested the UI/UX polish phase after Phase 9. The user selected B (crisp white and blue) from the visual comparison; written design remains to be approved; no Phase 9.5 product implementation has started.

## Existing state and intent

All local MVP workflows through Phase 9 exist. Public discovery, authentication, customer bookings/checkout/feedback, counselor scheduling/private notes and admin operations have functional UI, but mostly use independent text links, plain forms and incremental global CSS. There is no shared navigation/header/footer. Typography is Arial, controls vary between modules, small-radius white cards repeat without clear action hierarchy, and narrow form layouts contrast with dense operational data.

Improve visual coherence, orientation, reading hierarchy, mobile layouts and clear interaction states across the existing journeys. Preserve service rules, role authorization, local gates, existing form actions, stable request identities, private content boundaries, accessibility and all demo data. The app retains its existing name unless a name change is explicitly selected. Messaging, public ratings, financial remedies, production policies and new product workflows are outside this phase.

## Affected surfaces

| Area                | Expected polish                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared foundation   | Semantic color/spacing/type/control tokens, responsive containers, focus/disabled/error/status styles and reduced-motion support                                 |
| Navigation          | Consistent public/authenticated orientation and role-relevant links; working verified-session sign out; accessible mobile navigation and skip link               |
| Public journey      | Clear service introduction and next action, counselor cards/detail, readable availability and booking/checkout context                                           |
| Identity            | Consistent phone/OTP/profile forms, labels, help/error text and pending states without changing validation or age policy                                         |
| Customer portal     | Clear filter/action hierarchy, appointment date/status/payment sections, feedback entry and mobile cards                                                         |
| Counselor           | Workspace filters/session detail, calendar/control consistency and private note editor hierarchy while preserving draft/version/security behavior                |
| Admin               | Operational overview/count cards, clear grouped navigation, readable booking/feedback/case/payment/notification lists, filters/forms and long-reference wrapping |
| Loading/empty/error | Consistent existing state presentation and actionable retry/navigation without invented availability, testimonials or promises                                   |
| Testing/docs        | Representative responsive/keyboard/role navigation tests and full safe browser regression, accessibility review, production build and updated UI guide/records   |

## Boundaries and technical approach to settle in design

Prefer the existing Next/React modular monolith, shared presentational components and CSS tokens, with domain modules retaining all behavior. No new UI library, remote font, external image host or database migration is assumed necessary. Read installed Next documentation before layout/client routing changes. Do not replace proven domain forms with generic abstractions that lose action fields, pending protection, stable request UUIDs, version conflicts or draft guards.

Keep true status distinct from visual grouping: Confirmed past is not Completed; held payment is not confirmation; case closure is not source resolution. Retain visible local/simulator/fictional-content notices and meaningful consent/acknowledgement text. Public UI must not fabricate counselor credentials, privacy guarantees, testimonials, ratings, statistics, crisis service or production links/policies that do not exist. Current price/duration/scheduling values must come from existing settings when displayed as facts.

No private content in global navigation, page titles, query strings, logs, analytics, external assets or screenshots of existing notes. Read-only visual acceptance on existing records; writes only to generated disposable fixtures. Preserve existing Phase8/9 uncommitted work, identities/bookings/settings and note keys.

## Validation focus

Role-correct navigation/sign out, incomplete-profile gates, no nested/duplicate landmarks, mobile menu keyboard/focus/escape semantics, visible labels/contrast/focus, accessible active filters/status, no horizontal overflow at narrow widths, long IDs/comments, calendar and form controls, pending/disabled/conflict states, reduced motion, image absence/long names, default-disabled feature behavior and no client secret/private-marker leakage. Confirm all existing booking/payment/reschedule/Meet/notification/note/feedback/case regressions still pass.

The local visual comparison uses invented preview data only. The user selected B: crisp white/blue, sans-serif typography and structured layouts. Detailed design and implementation planning follow the existing approval workflow. No commits or deployment are authorized by this phase request.
