# Exercise details and drop-set repair

Implemented on `codex/notification-center-push`. Publication was approved with the
short phone-notification copy changes. See `exercise-details-release-2026-11-17.md`
for the database activation, deployment identity and rollback record.

## Behavior

- New custom exercises offer Starting resistance in pounds, including decimals,
  styled to match the other definition fields. Notes only appear inside the
  exercise, not in the create/edit definition form. The pencil in the library
  opens its editor without adding another copy to the workout.
- Notes start collapsed in the focused logger and history editor. The text box
  starts at the existing minimum height, grows/shrinks to fit wrapped text and
  line breaks, and has no manual resize handle. They autosave
  after a 700 ms typing pause, blur, navigation or hiding the app. Clearing the
  text removes the note; there are no Save/Remove buttons. The limit is 500
  characters, with pending/success/error feedback. Drafts are written immediately
  to account/exercise-scoped device storage (memory only in Demo Mode). Serial
  saves preserve newer typing, retry failed sync up to three times, and retry on
  reconnect/revisit. Shared definitions are not modified by personal notes.
- Starting resistance is added to the entered weight. A 100 lb base plus 10 lb
  entered stores 110 lb total. The input is labeled LBS and shows only 10, without
  a base/total caption. Overview, saved summaries, history and shared workout set
  details also show the entered weight. XP and volume still count 110 lb per rep.
- Each new set snapshots its starting resistance and stores total weight in the
  existing weight field. Existing PR/volume/XP calculations therefore
  include the base exactly once. Editing the default updates every matching set
  in the current unsaved workout while preserving entered weight, reps and drop
  links. Current PR and final volume/XP therefore use the corrected base. Saved
  workouts retain their original snapshots and loads. History-based hints from legacy logs
  retain their known total rather than silently adding a new base again.
- Name, muscle, notes and starting resistance can be changed on used custom
  exercises. Once an exercise has saved history, changing its type or unilateral
  tracking is rejected with an explanation to avoid reinterpreting old records.
- Removing the final drop child makes its parent normal. Parents with another
  child stay drop sets; removing the parent removes its child family. Type changes
  and child insertion/removal now happen atomically in both workout editors.

## Database and safety

Migration: `supabase/migrations/20261116183412_exercise_preferences_and_editing.sql`.
It creates the private, owner-scoped `exercise_settings` table and transactional
security-invoker save functions. Explicit grants/RLS, bounded note/resistance
checks, indexed foreign keys, and ownership checks cover shared/custom exercises.
It does not rewrite or delete any existing workout, set, or exercise.

The migration passed isolated tests and has been applied to the hosted project.
Authenticated create, notes save and definition edit passed in a rolled-back live
transaction. The private backup retains the pre-release workouts and definitions.
Older clients continue to use their existing tables. A new client reading an old
schema can still load workouts, but shows a clear unavailable message for notes;
new detail saves fail visibly instead of reporting false success.

## Verification

- 332 tests across 34 files passed, including 47 new resistance, deletion, autosave,
  private-service persistence, Postgres permissions/rollback and notes-rendering
  checks. Autosave tests cover typing pauses, leaving before saving, slow responses,
  clearing text, offline retry/recovery and restored device drafts. A 100 lb base
  plus 10 lb input displays 10 lb in summaries while volume/XP use 110 lb. Two-user
  tests reject cross-account reads/writes and editing shared or
  other-user definitions. Invalid multi-part saves roll back without orphan rows.
- Frontend/API type checks, full lint and the Vite/PWA production build passed.
- Browser verification was attempted using the local fictional demo, but Chrome
  app-access approval timed out before a test window could open. No visual/mobile
  browser or real-device acceptance result is claimed. No live database/user data
  was used or changed. The development preview also keeps the new saves local.
- Existing build warnings remain: Browserslist age, daisyUI CSS property
  optimization and bundle size.

Before publication, apply the migration, check database advisors and grants, and
complete a demo browser check of create → edit → add → autosave notes → revisit,
starting resistance totals, and drop-parent repair in both editors.
