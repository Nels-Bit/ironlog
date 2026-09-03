import { z } from 'zod';

export const ExerciseCategoryEnum = z.enum(['strength', 'cardio', 'mobility']);
export type ExerciseCategoryType = z.infer<typeof ExerciseCategoryEnum>;

export const SetTypeEnum = z.enum(['normal', 'warmup', 'dropset', 'dropset_child', 'failure']);
export type SetTypeType = z.infer<typeof SetTypeEnum>;

// Base exercise fields shared across all categories
const baseExerciseSchema = {
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Exercise name is required'),
  category: z.string().trim().min(1, 'Category is required'),
  isCustom: z.boolean().optional(),
};

// Strength / Mobility Exercise Schema: target_muscles and is_unilateral are expected
export const strengthExerciseSchema = z.object({
  ...baseExerciseSchema,
  exercise_category: z.enum(['strength', 'mobility']).default('strength'),
  target_muscles: z.string().min(1, 'Target muscle is required').or(z.array(z.string()).min(1)),
  is_unilateral: z.boolean().default(false),
});

// Cardio Exercise Schema: target_muscles and is_unilateral are strictly optional/nullable
export const cardioExerciseSchema = z.object({
  ...baseExerciseSchema,
  exercise_category: z.literal('cardio').default('cardio'),
  target_muscles: z.string().nullable().optional(),
  is_unilateral: z.boolean().nullable().optional(),
});

// Discriminated / Unified Exercise Schema
export const exerciseSchema = z.discriminatedUnion('exercise_category', [
  strengthExerciseSchema,
  cardioExerciseSchema,
  z.object({
    ...baseExerciseSchema,
    exercise_category: z.literal('mobility'),
    target_muscles: z.string().min(1, 'Target muscle is required').or(z.array(z.string()).min(1)),
    is_unilateral: z.boolean().default(false),
  }),
]);

// Helper validator for form inputs that detects 'cardio' from either exercise_category or category string
export const validateExerciseCreation = (data: {
  name: string;
  category: string;
  exercise_category?: 'strength' | 'cardio' | 'mobility';
  target_muscles?: string | string[] | null;
  is_unilateral?: boolean | null;
}) => {
  const isCardio = data.exercise_category === 'cardio' || data.category.toLowerCase() === 'cardio';

  if (isCardio) {
    return cardioExerciseSchema.safeParse({
      ...data,
      exercise_category: 'cardio',
      target_muscles: data.target_muscles ?? null,
      is_unilateral: data.is_unilateral ?? null,
    });
  }

  return strengthExerciseSchema.safeParse({
    ...data,
    exercise_category: data.exercise_category || 'strength',
    target_muscles: data.target_muscles || 'Other',
    is_unilateral: data.is_unilateral ?? false,
  });
};

// Set validation schemas
export const strengthSetSchema = z.object({
  id: z.string(),
  type: SetTypeEnum.default('normal'),
  weight: z.number().min(0).nullable(),
  reps: z.number().int().min(0).nullable(),
  repsLeft: z.number().int().min(0).nullish(),
  repsRight: z.number().int().min(0).nullish(),
  isCompleted: z.boolean(),
  bodyWeight: z.number().nullish(),
});

export const cardioSetSchema = z.object({
  id: z.string(),
  type: SetTypeEnum.default('normal'),
  distance: z.number().min(0).nullable().optional(), // miles or km
  durationSeconds: z.number().int().min(0).nullable().optional(), // seconds
  pace: z.number().min(0).nullable().optional(),
  caloriesBurned: z.number().min(0).nullable().optional(),
  incline: z.number().nullable().optional(),
  isCompleted: z.boolean(),
});

