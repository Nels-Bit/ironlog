import { useEffect } from 'react';
import { useLastExercisePerformance } from '../hooks/useLastExercisePerformance';
import type { ExerciseSet } from '../types';

interface Props {
  workoutExerciseId: string;
  exerciseId: string;
  onHydrate: (workoutExerciseId: string, exerciseId: string, sets: ExerciseSet[]) => void;
}

/** Invisible mount point that hydrates a block added or swapped during a workout. */
export const GhostSetHydrator = ({ workoutExerciseId, exerciseId, onHydrate }: Props) => {
  const query = useLastExercisePerformance(exerciseId);

  useEffect(() => {
    if (query.isSuccess) onHydrate(workoutExerciseId, exerciseId, query.data);
  }, [exerciseId, onHydrate, query.data, query.isSuccess, workoutExerciseId]);

  return null;
};
