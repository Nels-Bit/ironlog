import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { beforeAll, expect, it, vi } from "vitest";
let source: string;
beforeAll(async () => {
  source = await readFile(
    new URL("../public/push-worker.js", import.meta.url),
    "utf8",
  );
});
const id = "11111111-1111-4111-8111-111111111111";
const worker = () => {
  const callbacks: Record<string, (e: unknown) => void> = {};
  const show = vi.fn().mockResolvedValue(undefined),
    open = vi.fn().mockResolvedValue(undefined),
    clients = vi.fn().mockResolvedValue([]);
  runInNewContext(source, {
    URL,
    self: {
      addEventListener: (name: string, fn: (e: unknown) => void) =>
        (callbacks[name] = fn),
      location: { origin: "https://ironlog.example" },
      registration: { showNotification: show },
      clients: { matchAll: clients, openWindow: open },
    },
  });
  return { callbacks, show, open, clients };
};
it("handles a genuine push event with a stable tag and system notification", async () => {
  const w = worker();
  let promise = Promise.resolve();
  w.callbacks.push({
    data: { json: () => ({ body: "New notification", notificationId: id }) },
    waitUntil: (p: Promise<void>) => (promise = p),
  });
  await promise;
  expect(w.show).toHaveBeenCalledWith(
    "ironLog",
    expect.objectContaining({
      tag: id,
      body: "New notification",
      data: { notificationId: id },
    }),
  );
});
it.each([null, "malformed"])(
  "malformed payload %s still displays a safe fallback",
  async (value) => {
    const w = worker();
    let promise = Promise.resolve();
    w.callbacks.push({
      data: {
        json: () => {
          if (value === "malformed") throw Error();
          return value;
        },
      },
      waitUntil: (p: Promise<void>) => (promise = p),
    });
    await promise;
    expect(w.show).toHaveBeenCalledWith(
      "ironLog",
      expect.objectContaining({ body: "You have a new notification." }),
    );
  },
);
it("click focuses and navigates an existing same-origin window", async () => {
  const w = worker(),
    navigate = vi.fn().mockResolvedValue(undefined),
    focus = vi.fn().mockResolvedValue(undefined);
  w.clients.mockResolvedValue([
    { url: "https://ironlog.example/profile", navigate, focus },
  ]);
  let promise = Promise.resolve();
  w.callbacks.notificationclick({
    notification: { close: vi.fn(), data: { notificationId: id } },
    waitUntil: (p: Promise<void>) => (promise = p),
  });
  await promise;
  expect(navigate).toHaveBeenCalledWith(
    "https://ironlog.example/notifications/open/" + id,
  );
  expect(focus).toHaveBeenCalled();
  expect(w.open).not.toHaveBeenCalled();
});
it("does not follow untrusted payload routes or cross-origin clients", async () => {
  const w = worker(),
    navigate = vi.fn();
  w.clients.mockResolvedValue([{ url: "https://evil.example/", navigate }]);
  let promise = Promise.resolve();
  w.callbacks.notificationclick({
    notification: {
      close: vi.fn(),
      data: {
        notificationId: "https://evil.example/",
        route: "https://evil.example/",
      },
    },
    waitUntil: (p: Promise<void>) => (promise = p),
  });
  await promise;
  expect(navigate).not.toHaveBeenCalled();
  expect(w.open).toHaveBeenCalledWith("https://ironlog.example/alerts");
});
