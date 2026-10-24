import { it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDemoProvider } from '../src/lib/demo-transport';
import { createIronLogSeed } from '../src/lib/demo-seed';
import { WorkoutSummaryExercise } from '../src/components/WorkoutSummaryExercise';
import { getSummarySets } from '../src/utils/workoutSummary';

it('saves and reloads summary set details through the real service without network access', async () => {
  const provider = createDemoProvider(createIronLogSeed());
  vi.doMock('../src/lib/supabase', () => ({ supabase: provider.client }));
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Live request forbidden'));
  try {
    const { workoutService } = await import('../src/services/workoutService');
    const saved = await workoutService.saveWorkout({
      id: 'draft', name: 'Summary verification', startTime: Date.now(), endTime: Date.now(), volumeLoad: 1368.75,
      exercises: [{ id: 'instance', exerciseId: 'demo-bench', sets: [
        { id: 'logged', type: 'normal', weight: 182.5, reps: 7.5, isCompleted: true },
        { id: 'ghost', type: 'normal', weight: null, reps: null, isCompleted: false },
      ] }],
    });
    expect(saved).not.toBeNull();
    const reloaded = await workoutService.getWorkoutById(saved!.id);
    const fromProfileHistory = (await workoutService.getHistory()).find(workout => workout.id === saved!.id);
    expect(reloaded?.exercises).toEqual(fromProfileHistory?.exercises);
    for (const workout of [reloaded, fromProfileHistory]) {
      const exercise = workout!.exercises[0];
      expect(getSummarySets(exercise)).toHaveLength(1);
      const html = renderToStaticMarkup(createElement(WorkoutSummaryExercise, { exercise }));
      expect(html).toContain('182.5 lb');
      expect(html).toContain('7.5');
      expect(html).not.toContain('Set 2');
    }
    expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); vi.doUnmock('../src/lib/supabase'); }
});
