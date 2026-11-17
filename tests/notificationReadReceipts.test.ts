import { describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../src/types';
import { createNotificationReadReceipts, type ReadFeedback } from '../src/utils/notificationReadReceipts';

const item = (id: string, readAt: number | null = null): NotificationItem => ({
  id, readAt, type: 'workout_completed', message: 'A friend finished a workout', createdAt: 1, actor: null,
});
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return {promise, resolve};
};
const setup = (write = vi.fn<(...args: [string[]?]) => Promise<void>>().mockResolvedValue()) => {
  const states: ReadFeedback[] = [], refresh = vi.fn().mockResolvedValue(undefined);
  const receipts = createNotificationReadReceipts({write, refresh, onChange: state => states.push(state)});
  return {receipts, states, refresh, write};
};

describe('notification read feedback and visit receipts', () => {
  it('shows immediate busy feedback and coalesces repeated Read-all clicks', async () => {
    const delay = deferred(), write = vi.fn().mockReturnValue(delay.promise);
    const {receipts, states} = setup(write);
    const first = receipts.readAll(), second = receipts.readAll();
    expect(first).toBe(second);
    expect(states.at(-1)).toMatchObject({busy: true, markingAll: true, message: 'Marking all as read…'});
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    delay.resolve();
    expect(await first).toBe(true);
    expect(states.at(-1)).toMatchObject({busy: false, markingAll: false, error: false, message: 'All notifications marked as read.'});
  });
  it('keeps saving feedback active until the UI refresh completes', async () => {
    const delay = deferred(), {receipts, refresh, states} = setup();
    refresh.mockReturnValue(delay.promise);
    const save = receipts.readAll();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(states.at(-1)?.busy).toBe(true);
    delay.resolve(); await save;
    expect(states.at(-1)?.busy).toBe(false);
  });
  it('merely entering or loading the center does not write; leaving only reads loaded unread IDs', async () => {
    const {receipts, write} = setup();
    receipts.observe([item('loaded'), item('already-read', 10)]);
    expect(write).not.toHaveBeenCalled();
    await receipts.leave();
    expect(write).toHaveBeenCalledExactlyOnceWith(['loaded']);
    await receipts.leave();
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('collects loaded pages and filters, but respects deliberately marking an item unread', async () => {
    const {receipts, write} = setup();
    receipts.observe([item('first'), item('keep')]);
    receipts.keepUnread('keep');
    receipts.observe([item('keep'), item('second')]);
    await receipts.leave();
    expect(write).toHaveBeenCalledExactlyOnceWith(['first', 'second']);
  });
  it('does not duplicate automatic receipts when a delayed refresh still contains unread rows', async () => {
    const delay = deferred(), write = vi.fn().mockReturnValue(delay.promise);
    const {receipts} = setup(write);
    receipts.observe([item('seen')]);
    const leaving = receipts.leave();
    receipts.observe([item('seen')]);
    await receipts.leave();
    delay.resolve(); await leaving;
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('queues newly viewed arrivals separately while Read-all is in flight', async () => {
    const delay = deferred(), write = vi.fn().mockResolvedValue(undefined).mockReturnValueOnce(delay.promise);
    const {receipts} = setup(write);
    receipts.observe([item('old')]);
    const all = receipts.readAll();
    receipts.observe([item('old'), item('new')]);
    const leave = receipts.leave();
    delay.resolve(); await all; await leave;
    expect(write.mock.calls).toEqual([[undefined], [['new']]]);
  });
  it('does not claim success on failure, and retries only the failed viewed IDs', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const {receipts, states, refresh} = setup(write);
    receipts.observe([item('seen')]);
    expect(await receipts.leave()).toBe(false);
    expect(states.at(-1)).toMatchObject({error: true, busy: false});
    expect(refresh).not.toHaveBeenCalled();
    expect(await receipts.retry()).toBe(true);
    expect(write.mock.calls).toEqual([[['seen']], [['seen']]]);
  });
  it('retries a failed Read-all and suppresses repeated Retry clicks', async () => {
    const delay = deferred(), write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(delay.promise);
    const {receipts, states} = setup(write);
    expect(await receipts.readAll()).toBe(false);
    const retry = receipts.retry(); void receipts.retry();
    delay.resolve(); await retry;
    expect(write).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toMatchObject({error: false, markingAll: false});
  });
});
