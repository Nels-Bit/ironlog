import type { Exercise, ExerciseSet, PersonalRecordPerformance, WorkoutExercise } from '../types';
import { getTotalReps, isAssistedExercise, isBodyweightExercise, isCardioExercise } from './workoutMath';

/** Placeholder values never count as logged data or trigger deletion warnings. */
export const hasSetData = (set: ExerciseSet) => set.isCompleted || [
  set.weight, set.reps, set.repsLeft, set.repsRight, set.distance,
  set.durationSeconds, set.pace, set.caloriesBurned, set.incline
].some(value => value !== null && value !== undefined && Number.isFinite(value));

const display = (value: number | null | undefined) =>
  value !== null && value !== undefined && Number.isFinite(value) ? String(value) : '—';

/** Preserve the fetched load baseline (including legacy bodyweight calculations). */
export const getDisplayedPRPerformance = (
  historical: PersonalRecordPerformance,
  current: PersonalRecordPerformance,
  def?: Exercise
) => current.load > historical.load || (current.load === historical.load && current.set &&
  (!historical.set || getTotalReps(current.set, def) > getTotalReps(historical.set, def))) ? current : historical;

export const formatPRPerformance = (record: PersonalRecordPerformance, def?: Exercise) => {
  if (!record.set) return 'No PR yet';
  const reps = def?.isUnilateral
    ? `${display(record.set.repsLeft)}L / ${display(record.set.repsRight)}R reps`
    : `${display(record.set.reps)} ${record.set.reps === 1 ? 'rep' : 'reps'}`;
  return `${record.load} lb × ${reps}`;
};

/** Move by the workout instance ID, so duplicate exercise definitions stay distinct.
 * Keep each exercise and its sets intact; only the array order changes. */
export const moveWorkoutExercise = (
  exercises: WorkoutExercise[],
  workoutExerciseId: string,
  direction: 'up' | 'down'
) => {
  const index = exercises.findIndex(exercise => exercise.id === workoutExerciseId);
  const destination = index + (direction === 'up' ? -1 : 1);
  if (index < 0 || destination < 0 || destination >= exercises.length) return exercises;
  const reordered = [...exercises];
  [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
  return reordered;
};

export const getExerciseProgress = (exercise: WorkoutExercise, def?: Exercise) => {
  const completed = exercise.sets.filter(set => set.isCompleted).length;
  const logged = exercise.sets.filter(hasSetData);
  const summary = logged.map(set => {
    if (isCardioExercise(def)) {
      const seconds = set.durationSeconds;
      const time = seconds == null ? '—' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      return `${display(set.distance)} mi · ${time}`;
    }
    const load = isAssistedExercise(def) ? `${display(set.weight)} assist`
      : isBodyweightExercise(def) ? `BW + ${display(set.weight)} lb` : `${display(set.weight)} lb`;
    const reps = def?.isUnilateral ? `${display(set.repsLeft)}/${display(set.repsRight)}` : display(set.reps);
    return `${load} × ${reps}`;
  }).join(' · ');
  return {
    completed,
    total: exercise.sets.length,
    logged: logged.length,
    summary: summary || 'Tap to log your first set',
    status: completed > 0 && completed === exercise.sets.length ? 'Complete'
      : logged.length > 0 ? 'In progress' : 'Not started'
  };
};
