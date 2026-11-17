import { it, expect, vi } from 'vitest';
import { createDemoProvider } from '../src/lib/demo-transport';
import { createIronLogSeed } from '../src/lib/demo-seed';
import { defaultNotificationPreferences } from '../src/utils/notifications';
it('device timezone sync preserves preferences and notification saves cannot overwrite profile consent',async()=>{
  vi.resetModules();
  const seed=createIronLogSeed();
  const prefs={...defaultNotificationPreferences('UTC'),user_id:seed.user.id,share_activity:false,reminder_days:[1,3]};
  prefs.in_app.friend_workout=false; prefs.push.friend_workout=false;
  seed.tables.notification_preferences=[prefs];
  const provider=createDemoProvider(seed);
  vi.doMock('../src/lib/supabase',()=>({supabase:provider.client}));
  const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Production request forbidden'));
  const original=Intl.DateTimeFormat().resolvedOptions();
  const clock=vi.spyOn(Intl.DateTimeFormat.prototype,'resolvedOptions').mockReturnValue({...original,timeZone:'Pacific/Honolulu'});
  try {
    const {notificationService}=await import('../src/services/notificationService');
    expect(await notificationService.syncDeviceTimezone()).toBe(true);
    expect(await notificationService.syncDeviceTimezone()).toBe(false);
    let saved=provider.snapshot().tables.notification_preferences[0];
    expect(saved).toMatchObject({timezone:'Pacific/Honolulu',share_activity:false,push_enabled:false,reminder_days:[1,3]});
    const loaded=await notificationService.preferences();
    expect(loaded.in_app.friend_workout).toBe(false);
    await notificationService.saveSocialPrivacy(false,false);
    expect(provider.snapshot().tables.user_profiles.find(r=>r.user_id===seed.user.id)?.is_public).toBe(false);
    await notificationService.savePreferences({...loaded,share_activity:true,timezone:'UTC',quiet_enabled:true});
    saved=provider.snapshot().tables.notification_preferences[0];
    expect(saved).toMatchObject({timezone:'Pacific/Honolulu',share_activity:false,quiet_enabled:false});
    expect(saved.in_app).toEqual(saved.push);
    expect(network).not.toHaveBeenCalled();
  } finally {clock.mockRestore();network.mockRestore();vi.doUnmock('../src/lib/supabase');}
});
