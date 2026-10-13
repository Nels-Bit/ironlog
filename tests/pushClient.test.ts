import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => vi.fn());
vi.mock("../src/services/notificationService", () => ({
  notificationService: { api },
}));
vi.mock("../src/lib/demo-session", () => ({ isDemoSession: () => false }));
import { pushService } from "../src/services/pushService";
const unsubscribe = vi.fn(),
  permission = vi.fn(),
  subscribe = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  unsubscribe.mockResolvedValue(true);
  permission.mockResolvedValue("granted");
  api.mockResolvedValue({ ok: true });
  subscribe.mockResolvedValue({
    toJSON: () => ({ endpoint: "https://web.push.apple.com/test", keys: {} }),
    unsubscribe,
  });
  const register = {
    active: {},
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe,
    },
  };
  vi.stubGlobal("navigator", {
    userAgent: "iPhone",
    platform: "iPhone",
    maxTouchPoints: 1,
    serviceWorker: { getRegistration: vi.fn().mockResolvedValue(register) },
    standalone: true,
  });
  const notification = { permission: "default", requestPermission: permission };
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("window", {
    isSecureContext: true,
    PushManager: {},
    Notification: notification,
    matchMedia: () => ({ matches: true }),
  });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            publicKey: Buffer.alloc(65, 1).toString("base64url"),
          }),
        ),
      ),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("requests permission directly before awaiting network configuration", async () => {
  const result = pushService.enable();
  expect(permission).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
  await result;
  expect(api).toHaveBeenCalledWith(
    expect.objectContaining({ action: "register", enableAccount: true }),
  );
});
it("does not prompt a denied installation", async () => {
  vi.stubGlobal("Notification", {
    permission: "denied",
    requestPermission: permission,
  });
  await expect(pushService.enable()).rejects.toThrow("blocked");
  expect(permission).not.toHaveBeenCalled();
});
it("reconciliation never requests permission or enables account push", async () => {
  await pushService.reconcile();
  expect(permission).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
});
it("failed registration rolls back the browser subscription", async () => {
  api.mockRejectedValue(new Error("Failed"));
  await expect(pushService.enable()).rejects.toThrow();
  expect(unsubscribe).toHaveBeenCalled();
});
it("storage denial during logout still unsubscribes the browser device", async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("Storage denied");
    },
  });
  const registration = {
    pushManager: { getSubscription: async () => ({ unsubscribe }) },
  };
  vi.stubGlobal("navigator", {
    userAgent: "iPhone",
    platform: "iPhone",
    maxTouchPoints: 1,
    standalone: true,
    serviceWorker: { getRegistration: async () => registration },
  });
  await pushService.disableDevice();
  expect(unsubscribe).toHaveBeenCalled();
});
