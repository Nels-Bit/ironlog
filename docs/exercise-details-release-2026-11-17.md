# Exercise details and app-update release

The owner approved submitting the repository and publishing the complete update.
Source remains on `codex/notification-center-push` and the existing pull request.

## Included behavior

- Starting resistance, owned-exercise editing and private 500-character notes.
- Collapsed, automatically sized notes with debounced saving, device drafts and retry.
- Active-workout resistance corrections preserve entered weight and recalculate PR,
  volume and XP. Saved workouts retain their recorded snapshots.
- Entered weight in logger/summary/history; total load in calculations.
- Repair drop parents after the last child is removed, in both workout editors.
- The approved concise phone notification messages, including matching PR + trophy.
- Background PWA checks after startup, sign-in, resume and reconnect, plus periodic
  checks while open. Activation/reload wait for a visible safe screen without an
  active workout, visible edit fields, pending note saves or recent typing/clicking.
- Demo identity matches its fictional provider, including owner-scoped autosaving.

## Update limits

Checks do not block app rendering or login and do not download every asset on each
sign-in. New assets are downloaded when the service worker detects a new release.
Offline devices update after reconnecting. Existing installations running older
code may require closing/reopening once for this first release. A browser controls
service-worker timing, so an instant first-login update cannot be guaranteed.

## Database activation

- Private backup `ironlog_exercise_backup_20261116`: 332 existing workouts and 250
  exercise definitions, plus the old grants/policies. App roles have no schema access.
- Backup migration `20261117010016_exercise_release_backup` applied successfully.
- Feature migration `20261116183412_exercise_preferences_and_editing` applied in
  one transaction after the migration connector failed twice without installing it.
  The reviewed SQL and its version were recorded in migration history together.
- Authenticated create -> notes save -> definition edit passed against the hosted
  database inside a rolled-back transaction. No test exercise/settings were retained.
- Settings RLS is enabled, anonymous access is denied, and both new functions use
  security-invoker permissions. Signed-in execution is granted; anonymous execution
  is denied. Existing advisor warnings are unchanged; private backup tables add
  expected deny-all/no-policy information notices.

## Verification and rollback

332 automated tests passed before publication; frontend/API type checks, lint and
the production build passed. Real device notification receipt is not established
by these checks. Existing build warnings concern Browserslist age, CSS properties
and bundle size.

Previous production: `dpl_2uRyfFNBmfbwHaLmCpcu19HJe7dr`, commit `3de20f9`,
`https://iron-6zfk9x2g0-nels-bits-projects.vercel.app`. The database extension is
compatible with the prior client; reverting the frontend does not require deleting
new settings or restoring old workout rows. Use the private snapshot only for an
explicitly reviewed data recovery, preserving workouts created since the snapshot.

## Published release

- Runtime commit: `632fdee89a0cec1df2c44924a99f54522ce57ed6`.
- GitHub: https://github.com/Nels-Bit/ironlog/pull/31 (updated on the feature branch).
- Preview: `dpl_Fwmx8HU8tVajyUfTMCFnjAHfkjyA`, READY.
- Production: `dpl_Din49SrPYHZuq9kAMrPFzGkL5iET`, READY, correct project and commit.
- Immutable URL: https://iron-l3zooiz5j-nels-bits-projects.vercel.app.
- Stable URL: https://iron-log-tau.vercel.app, assigned to that production build.
- Public HTML serves `/assets/index-BUvXSKfc.js`; `/sw.js` returns 200 with no-cache.

The existing cached browser initially loaded the previous bundle. Closing and
reopening the app once after the new worker installed loaded the correct new
bundle. This verifies the stated first-transition caveat rather than guaranteeing
an immediate update for every existing installation.

Live fictional-demo browser checks passed:

- Create custom machine with a 100 lb base; complete 8 lb x 10 reps -> PR 108 lb.
- Edit that same definition to a 120 lb base -> PR 128 lb; entered weight stays 8.
- Notes begin collapsed, autosave, and remain available after leaving/reopening.
- Notes grow from 80 px to 306 px with multiline text and shrink back to 80 px.
  Manual resize is disabled. The edit-definition form does not show notes.
- At 390 x 844, the exercise screen did not overflow horizontally. Screenshot:
  `.vercel/exercise-release-live-2026-11-17.jpg`. Temporary viewport override reset.
- Captured browser warning/error logs were empty. Only fictional demo data was used.

The hosted rolled-back save test and isolated tests cover data persistence; this
browser demo does not establish a real iOS push-receipt or cross-device acceptance
result. No log drains are configured. GitHub reported 44 existing default-branch
dependency alerts during push (1 critical, 19 high, 19 moderate, 5 low); this update
does not change package versions or establish those alerts' applicability to this
feature branch. Treat dependency remediation as a separate maintenance task.
