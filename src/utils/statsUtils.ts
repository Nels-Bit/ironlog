import { exerciseService } from '../services/exerciseService';
import { authService } from '../services/authService';
import { getSetLoad, parseUserWeight, shouldCountSetForPR } from './workoutMath';
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
    const userWeight = parseUserWeight(user?.weight);

    // 1. Fetch ALL exercises once (Performance Optimization)
    const allExercises = await exerciseService.getAllExercises();
    // Create a lookup map: ID -> Name
    const exerciseNames = new Map(allExercises.map(e => [e.id, e.name]));
    const exerciseDefs = new Map<string, Exercise>(allExercises.map(e => [e.id, e]));

    // 2. Loop through every workout
    history.forEach(workout => {
      workout.exercises.forEach(ex => {
        const def = exerciseDefs.get(ex.exerciseId);
        ex.sets.forEach(set => {
          if (!shouldCountSetForPR(set as ExerciseSet, def, undefined, userWeight)) return;

          const load = getSetLoad(set as ExerciseSet, def, undefined, userWeight);
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