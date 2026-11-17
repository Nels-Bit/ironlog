import type { Exercise, ExerciseSet, WorkoutExercise } from '../types';
import { hasSetData } from './exerciseLogging';
import { isAssistedExercise, isBodyweightExercise, isCardioExercise } from './workoutMath';
import { enteredSetWeight } from './exerciseDetails';

const number = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? String(value) : '—';

const setTypes: Record<ExerciseSet['type'], string> = {
  normal: 'Working', warmup: 'Warm-up', dropset: 'Drop set',
  dropset_child: 'Drop', failure: 'Failure',
};

/** Show the weight the user entered; total load remains available to XP/volume. */
export function getSummarySets(exercise: WorkoutExercise, def?: Exercise) {
  return exercise.sets.flatMap((set, index) => {
    if (!hasSetData(set)) return [];
    const cardio = isCardioExercise(def);
    const seconds = set.durationSeconds;
    const duration = seconds != null && Number.isFinite(seconds) && seconds >= 0
      ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—';
    const entered = enteredSetWeight(set);
    const weight = isAssistedExercise(def) ? `${number(entered)} lb assist`
      : isBodyweightExercise(def) ? `BW${entered === 0 ? '' : ` + ${number(entered)} lb`}`
        : `${number(entered)} lb`;
    return [{
      id: set.id,
      label: `Set ${index + 1}`,
      type: setTypes[set.type] || 'Working',
      completed: set.isCompleted,
      child: set.type === 'dropset_child',
      load: cardio ? `${number(set.distance)} mi` : weight,
      reps: cardio ? duration : def?.isUnilateral
        ? `${number(set.repsLeft)} / ${number(set.repsRight)}` : number(set.reps),
    }];
  });
}
