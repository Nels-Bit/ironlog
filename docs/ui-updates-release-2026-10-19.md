# Notification and workout UI release — October 19, 2026

The owner approved publishing all pending updates on October 19, 2026.
Keep this work on `codex/notification-center-push`; publication does not merge main.

## Scope

- Immediate Read all saving/success/error feedback and duplicate-request protection.
- Acknowledge notifications loaded during a notification-center visit on leaving;
  preserve intentionally marked-unread items. Hard-close/offline saves remain best effort.
- Tap-anywhere workout-completion celebration dismissal, above navigation.
- Expandable set details on the shared post-save and profile-history summary screen.
- Preserve decimal, unilateral, bodyweight, assistance and cardio details, label
  unfinished entered sets, and omit untouched placeholders.
- Keep missing numeric values null when loading saved workouts rather than turning them into zero.
- Enlarge workout exercise-card three-dot icons from 20px to 24px, preserving tap area and spacing.

No database migration, credential change, deletion, or rewrite of stored workouts is included.

## Release checks

- 276 automated tests across 27 files pass, including isolated real-service save/reload
  tests that reject live network requests.
- Frontend/API TypeScript, full lint, production Vite/PWA build and whitespace checks pass.
- Prior isolated fictional browser checks cover notification read feedback and visit
  acknowledgements, profile-history summary expansion, keyboard disclosure toggling,
  center-card celebration dismissal, and phone-sized summary layout.
- The prior browser Finish workout confirmation prevented that full UI save walkthrough.
  Save/reload is covered separately by the isolated integration test. No real workout
  or notification was changed for verification.
- Existing nonblocking build warnings: Browserslist age, CSS property optimization,
  and bundle size.

## Rollback point checked immediately before publication

Stable origin: `https://iron-log-tau.vercel.app`.
Production READY: `dpl_FdoUy6ZqRrANm3tgYLzaQVFDhnUT`.
Runtime commit: `44ce81f0bb7b36e7bb13d8ea5f5271b446f08ffe`.
Immutable URL: `https://iron-mr9fxekfq-nels-bits-projects.vercel.app`.
Project: `prj_xFflzyRIKp78zOuKSssRFS1qdRoo`.

Retain that deployment for rollback. Restore only if the owner requests it or
an immediate failed-release recovery requires it; no database rollback is needed.
Append the new deployment identity and live smoke-test evidence after publication.

## Published production release

- Runtime source commit: `3de20f96c9bf4b31597b2b7bcc6bd08b145a73ef`.
- Git preview: `dpl_181rYVj73r57Ave1kEhtUzxeFGei`, READY before the production rebuild.
- Production deployment: `dpl_2uRyfFNBmfbwHaLmCpcu19HJe7dr`, READY, Vite.
- Immutable URL: `https://iron-6zfk9x2g0-nels-bits-projects.vercel.app`.
- Stable alias `https://iron-log-tau.vercel.app` was verified assigned to this deployment.
- Production build-to-ready duration: about 25 seconds. Commit and project were
  checked before creation and again after readiness. No environment settings changed.

On the stable origin, a fictional demo session loaded the new
`assets/index-DpPTHbao.js` after two reloads activated the PWA update. Live checks:

- Read all ended with "All notifications marked as read" and disabled the control.
- Reset demo → Notifications → Profile cleared the viewed-notification badge.
- Profile → Activity → Summary opened the celebration; clicking the center level
  number dismissed it. Escape dismissal also passed on the alternate summary route.
- Both summary route variants rendered correctly; expanded Barbell Squat showed
  all three saved sets (135 lb for 9, 10, and 8 reps).
- At 390 × 844, the summary did not overflow horizontally. Screenshot:
  `.vercel/ui-updates-live-2026-10-19.jpg`.
- A temporary demo workout confirmed a 24px three-dot icon inside the unchanged
  44 × 44px control; clicking opened the exercise menu.
- Captured browser warning/error logs were empty. Temporary viewport overrides
  were reset. No real user's data was changed for these checks.

The deployment-scoped 10-minute error-log scan returned one Node DEP0169
`url.parse()` dependency deprecation warning on `/api/notifications`, matching the
previous release warning. It did not show a new feature exception. These are scoped
UI smoke checks, not a physical iOS or real-account push-delivery acceptance test.

GitHub reported 30 dependency alerts on the repository's default branch during
push (1 critical, 17 high, 11 moderate, 1 low). No dependency versions changed in
this release, and this report does not establish the alert status of the feature
branch. Track that as a separate security maintenance task.

The prior Production READY deployment above is retained; no rollback occurred.
This record may be committed after the runtime release as a documentation-only
follow-up. That does not change the production runtime commit listed here.
