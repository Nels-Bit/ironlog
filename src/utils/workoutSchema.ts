import type { WorkoutExercise, ExerciseSet } from "../types.js";
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumber = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Normalizes legacy JSON rows so old workouts can still provide ghost targets. */
export const getWorkoutExercises = (value: unknown): WorkoutExercise[] =>
  asArray(value).flatMap((rawExercise, exerciseIndex) => {
    const exercise = asRecord(rawExercise);
    if (!exercise) return [];
    const exerciseId = exercise.exerciseId ?? exercise.exercise_id;
    if (typeof exerciseId !== "string" || !exerciseId) return [];

    const sets = asArray(exercise.sets ?? exercise.exerciseSets).flatMap(
      (rawSet, setIndex) => {
        const set = asRecord(rawSet);
        if (!set) return [];
        const type = set.type ?? set.set_type ?? "normal";
        return [
          {
            id:
              typeof set.id === "string"
                ? set.id
                : `legacy-${exerciseIndex}-${setIndex}`,
            type:
              typeof type === "string"
                ? (type as ExerciseSet["type"])
                : "normal",
            weight: asNumber(set.weight),
            reps: asNumber(set.reps),
            repsLeft: asNumber(set.repsLeft ?? set.reps_left),
            repsRight: asNumber(set.repsRight ?? set.reps_right),
            distance: asNumber(
              set.distance ?? set.distanceMiles ?? set.distance_miles,
            ),
            durationSeconds: asNumber(
              set.durationSeconds ?? set.duration_seconds,
            ),
            isCompleted: set.isCompleted === true || set.completed === true,
            parentSetId:
              typeof (set.parentSetId ?? set.parent_set_id) === "string"
                ? ((set.parentSetId ?? set.parent_set_id) as string)
                : undefined,
            bodyWeight:
              asNumber(set.bodyWeight ?? set.body_weight) ?? undefined,
          },
        ];
      },
    );

    return [
      {
        id:
          typeof exercise.id === "string"
            ? exercise.id
            : `legacy-exercise-${exerciseIndex}`,
        exerciseId,
        sets,
      },
    ];
  });
