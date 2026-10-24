import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { notificationPushPresentation } from "./pushPresentation.js";
import { inboxCategories } from "../src/utils/notifications.js";
import {
  buildWorkoutNotifications,
  type WorkoutEventSnapshot,
} from "../src/utils/notificationEvents.js";
import { normalizePreferences } from "../src/utils/notifications.js";
import {
  pushFailureDisposition,
  validatePushSubscription,
} from "./pushSecurity.js";

export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Notification backend not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function rpc(
  db: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`Notification database operation failed: ${name}`);
  return data;
}
export async function processNotificationEvents(
  db: SupabaseClient,
  actor: string | null = null,
) {
  const events = (await rpc(db, "claim_notification_events", {
    p_actor: actor,
  })) as {
    id: string;
    lease_id: string;
    kind: string;
    source_id: string;
    snapshot: WorkoutEventSnapshot;
    attempts: number;
  }[];
  let persisted = 0;
  for (const event of events) {
    try {
      const items =
        event.kind === "workout"
          ? buildWorkoutNotifications(event.source_id, event.snapshot)
          : [];
      persisted +=
        Number(
          await rpc(db, "emit_notification_event", {
            p_event: event.id,
            p_lease: event.lease_id,
            p_items: items,
          }),
        ) || 0;
    } catch {
      // Durable bounded retries: no endpoint, token or snapshot in logs.
      console.error("Notification event processing failed", {
        eventId: event.id,
      });
      const { error } = await db
        .from("notification_events")
        .update({
          lease_id: null,
          lease_until: null,
          last_error: "processing_failed",
          available_at: new Date(
            Date.now() + Math.min(3600, 2 ** event.attempts * 30) * 1000,
          ).toISOString(),
        })
        .eq("id", event.id)
        .eq("lease_id", event.lease_id);
      if (error) throw new Error("Unable to release event lease.");
    }
  }
  return persisted;
}
export async function scheduleReminders(db: SupabaseClient) {
  return Number(await rpc(db, "schedule_workout_reminders", {})) || 0;
}
type Delivery = {
  id: string;
  notification_id: string;
  subscription_id: string;
  lease_id: string;
  attempts: number;
  expires_at: string;
};
export async function deliverPushJobs(
  db: SupabaseClient,
  recipient: string | null = null,
  send = webpush.sendNotification,
) {
  const jobs = (await rpc(db, "claim_push_jobs", {
    p_recipient: recipient,
  })) as Delivery[];
  const result = { attempted: 0, accepted: 0, skipped: 0, invalidated: 0 };
  // Each device has its own job and lease. A failed device cannot cancel another.
  for (const job of jobs) {
    const finish = async (values: Record<string, unknown>) => {
      const { error } = await db
        .from("push_delivery_jobs")
        .update({ ...values, lease_id: null, lease_until: null })
        .eq("id", job.id)
        .eq("lease_id", job.lease_id);
      if (error) throw new Error("Unable to persist delivery outcome.");
    };
    try {
      const [{ data: n, error: ne }, { data: s, error: se }] =
        await Promise.all([
          db
            .from("notifications")
            .select("*")
            .eq("id", job.notification_id)
            .maybeSingle(),
          db
            .from("push_subscriptions")
            .select("*")
            .eq("id", job.subscription_id)
            .maybeSingle(),
        ]);
      if (ne || se) throw new Error("Delivery lookup failed.");
      if (
        !n ||
        !s ||
        n.deleted_at ||
        s.invalidated_at ||
        s.user_id !== n.recipient_id ||
        Date.parse(job.expires_at) <= Date.now()
      ) {
        await finish({ state: "skipped" });
        result.skipped++;
        continue;
      }
      if (!inboxCategories.includes(n.category)) {
        await finish({ state: "skipped" });
        result.skipped++;
        continue;
      }
      if (n.category === 'friend_pr' && !['Barbell Squat','Barbell Deadlift','Barbell Bench Press'].includes((n.body || '').split(' · ')[0])) {
        await finish({ state: 'skipped' });
        result.skipped++;
        continue;
      }
      const { data: rawPrefs, error: pe } = await db
        .from("notification_preferences")
        .select("*")
        .eq("user_id", n.recipient_id)
        .maybeSingle();
      if (pe) throw new Error("Preferences lookup failed.");
      const prefs = normalizePreferences(rawPrefs || {});
      const presentation = notificationPushPresentation(n, prefs);
      if (!presentation) {
        await finish({ state: "skipped" });
        result.skipped++;
        continue;
      }
      if (
        n.type === "workout_reminder" &&
        !(await rpc(db, "reminder_push_needed", { p_notification: n.id }))
      ) {
        await finish({ state: "skipped" });
        result.skipped++;
        continue;
      }
      if (n.category.startsWith("friend_")) {
        if (n.category === "friend_request") {
          const kind = n.type === "friend_request" ? "pending" : "accepted";
          const { data: f, error: fe } = await db
            .from("friendships")
            .select("id")
            .eq("id", n.target_id)
            .eq("status", kind)
            .maybeSingle();
          if (fe) throw new Error("Friendship lookup failed.");
          if (!f) {
            await finish({ state: "skipped" });
            result.skipped++;
            continue;
          }
        } else if (
          !(await rpc(db, "notification_social_allowed", {
            p_actor: n.actor_id,
            p_recipient: n.recipient_id,
          }))
        ) {
          await finish({ state: "skipped" });
          result.skipped++;
          continue;
        }
      }
      if (n.target_type === "friend_workout" || n.target_type === "workout") {
        const { data: w, error: we } = await db
          .from("workouts")
          .select("id")
          .eq("id", n.target_id)
          .maybeSingle();
        if (we) throw new Error("Source lookup failed.");
        if (!w) {
          await finish({ state: "skipped" });
          result.skipped++;
          continue;
        }
      }
      const vapid = {
        subject: process.env.VAPID_SUBJECT!,
        publicKey: process.env.VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      };
      if (!vapid.subject || !vapid.publicKey || !vapid.privateKey) {
        await finish({
          available_at: new Date(Date.now() + 300_000).toISOString(),
          attempts: Math.max(0, job.attempts - 1),
        });
        continue;
      }
      const subscription = validatePushSubscription({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      });
      const { error: attemptError } = await db
        .from("push_delivery_jobs")
        .update({ attempted_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("lease_id", job.lease_id);
      if (attemptError) throw new Error("Unable to record push attempt.");
      result.attempted++;
      // Descriptive text is opt-in through push; privacy/friendship was checked above.
      const payload = JSON.stringify({
        ...presentation,
        notificationId: n.id,
      });
      const accepted = await send(subscription, payload, {
        vapidDetails: vapid,
        TTL: Math.max(
          1,
          Math.min(
            3600,
            Math.floor((Date.parse(job.expires_at) - Date.now()) / 1000),
          ),
        ),
        timeout: 5000,
        topic: createHash("sha256")
          .update(n.id)
          .digest("base64url")
          .slice(0, 32),
      });
      await finish({
        state: "accepted",
        accepted_at: new Date().toISOString(),
        last_status: accepted.statusCode,
      });
      await db
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString() })
        .eq("id", s.id)
        .eq("user_id", s.user_id);
      result.accepted++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      const disposition = pushFailureDisposition(status, job.attempts);
      if (disposition === "invalidate") {
        const { error: invalidError } = await db
          .from("push_subscriptions")
          .update({ invalidated_at: new Date().toISOString() })
          .eq("id", job.subscription_id);
        if (invalidError)
          throw new Error("Unable to invalidate expired subscription.");
        result.invalidated++;
      }
      await finish({
        state: disposition === "retry" ? "pending" : "failed",
        last_status: status || null,
        available_at: new Date(
          Date.now() + Math.min(3600, 2 ** job.attempts * 30) * 1000,
        ).toISOString(),
      });
      console.error("Push delivery not accepted", {
        jobId: job.id,
        status: status || "transport_error",
      });
    }
  }
  return result;
}
