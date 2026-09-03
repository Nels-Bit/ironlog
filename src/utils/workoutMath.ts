import type { Exercise, ExerciseSet, WorkoutExercise } from '../types';

export const parseUserWeight = (value: unknown): number | null => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? parseFloat(value)
      : NaN;

  return Number.isFinite(parsed) ? parsed : null;
};

export const isAssistedExercise = (def?: Exercise) =>
  /assist/i.test(def?.name ?? '') || (def?.category || '').toLowerCase() === 'assisted';

export const isBodyweightExercise = (def?: Exercise) =>
  (def?.category || '').toLowerCase() === 'bodyweight';

export const hasCompleteUnilateralReps = (set: ExerciseSet, def?: Exercise) => {
  if (!def?.isUnilateral) return true;
  const left = set.repsLeft ?? 0;
  const right = set.repsRight ?? 0;
  return left > 0 && right > 0;
};

export const getTotalReps = (set: ExerciseSet, def?: Exercise) => {
  if (def?.isUnilateral) {
    return (set.repsLeft ?? 0) + (set.repsRight ?? 0);
  }
  return set.reps ?? 0;
};

export const resolveBodyWeight = (
  set: ExerciseSet,
  workoutBodyWeight?: number | null,
  userWeight?: number | null
) => {
  if (Number.isFinite(set.bodyWeight ?? NaN)) return set.bodyWeight as number;
  if (Number.isFinite(workoutBodyWeight ?? NaN)) return workoutBodyWeight as number;
  if (Number.isFinite(userWeight ?? NaN)) return userWeight as number;
  return 0;
};

export const getSetLoad = (
  set: ExerciseSet,
  def?: Exercise,
  workoutBodyWeight?: number | null,
  userWeight?: number | null
) => {
  const extra = typeof set.weight === 'number' && !Number.isNaN(set.weight) ? set.weight : 0;

  if (isAssistedExercise(def)) {
    const bodyWeight = resolveBodyWeight(set, workoutBodyWeight, userWeight);
    return Math.max(0, bodyWeight - extra);
  }

  if (isBodyweightExercise(def)) {
    const bodyWeight = resolveBodyWeight(set, workoutBodyWeight, userWeight);
    return Math.max(0, bodyWeight + extra);
  }

  return Math.max(0, extra);
};

export const shouldCountSetForVolume = (
  set: ExerciseSet,
  def?: Exercise,
  workoutBodyWeight?: number | null,
  userWeight?: number | null
) => {
  if (!set.isCompleted) return false;
  if (!hasCompleteUnilateralReps(set, def)) return false;

  const totalReps = getTotalReps(set, def);
  if (totalReps <= 0) return false;

  const load = getSetLoad(set, def, workoutBodyWeight, userWeight);
  if (load <= 0) return false;

  return true;
};

export const isCardioExercise = (def?: Exercise) =>
  (def?.category || '').toLowerCase() === 'cardio' || def?.exerciseCategory === 'cardio';

export const PR_ELIGIBLE_SET_TYPES = ['normal', 'failure', 'drop', 'dropset'] as const;
export type PREligibleSetType = typeof PR_ELIGIBLE_SET_TYPES[number];

export const isEligibleForPR = (setType?: string | null): boolean => {
  // Backward compatibility: If older rows contain set_type = NULL or undefined, default to 'normal'
  const normalized = (setType || 'normal').toLowerCase();
  return PR_ELIGIBLE_SET_TYPES.includes(normalized as PREligibleSetType);
};

export const shouldCountSetForPR = (
  set: ExerciseSet,
  def?: Exercise,
  workoutBodyWeight?: number | null,
  userWeight?: number | null
) => {
  if (isCardioExercise(def)) return false;
  if (!isEligibleForPR(set.type)) return false;
  return shouldCountSetForVolume(set, def, workoutBodyWeight, userWeight);
};

export const applyBodyWeightToExercises = (
  exercises: WorkoutExercise[],
  defMap: Map<string, Exercise>,
  bodyWeight?: number
) => exercises.map(exercise => {
  const def = defMap.get(exercise.exerciseId);
  if (!isBodyweightExercise(def) && !isAssistedExercise(def)) return exercise;

  const updatedSets = exercise.sets.map(set => {
    if (Number.isFinite(set.bodyWeight ?? NaN)) return set;
    if (!Number.isFinite(bodyWeight ?? NaN)) return set;
    return { ...set, bodyWeight };
  });

  return { ...exercise, sets: updatedSets };
});
