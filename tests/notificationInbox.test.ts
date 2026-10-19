import { expect, it, vi } from "vitest";
import { createDemoProvider } from "../src/lib/demo-transport";
import { createIronLogSeed } from "../src/lib/demo-seed";
it("real service pagination, filters, counts and state operations remain isolated in demo", async () => {
  const seed = createIronLogSeed();
  const time = new Date().toISOString().replace("Z", "123+00:00");
  seed.tables.notifications = Array.from({ length: 25 }, (_, i) => ({
    id: crypto.randomUUID(),
    recipient_id: "demo-alex",
    type: i % 2 ? "workout_reminder" : "workout_completed",
    category: i % 2 ? "workout_reminder" : "friend_workout",
    title: "Test",
    message: "Test",
    created_at: time,
    read_at: null,
    deleted_at: null,
    in_app_visible: true,
  }));
  seed.tables.notifications.push({
    id: crypto.randomUUID(),
    recipient_id: "other-user",
    category: "workout_reminder",
    read_at: null,
    deleted_at: null,
    created_at: time,
  });
  const provider = createDemoProvider(seed);
  vi.doMock("../src/lib/supabase", () => ({ supabase: provider.client }));
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("No production network"));
  try {
    const { notificationService: s } =
      await import("../src/services/notificationService");
    expect(await s.count()).toBe(25);
    const first = await s.page();
    expect(first.items).toHaveLength(20);
    const next = await s.page("all", first.next);
    expect(next.items).toHaveLength(5);
    expect(new Set([...first.items, ...next.items].map((n) => n.id)).size).toBe(
      25,
    );
    expect((await s.page("personal")).items).toHaveLength(12);
    await s.mutate("read", first.items[0].id);
    expect(await s.count()).toBe(24);
    await s.mutate("unread", first.items[0].id);
    expect(await s.count()).toBe(25);
    await s.mutate("delete", first.items[0].id);
    expect(await s.count()).toBe(24);
    await s.mutate("clear");
    expect((await s.page()).items).toHaveLength(0);
    expect(
      provider
        .snapshot()
        .tables.notifications.filter(
          (n) => n.recipient_id === "other-user" && n.deleted_at == null,
        ),
    ).toHaveLength(1);
    const prefs = await s.preferences();
    prefs.push_enabled = true;
    await s.savePreferences(prefs);
    expect((await s.preferences()).push_enabled).toBe(true);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
    vi.doUnmock("../src/lib/supabase");
  }
});

it('visit read receipts use owned finite IDs and preserve unread older notifications', async () => {
  vi.resetModules();
  const seed = createIronLogSeed();
  seed.tables.notifications = Array.from({length: 25}, (_, index) => ({
    id: crypto.randomUUID(), recipient_id: 'demo-alex', category: 'friend_workout',
    type: 'workout_completed', title: 'Test', message: 'Test',
    created_at: new Date(Date.now() - index * 1000).toISOString(),
    read_at: null, deleted_at: null, in_app_visible: true,
  }));
  const other = { ...seed.tables.notifications[0], id: crypto.randomUUID(), recipient_id: 'other-user' };
  seed.tables.notifications.push(other);
  const provider = createDemoProvider(seed);
  vi.doMock('../src/lib/supabase', () => ({supabase: provider.client}));
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No production network'));
  try {
    const {notificationService: service} = await import('../src/services/notificationService');
    const first = await service.page();
    const ids = first.items.map(item => item.id);
    await expect(service.markRead(ids, 'different-user')).rejects.toThrow('account changed');
    expect(await service.count()).toBe(25);
    await service.markRead([], 'demo-alex');
    expect(await service.count()).toBe(25);
    await service.markRead([...ids, ids[0], other.id], 'demo-alex');
    expect(await service.count()).toBe(5);
    expect(provider.snapshot().tables.notifications.find(row => row.id === other.id)?.read_at).toBeNull();
    await service.markRead(ids, 'demo-alex');
    expect(await service.count()).toBe(5);
    await service.markRead(undefined, 'demo-alex');
    expect(await service.count()).toBe(0);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
    vi.doUnmock('../src/lib/supabase');
  }
});
