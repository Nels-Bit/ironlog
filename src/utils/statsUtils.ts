import { exerciseService } from '../services/exerciseService';
import type { WorkoutSession } from '../types';

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

    // 1. Fetch ALL exercises once (Performance Optimization)
    const allExercises = await exerciseService.getAllExercises();
    // Create a lookup map: ID -> Name
    const exerciseNames = new Map(allExercises.map(e => [e.id, e.name]));

    // 2. Loop through every workout
    history.forEach(workout => {
      workout.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          if (set.isCompleted && set.weight && set.weight > 0) {
            
            const existingPR = prMap.get(ex.exerciseId);
            
            if (!existingPR || set.weight > existingPR.weight) {
              
              // Get name from our lookup map (Instant)
              const name = exerciseNames.get(ex.exerciseId) || 'Unknown Exercise';
              
              prMap.set(ex.exerciseId, {
                exerciseId: ex.exerciseId,
                exerciseName: name,
                weight: set.weight,
                date: workout.startTime
              });
            }
          }
        });
      });
    });

    return Array.from(prMap.values()).sort((a, b) => b.date - a.date);
  }
};