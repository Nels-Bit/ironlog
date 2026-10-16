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
