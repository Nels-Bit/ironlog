# Notification rebuild plan

Branch: `codex/notification-center-push`. Local implementation only; no deployment,
commit, push, or production migrations are authorized by this task.

Follow-up: the owner has now authorized production implementation. See
`notification-release-status.md` for preparation and the remaining private-key gate;
the original local-only restriction still describes the initial review phase.

## Inspection

React 19/TypeScript/Vite, React Router, Tailwind/DaisyUI and Lucide remain in use.
Supabase Auth/Postgres/Realtime own accounts, friendships and notification rows.
Vercel hosts the app and existing Node API functions. VitePWA generates the one
Workbox caching worker. There is no existing push subscription or scheduler.
The old Alerts page has only the latest 20 social notifications and mark-all-read;
the client creates social events, which can be lost when the browser closes.
The prior dispatcher also queries a profile `weight` column absent from its migration.

## Implementation

1. Extend notifications without deleting legacy history. Recipient-only RPCs own
   read/unread/soft-delete state. Add pagination and shared Realtime invalidation.
2. Persist separate in-app and push category preferences, reminder schedule,
   timezone, sharing consent and quiet hours; per-install subscriptions remain independent.
3. Database triggers capture only first finalizations and real friendship transitions.
   A private durable event outbox snapshots history/definitions at completion;
   server workers reuse existing PR/XP/trophy/streak functions. No client-supplied
   recipients or achievement claims. No startup/edit/import notifications.
4. Transactional fan-out checks current friendship, public profile and sharing
   settings; stable keys deduplicate rows and per-device delivery jobs.
5. Vercel Node worker sends encrypted standards-based Web Push with server-only
   VAPID credentials. Leased jobs, bounded retries, expired-endpoint invalidation,
   send-time privacy/preference checks and generic lock-screen payloads.
6. Keep the generated caching worker; import one push/click handler script into
   it, not a second registration. Clicks route through authenticated target resolution.
7. Supabase pg_cron + pg_net + Vault invoke the protected worker every minute.
   Server timezone scheduling handles DST; daily idempotency and already-worked-out
   suppression; quiet hours defer up to the delivery expiry, never erase history.
8. Redesign Notifications, add Settings → Notifications and iOS Home Screen/
   permission guidance; never prompt automatically. Test action means queued or
   push-service accepted, never guaranteed phone display.

## Validation and deployment gates

Pure event/scheduling/security tests, actual Postgres migration/RLS/outbox tests
via development-only PGlite, mocked encrypted transport tests, existing regression
suite, frontend/server TypeScript, ESLint and PWA build; mobile/demo browser review.
Production migration, VAPID/worker secrets and scheduler activation are documented
but deliberately not applied. Physical iPhones and live two-account Supabase
acceptance remain required before claiming real-device delivery.
