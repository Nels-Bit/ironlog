# Notifications and Web Push — deployment & acceptance

## Current delivery boundary

This implementation is on `codex/notification-center-push`. The owner has now
approved production rollout. Preparation has configured Production-only push keys
and verified a hosted preview; see `notification-release-status.md` for the current
release gate and deployment evidence. The approved database upgrade and private
rollback copies are now verified, and the production app is deployed. The corrected
IronLog server credential passed the live worker test; the protected minute schedule
is active and its first scheduled HTTP request returned 200. No phones are registered
yet. Automated tests cannot establish that a physical iPhone displayed a notification.

## Architecture

Existing React/TypeScript, Supabase Auth/Postgres/Realtime and Vercel Node functions
are retained. Existing PR, XP, trophy and streak code is reused on the server,
with an immutable database snapshot from the first finalized live workout.
`workouts.notification_source='live'` is set only by the completion save path;
legacy/imported rows default to `historical`. Editing a completed row does not
queue a new event. Older schemas still save workouts through a schema-only fallback.

One generated Workbox worker retains offline caching and auto-update behavior;
`push-worker.js` supplies push/click handlers via importScripts. It is NOT a second
worker. `web-push` performs RFC-standard encryption and VAPID authentication.
The stale `/manifest.json` reference was removed; VitePWA now supplies the single
generated manifest, with the existing PNG reused for the Apple Home Screen icon.
PGlite is development-only, used for actual Postgres migration/RLS/transaction tests.

Events → persisted recipient notification → per-install durable job → send attempt
→ push-service acceptance are distinct states. No display receipt is claimed.
Outbox leases recover after crashes, and event/recipient/device uniqueness prevents
duplicate records. A network acceptance followed by a lost database acknowledgement
can require a retry: delivery is at-least-once, not exactly-once. Stable push tags
and topics coalesce duplicate presentations where supported.

Public profiles, sharing consent and active friendships are checked at fan-out,
push-send and deep-link resolution. Lock-screen payloads are generic; detailed
workout information stays behind sign-in and server authorization. A recipient can
only read/mutate their own inbox; clients cannot insert notifications, edit titles
or read subscription credentials/event snapshots. Soft deletion preserves event
keys for deduplication without showing deleted records in the inbox or unread count.
In-app and push categories are independent: push-only events retain a hidden owned
record for authorization/deduplication, excluded from inbox pages and unread counts.

## Deployment checklist (reference; live status is recorded separately)

1. Back up the database. Confirm existing social/workout/exercise tables and deploy
   existing social migrations first. Apply
   `supabase/migrations/20261013_notification_center_push.sql` in a staging database.
   Existing notifications remain; no historical notification backfill is sent.
2. Configure server environment variables (Secret type for private values):

   | Name | Expected value |
   |---|---|
   | SUPABASE_URL | `https://<project-ref>.supabase.co` |
   | SUPABASE_ANON_KEY | Existing project's public anon/publishable-compatible key |
   | SUPABASE_SERVICE_ROLE_KEY | IronLog privileged service_role or modern `sb_secret_` key, server only |
   | APP_ORIGIN | Exact HTTPS app origin, no trailing slash |
   | VAPID_PUBLIC_KEY | URL-safe base64 uncompressed P-256 public key, 65 bytes |
   | VAPID_PRIVATE_KEY | URL-safe base64 P-256 private key, 32 bytes, server only |
   | VAPID_SUBJECT | A real `mailto:owner@example.com` contact or HTTPS contact URL; not localhost |
   | NOTIFICATION_WORKER_SECRET | Random 32+ byte credential; never a client variable |

   Existing VITE_SUPABASE variables stay unchanged. The API accepts these as a
   fallback for URL/anon only. No private key may use a `VITE_` prefix.
3. Generate one stable VAPID pair in a private administrator terminal using
   `npx web-push generate-vapid-keys --json`. Copy to server Secret settings; do not
   commit the output. Generate the worker secret with a cryptographic RNG.
   Keep development/preview and production secrets/database credentials separate.
   Changing VAPID keys requires re-subscribing affected devices.
4. Deploy the frontend and `/api/notifications` together over HTTPS. Confirm the
   build includes `/push-worker.js`, and `/sw.js` imports it alongside Workbox.
   Add no-cache headers for worker scripts. `GET /api/notifications` returns ONLY
   the public key. Authenticated POST supports register/unregister/test/kick, never
   arbitrary recipients or message content. Supabase bearer auth is verified
   server-side; cross-origin browser mutations are rejected. Database rate limits
   cap test requests at two/minute and other sensitive actions at twenty/minute.
   Database friend-request inserts require two public profiles and are limited to ten/minute.
5. Enable Supabase pg_cron, pg_net and Vault. In Vault create
   `ironlog_notification_worker_url` (HTTPS `/api/notifications?worker=1`) and
   `ironlog_notification_worker_secret` (same as the server secret). Run
   `supabase/setup/notifications-scheduler.sql` to activate the minute scheduler.
   This avoids a paid scheduling dependency or Hobby-plan per-minute Vercel Cron.
   It must reach the production endpoint without preview authentication barriers.
6. Confirm Realtime publication includes notifications and notification_preferences;
   watch read/deleted/preference updates from a second signed-in device. Initial
   fetch, visibility refresh and a two-minute count refresh are fallbacks, not push.
7. In staging, exercise the four-phone acceptance below. Only then apply production
   configuration/migration and release to users. Keep branch work local until approved.

## Reminder & quiet-hour policy

Selected days/time use the configured IANA timezone, defaulting from the device
when preferences are first saved or push is first enabled. The timezone does NOT
silently change when another device logs in. “Use this device’s timezone” is explicit.
Intl and Postgres use timezone rules including DST. A skipped spring-forward time
fires after the clock advances; the repeated fall-back hour retains the same daily
key. A scheduler outage catches up later the same local day, never backfills prior
days. A saved non-rest workout ending that local day suppresses the reminder,
including when the workout finishes after queueing but before delayed delivery.
Disabling reminders prevents creation and skips pending delivery. Quiet hours
defer push, but never hide inbox history; reminder jobs expire after two hours,
milestone jobs after twenty-four. Expired quiet-hour items are skipped.

## iPhone acceptance (required, not performed here)

1. Use supported iOS/iPadOS 16.4+ and Safari. Open the HTTPS app, sign in, choose
   Share → Add to Home Screen, and launch from that icon. Update/reopen once online.
2. Notifications → gear → Enable notifications. Tap Allow in the system prompt.
   Permission is requested ONLY by this button. A decline is never auto-prompted.
   Denied permission must be changed in iPhone Settings; account toggles cannot override it.
3. Confirm “Subscribed”; enable account push and desired categories. Save settings.
   Send test push. “Accepted” means the push service accepted it, not proof of display.
4. Lock the phone and inspect actual system delivery. Tap it; it opens the owned
   notification after authentication. Close the PWA and repeat using another
   account/device to create a workout event, relying on the scheduler, not an open tab.
5. Sign into the same account on iPhone 2 and enable it independently. Both should
   receive attempts. Disable only iPhone 1; iPhone 2 must still receive. Sign out
   of iPhone 1; its endpoint is revoked and browser subscription removed. If offline,
   browser unsubscribe runs even when server revocation fails; expired endpoints
   are invalidated on 404/410. Test account switching on the same installation.
6. On phones 3 and 4 (different friend accounts), accept the friendship and enable
   friend activity. Complete one workout; exactly one inbox event per category and
   one delivery job per active device. Retry worker/kick; no duplicate inbox rows.
   Private/nonsharing profiles, declined requests, unfriended and unrelated users
   must not get friend-only activity. Remove friendship before worker delivery and
   confirm queued private activity is skipped and old deep links gracefully fail.
7. Read, unread, delete and clear an inbox from one phone; verify the other updates.
   Test All/Unread/Friends/Personal and older-history pagination. Clear keeps workouts.
8. Complete PRs with normal/warmup/failure/drop/child; edit old workouts/reopen an
   active session: no new events from editing/hydration. Test cardio and XP unchanged.
9. Test a local-time reminder with the app closed, selected/unselected days, disable,
   already-completed workouts and quiet-hour defer/expiry. Test DST in staging using
   clocks/schedule fixtures; do not alter a production clock.
10. Confirm offline shell/worker updates and normal workout/navigation/auth behavior.

## Operations & known boundaries

Monitor pending notification_events (processed_at null), attempts >=8 (manual
review/dead-letter recovery), pending/failed/skipped/accepted push_delivery_jobs,
and invalidated subscriptions. Retry failed events by resetting attempts/available_at
only after the cause is fixed. Monitor cron.job_run_details and net._http_response.
Logs include event/job IDs and sanitized status codes, never endpoints, encryption
keys, tokens or private snapshots. Processed snapshots are cleared.
`attempted_at` records real transport attempts separately from worker lease/retry
counts; `accepted_at` records push-service acceptance, never phone display.
Minute-worker maintenance removes invalidated device credentials after 30 days,
processed event rows after 90 days, and stale rate-limit windows. Inbox event keys
remain for deduplication, including after soft deletion.

The live Supabase migration, rollback snapshots, worker connection and scheduled
worker execution are verified. Real push-service acceptance, installed-PWA update
and physical iPhone delivery remain unverified.
Preview push is intentionally disabled in
fictional demo mode. Multi-worker locking was exercised through actual Postgres
leases; embedded tests are serial and do not reproduce real distributed transport
timing. Existing dependency advisories are outside this feature's scope.

Primary references: [WebKit iOS Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/),
[web-push](https://github.com/web-push-libs/web-push),
[Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron),
[Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
