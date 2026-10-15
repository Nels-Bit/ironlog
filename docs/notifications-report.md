# Notification Center and Web Push — local implementation report

Verified October 13, 2026. Branch: `codex/notification-center-push`.
Production upgrade and private rollback snapshots are verified, and the new app
is deployed. GitHub submission is authorized. Current delivery limitations are
recorded in `notification-release-status.md`.

## Architecture and features

The existing React/TypeScript/Vite UI, DaisyUI, React Query, Supabase Auth,
Postgres/Realtime and Vercel Node API architecture are retained. One existing
Workbox service worker imports the new push handler; no competing worker is added.

- Notification Center: All/Unread/Friends/Reminders, owned history pagination,
  unread `9+` badge, contextual cards and authorized destinations, read/unread,
  delete, mark-all-read, confirmed history clearing, empty/error/retry states.
- Persisted account preferences: one switch per category for both channels,
  account master push switch, sharing beside profile privacy, reminder days/time
  with automatic device timezone, and independent device subscriptions. App-level
  quiet hours are removed; device DND/Focus controls silence.
- Saved-workout events: friend completions, levels, trophies and friendship
  requests/acceptance. Friend PR alerts are limited to Barbell Squat, Barbell
  Deadlift and Barbell Bench Press. Personal PR/level/trophy/streak alerts are
  removed; PR tracking and XP for other exercises remain available in the app.
- Real Web Push implementation: standard encrypted `web-push` transport, VAPID,
  explicit permission button, install guidance, test sends, secure click resolution,
  device revocation on sign-out, endpoint expiration cleanup and account isolation.
- Delivery reliability: database snapshots of first live finalizations, transactional
  recipient fan-out, durable leased jobs, idempotency, bounded retries, expiration,
  timezone/DST scheduling and send-time privacy/preference/reminder rechecks.
- Privacy: recipient RLS and constrained mutations, private device credentials and
  event snapshots, authenticated API and worker endpoint, request limits, endpoint
  validation, descriptive opt-in lock-screen text and authorized shared workouts.
  Push titles are Workout/Award/Milestone with actor and event details in the
  body; the operating system controls the app/source label.

## Major files

| Area | Files |
|---|---|
| Screens and shared state | `src/pages/Alerts.tsx`, `NotificationSettings.tsx`, `NotificationTarget.tsx`, `src/context/NotificationProvider.tsx`, `notificationContext.shared.ts`, `src/components/Navbar.tsx`, `src/App.tsx` |
| Client services | `src/services/notificationService.ts`, `pushService.ts`, `socialService.ts`, `workoutService.ts`, `authService.ts` |
| Rules and types | `src/utils/notificationEvents.ts`, `notifications.ts`, `workoutSchema.ts`, `achievementUtils.ts`, `src/types.ts` |
| Backend | `api/notifications.ts`, `server/notificationWorker.ts`, `server/pushSecurity.ts` |
| Database and scheduler | `supabase/migrations/20261013_notification_center_push.sql`, `supabase/setup/notifications-scheduler.sql` |
| PWA and configuration | `public/push-worker.js`, `vite.config.ts`, `index.html`, `vercel.json`, `.env.example`, `tsconfig.node.json`, package files |
| Isolated demo | `src/lib/demo-seed.ts`, `demo-transport.ts` |
| Documentation and tests | This report, `docs/notification-plan.md`, `docs/notifications-deployment.md`, six new notification/push test files and a Postgres test helper |

`web-push` is the only new runtime dependency. Its types and PGlite are
development-only; PGlite exercises actual PostgreSQL rather than mocking SQL.

## Exact local verification

- Full test suite: **23 test files passed, 248 tests passed, 0 failed**.
  Includes exact barbell matching, removed alert suppression, descriptive push
  payloads and real Postgres exercise merges with legacy/drop-set preservation.
- Frontend and server TypeScript compilation: passed.
- Additional NodeNext compilation and native Node invocation of the emitted API:
  passed. Relative imports use explicit `.js` extensions for Vercel's ESM runtime.
- Full-project ESLint: passed.
- Production Vite/Workbox build: passed; one generated manifest and one worker
  with the imported push handler. No private server-key names in frontend assets.
- Git whitespace check: passed.
- Browser review: 360px and 430px mobile viewports, no horizontal overflow,
  minimum 44px header actions, filters, read/unread, deletion/clear, preference
  persistence and authorized navigation in fictional demo mode. Fresh page load
  had no captured warnings/errors after development hot-reload artifacts cleared.

Database tests cover authenticated RLS and hidden credentials, independent channels,
one account on multiple installations, logout/account rebinding, actual worker
fan-out against PostgreSQL, privacy revocation, leases/retries/deduplication,
  expired endpoints, reminder suppression, legacy quiet-hour removal, timezone/DST
  and maintenance. See `notification-settings-simplification.md` for the newer
  single-switch/device-timezone/profile-privacy behavior.
  See `matching-record-awards-and-decimal-logging.md` for matching-lift alert
  grouping, send-time preference rechecks, fractional logging/editing and the
  once-only exercise-added cue.
Transport tests generate encrypted VAPID requests; network sends are mocked.
Service-worker handlers are executed in tests, including malformed payloads and
same-origin click routing. None of this proves display on a physical phone.

## Deployment reference and remaining iPhone acceptance

Follow `docs/notifications-deployment.md` for exact formats and commands:

The production migration, private backup, server configuration, frontend/API and
protected scheduler are now deployed and checked. A manual worker probe and the
first scheduled HTTP request returned 200. See `notification-release-status.md`
for exact evidence. The infrastructure steps below are reference instructions,
not remaining tasks; physical device and real event acceptance remain outstanding.

1. Apply the additive migration in staging after the existing social migrations.
2. Set server-only Supabase service credentials, exact HTTPS `APP_ORIGIN`, stable
   VAPID public/private/contact values, and a random worker secret. No secrets
   were generated into or committed to this repository.
3. Deploy the frontend and API together. Activate the protected minute scheduler
   through Supabase pg_cron/pg_net/Vault and verify Realtime publications.
4. On each supported iPhone, use Safari → Share → Add to Home Screen, launch
   that installed app, open Notifications → settings → Enable notifications,
   tap Allow, then send a test. Lock the phone and verify actual delivery/clicks;
   repeat with the app closed, two devices on one account and two friend accounts.

## Known limitations

- Production worker connectivity and scheduled execution are verified with no
  eligible devices/events. Real workout-to-inbox-to-push flow, physical iPhones,
  system permission prompts and installed-PWA offline/update behavior still require
  acceptance. Zero counters are not evidence that a phone received a push.
- Push-service acceptance is not phone display. Network acknowledgements can be
  lost; transport is at-least-once, with stable topics/tags to coalesce duplicates.
- Preview demo intentionally blocks real push and production writes.
- Existing dependency advisories and non-failing build warnings (Browserslist
  data, DaisyUI CSS optimization and bundle size) remain outside this feature.
- The owner corrected the server credential after confirming the earlier key came
  from Daymark. No private credential was retrieved, displayed or committed.
- GitHub submission is PR #31 on `codex/notification-center-push`; it is not merged.
