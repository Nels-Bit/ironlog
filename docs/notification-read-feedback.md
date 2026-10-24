# Notification read feedback — October 19, 2026

## Behavior

- Read all immediately shows a spinner, `Saving…` and a live status message.
  Repeated clicks share one request; the control stays disabled until saved
  state and cached inbox/count refreshes finish. Confirmation is shown only
  after success. Failures offer Retry instead of claiming the write succeeded.
- Loaded unread IDs are collected for the current notification-center visit.
  Navigating away acknowledges those IDs through the existing owner-scoped RPC.
  Hidden/pagehide events also attempt to save that visit. Effect cleanup itself
  performs no write, avoiding React Strict Mode's simulated-unmount trap.
- Older/unloaded notifications and new arrivals not loaded during the visit are
  not acknowledged automatically. Explicit Read all still covers the full inbox.
  Intentionally choosing Mark unread excludes that item for the rest of the visit.
- The provider owns the pending work and retry feedback, so normal in-app
  navigation does not cancel it. Account-scoped cache keys and an account check
  protect identity changes. No credentials, direct table UPDATE grants, schema
  migration or notification/history deletion is introduced.

## Verification

- 264 automated tests across 25 files passed, including delayed saves and cache
  refresh, double-click deduplication, retries, visit-only IDs, preserving explicit
  unread choices, arrivals during Read all, and real service/demo-provider RPCs.
- Frontend and API TypeScript, full lint, production Vite/PWA build and whitespace
  checks passed. Existing non-failing build warnings remain unchanged.
- Browser testing used only the isolated fictional demo. Read all produced the
  saved confirmation, explicit Mark unread survived the current visit's exit,
  and revisiting then leaving acknowledged that viewed item. No browser
  warnings/errors were captured. The 44px read control fits 360px/390px layouts.

The owner approved publication on October 19, 2026; see
`ui-updates-release-2026-10-19.md` for release tracking. No real
account's notification read state was changed for verification. A hard browser
termination or offline device can interrupt an unload-time request; the hidden/
pagehide handler is best effort, not a claim of durable offline background sync.
