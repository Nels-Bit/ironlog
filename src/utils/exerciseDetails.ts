import type { Exercise, ExerciseSet, WorkoutSession } from '../types.js';

export const EXERCISE_NOTES_LIMIT = 500;
export const EXERCISE_CHANGED = 'ironlog:exercise-changed';
export const validateExerciseSettings = (value: { notes?: string; startingResistance?: number }) => {
  if (value.notes !== undefined && (typeof value.notes !== 'string' || value.notes.length > EXERCISE_NOTES_LIMIT))
    throw new Error(`Notes must be ${EXERCISE_NOTES_LIMIT} characters or fewer.`);
  if (value.startingResistance !== undefined && (!Number.isFinite(value.startingResistance) || value.startingResistance < 0 || value.startingResistance > 10000))
    throw new Error('Starting resistance must be between 0 and 10,000 lb.');
};
export const startingResistanceFor = (exercise?: Exercise) =>
  exercise?.exerciseCategory === 'cardio' || exercise?.category.toLowerCase() === 'cardio'
    ? 0 : exercise?.startingResistance ?? 0;
export const enteredSetWeight = (set: ExerciseSet) =>
  set.weight == null ? null : Number(Math.max(0, set.weight - (set.startingResistance ?? 0)).toFixed(8));
export const totalSetWeight = (set: ExerciseSet, entered: number | null) =>
  entered == null ? null : Number((entered + (set.startingResistance ?? 0)).toFixed(8));
export const ghostEnteredWeight = (set: ExerciseSet, previous?: ExerciseSet) =>
  previous?.weight == null ? null : previous.startingResistance === undefined
    // Legacy logs only identify a total load. Do not manufacture a PR by adding
    // a newly configured base to that old total during automatic completion.
    ? Math.max(0,previous.weight-(set.startingResistance ?? 0)) : enteredSetWeight(previous);

/** A definition correction applies to this unsaved session, preserving entered plates.
 * Saved sessions retain their original resistance snapshots and recorded totals. */
export function updateActiveStartingResistance(workout: WorkoutSession | null, exercise: Exercise) {
  if (!workout || workout.endTime !== undefined) return workout;
  const startingResistance = startingResistanceFor(exercise);
  let changed = false;
  const exercises = workout.exercises.map(instance => {
    if (instance.exerciseId !== exercise.id) return instance;
    let setsChanged = false;
    const sets = instance.sets.map(set => {
      if ((set.startingResistance ?? 0) === startingResistance) return set;
      const updated = {...set, startingResistance};
      updated.weight = totalSetWeight(updated, enteredSetWeight(set));
      setsChanged = true;
      return updated;
    });
    if (!setsChanged) return instance;
    changed = true;
    return {...instance, sets};
  });
  return changed ? {...workout, exercises} : workout;
}

/** Remove a whole drop family, or repair the parent after its final child is removed. */
export function removeWorkoutSet(sets: ExerciseSet[], index: number) {
  const removed = sets[index];
  if (!removed) return sets;
  return repairDropSets(sets.filter(set => set.id !== removed.id && set.parentSetId !== removed.id));
}
function repairDropSets(sets: ExerciseSet[]) {
  return sets.map(set => {
    if (set.type === 'dropset' && !sets.some(child => child.type === 'dropset_child' && child.parentSetId === set.id))
      return { ...set, type: 'normal' as const, parentSetId: undefined };
    if (set.type === 'dropset_child' && !sets.some(parent => parent.id === set.parentSetId && parent.type === 'dropset'))
      return { ...set, type: 'normal' as const, parentSetId: undefined };
    return set;
  });
}
/** A type change and its child insertion/removal are one atomic state update. */
export function changeWorkoutSetType(sets: ExerciseSet[], index: number, type: ExerciseSet['type'], newId: string) {
  const current = sets[index];
  if (!current || current.type === type) return sets;
  let next = sets.map(set => set.id === current.id ? { ...set, type, parentSetId: type === 'dropset_child' ? set.parentSetId : undefined } : set);
  if (current.type === 'dropset') next = next.filter(set => set.parentSetId !== current.id);
  if (type === 'dropset') next.splice(index + 1, 0, {
    id: newId, type: 'dropset_child', parentSetId: current.id,
    weight: null, reps: null, repsLeft: null, repsRight: null, isCompleted: false,
    startingResistance: current.startingResistance,
  });
  return repairDropSets(next);
}
