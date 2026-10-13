# Notification release status — October 13, 2026

Production rollout and GitHub submission were explicitly authorized after review.
The implementation remains on `codex/notification-center-push` for submission.

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
- Uploaded source contains no `.env` or `.vercel` files. Source digest:
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
The diagnostic deployment is `dpl_ABCn6W7zYFjH6ZZvaNL87iMePffY`.
The public endpoint returns only the VAPID public key; no private credential is
exposed. Realtime contains notifications and notification_preferences. Privileged
worker helpers and subscription credentials are denied to public clients.

## Remaining delivery gate

The owner saved `SUPABASE_SERVICE_ROLE_KEY` in the correct Vercel project as a
Production-only Secret. Metadata verification confirms the name, scope and storage
type without retrieving or displaying its value. The actual server connection
test failed: Supabase gateway logs return HTTP 401,
`UNAUTHORIZED_INVALID_API_KEY`, for `/rest/v1/rpc/cleanup_notification_delivery`.
The provided credential identifies itself as service_role but is not accepted for
the target project. The owner must replace its value with ironLog's complete key.

The earlier safety rejection was resolved by the owner's explicit approval for the
exact database upgrade and possible brief save interruption. The approved transaction
included the private snapshot and all migration changes; it did not delete history.

- [Supabase legacy keys](https://supabase.com/dashboard/project/vshrcthrjgsqarhsssto/settings/api-keys/legacy)
- [Vercel environment variables](https://vercel.com/nels-bits-projects/iron-log/settings/environment-variables)

pg_cron and pg_net are installed. The worker URL and secret are stored in Vault,
without putting the credential in the scheduled SQL. The schedule remains OFF
until the owner replaces the rejected server key and a fresh deployment passes
the actual worker request. Failed connection tests did not send pushes or create
fake workouts/notifications. Workout logging remains independent of push failures.

## Remaining rollout

1. Replace the rejected Production service-role value, then rebuild/redeploy.
2. Verify an authenticated worker request returns HTTP 200 before activating cron.
3. Verify actual scheduled HTTP responses, event persistence and secure delivery
   without creating fake workouts or notifying real friends as test fixtures.
4. Physical iPhone permission, lock-screen display and multi-phone acceptance still
   require the owner. Push acceptance never proves display.

See `notifications-deployment.md` for the full operational and iPhone checklist.
