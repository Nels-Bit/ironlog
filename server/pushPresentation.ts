import type { NotificationPreferences } from '../src/utils/notifications.js';
import { barbellLiftNames } from '../src/utils/barbellLifts.js';

type PushRow = {type: string; category?: string; title?: string; body?: string; payload?: Record<string, unknown> | null};
/** Recheck both parts at send time: a changed switch must not leak disabled details. */
export function notificationPushPresentation(n: PushRow, prefs: NotificationPreferences) {
  if (!prefs.push_enabled) return null;
  const record = n.payload?.recordBody, award = n.payload?.awardBody;
  if (typeof record === 'string' && typeof award === 'string') {
    const lift = record.split(' · ')[0];
    if (!Object.values(barbellLiftNames).some(name => name === lift) || !award.endsWith(` ${lift} Trophy`)) return null;
    const showRecord = prefs.push.friend_pr, showAward = prefs.push.friend_achievement;
    if (!showRecord && !showAward) return null;
    const actor = typeof n.payload?.actorName === 'string' ? n.payload.actorName : 'A friend';
    return pushPresentation({
      type: showRecord ? 'personal_record' : 'achievement_unlocked',
      title: `${actor} ${showRecord && showAward ? 'hit a new PR and received a new award' : showRecord ? 'hit a new PR' : 'received a new award'}`,
      body: showRecord && showAward ? `${record} · ${award}` : showRecord ? record : award,
    });
  }
  if (n.type !== 'test_push' && !prefs.push[n.category as keyof typeof prefs.push]) return null;
  return pushPresentation(n);
}

/** Only already-authorized rows enter this formatter. The OS owns the source label. */
export function pushPresentation(n: {type: string; title?: string; body?: string}) {
  const title = n.type === "workout_completed" ? "Workout"
    : n.type === "achievement_unlocked" ? "Award"
      : ["personal_record", "level_up"].includes(n.type) ? "Milestone"
        : n.type.startsWith("friend_request") ? "Friend request"
          : n.type === "workout_reminder" ? "Workout reminder"
            : n.type === "test_push" ? "Test notification" : "Notification";
  const heading = (n.title || "").trim(), detail = (n.body || "").trim();
  const body = n.type === "test_push" ? "Your ironLog test notification is ready."
    : n.type.startsWith("friend_request") ? detail
      : [heading, detail].filter(Boolean).join(" · ");
  return { title, body: body.slice(0, 600) || "Open ironLog to see the details." };
}
