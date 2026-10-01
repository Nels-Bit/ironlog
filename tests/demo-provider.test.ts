import { describe, it, expect, vi } from 'vitest';
import { createDemoProvider } from '../src/lib/demo-transport';
import { createIronLogSeed } from '../src/lib/demo-seed';

describe('isolated Iron Log demo', () => {
  it('uses real query builders without any network or production identity', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
    try {
      const seed = createIronLogSeed(), provider = createDemoProvider(seed), client = provider.client;
      expect((await client.auth.getSession()).data.session).toBeNull();
      expect((await client.auth.getUser()).data.user?.id).toBe('demo-alex');
      const history = await client.from('workouts').select('*').eq('user_id', 'demo-alex').order('start_time', { ascending: false });
      expect(history.error).toBeNull(); expect(history.data).toHaveLength(30);
      expect((await client.rpc('ensure_current_user_profile')).data.display_name).toBe('Alex Morgan');
      const saved = await client.from('workouts').insert({ user_id: 'demo-alex', name: 'Temporary workout', exercises: [], start_time: Date.now(), volume_load: 0 }).select().single();
      expect(saved.error).toBeNull();
      expect((await client.from('workouts').update({ name: 'Edited' }).eq('id', saved.data.id)).error).toBeNull();
      expect((await client.from('workouts').delete().eq('id', saved.data.id)).error).toBeNull();
      expect((await client.auth.updateUser({ data: { weight: 180.2 } })).error).toBeNull();
      expect((await client.auth.getUser()).data.user?.user_metadata.weight).toBe(180.2);
      expect((await client.from('user_profiles').update({ display_name: 'Temporary Alex' }).eq('user_id', 'demo-alex')).error).toBeNull();
      expect((await client.from('exercises').insert({ user_id: 'demo-alex', name: 'Temporary exercise' }).select().single()).error).toBeNull();
      expect((await client.from('friendships').update({ status: 'accepted' }).eq('id', 'demo-friend-3')).error).toBeNull();
      expect((await client.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)).error).toBeNull();
      expect((await client.auth.updateUser({ password: 'blocked' })).error).toBeTruthy();
      expect((await client.auth.updateUser({ email: 'blocked@example.invalid' })).error).toBeTruthy();
      expect((await client.auth.signUp({ email: 'blocked@example.invalid', password: 'blocked' })).error).toBeTruthy();
      expect((await client.rpc('delete_account')).error).toBeTruthy();
      expect((await client.storage.from('avatars').upload('demo.png', new Blob(['temporary']))).error).toBeTruthy();
      expect((await client.functions.invoke('production_function')).error).toBeTruthy();
      expect((await client.from('unknown_table').insert({})).error).toBeTruthy();
      expect((await provider.transport('https://real.supabase.co/rest/v1/workouts', { method: 'POST', body: '{}' })).status).toBe(403);
      expect((await provider.transport('https://demo.invalid/storage/v1/upload', { method: 'POST', body: 'image' })).status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
      provider.reset(); expect(provider.snapshot()).toEqual(seed);
      expect(createDemoProvider(seed).snapshot()).toEqual(seed);
    } finally { fetchSpy.mockRestore(); }
  });
});
