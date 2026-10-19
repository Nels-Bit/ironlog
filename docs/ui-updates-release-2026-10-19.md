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
