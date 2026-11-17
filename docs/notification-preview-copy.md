# Short phone notification messages

The phone preview uses the owner's supplied copy. Detailed workout names,
exercise names, weights/reps, trophy ranks, and levels remain in the notification
center; only the outbound push message is shortened.

| Type | Phone title | Example body |
| --- | --- | --- |
| Workout reminder | Workout reminder | Time for your workout |
| Friend request | Friend request | Nelson sent you a friend request. |
| Request accepted | Friend request | Nelson accepted your friend request. |
| Friend finishes a workout | Workout | Nelson finished a workout |
| Friend hits a PR | Milestone | Nelson hit a new PR |
| Friend earns a trophy | Award | Nelson received a new award |
| Friend levels up | Milestone | Nelson reached a new level |
| Matching PR + trophy | Milestone | Nelson hit a new PR and received a new award |

The actor's actual name replaces Nelson in these examples. The manual test notification is
unchanged. Same-lift combination, barbell-only PR filtering, privacy, account push
and category opt-outs are unchanged. No database migration or historical-row
rewrite is needed. Already delivered phone notifications cannot be rewritten.

Publication is approved as part of the exercise-details release. No phone notifications were
sent to real users for testing. Tests cover exact preview text, unchanged inbox
details, per-category opt-outs and combined-event delivery/deduplication.
