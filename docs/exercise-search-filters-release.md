# Exercise search filters — October 16, 2026

The owner approved publishing after reviewing the tested mobile UI.

## Scope

The shared exercise picker in active logging and historical editing now has
equal-width Muscle and Type menus directly below the existing search. Both
filters combine with search text. Menus use the full visible exercise library,
including custom types, with case/whitespace normalization and no duplicate
options. Cardio does not require a muscle target. Empty results offer a filter
reset that preserves the current search text.

This is a frontend-only change. It does not alter database schema, exercises,
workouts, authentication, notification settings or credentials.

## Verification before publication

- 255 tests across 24 files passed, including seven exercise-filter tests.
- Frontend/API TypeScript, full lint, production Vite/PWA build and whitespace
  checks passed. Existing non-failing build warnings were unchanged.
- Fictional demo browser checks covered text plus muscle filtering, Cardio,
  Free Weights, all three inputs together, conflicting filters, reset preserving
  text, custom-exercise menu updates and adding a matching result.
- At 360px and 390px, both menus were equal width and 44px tall with no horizontal
  page overflow. Captured browser warnings/errors were empty. Only temporary
  fictional demo data was used; no production workout was changed for testing.

## Rollback point

Immediately before publication, the stable origin
`https://iron-log-tau.vercel.app` served Production READY deployment
`dpl_HEKhSjB1J7egJcai49P2qEHLAtJy`, runtime commit
`dd6c85648e1f325697caee6e076bc4fe78d7c501`.

Retain that deployment and restore it only if the owner requests a rollback.
Alternatively, redeploy the prior feature-branch commit `08446d8`. No database
rollback or data deletion is needed for reverting these filters. The main branch
is not merged as part of this publication.

## Production publication — October 19, 2026

The interrupted October 16 attempt created only the Git preview
`dpl_F9HE2SpQ26gvaj5dUTiGoZqjp6N2`; the main production alias was still on the
rollback point above. Publication resumed after checking the exact commit and
existing deployments rather than creating a duplicate preview.

The reviewed commit `44ce81f0bb7b36e7bb13d8ea5f5271b446f08ffe` was rebuilt with
the Production environment from that preview's immutable source. Deployment
`dpl_FdoUy6ZqRrANm3tgYLzaQVFDhnUT` is Production READY and assigned to
`https://iron-log-tau.vercel.app`. Build start to readiness was about 28 seconds.
No environment values, database migrations or data rewrites were needed.

On the stable origin, an isolated fictional demo browser session confirmed the
new controls, combined muscle/name filtering, conflicting type filtering, reset
preserving search text, Cardio results and adding a selected result. Captured
browser warning/error logs were empty. One reload activated the new PWA assets;
users may need to reopen/reload the installed app. The 10-minute deployment
error-log scan found only the existing Node DEP0169 dependency deprecation
warning, not a filter error. This was a scoped UI smoke test, not a new full
physical-device, push-delivery or production-account acceptance run.

The previous READY deployment is retained as the rollback point. Restore it only
when requested; no rollback has been performed. PR #31 is still not merged.
