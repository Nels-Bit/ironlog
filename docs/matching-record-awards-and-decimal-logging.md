# Matching record awards and decimal logging — October 14, 2026

## Behavior

- A PR and newly earned trophy for the **same barbell lift in the same workout**
  create one notification, not two. Bench Press, Squat and Deadlift remain the
  only PR-notification lifts. Different lifts, unrelated awards and the separate
  workout-finished event are not grouped together.
- Combined alerts include the athlete, canonical lift, weight, reps and trophy.
  Each recipient's Records and Achievements switches are respected when creating
  the inbox row. The worker rechecks both switches before sending: if one was
  disabled while queued, only the still-enabled detail is sent. Neither enabled
  means no combined push. Existing inbox history is not rewritten.
- Newly added exercise tiles scroll into view, jiggle once and briefly gain an
  orange outline. Reduced-motion users get the outline without spatial movement.
  Existing/restored exercises do not repeatedly animate on timer ticks.
- Weight and reps accept plain nonnegative decimals in the active logger and
  historical editor, including unilateral left/right reps. Focused drafts such
  as `22.` remain typable; stored numeric values are not truncated to integers.
  The shared input rejects signs, exponent notation and nonfinite values.

## Data protection and migration

`supabase/migrations/20261015030803_combine_matching_record_award_alerts.sql`
replaces the service-only event emitter, retaining its grants and social/privacy
checks. Before replacement, the prior function definition is copied into private
`ironlog_combined_alert_backup_20261014.functions` (one row). The backup schema
denies anonymous/authenticated access and its table has RLS without client policies.
The migration has short lock/statement timeouts and rewrites no workout history,
notifications or event rows. Decimal sets already use JSON numeric fields, so no
numeric-column conversion is necessary.

Immediately before and after the live migration, the counts were 256 workouts,
23 notifications and 6 events. Anonymous/authenticated emitter execution and
client backup access were denied; service-role execution remained allowed.
Existing private backups are retained. Existing unrelated security-advisor and
dependency findings were not changed by this feature.

## Verification

- **248 tests across 23 files pass**, including actual PostgreSQL emission,
  one matching inbox row and one encrypted push attempt per device, retry
  deduplication, mismatched-lift rejection, per-recipient opt-outs and send-time
  preference changes. Network transport is mocked in these tests.
- Frontend/server/NodeNext TypeScript, full ESLint, production Vite/PWA build
  and Git whitespace checks pass.
- Isolated fictional demo browser checks verified one-time jiggle/outline and
  `145.75 lb × 5.5 reps`, plus unilateral `22.5 lb × 2.5L / 3.5R reps`.
- Editing, saving and reopening a fictional historical workout retained weight
  `145.75` and reps `5.5`. Mobile 360px/430px layouts did not overflow; captured
  local browser warnings/errors were empty. No real-account workout or fake
  production notification was created for these checks.
- Browser screenshots are local ignored artifacts under `.vercel/`, not source
  assets or private production records.

Production release evidence is recorded in `notification-release-status.md`.
Physical-phone push display still requires the owner-operated PWA acceptance
check; mocked transport or an HTTP-200 worker response does not establish that.
