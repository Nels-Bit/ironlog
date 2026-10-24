import { beforeEach, expect, it, vi } from "vitest";
import { createECDH, randomBytes } from "node:crypto";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc }),
}));
import handler from "../api/notifications";
const userId = "11111111-1111-4111-8111-111111111111",
  install = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "test-anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  vi.stubEnv("APP_ORIGIN", "https://ironlog.example");
  vi.stubEnv("NOTIFICATION_WORKER_SECRET", "worker-test");
  vi.stubEnv("VAPID_PUBLIC_KEY", "public-test");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private-test");
  mocks.user.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.rpc.mockClear();
});
const call = async (req: Parameters<typeof handler>[0]) => {
  let code = 0,
    body: unknown;
  const res = {
    setHeader: vi.fn(),
    status: (status: number) => {
      code = status;
      return res;
    },
    json: (value: unknown) => {
      body = value;
    },
  };
  await handler(req, res);
  return { code, body };
};
it("rejects unsigned browser mutations", async () =>
  expect(
    (await call({ method: "POST", headers: {}, body: { action: "test" } }))
      .code,
  ).toBe(401));
it("rejects wrong worker secrets", async () =>
  expect(
    (
      await call({
        method: "GET",
        headers: { authorization: "Bearer wrong" },
        query: { worker: "1" },
      })
    ).code,
  ).toBe(401));
it("exposes only the public VAPID key", async () => {
  const reply = await call({ method: "GET", headers: {} });
  expect(reply.body).toEqual({ publicKey: "public-test" });
  expect(JSON.stringify(reply.body)).not.toContain("private-test");
});
it("rejects cross-origin requests", async () =>
  expect(
    (
      await call({
        method: "POST",
        headers: {
          authorization: "Bearer valid",
          origin: "https://evil.example",
        },
        body: { action: "test" },
      })
    ).code,
  ).toBe(403));
it("verifies expired auth server-side", async () => {
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { message: "expired" },
  });
  expect(
    (
      await call({
        method: "POST",
        headers: { authorization: "Bearer expired" },
        body: { action: "test" },
      })
    ).code,
  ).toBe(401);
});
it("blocks arbitrary recipient/message actions", async () =>
  expect(
    (
      await call({
        method: "POST",
        headers: { authorization: "Bearer valid" },
        body: { action: "send", recipient: userId },
      })
    ).code,
  ).toBe(400));
it("registration derives ownership from auth, never a body user ID", async () => {
  const curve = createECDH("prime256v1");
  curve.generateKeys();
  const reply = await call({
    method: "POST",
    headers: { authorization: "Bearer valid" },
    body: {
      action: "register",
      userId: install,
      installId: install,
      subscription: {
        endpoint: "https://web.push.apple.com/device",
        keys: {
          p256dh: curve.getPublicKey().toString("base64url"),
          auth: randomBytes(16).toString("base64url"),
        },
      },
    },
  });
  expect(reply.code).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "register_push_install",
    expect.objectContaining({
      p_user: userId,
      p_install: install,
      p_enable: false,
    }),
  );
});
it("rate limits test/registration requests", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect(
    (
      await call({
        method: "POST",
        headers: { authorization: "Bearer valid" },
        body: { action: "test" },
      })
    ).code,
  ).toBe(429);
});
