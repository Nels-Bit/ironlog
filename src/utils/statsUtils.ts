import { exerciseService } from '../services/exerciseService';
import { authService } from '../services/authService';
import type { WorkoutSession, Exercise, ExerciseSet } from '../types';

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  date: number;
}

export const statsUtils = {
  // Now explicitly Async because we need to fetch exercise names from DB
  calculatePRs: async (history: WorkoutSession[]): Promise<PersonalRecord[]> => {
    const prMap = new Map<string, PersonalRecord>();

    const user = await authService.getUser();
    const rawWeight = user?.weight;
    const userWeight = typeof rawWeight === 'number'
      ? rawWeight
      : typeof rawWeight === 'string'
        ? parseFloat(rawWeight)
        : 0;

    // 1. Fetch ALL exercises once (Performance Optimization)
    const allExercises = await exerciseService.getAllExercises();
    // Create a lookup map: ID -> Name
    const exerciseNames = new Map(allExercises.map(e => [e.id, e.name]));
    const exerciseDefs = new Map<string, Exercise>(allExercises.map(e => [e.id, e]));

    const isBodyweight = (def?: Exercise) => (def?.category || '').toLowerCase() === 'bodyweight';
    const getTotalReps = (set: ExerciseSet, def?: Exercise) => {
      if (def?.isUnilateral) {
        return (set.repsLeft ?? 0) + (set.repsRight ?? 0);
      }
      return set.reps ?? 0;
    };
    const getSetLoad = (set: ExerciseSet, def?: Exercise) => {
      const extra = typeof set.weight === 'number' && !Number.isNaN(set.weight) ? set.weight : 0;
      if (isBodyweight(def)) {
        return Math.max(0, (Number.isFinite(userWeight) ? userWeight : 0) + extra);
      }
      return Math.max(0, extra);
    };

    // 2. Loop through every workout
    history.forEach(workout => {
      workout.exercises.forEach(ex => {
        const def = exerciseDefs.get(ex.exerciseId);
        ex.sets.forEach(set => {
          const totalReps = getTotalReps(set, def);
          if (!set.isCompleted || totalReps <= 0) return;

          const load = getSetLoad(set, def);
          if (load <= 0) return;

          const existingPR = prMap.get(ex.exerciseId);

          if (!existingPR || load > existingPR.weight) {
            // Get name from our lookup map (Instant)
            const name = exerciseNames.get(ex.exerciseId) || 'Unknown Exercise';

            prMap.set(ex.exerciseId, {
              exerciseId: ex.exerciseId,
              exerciseName: name,
              weight: load,
              date: workout.startTime
            });
          }
        });
      });
    });

    return Array.from(prMap.values()).sort((a, b) => b.date - a.date);
  }
};