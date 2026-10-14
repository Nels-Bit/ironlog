import type { Exercise, WorkoutExercise } from "../types.js";
export const barbellLiftNames = { bench_press: "Barbell Bench Press", squat: "Barbell Squat", deadlift: "Barbell Deadlift" } as const;
export type BarbellLift = keyof typeof barbellLiftNames;
const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
/** Exact aliases only: machine Squat, incline press and RDL remain distinct. */
export const getBarbellLift = (exercise?: Pick<Exercise, "name" | "category" | "isUnilateral">): BarbellLift | null => {
  if (!exercise || exercise.isUnilateral) return null;
  if (!['free weights', 'free weight', 'barbell', 'strength', 'chest', 'legs', 'back'].includes(normalized(exercise.category || ""))) return null;
  const name = normalized(exercise.name);
  if (["bench press", "barbell bench press"].includes(name)) return "bench_press";
  if (["squat", "barbell squat"].includes(name)) return "squat";
  if (["deadlift", "barbell deadlift"].includes(name)) return "deadlift";
  return null;
};
export const canonicalBarbellName = (exercise: Pick<Exercise, "name" | "category" | "isUnilateral">) => {
  const lift = getBarbellLift(exercise);
  return lift ? barbellLiftNames[lift] : exercise.name;
};
/** Change identity only, retaining every block, set id and drop-set relationship. */
export const remapWorkoutExerciseIds = (exercises: WorkoutExercise[], aliases: ReadonlyMap<string, string>) =>
  exercises.map(exercise => aliases.has(exercise.exerciseId) ? { ...exercise, exerciseId: aliases.get(exercise.exerciseId)! } : exercise);
export const combineExerciseLogs = (exercises: WorkoutExercise[], exerciseId: string): WorkoutExercise | null => {
  const logs = exercises.filter(exercise => exercise.exerciseId === exerciseId);
  return logs.length ? { ...logs[0], sets: logs.flatMap(exercise => exercise.sets) } : null;
};
