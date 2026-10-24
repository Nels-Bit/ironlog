import { isDemoSession } from "../lib/demo-session";
import { notificationService } from "./notificationService";
const INSTALL_KEY = "ironlog-push-install";
export const devicePushSupport = () => {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    ios,
    installed,
    supported:
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
    permission:
      "Notification" in window
        ? Notification.permission
        : ("unsupported" as const),
  };
};
const installId = () => {
  const existing = localStorage.getItem(INSTALL_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(INSTALL_KEY, id);
  return id;
};
const publicKeyBytes = (key: string) => {
  const bytes = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bytes, (c) => c.charCodeAt(0));
};
export const pushService = {
  async current() {
    if (isDemoSession() || !devicePushSupport().supported) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ? registration.pushManager.getSubscription() : null;
  },
  async enable() {
    if (isDemoSession()) throw new Error("Real push is disabled in Demo Mode.");
    const support = devicePushSupport();
    if (support.ios && !support.installed)
      throw new Error(
        "Add ironLog to your Home Screen in Safari, then open it there.",
      );
    if (!support.supported)
      throw new Error("This browser cannot enable push notifications.");
    if (support.permission === "denied")
      throw new Error(
        "Notifications are blocked. Change permission in system/browser settings.",
      );
    // Called directly by the Enable button, before any awaited network operation.
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw new Error(
        "Permission was not granted. We will not prompt again automatically.",
      );
    const configuration = await fetch("/api/notifications");
    if (!configuration.ok)
      throw new Error("Push configuration is unavailable.");
    const { publicKey } = await configuration.json();
    if (!publicKey)
      throw new Error("The server VAPID keys have not been configured.");
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active)
      throw new Error(
        "Open the installed production app once online to activate its service worker.",
      );
    let subscription = await registration.pushManager.getSubscription();
    const key = publicKeyBytes(publicKey);
    const existingKey = subscription?.options.applicationServerKey;
    if (
      subscription &&
      existingKey &&
      [...new Uint8Array(existingKey)].join(",") !== [...key].join(",")
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ||= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    try {
      await notificationService.api({
        action: "register",
        installId: installId(),
        subscription: subscription.toJSON(),
        enableAccount: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (error) {
      await subscription.unsubscribe();
      throw error;
    }
    return subscription;
  },
  async disableDevice() {
    if (isDemoSession()) return;
    let id: string | null = null;
    try {
      id = localStorage.getItem(INSTALL_KEY);
    } catch {
      /* Storage denial must not prevent browser unsubscribe. */
    }
    try {
      if (id)
        await notificationService.api({ action: "unregister", installId: id });
    } finally {
      const subscription = await pushService.current();
      await subscription?.unsubscribe();
    }
  },
  async reconcile() {
    if (isDemoSession() || devicePushSupport().permission !== "granted") return;
    const subscription = await pushService.current();
    if (subscription)
      await notificationService.api({
        action: "register",
        installId: installId(),
        subscription: subscription.toJSON(),
      });
  },
};
