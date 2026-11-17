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

Deployment identity and live verification are recorded after publication.
