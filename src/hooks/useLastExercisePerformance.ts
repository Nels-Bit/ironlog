import { useQuery } from '@tanstack/react-query';
import { workoutService } from '../services/workoutService';
import type { ExerciseSet } from '../types';

export const ghostSetsQueryKey = (exerciseId: string) => ['ghost-sets', exerciseId] as const;

/** Fetches history when an exercise block is mounted, including mid-workout additions. */
export const useLastExercisePerformance = (exerciseId?: string) => useQuery<ExerciseSet[]>({
  queryKey: ghostSetsQueryKey(exerciseId ?? ''),
  enabled: Boolean(exerciseId),
  staleTime: 5 * 60 * 1000,
  queryFn: async () => {
    if (!exerciseId) return [];
    const lastLog = await workoutService.getLastLog(exerciseId);
    if (lastLog === undefined) throw new Error('Unable to load previous performance.');
    return lastLog?.sets ?? [];
  }
});
