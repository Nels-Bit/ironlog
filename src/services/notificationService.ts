import { supabase } from "../lib/supabase";
import { isDemoSession } from "../lib/demo-session";
import type { NotificationItem } from "../types";
import {
  normalizePreferences,
  inboxCategories,
  validatePreferences,
  deviceTimezone,
  type NotificationCategory,
  type NotificationFilter,
  type NotificationPreferences,
} from "../utils/notifications";
export const NOTIFICATION_CHANGED = "ironlog-notifications-changed";
export const notifyInboxChanged = () => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(NOTIFICATION_CHANGED));
};
const currentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in to view notifications.");
  return user.id;
};
export type InboxCursor = { date: string; id: string };
export const notificationService = {
  async page(filter: NotificationFilter = "all", cursor?: InboxCursor) {
    const userId = await currentUser();
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .is("deleted_at", null)
      .eq("in_app_visible", true)
      .in("category", inboxCategories)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(21);
    if (filter === "unread") query = query.is("read_at", null);
    if (filter === "friends")
      query = query.in("category", [
        "friend_workout",
        "friend_request",
        "friend_pr",
        "friend_achievement",
      ]);
    if (filter === "personal")
      query = query.in("category", [
        "workout_reminder",
        "test_push",
      ]);
    if (cursor) {
      // Preserve Postgres microseconds and its +00:00 offset; rounding a cursor
      // through Date.toISOString() can skip rows with the same millisecond.
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          cursor.date,
        ) ||
        !Number.isFinite(Date.parse(cursor.date)) ||
        !/^[a-zA-Z0-9-]{1,100}$/.test(cursor.id)
      )
        throw new Error("Invalid inbox cursor.");
      query = query.or(
        `created_at.lt.${cursor.date},and(created_at.eq.${cursor.date},id.lt.${cursor.id})`,
      );
    }
    const { data, error } = await query;
    if (error)
      throw new Error(
        "Notifications could not load. Check your connection, or apply the notification migration.",
      );
    const rows = (data || []).slice(0, 20);
    const items: NotificationItem[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category as NotificationCategory,
      title: row.title || "Notification",
      body: row.body || row.message,
      message: row.message,
      createdAt: Date.parse(row.created_at),
      readAt: row.read_at ? Date.parse(row.read_at) : null,
      deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : null,
      targetId: row.target_id,
      targetType: row.target_type,
      actor: null,
      payload: row.payload || undefined,
    }));
    const last = rows.at(-1);
    return {
      items,
      next:
        (data || []).length > 20 && last
          ? { date: last.created_at as string, id: last.id as string }
          : undefined,
    };
  },
  async count() {
    const userId = await currentUser();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null)
      .is("deleted_at", null)
      .eq("in_app_visible", true)
      .in("category", inboxCategories);
    if (error) throw error;
    return count || 0;
  },
  async mutate(action: "read" | "unread" | "delete" | "clear", id?: string) {
    const { error } = await supabase.rpc("notification_state", {
      p_id: id || null,
      p_action: action,
    });
    if (error)
      throw new Error("Unable to update notifications. Please try again.");
    notifyInboxChanged();
  },
  async markRead(ids?: string[], expectedUserId?: string) {
    const userId = await currentUser();
    if (expectedUserId && userId !== expectedUserId && !isDemoSession())
      throw new Error("Your account changed. Please reopen notifications.");
    if (ids === undefined) return notificationService.mutate("read");
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    // Use the existing owner-scoped RPC: clients cannot directly update rows.
    // A finite list never acknowledges older/unloaded or newly arriving items.
    try {
      for (let offset = 0; offset < unique.length; offset += 4) {
        const results = await Promise.all(unique.slice(offset, offset + 4).map(id =>
          supabase.rpc("notification_state", {p_id: id, p_action: "read"})));
        if (results.some(result => result.error))
          throw new Error("Unable to update notifications. Please try again.");
      }
    } finally { notifyInboxChanged(); }
  },
  async target(id: string) {
    const { data, error } = await supabase.rpc("notification_target", {
      p_id: id,
    });
    if (error) throw new Error("This notification could not open.");
    return data as {
      unavailable?: boolean;
      route?: string;
      workout?: Record<string, unknown>;
      exercises?: Record<string, unknown>[];
    };
  },
  async preferences() {
    const userId = await currentUser();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      throw new Error(
        "Notification settings need the latest database migration.",
      );
    const zone = deviceTimezone();
    return normalizePreferences({ ...data, timezone: zone }, zone);
  },
  async savePreferences(preferences: NotificationPreferences) {
    const userId = await currentUser();
    const p = validatePreferences(normalizePreferences({ ...preferences, timezone: deviceTimezone() }));
    // Sharing belongs to profile privacy; this form must not overwrite it.
    const { share_activity: _sharing, ...settings } = p;
    void _sharing;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...settings }, { onConflict: "user_id" });
    if (error) throw new Error("Settings could not save. Please try again.");
    notifyInboxChanged();
  },
  async syncDeviceTimezone() {
    const userId = await currentUser(), timezone = deviceTimezone();
    const { data, error } = await supabase.from("notification_preferences")
      .select("timezone").eq("user_id", userId).maybeSingle();
    if (error) throw new Error("Device timezone could not sync. Please retry.");
    if (data?.timezone === timezone) return false;
    // Partial upsert: never reset category opt-outs, reminders, push or privacy.
    const { error: saveError } = await supabase.from("notification_preferences")
      .upsert({ user_id: userId, timezone }, { onConflict: "user_id" });
    if (saveError) throw new Error("Device timezone could not sync. Please retry.");
    notifyInboxChanged();
    return true;
  },
  async saveSocialPrivacy(isPublic: boolean, shareActivity: boolean) {
    const { error } = await supabase.rpc("save_social_privacy", {
      p_is_public: isPublic, p_share_activity: shareActivity,
    });
    if (error) throw new Error("Profile privacy could not save. Please retry.");
    notifyInboxChanged();
  },
  async api(body: Record<string, unknown>) {
    if (isDemoSession()) throw new Error("Real push is disabled in Demo Mode.");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      throw new Error("Sign in again to manage push notifications.");
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Notification service unavailable.");
    return data as {
      notifications?: number;
      accepted?: number;
      attempted?: number;
      queued?: boolean;
    };
  },
  async kick() {
    // The durable database outbox is the source of truth. This only lowers latency.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (isDemoSession() || !session) return { notifications: 0 };
    return notificationService.api({ action: "kick" });
  },
  async subscribe(onChange: () => void) {
    const userId = await currentUser();
    const channel = supabase
      .channel(`inbox:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_preferences",
          filter: `user_id=eq.${userId}`,
        },
        onChange,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
