# Simplified notification settings — October 13, 2026

The owner requested a single category switch, device timezone, no app quiet
hours, and milestone sharing beside the public/private profile controls.

## Behavior

- Each category switch writes both in-app and push settings together. An existing
  opt-out in either channel becomes off for both; no unwanted category is enabled.
  The account push switch, device subscription and OS permission remain separate
  delivery prerequisites. Old inbox history is retained.
- Reminder timezone follows the most recently active device on app startup,
  foreground resume and timezone-change checks while visible. Saving settings
  also captures the device zone. There is no manual timezone editor. A server
  cannot detect travel while every app installation is closed; the last observed
  device zone remains in use until an installation resumes. DST remains automatic.
- Quiet-hour controls and worker deferral are removed. Legacy columns remain
  compatible, but quiet_enabled is forced false even for older clients. Phone
  Do Not Disturb/Focus controls silence; pending jobs remain intact.
- Profile → Edit Profile → Profile Privacy now contains milestone sharing.
  Private profiles cannot share. Visibility and sharing consent save in one
  owner-authorized transaction. Notification-form saves cannot overwrite consent.

## Data and security

Migration: `20261014020956_simplify_notification_preferences.sql`.
Private snapshot: `ironlog_notification_settings_backup_20261013` (preferences
and profiles; client access revoked, RLS without client policies). No workouts,
sets, profiles, preferences or notifications are deleted. Live verification found
253 workouts, unchanged profiles, no missing preferences, no changed reminder/
sharing/master settings, matching channel maps and zero enabled app quiet hours.

The new privacy RPC is SECURITY INVOKER with a fixed search path and no anonymous
execution; existing owner RLS applies to both writes. It accepts no owner ID.
Tests verify cross-account isolation, invalid input, inaccessible backups and
rollback of visibility if the consent write fails. Existing project advisor
warnings unrelated to these additions are unchanged (legacy profile functions,
mutable search paths, pg_net placement and password protection). New backups
intentionally have no client policies; do not make them publicly readable to
silence an informational advisor notice.

## Verification

- 222 tests across 21 files; frontend/server/NodeNext TypeScript, ESLint,
  whitespace and production Vite/PWA build pass.
- Service tests verify timezone sync does not reset preferences, saves always
  use the device zone, channel maps match, sharing survives unrelated form saves
  and demo operations make no production requests.
- Browser verification uses fictional demo data, including privacy gating,
  saved sharing consent, category persistence, five switches, no manual timezone,
  no quiet-hour block, and no horizontal overflow at 360px/430px.
- Existing non-failing build warnings and physical phone acceptance limitations
  remain unchanged. The feature branch and PR #31 remain separate from main.

## Published result

Production deployment `dpl_4nVmek2MMez8swVpZsHkRAsAw2un` is READY at
`https://iron-log-tau.vercel.app`, runtime commit
`4387afd31e172a865818bf06914968c8db2a0b51` (about 28 seconds building).
Manual worker request 549 and independent scheduled request 550 both returned
HTTP 200; the minute scheduler remains active. Counters were zero, not proof of
phone display. The runtime scan found only the existing Node DEP0169 dependency
deprecation warning. The security advisor found no findings for either new
function. Published demo UI has five category switches plus the account push
master, no manual timezone/quiet/sharing controls on Notification Settings, and
sharing beside Profile Privacy. After saving a fictional sharing opt-out and
separately saving notification categories, that sharing opt-out was retained.
No real-account preferences were changed for browser acceptance testing.

Existing advisor follow-up references (not changes introduced here):
[legacy privileged functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
[extension placement](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
