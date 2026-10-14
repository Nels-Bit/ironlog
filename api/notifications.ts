import { createClient } from "@supabase/supabase-js";
import {
  adminClient,
  deliverPushJobs,
  processNotificationEvents,
  scheduleReminders,
} from "../server/notificationWorker.js";
import {
  isUuid,
  RequestError,
  safeSecretEqual,
  validatePushSubscription,
} from "../server/pushSecurity.js";
import { validTimezone } from "../src/utils/notifications.js";

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[]>;
};
type ApiReply = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiReply;
  json(value: unknown): void;
};
/** Match the existing Vercel /api handler convention. Browser mutations require
 * a Supabase bearer token; cookie-only/CSRF requests cannot authorize anything. */
export default async function handler(req: ApiRequest, res: ApiReply) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const authorization =
      typeof req.headers.authorization === "string"
        ? req.headers.authorization
        : "";
    if (req.method === "GET" && req.query?.worker === "1") {
      if (
        !safeSecretEqual(
          authorization,
          "Bearer " + (process.env.NOTIFICATION_WORKER_SECRET || ""),
        ) ||
        !process.env.NOTIFICATION_WORKER_SECRET
      )
        throw new RequestError(401, "Unauthorized.");
      const db = adminClient();
      const { error: cleanupError } = await db.rpc(
        "cleanup_notification_delivery",
      );
      if (cleanupError) {
        console.error("Notification database unavailable", {
          operation: "maintenance",
          code: cleanupError.code,
          reason: /invalid api key/i.test(cleanupError.message)
            ? "invalid_api_key"
            : /jwt|token|signature/i.test(cleanupError.message)
              ? "invalid_token"
              : /fetch failed|network/i.test(cleanupError.message)
                ? "network_error"
                : "database_error",
        });
        throw new RequestError(503, "Delivery maintenance failed.");
      }
      const reminders = await scheduleReminders(db);
      const notifications = await processNotificationEvents(db);
      const delivery = await deliverPushJobs(db);
      res.status(200).json({ reminders, notifications, delivery });
      return;
    }
    if (req.method === "GET") {
      res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
      return;
    }
    if (req.method !== "POST")
      throw new RequestError(405, "Method not allowed.");
    const origin = req.headers.origin;
    if (origin && origin !== process.env.APP_ORIGIN)
      throw new RequestError(403, "Origin not allowed.");
    if (!authorization.startsWith("Bearer ") || authorization.length > 8192)
      throw new RequestError(401, "Sign in first.");
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anon =
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anon)
      throw new RequestError(503, "Notification backend not configured.");
    const auth = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser(authorization.slice(7));
    if (authError || !user) throw new RequestError(401, "Sign in again.");
    if (JSON.stringify(req.body || {}).length > 12000)
      throw new RequestError(413, "Request too large.");
    const body = (
      typeof req.body === "string" ? JSON.parse(req.body) : req.body
    ) as {
      action?: string;
      installId?: unknown;
      subscription?: unknown;
      enableAccount?: boolean;
      timezone?: string;
    };
    if (
      !body ||
      !["register", "unregister", "test", "kick"].includes(body.action || "")
    )
      throw new RequestError(400, "Invalid action.");
    const db = adminClient();
    const { data: allowed, error: rateError } = await db.rpc(
      "consume_notification_rate",
      {
        p_user: user.id,
        p_bucket: body.action,
        p_limit: body.action === "test" ? 2 : 20,
      },
    );
    if (rateError)
      throw new RequestError(503, "Notification database unavailable.");
    if (!allowed)
      throw new RequestError(429, "Please wait a minute before trying again.");
    if (body.action === "register" || body.action === "unregister") {
      if (!isUuid(body.installId))
        throw new RequestError(400, "Invalid device identifier.");
      if (body.action === "register") {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
          throw new RequestError(503, "Push delivery is not configured yet.");
        const subscription = validatePushSubscription(body.subscription);
        const timezone =
          typeof body.timezone === "string" && validTimezone(body.timezone)
            ? body.timezone
            : "UTC";
        const { error } = await db.rpc("register_push_install", {
          p_user: user.id,
          p_install: body.installId,
          p_endpoint: subscription.endpoint,
          p_key: subscription.keys.p256dh,
          p_auth: subscription.keys.auth,
          p_enable: body.enableAccount === true,
          p_timezone: timezone,
        });
        if (error)
          throw new RequestError(
            409,
            "This subscription could not be registered. Disable this device subscription and try again.",
          );
      } else {
        const { error } = await db.rpc("revoke_push_install", {
          p_user: user.id,
          p_install: body.installId,
        });
        if (error) throw new RequestError(503, "Unable to revoke this device.");
      }
      res.status(200).json({ ok: true });
      return;
    }
    if (body.action === "test") {
      const { error } = await db
        .from("notifications")
        .insert({
          recipient_id: user.id,
          type: "test_push",
          category: "test_push",
          event_key: `test:${user.id}:${Math.floor(Date.now() / 60000)}`,
          title: "Push test",
          body: "This test was queued for your eligible devices.",
          message: "Push test",
          target_type: "notifications",
          in_app_visible: true,
        });
      if (error && error.code !== "23505")
        throw new RequestError(503, "Unable to queue test.");
      const delivery = await deliverPushJobs(db, user.id);
      res.status(200).json({ queued: true, ...delivery });
      return;
    }
    const notifications = await processNotificationEvents(db, user.id);
    const delivery = await deliverPushJobs(db, user.id);
    res.status(200).json({ notifications, delivery });
  } catch (error) {
    const known = error instanceof RequestError;
    if (!known)
      console.error("Notification API failed", {
        kind: error instanceof SyntaxError ? "invalid_json" : "internal_error",
      });
    res
      .status(known ? error.status : error instanceof SyntaxError ? 400 : 503)
      .json({
        error: known
          ? error.message
          : "Notification service is temporarily unavailable.",
      });
  }
}
