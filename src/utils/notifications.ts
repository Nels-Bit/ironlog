export const notificationCategories = {
  workout_reminder: "Workout reminders",
  friend_workout: "Friends’ workouts",
  friend_request: "Friend requests",
  friend_pr: "Friends’ records",
  friend_achievement: "Friends’ achievements",
} as const;
export type NotificationCategory = keyof typeof notificationCategories;
export const inboxCategories = [...Object.keys(notificationCategories), "test_push"];
export type NotificationFilter = "all" | "unread" | "friends" | "personal";
export interface NotificationPreferences {
  push_enabled: boolean;
  in_app: Record<NotificationCategory, boolean>;
  push: Record<NotificationCategory, boolean>;
  share_activity: boolean;
  reminder_days: number[];
  reminder_time: string;
  timezone: string;
  /** Retained for older clients/database rows; app-level quiet hours are disabled. */
  quiet_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
}
const categoryDefaults = () =>
  Object.fromEntries(
    Object.keys(notificationCategories).map((k) => [k, true]),
  ) as Record<NotificationCategory, boolean>;
export const defaultNotificationPreferences = (
  timezone = "UTC",
): NotificationPreferences => ({
  push_enabled: false,
  in_app: categoryDefaults(),
  push: categoryDefaults(),
  share_activity: true,
  reminder_days: [],
  reminder_time: "18:00",
  timezone,
  quiet_enabled: false,
  quiet_start: "22:00",
  quiet_end: "08:00",
});
export const validTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};
export const deviceTimezone = () => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && validTimezone(zone) ? zone : "UTC";
  } catch { return "UTC"; }
};
export const normalizePreferences = (
  value: Partial<NotificationPreferences> = {},
  timezone = "UTC",
): NotificationPreferences => {
  const defaults = defaultNotificationPreferences(timezone);
  // Preserve any prior opt-out when collapsing independent channel switches.
  const categories = Object.fromEntries(Object.keys(notificationCategories).map(k => {
    const key = k as NotificationCategory;
    return [key, (value.in_app?.[key] ?? true) && (value.push?.[key] ?? true)];
  })) as Record<NotificationCategory, boolean>;
  return {
    ...defaults,
    ...value,
    // Removed personal categories in old settings must never be revived.
    in_app: { ...categories },
    push: { ...categories },
    quiet_enabled: false,
  };
};
export const validatePreferences = (p: NotificationPreferences) => {
  if (!validTimezone(p.timezone) || p.timezone.length > 100)
    throw new Error("Choose a valid timezone.");
  if (
    ![p.reminder_time, p.quiet_start, p.quiet_end].every((t) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
    )
  )
    throw new Error("Enter a valid time.");
  if (
    !Array.isArray(p.reminder_days) ||
    p.reminder_days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new Error("Choose valid reminder days.");
  if (
    ![
      p.push_enabled,
      p.share_activity,
      p.quiet_enabled,
      ...Object.keys(notificationCategories).flatMap((k) => [
        p.in_app[k as NotificationCategory],
        p.push[k as NotificationCategory],
      ]),
    ].every((v) => typeof v === "boolean")
  )
    throw new Error("Invalid notification preferences.");
  return p;
};
export const safeNotificationRoute = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length > 250 ||
    !/^\/(profile|workout|alerts)(\?[^#]*)?$/.test(value)
  )
    return "/alerts";
  return value;
};
export const notificationScope = (category: string) =>
  category.startsWith("friend_") ? "friends" : "personal";
export const relativeNotificationTime = (at: number, now = Date.now()) => {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
/** Intl uses IANA timezone transitions, including repeated/skipped DST clock hours. */
export const localClock = (at: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      get("weekday"),
    ),
  };
};
export const reminderDue = (p: NotificationPreferences, now: Date) => {
  const clock = localClock(now, p.timezone);
  // Catch a missed minute or spring-forward time later the same day. Daily key
  // in Postgres prevents repeats during fall-back and concurrent scheduler runs.
  return (p.in_app.workout_reminder ||
    (p.push_enabled && p.push.workout_reminder)) &&
    p.reminder_days.includes(clock.day) &&
    clock.time >= p.reminder_time
    ? clock.date
    : null;
};
