# Active workout mobile redesign review

Review date: October 12, 2026. Changes remain uncommitted for user review.

## Local preview

Open http://127.0.0.1:5174/workout-preview.html.

The development-only HTML entry renders the real WorkoutLogger, WorkoutProvider,
RestTimer, ExerciseSelector, Navbar, and WorkoutSummary. Services use fictional
exercise definitions and historical performances; network requests are rejected.
The normal application remains available at http://127.0.0.1:5174/ and requires
the usual sign-in. No production account or workout was modified during testing.

Use Reset preview for the seeded session or Empty session to test starting a new
workout. Preview state persists on this local origin. The preview HTML and harness
are not entry points in the normal production build.

## Changed files and behavior

- `src/pages/WorkoutLogger.tsx`: compact overview cards, progress and entered-set
  summaries, overflow removal actions, a confirmation dialog for entered data,
  one focused editor, per-set completion/deletion/type selection, accessible
  numeric fields, and a single Done action beside Add Set at the bottom. Finish disables while
  saving and reports errors without losing the active session.
- `src/utils/exerciseLogging.ts`: overview formatting for strength, cardio,
  unilateral, bodyweight, and assisted exercise sets; entered-data detection for
  removal protection. Historical hints do not count as entered data.
- `src/context/WorkoutContext.tsx` and `src/context/workoutContext.shared.ts`:
  moveExercise reorders workout instances through the same state and persistence.
  The untouched-default ghost hydration guard
  now accepts absent legacy fields and checks unilateral reps before hydrating.
  This prevents empty defaults from missing history and entered sides from being
  overwritten by a late historical response.
- `tests/exerciseLogging.test.ts`: nine regression tests for overview summaries,
  partial-data protection, cardio formatting, legacy/empty values, and three
  reorder tests for data integrity, boundaries, and persistence.
- `src/services/workoutService.ts`, `src/utils/workoutMath.ts`, and `src/types.ts`:
  historical PR lookups retain the actual highest-load set and its matching reps.
  The existing numeric PR API remains available, and failed history lookups do
  not become zero-load baselines. `tests/prPerformance.test.ts` adds 13 checks.
- `workout-preview.html` and `tests/preview/workout-preview.tsx`: local review
  harness, fictional history, persistent fixture data, and save-call counts.

## Navigation and persistence

The existing router stores only the selected workout-exercise instance ID in
`?exercise=...`. Tapping a card opens its editor. Done returns to the overview,
which immediately derives its summary from the context. Browser back/forward
uses the same navigation state. Direct focus links without an overview history
entry return by replacing the query. Unknown/removed instance IDs show overview.

Every data change continues through the existing context update functions and
the existing `current_workout` localStorage persistence. Done does not save a
second workout or award XP. Supabase saving remains in finishWorkout.

Input drafts preserve intermediate decimal strings such as `22.` while the
context stores their numerical value immediately. Load and cardio fields use
`inputMode="decimal"`; rep and left/right rep fields use `inputMode="numeric"`.
Input validation accepts nonnegative decimal loads and whole-number reps and
rejects scientific notation and invalid pasted values. Accessible labels identify
the set and field. The numeric controls and action buttons have 44px minimum
height; unilateral rep fields measured 46px wide at the 360px test viewport.

The existing SetType model remains unchanged: normal, warmup, failure, dropset,
and linked dropset_child. Drop parents keep the existing child-creation/removal
behavior; linked children remain identifiable and their type control is enabled.
The set-type and removal dialogs use native modal focus/keyboard handling.
The existing app colors, buttons, icons, and daisyUI component patterns were reused.

## PR and XP protection

The numeric PR cache, readiness gate, historical lookup scope, active-session comparison, and
start/cancel/finish cache lifecycle were retained. Changing views does not fetch
a new baseline or turn an entered but incomplete set into a PR.
The historical set-detail cache follows the same lifecycle and readiness gate.
PR labels now include actual reps at the displayed load; tied loads use the most
completed reps without changing weight-based PR eligibility or XP bonuses.

No XP engine or XP constants were changed. Cardio remains 2 XP per minute and
20 XP per mile. The existing deterministic historical replay tests pass. In the
browser fixture, a 30-minute, 3-mile run contributed 120 cardio XP. The tested
mixed session had raw XP 304 (85 base + 14 volume + 85 PR + 120 cardio), with
307 XP after the existing streak multiplier. Reloading its summary still showed
307 XP and one saved workout.

## Verification results

- TypeScript build: passed.
- Production Vite/PWA build: passed, with existing CSS optimization and bundle
  size warnings.
- All automated tests: 104 passed across eight files, including PR rehydration,
  PR eligibility, cardio XP, XP replay, and the new overview tests.
- Lint on every changed TypeScript/TSX file: passed.
- Full-project lint: blocked by existing unused identifiers in
  `src/pages/Profile.tsx:98` and `tests/prRehydration.test.ts:22`. Those unrelated
  files were not changed.
- Browser: overview and focused editor inspected at phone widths of 360px and
  430px, plus the desktop layout. The 430px DOM check found no horizontal overflow.
- Browser: integer and sequential decimal entry (`22` then `.5`), whole-number
  rep validation, normal/warmup/failure/drop/child sets, edits after completion,
  adding/removing a set, Done, reopening exercises, and switching exercises passed.
- Browser: browser back/forward and active-workout reload retained entered data
  and set count. Historical equality (25lb matching a 25lb baseline) remained
  non-PR after reload; a completed 190lb failure set beat a 185lb historical PR.
- Browser: dynamic exercise addition restored 45-day-old ghost targets; completing
  an untouched set filled previous targets and did not invent a new PR.
- Browser: existing and newly created cardio exercises used mile/time inputs and
  retained entered values after reload.
- Browser: overview removal of untouched exercises, keeping entered data at the
  confirmation dialog, and confirming removal of entered data passed.
- Browser: empty-session start, cancel, finish, and summary reload were exercised.
  Finish made exactly one save call; summary reload made no second save.
- Browser: console inspection after the exercised flow found no errors/warnings.

## Remaining verification boundaries

The local review uses fictional services. Live authentication, Supabase persistence,
and notification dispatch were not tested against a real account in this turn.
Physical iOS/Android keyboard layouts, safe-area insets, and installed-PWA suspend
and resume need device acceptance testing. Desktop browser resize/refresh cannot
establish those physical-device behaviors.

The overview now supports Move up and Move down from its overflow menu. Move up
is absent on the first exercise and Move down is absent on the last. Reordering
changes only the exercises array, keeps set IDs and values, and persists through
the context. There are no exercise-note controls in the existing data model.
Existing summary presentation rules
(including excluding warmups from its set count) were left unchanged.

## Review feedback applied

- Focused metadata now shows muscle group and equipment/category.
- Repeated Previous-performance text was removed; input ghost targets remain.
- Type buttons show icons, including a circle for normal, without set numbers.
  Their accessible labels still identify the set number and current type.
- Focused header Back and Done controls were removed. Done beside Add Set remains,
  and browser back still returns to the overview.
- The overview heading/counters were removed. Cards show entered sets as
  "2 sets logged" rather than a completed/total fraction.
- Overview menus support reordering as described above.

Follow-up browser checks confirmed first/last boundary menus, order persistence
after reload, preservation of Bench Press weights/reps/completion after moves,
no focused-header buttons, icon-only normal selectors, Chest/Cables metadata,
and remaining 25lb/12-rep ghost placeholders without repeated Previous text.

The cardio follow-up shows only one Cardio metadata label, omits Cardio Session,
and removes the type column/control entirely. Miles, time, completion, and deletion
remain available, with the existing cardio data and XP calculation intact.
Strength type selectors are now transparent, borderless icons with 44px tap
targets and visible keyboard focus indicators.

The rest-timer follow-up removes its header clock icon, badge, and progress bar.
The expanded timer is a single 62px-high row with no visible title. Minimize,
subtract 15 seconds, add 15 seconds, and close surround a readable countdown.
A shared navbar height
variable includes the safe-area inset and border in the timer offset, with a
12px gap for both docked and expanded states. Desktop positioning is unchanged.
Timer buttons have 44px tap targets and accessible labels. Browser checks measured
the mobile gap as 12px and verified docking/expanding without restarting the timer.
The slim bar measured 62px high, all four buttons measured 44px square, and its
45-minute overtime display fit at a 360px viewport without horizontal overflow.

The latest feedback removes overview chevrons and adds reps to PR labels. Browser
reload preserved PR 185 lb × 8 reps without a false NEW PR. Drop parents retain
full-width rows; children indent 20px, share the same right edge, and leave room
for the connector. Add Set and Done share one 44px-high action row, with Done on
the right and no older duplicate action. This layout fit the 360px viewport
without horizontal overflow. Historical lookup tests verify older PRs, lighter
recent ghost targets, duplicate exercise blocks, legacy JSON keys, and fetch errors.

The overview follow-up replaces set-count/status text with orange muscle and
equipment metadata (for example, Chest · Free Weights); cardio still shows a
single Cardio label. Exercise names use 18px type instead of 16px. The header
already spans the available width, so its height increases from 64px to 68px,
plus the device's top safe-area inset to preserve usable header space.

The input-spacing follow-up keeps cardio rows full-width like strength rows,
while capping each cardio input at 112px, centered under its column label. Inner
horizontal padding and an inset focus indicator (no scaling) prevent spillover.
Numeric fields retain their 44px height. All set rows now have 12px between them;
drop children indent 32px while retaining the parent's right edge. The connector
was extended to match the new indent and row gap.

The connector now starts 4px below the preceding row, within the 12px gap, so it
does not touch or run across the parent. The overview header uses equal-width
side tracks to center its title and elapsed time independently of button width.
Long workout names truncate on narrow screens without covering the controls.
