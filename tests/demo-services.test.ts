import { it, expect, vi } from 'vitest';
import { createDemoProvider } from '../src/lib/demo-transport';
import { createIronLogSeed } from '../src/lib/demo-seed';

it('existing auth, workout, exercise and social services use only the local provider', async () => {
  const provider = createDemoProvider(createIronLogSeed());
  vi.doMock('../src/lib/supabase', () => ({ supabase: provider.client }));
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Production request forbidden'));
  const logging = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const { authService } = await import('../src/services/authService');
    const { workoutService } = await import('../src/services/workoutService');
    const { exerciseService } = await import('../src/services/exerciseService');
    const { socialService } = await import('../src/services/socialService');
    expect((await authService.getUser())?.name).toBe('Alex Morgan');
    await authService.updateProfile({ name: 'Demo visitor', weight: 180.2, isPublic: true });
    expect((await authService.getUser())?.weight).toBe(180.2);
    const custom = await exerciseService.createExercise({ name: 'Demo lift', category: 'Chest', target: 'Chest' });
    expect(custom.isCustom).toBe(true);
    const saved = await workoutService.saveWorkout({ id: 'draft', name: 'Test session', startTime: Date.now(), endTime: Date.now(), volumeLoad: 1200, exercises: [{ id: 'exercise-set', exerciseId: 'demo-bench', sets: [{ id: 'set', type: 'normal', weight: 150, reps: 8, isCompleted: true }] }] });
    expect(saved).toBeTruthy();
    expect(await workoutService.getHistory()).toHaveLength(31);
    expect(await workoutService.getPersonalRecord('demo-bench')).toBe(150);
    await socialService.dispatchFriendMilestones(saved!.id);
    await workoutService.updateWorkout(saved!.id, { ...saved!, name: 'Edited demo workout' });
    expect((await workoutService.getWorkoutById(saved!.id))?.name).toBe('Edited demo workout');
    await workoutService.deleteWorkout(saved!.id);
    await exerciseService.deleteCustomExercise(custom.id);
    await socialService.respondToFriendRequest('demo-friend-3', true);
    expect(await socialService.getFriendsWithStats()).toHaveLength(3);
    await socialService.sendFriendRequest('demo_riley');
    expect(await socialService.getOutgoingFriendRequests()).toHaveLength(1);
    expect(await socialService.searchPublicUsers('Riley')).toHaveLength(1);
    expect((await socialService.getFriendProfile('demo-jordan')).stats?.totalWorkouts).toBe(30);
    await socialService.markAllNotificationsAsRead();
    expect(await socialService.getUnreadNotificationCount()).toBe(0);
    const unsubscribe = await socialService.subscribeToNotifications(() => {});
    unsubscribe();
    expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); logging.mockRestore(); vi.doUnmock('../src/lib/supabase'); }
});

it('demo cache/drafts never touch real device storage, including when session storage is denied', async () => {
  vi.resetModules();
  const getItem = vi.fn(() => 'REAL WORKOUT'), setItem = vi.fn(), removeItem = vi.fn();
  vi.stubGlobal('window', { location: { pathname: '/demo' } });
  vi.stubGlobal('sessionStorage', { getItem() { throw Error('Denied'); } });
  vi.stubGlobal('localStorage', { getItem, setItem, removeItem });
  try {
    const { appStorage } = await import('../src/lib/demo-session');
    expect(appStorage.getItem('current_workout')).toBeNull();
    // Client-side navigation away from /demo must retain the locked mode.
    window.location.pathname = '/profile';
    appStorage.setItem('current_workout', 'DEMO WORKOUT');
    expect(appStorage.getItem('current_workout')).toBe('DEMO WORKOUT');
    appStorage.removeItem('current_workout');
    expect(appStorage.getItem('current_workout')).toBeNull();
    expect(getItem).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled(); expect(removeItem).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
