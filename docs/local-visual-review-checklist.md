# Local visual review

Open **http://127.0.0.1:5175/demo** and confirm the **Demo Mode** banner.
Use this link rather than signing in with a real account. Everything below uses
fictional data. Refresh and Reset Demo discard demo changes; navigate within the
app when testing whether something remains saved for the next exercise/workout.

## New exercise features

1. **Create form:** Log → Start Session → Add Exercise → + (Create exercise).
   Check name, type, target muscle, unilateral toggle and Starting resistance.
   Resistance should match the other fields' labels, borders and rounded corners.
   There should be no notes field in this form. Cardio uses distance/time instead of
   weighted-set tracking.
2. **Example setup:** Create `Review Machine Press`, choose Machines, enter
   starting resistance `100`.
3. **Resistance calculation:** Open the exercise. Enter weight `10` and reps `10`.
   The header should say **LBS**, the input should show only **10**, and no
   base/total text should appear underneath. The overview and expanded summary
   should also show **10 lb × 10**, while volume counts **1,100 lb** and XP uses
   that volume. Try decimals, such as `10.5`, without long rounding artifacts.
4. **Custom editing:** Open Add Exercise again and use the pencil beside your
   custom exercise. Rename it or change its muscle or resistance, then save.
   Confirm the same exercise is updated rather than a duplicate being added.
   Built-in exercises should not have a custom-definition edit pencil.
5. **Notes:** The Exercise notes panel starts collapsed and has a small orange
   notebook icon. Expand it, enter `Seat 3. Keep shoulders down.`, and pause briefly
   for **Saved**. There are no Save/Remove buttons. Leave and return; expand the
   panel and confirm your text remains. Reusing the exercise shares those notes.
6. **Notes removal and limit:** Clear the text, revisit, and confirm it stays blank.
   Check the `500`-character counter and that typing/pasting beyond the limit is
   prevented. The box starts at its compact minimum with no resize handle. Long
   text and line breaks should grow it automatically; clearing shrinks it again.
7. **Save feedback:** Look for Saving/Saved while notes autosave. You should still
   be able to type during saving. Try leaving immediately after an edit, then
   reopening it: the latest text should remain. Check layout at a phone-sized width.
8. **Resistance edits update the active workout:** Before finishing, change the
   default resistance from `100` to `120`. Existing sets with `10` entered should
   keep showing `10`, but PR should now use `130` and a completed 10-rep set should
   count `1,300` volume. New sets use that base too. Finish and inspect its summary
   and Profile → Activity → Edit. Later default edits must leave saved workouts'
   snapshots and volume unchanged, without adding the base twice.
9. **History-safe editing:** After saving a workout using the custom exercise,
   its name, muscle, notes and starting resistance remain editable. Trying to
   change its type or left/right tracking should explain that those are protected
   to avoid reinterpreting saved history.
10. **Drop-set child removal:** Change a set to Drop Set, then remove its indented
    child. The parent must return to Normal and the connector disappear. Removing
    a parent should remove its child family. Ordinary neighboring sets must stay.
11. **Historical editor:** Repeat the drop-set deletion check in Profile → Activity
    → Edit. Also check collapsed notes, automatic saving and entered-weight display.

## Earlier changes to spot-check

- **Workout summaries:** After finishing a demo workout and from Profile → Activity
  → Summary, tap exercises to reveal weight and reps (distance/time for cardio).
- **Celebration:** On a level-up popup, tapping its medal/text/card should dismiss
  it, not only tapping outside. The second workout in demo history (Lower Body)
  provides a useful level-up example.
- **Exercise menus:** The three dots are larger; their menu still opens normally.
- **Exercise search:** Muscle and Type filters sit half-and-half below search and
  combine with the search text. Check Cardio and an empty-result combination.
- **Notification center:** Read all should acknowledge the action and show All read.
  Reset Demo to restore unread examples, visit Notifications and leave: the viewed
  unread items should become read. Only demo notification state changes here.

## Not verifiable through this local visual demo

- Actual iPhone/lock-screen push delivery and the new shortened phone messages.
  That wording is a separate pending server change; it needs deployment and a real
  device delivery test. The detailed in-app notification body intentionally stays.
- Cross-device persistence, production permissions, or the hosted database update.
  The new migration has been tested in an isolated database, not applied live.
- The demo intentionally resets on refresh. That reset is not evidence that saved
  production notes disappear.

Nothing has been published by starting this preview, and no real workouts are
changed. Send back the item numbers and anything that looks wrong.
