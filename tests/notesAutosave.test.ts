import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createNotesAutosave } from '../src/utils/notesAutosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return {promise, resolve};
};
function setup(saved = '', draft: string | null = null, save = vi.fn<(value: string) => Promise<void>>(async () => {})) {
  const storeDraft = vi.fn(), clearDraft = vi.fn();
  const controller = createNotesAutosave({saved, draft, save, storeDraft, clearDraft});
  return {controller, save, storeDraft, clearDraft};
}
it('keeps a draft immediately and saves only the latest text after a typing pause', async () => {
  const {controller,save,storeDraft,clearDraft} = setup();
  controller.update('S');
  await vi.advanceTimersByTimeAsync(400);
  controller.update('Seat 3');
  expect(storeDraft).toHaveBeenLastCalledWith('Seat 3');
  await vi.advanceTimersByTimeAsync(699);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledExactlyOnceWith('Seat 3');
  expect(controller.getSnapshot()).toMatchObject({value:'Seat 3',status:'saved'});
  expect(clearDraft).toHaveBeenCalledOnce();
});
it('flushes on leaving without waiting for the typing timer', async () => {
  const {controller,save} = setup();
  controller.update('Seat 4');
  await controller.flush();
  await vi.advanceTimersByTimeAsync(700);
  expect(save).toHaveBeenCalledExactlyOnceWith('Seat 4');
});
it('serializes slow saves and preserves newer typing until it is acknowledged', async () => {
  const first=deferred(), second=deferred();
  const save=vi.fn<(value: string) => Promise<void>>(async () => {}).mockImplementationOnce(()=>first.promise).mockImplementationOnce(()=>second.promise);
  const {controller,clearDraft}=setup('',null,save);
  controller.update('First');
  const pending=controller.flush();
  controller.update('Second');
  controller.reconcile('First');
  await vi.advanceTimersByTimeAsync(700);
  expect(save).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().value).toBe('Second');
  first.resolve(); await pending;
  expect(clearDraft).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save.mock.calls.map(call=>call[0])).toEqual(['First','Second']);
  second.resolve(); await controller.flush();
  expect(controller.getSnapshot()).toMatchObject({value:'Second',status:'saved'});
});
it('saves an empty string when notes are cleared, including during a slow save', async () => {
  const first=deferred();
  const save=vi.fn<(value: string) => Promise<void>>(async () => {}).mockImplementationOnce(()=>first.promise);
  const {controller,storeDraft}=setup('Original',null,save);
  controller.update('Edit');const pending=controller.flush();
  controller.update('');void controller.flush();
  expect(storeDraft).toHaveBeenLastCalledWith('');
  first.resolve();await pending;await vi.advanceTimersByTimeAsync(1);
  expect(save.mock.calls.map(call=>call[0])).toEqual(['Edit','']);
  expect(controller.getSnapshot()).toMatchObject({value:'',status:'saved'});
});
it('keeps a failed draft, retries automatically and recovers without another edit', async () => {
  const save=vi.fn<(value: string) => Promise<void>>(async () => {}).mockRejectedValueOnce(new Error('Offline'));
  const {controller,clearDraft}=setup('',null,save);
  controller.update('My setup');await controller.flush();
  expect(controller.getSnapshot()).toMatchObject({value:'My setup',status:'error',error:'Offline'});
  expect(clearDraft).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5000);
  expect(save).toHaveBeenCalledTimes(2);
  expect(controller.getSnapshot().status).toBe('saved');
});
it('restores a device draft (including a cleared note) and syncs it on the next visit', async () => {
  const {controller,save}=setup('Old note','');
  expect(controller.getSnapshot().value).toBe('');
  controller.start();await vi.advanceTimersByTimeAsync(700);
  expect(save).toHaveBeenCalledExactlyOnceWith('');
});
it('bounds offline retries, then retries on reconnect or revisit', async () => {
  const save=vi.fn<(value: string) => Promise<void>>(async () => {}).mockRejectedValue(new Error('Offline'));
  const {controller,clearDraft}=setup('',null,save);
  controller.update('Pending');await vi.advanceTimersByTimeAsync(20000);
  expect(save).toHaveBeenCalledTimes(3);expect(clearDraft).not.toHaveBeenCalled();
  save.mockResolvedValue(undefined);await controller.retry();
  expect(controller.getSnapshot().status).toBe('saved');
});
it('enforces 500 characters and leaves another exercise queue unchanged', async () => {
  const a=setup(), b=setup('Other exercise');
  a.controller.update('x'.repeat(501));await a.controller.flush();
  expect(a.save).toHaveBeenCalledExactlyOnceWith('x'.repeat(500));
  expect(b.controller.getSnapshot().value).toBe('Other exercise');expect(b.save).not.toHaveBeenCalled();
});
