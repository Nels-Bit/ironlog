# Notification rollout backup and recovery

The October 13, 2026 production upgrade created private backup tables before
changing the live schema, inside the same transaction. It did not delete or move
the original rows. The backup is in Supabase project `vshrcthrjgsqarhsssto`, schema
`ironlog_notification_backup_20261013`.

| Backup table | Verified rows |
|---|---:|
| workouts | 250 |
| friendships | 2 |
| user_profiles | 3 |
| notifications | 4 |

Additional `policy_snapshot`, `grant_snapshot` and `function_snapshot` tables
preserve the prior social permissions and profile-bootstrap function definition.
The schema is not an exposed API schema, anon/authenticated schema/table privileges
are revoked, and RLS without client policies provides defense in depth. Only a
privileged database administrator should inspect or restore these copies.

Verification after migration found zero missing original workouts and zero changed
original workout contents. The live and backup counts matched for all four tables.
No historical notifications or push jobs were backfilled.

## If the update has a defect

1. Prefer fixing or rolling back the app without replacing user workout data.
   Keep delivery paused if notification-only functionality fails.
2. Inspect live IDs against the backup with a privileged SQL session. Never run
   TRUNCATE, drop the production tables, or blindly replace current rows.
3. Preserve workouts and edits created after the snapshot. Restore only specifically
   verified missing/damaged rows with explicit owner approval; do not overwrite
   newer data just because it differs from this point-in-time backup.
4. Restored workout rows must remain `notification_source='historical'` so recovery
   does not generate false PR, milestone, friend or push events.
5. Permission/function recovery requires reviewing the stored snapshots against the
   app version being restored. Do not automatically reopen unrestricted client
   notification insertion or private-subscription access.
6. Retain the backup until the owner has approved its removal after acceptance.

These tables protect against migration/update mistakes, not deletion of the entire
Supabase project or a database-wide failure: they share the same database. An
independent encrypted export or provider backup is needed for disaster recovery.
No such private-data export was performed as part of this release.

## Barbell identity / notification refinement snapshot

The later migration made a second private snapshot in
`ironlog_barbell_backup_20261013`, immediately before merging exercise identities.
It contains exercises, 253 workouts, notification rows, preferences, delivery jobs
and the prior notification helper definitions. Client schema/table privileges are
revoked and every backup table has RLS with no client policies.

Post-migration verification: zero missing workouts/exercises, zero changes outside
workout exercise references, zero unexpected JSON/set changes, and unchanged
machine Squat data. The existing custom Barbell Squat is the preferred identity;
an owner-only alias preserves older clients and active drafts. Source definitions
are retained, not deleted. Restore only reviewed affected rows, preserving all
newer edits; do not blindly overwrite live tables or replay historical events.
