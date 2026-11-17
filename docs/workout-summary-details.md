# Workout summary interactions — October 19, 2026

Status at implementation: local on `codex/notification-center-push`. The owner approved publication on October 19, 2026; see `ui-updates-release-2026-10-19.md` for release tracking. Earlier notification-read feedback edits are preserved.

## Changes

- Workout-completion level celebration uses a native modal dialog. Taps on the trophy, text, card, or surrounding screen dismiss it. It sits above the navigation, traps focus, and supports Escape.
- Shared workout summary renders independently expandable exercise rows using native details/summary controls styled with the existing collapse component. Both profile-history and post-save summary routes use this screen.
- Expanded rows show saved weight and reps, decimal values, left/right reps, bodyweight/assistance, warm-up/drop/failure labels, and cardio distance/time. Entered unfinished sets are marked "Not completed"; untouched placeholders are omitted.
- Numeric normalization preserves null/empty measurements instead of converting them to zero. This only changes reading data; no stored workout rows, schema, or scoring rules are changed.
- Summary loading cancels delayed animations/celebrations on unmount, avoiding stale/duplicate timers.

## Verification

- 276 tests across 27 files passed, including 12 new summary rendering, formatting, normalization, and save/reload checks. Frontend/backend type checks, lint, and production build passed.
- Isolated save/reload test uses the real workout service against the existing in-memory demo provider. Saved and history-fetched details agree; decimal values survive and unused sets stay hidden. A network spy rejects any live request.
- Browser: Profile → Activity → Summary → exercise expansion showed all three recorded sets with correct weight/reps. Keyboard Enter collapsed the disclosure. Tapping the center level number dismissed the celebration. Phone-sized (390 × 844) layout had no document horizontal overflow; exercised browser flow logged no warnings/errors.
- Full browser Finish → Save walkthrough was blocked at the existing JavaScript confirmation: this browser cannot resolve that dialog reliably. Subsequent interactions in that browser were inconclusive, so Escape/background-tap were not independently browser-verified. Save/reload is covered by the isolated integration test; no production workout was created or changed.
- Screenshot: `.vercel/workout-summary-details-2026-10-19.jpg` (fictional demo data).
- Existing nonblocking build warnings remain: Browserslist age, daisyUI CSS property optimization, and bundle size.

No migration, credentials, package installation, or live database changes are required.
