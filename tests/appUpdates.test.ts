import { expect, it, vi } from 'vitest';
import { createAppUpdates } from '../src/utils/appUpdates';
function setup() {
  let safe=true, time=0;
  const check=vi.fn(async()=>{}),activate=vi.fn(async()=>{}),reload=vi.fn();
  const manager=createAppUpdates({check,activate,reload,canApply:()=>safe,now:()=>time});
  return {manager,check,activate,reload,safe:(value:boolean)=>{safe=value;},time:(value:number)=>{time=value;}};
}
it('checks in the background and throttles repeated resume/navigation signals',async()=>{
  const t=setup();await t.manager.check();await t.manager.check();
  expect(t.check).toHaveBeenCalledTimes(1);
  t.time(60_000);await t.manager.check();expect(t.check).toHaveBeenCalledTimes(2);
  await t.manager.check(true);expect(t.check).toHaveBeenCalledTimes(3);
});
it('deduplicates simultaneous checks including a sign-in signal',async()=>{
  const t=setup();const first=t.manager.check();const second=t.manager.check(true);
  expect(second).toBe(first);await first;expect(t.check).toHaveBeenCalledTimes(1);
});
it('waits for workouts, edits and note saves to finish before activating or reloading',()=>{
  const t=setup();t.safe(false);t.manager.available();expect(t.activate).not.toHaveBeenCalled();
  t.safe(true);t.manager.apply();t.manager.apply();expect(t.activate).toHaveBeenCalledTimes(1);
  t.safe(false);t.manager.activated();expect(t.reload).not.toHaveBeenCalled();
  t.safe(true);t.manager.apply();t.manager.apply();expect(t.reload).toHaveBeenCalledTimes(1);
});
it('does not reload a first install, or reload before the new worker takes control',()=>{
  const t=setup();t.manager.apply();expect(t.activate).not.toHaveBeenCalled();
  t.manager.available();expect(t.activate).toHaveBeenCalledTimes(1);expect(t.reload).not.toHaveBeenCalled();
  t.manager.activated();expect(t.reload).toHaveBeenCalledTimes(1);
});
it('recovers from failed update checks without blocking or losing an available update',async()=>{
  const t=setup();t.check.mockRejectedValueOnce(new Error('Offline'));
  await expect(t.manager.check()).resolves.toBeUndefined();
  t.time(60_000);await t.manager.check();expect(t.check).toHaveBeenCalledTimes(2);
  t.manager.available();expect(t.activate).toHaveBeenCalledTimes(1);
});
