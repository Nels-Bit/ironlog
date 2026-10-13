/* Imported into the ONE generated Workbox worker. Does not register a worker. */
const validNotificationId = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const value = event.data ? event.data.json() : {};
    payload = value && typeof value === "object" ? value : {};
  } catch {
    /* Show a safe fallback. */
  }
  const id = validNotificationId(payload.notificationId)
    ? payload.notificationId
    : null;
  event.waitUntil(
    self.registration.showNotification("ironLog", {
      body:
        typeof payload.body === "string"
          ? payload.body.slice(0, 180)
          : "You have a new notification.",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: id || "ironlog-notification",
      data: { notificationId: id },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data?.notificationId;
  const path = validNotificationId(id)
    ? `/notifications/open/${id}`
    : "/alerts";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const window of windows) {
        if (new URL(window.url).origin !== self.location.origin) continue;
        try {
          await window.navigate(url);
          await window.focus();
          return;
        } catch {
          /* Try another client. */
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
// Background renewal cannot authenticate safely. Ask a foreground client to
// reconcile on its next settings visit; never send stale account tokens here.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      windows.forEach((window) =>
        window.postMessage({ type: "ironlog-push-subscription-changed" }),
      );
    }),
  );
});
