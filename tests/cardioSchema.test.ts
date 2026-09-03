import { describe, it, expect } from 'vitest';
import {
  validateExerciseCreation,
  cardioExerciseSchema,
  strengthExerciseSchema,
  cardioSetSchema,
  strengthSetSchema
} from '../src/schemas/exercise';

describe('Cardio Exercise Schema & Logging Decoupling', () => {
  describe('Exercise Creation Validation', () => {
    it('successfully validates a cardio exercise with target_muscles: null and is_unilateral: null', () => {
      const result = validateExerciseCreation({
        name: 'Outdoor Running',
        category: 'Cardio',
        exercise_category: 'cardio',
        target_muscles: null,
        is_unilateral: null
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exercise_category).toBe('cardio');
        expect(result.data.target_muscles).toBeNull();
        expect(result.data.is_unilateral).toBeNull();
      }
    });

    it('successfully validates cardio with category="Cardio" without explicit exercise_category discriminator', () => {
      const result = validateExerciseCreation({
        name: 'Stationary Bike',
        category: 'Cardio'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exercise_category).toBe('cardio');
        expect(result.data.target_muscles).toBeNull();
      }
    });

    it('fails direct strength validation when target_muscles is missing', () => {
      const result = strengthExerciseSchema.safeParse({
        name: 'Bench Press',
        category: 'Free Weights',
        exercise_category: 'strength',
        // target_muscles is omitted
        is_unilateral: false
      });

      expect(result.success).toBe(false);
    });

    it('passes direct cardio validation with null target_muscles and is_unilateral', () => {
      const result = cardioExerciseSchema.safeParse({
        name: 'Rowing Machine',
        category: 'Cardio',
        exercise_category: 'cardio',
        target_muscles: null,
        is_unilateral: null
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Cardio Set Metrics Validation', () => {
    it('validates cardio set with distance, durationSeconds, pace, and caloriesBurned', () => {
      const validCardioSet = {
        id: 'c-set-1',
        type: 'normal',
        distance: 5.2, // 5.2 miles
        durationSeconds: 1800, // 30 minutes
        pace: 5.76, // min/mile
        caloriesBurned: 520,
        incline: 1.5,
        isCompleted: true
      };

      const result = cardioSetSchema.safeParse(validCardioSet);
      expect(result.success).toBe(true);
    });

    it('validates strength set requiring weight and reps without cardio fields', () => {
      const validStrengthSet = {
        id: 's-set-1',
        type: 'normal',
        weight: 225,
        reps: 5,
        isCompleted: true
      };

      const result = strengthSetSchema.safeParse(validStrengthSet);
      expect(result.success).toBe(true);
    });
  });
});

