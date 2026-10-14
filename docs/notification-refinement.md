# Notification and barbell refinement — October 13, 2026

Requested by the owner after the initial notification rollout.

## Behavior

- Remove own PR, own level, own trophy and own streak alerts from generation,
  settings, inboxes and pending push jobs. Historical rows are hidden, not deleted.
- Retain workout reminders, friend requests, friends' workouts, records and
  achievements. Test notifications remain available as a separate diagnostic.
- Push titles identify Workout, Award or Milestone; the body names the athlete
  and action, then includes the workout, trophy/level or weight/reps details.
  Example: `Milestone` / `Nelson hit a new PR · Barbell Bench Press · 225 lb × 5 reps`.
  iOS/Android own the app/source label; JavaScript cannot replace that label.
- Only Barbell Squat, Barbell Deadlift and Barbell Bench Press generate friend
  PR alerts. Other exercises still retain normal PR tracking and XP.
- The same three exercise and trophy labels are canonicalized. Only exact
  barbell aliases qualify; machine/dumbbell/Smith/incline/Romanian variations
  remain separate and do not inflate those barbell trophies.

## Merge and safety

Migration: `20261014005851_refine_notifications_and_barbell_exercises.sql`.
An existing canonical custom exercise wins over shared/default definitions.
Owner-only aliases remap historical references and restored active drafts; a
database trigger also remaps old offline clients. Every exercise block, set ID,
drop parent link and legacy JSON shape is retained. Multiple blocks in the most
recent session combine for ghost-set retrieval. No workouts, sets or source
exercise definitions are deleted, and no completion notifications are replayed.

Live verification after the atomic migration: 253 backed-up and 253 live workouts,
zero missing workouts/exercises, zero changed non-exercise workout fields, zero
unexpected set/JSON changes, one owner-specific Squat alias, machine Squat
unchanged, zero visible/pending personal alerts, and unchanged event count (3).
Backups deny client access; clients can read only their own identity mappings
and cannot insert/forge them. See `notification-backup.md` for recovery rules.

## Verification

- 216 tests across 19 files pass, including actual Postgres migration/RLS tests,
  duplicate-identity PR comparisons, legacy ghost data, drop links, and fail-closed
  demo service tests with zero production requests.
- Frontend/server/NodeNext TypeScript, ESLint, whitespace and Vite/PWA build pass.
- Browser: five remaining category settings; no horizontal overflow at 360px or
  430px; canonical trophy labels visible; no captured local warnings/errors.
- Existing non-failing Browserslist, CSS optimization and bundle-size warnings
  are unchanged and outside this request.

Physical lock-screen display and real two-friend/multi-device acceptance remain
manual checks. Mocked transport and server acknowledgements do not prove display.
GitHub changes remain on `codex/notification-center-push` / PR #31, not main.
