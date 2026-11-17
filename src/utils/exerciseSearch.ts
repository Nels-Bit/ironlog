import type { Exercise } from '../types';
import { isCardioExercise } from './workoutMath';

const normalize = (value: string) => value.trim().toLowerCase();
const isCardio = (exercise: Exercise) => isCardioExercise(exercise) || normalize(exercise.category) === 'cardio';
const exerciseType = (exercise: Exercise) => isCardio(exercise) ? 'Cardio' : exercise.category.trim();
const exerciseMuscle = (exercise: Exercise) => isCardio(exercise) ? '' : (exercise.target ?? '').trim();

/** Build each menu from the full library, not the currently filtered results. */
export function getExerciseFilterOptions(exercises: Exercise[]) {
  const uniqueOptions = (values: string[]) => {
    const options = new Map<string, string>();
    for (const value of values) if (value && !options.has(normalize(value))) options.set(normalize(value), value);
    return [...options].sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label }));
  };
  return {
    muscles: uniqueOptions(exercises.map(exerciseMuscle)),
    types: uniqueOptions(exercises.map(exerciseType)),
  };
}

export function filterExercises(exercises: Exercise[], search: string, muscle = '', type = '') {
  const query = normalize(search), selectedMuscle = normalize(muscle), selectedType = normalize(type);
  return exercises.filter(exercise => {
    const target = exerciseMuscle(exercise), category = exerciseType(exercise);
    return (!selectedMuscle || normalize(target) === selectedMuscle)
      && (!selectedType || normalize(category) === selectedType)
      && (!query || [exercise.name, target, category].some(value => normalize(value).includes(query)));
  });
}
