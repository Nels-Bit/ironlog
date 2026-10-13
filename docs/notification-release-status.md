# Notification release status — October 13, 2026

Production rollout and GitHub submission were explicitly authorized after review.
The implementation is submitted as [PR #31](https://github.com/Nels-Bit/ironlog/pull/31)
on `codex/notification-center-push`. The PR has not been merged.

## Confirmed targets

- Vercel: `nels-bits-projects/iron-log`, project `prj_xFflzyRIKp78zOuKSssRFS1qdRoo`.
- Production origin: `https://iron-log-tau.vercel.app`.
- Supabase: `iron-log`, project `vshrcthrjgsqarhsssto`, healthy Postgres 17.
- Existing live data before rollout: 250 workouts, 2 friendships, 4 notifications.
  No workout/notification contents were exported during inspection.

## Preparation completed

- Configured Production-only APP_ORIGIN, VAPID_SUBJECT, VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY and NOTIFICATION_WORKER_SECRET in Vercel. Private values are
  Secret variables and were not written into repository files or shown to the user.
- Examined the real legacy schema, including policies, grants and constraints.
  Added a real Postgres regression for upgrade/history preservation and removed
  legacy client TRUNCATE permissions on notification/friendship/preference tables.
- Hosted preview initially exposed Vercel ESM import failures. Explicit `.js`
  imports and `api/tsconfig.json` now fix them; the normal build also checks NodeNext.
- All 185 tests, frontend/server/NodeNext TypeScript, ESLint and PWA build passed.
  A native Node invocation of the emitted API returned HTTP 200.
- Corrected hosted preview: `dpl_GYCeFG73TQ2x7XopY6P9CW9kTw1j`.
  Authenticated fetch of `/api/notifications` returned HTTP 200 with
  `{"publicKey":null}`. The null is expected: private production settings are
  intentionally not shared with Preview. Its build logs had no TypeScript errors.
- Uploaded source contains no `.env` or `.vercel` files. Initial preview source digest:
  `65791374154f41dfe0ca328b9795f68defbe5c364c5a8d6c7fba37a3f95365f1`.

## Production deployment and verified backup

The approved migration `notification_center_and_push_release` completed successfully.
The first approval attempt expired without executing; a read-only check confirmed
the original database was unchanged before retrying the approved transaction.

Private rollback copies are in `ironlog_notification_backup_20261013`:

| Table | Backup rows | Live rows immediately after migration |
|---|---:|---:|
| workouts | 250 | 250 |
| friendships | 2 | 2 |
| user_profiles | 3 | 3 |
| notifications | 4 | 4 |

All original workout IDs remain and zero original workout contents changed.
The private schema denies anon/authenticated access, and its tables also have RLS.
Policy, grant and profile-function snapshots are retained for recovery. No private
records were exported or committed. See `notification-backup.md` for recovery rules.

Production frontend/API deployment is READY at `https://iron-log-tau.vercel.app`.
The verified deployment is `dpl_EzW4VtBySh37Z8pg6GEH1qyWwi4N`, using commit
`597e4ac18fc491932c0a194e84607fb88ca104d9` (Vite, Production, READY; approximately
34 seconds from build start to readiness).
The public endpoint returns only the VAPID public key; no private credential is
exposed. Realtime contains notifications and notification_preferences. Privileged
worker helpers and subscription credentials are denied to public clients.

## Credential correction and live worker verification

The owner saved `SUPABASE_SERVICE_ROLE_KEY` in the correct Vercel project as a
Production-only Secret. Metadata verification confirms the name, scope and storage
type without retrieving or displaying its value. Earlier connection tests returned
HTTP 401 `UNAUTHORIZED_INVALID_API_KEY`; the owner confirmed the copied key came
from the separate Daymark project. After replacing it with IronLog's own key and
rebuilding Production, authenticated worker request 6 returned HTTP 200. Maintenance,
reminder scheduling, event processing and delivery-job queries all completed without
error. Counters were zero because there were no eligible queued events or devices;
this establishes connectivity, not real push-service or phone acceptance.

The earlier safety rejection was resolved by the owner's explicit approval for the
exact database upgrade and possible brief save interruption. The approved transaction
included the private snapshot and all migration changes; it did not delete history.

- [Supabase API keys](https://supabase.com/dashboard/project/vshrcthrjgsqarhsssto/settings/api-keys)
- [Vercel environment variables](https://vercel.com/nels-bits-projects/iron-log/settings/environment-variables)

pg_cron and pg_net are installed. The worker URL and secret are stored in Vault,
without putting the credential in the scheduled SQL. Following the successful probe,
the approved `ironlog-notification-worker` minute schedule was activated as job 1.
Its first scheduled run at 17:23 UTC (1:23 PM America/New_York) succeeded; HTTP
request 7 independently returned 200, without a manual worker call. A fresh data
check still found 250 live/250 protected workouts, zero missing original rows and
zero changed original workout contents. There were zero registered push devices.
No fake workouts, accounts or notifications were created for verification.
Workout logging remains independent of push failures.

The production error-log scan found a Node DEP0169 dependency deprecation warning,
not a failed worker/database request. Broader dependency updates remain out of scope.

## Remaining rollout

1. Register an actual supported installed PWA through its explicit Enable button.
2. Verify a user-requested test notification is accepted and displayed on the phone.
3. Complete the two-account/multi-phone acceptance checklist for real workout,
   level, trophy and reminder events. No such live end-to-end acceptance is claimed.
4. Review and merge PR #31 separately; physical device acceptance remains outstanding.

See `notifications-deployment.md` for the full operational and iPhone checklist.
