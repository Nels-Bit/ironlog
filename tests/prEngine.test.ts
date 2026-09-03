import { describe, it, expect } from 'vitest';
import {
  isEligibleForPR,
  shouldCountSetForPR,
  getSetLoad,
  isCardioExercise
} from '../src/utils/workoutMath';
import type { Exercise, ExerciseSet, WorkoutSession } from '../src/types';

describe('PR Engine: Multi-Type Set Ingestion', () => {
  const benchPress: Exercise = {
    id: 'ex_bench',
    name: 'Barbell Bench Press',
    category: 'Free Weights',
    exerciseCategory: 'strength',
    target: 'Chest'
  };

  const treadmill: Exercise = {
    id: 'ex_treadmill',
    name: 'Treadmill Run',
    category: 'Cardio',
    exerciseCategory: 'cardio',
    target: null
  };

  describe('isEligibleForPR predicate', () => {
    it('evaluates normal/working sets as eligible', () => {
      expect(isEligibleForPR('normal')).toBe(true);
    });

    it('evaluates failure sets as eligible for all PRs', () => {
      expect(isEligibleForPR('failure')).toBe(true);
    });

    it('evaluates primary drop sets as eligible', () => {
      expect(isEligibleForPR('dropset')).toBe(true);
      expect(isEligibleForPR('drop')).toBe(true);
    });

    it('excludes warmup sets from PR calculation', () => {
      expect(isEligibleForPR('warmup')).toBe(false);
    });

    it('excludes secondary drop sets (dropset_child) from PR calculation', () => {
      expect(isEligibleForPR('dropset_child')).toBe(false);
    });

    it('gracefully defaults legacy rows with null or undefined set_type to normal', () => {
      expect(isEligibleForPR(null)).toBe(true);
      expect(isEligibleForPR(undefined)).toBe(true);
      expect(isEligibleForPR('')).toBe(true);
    });
  });

  describe('shouldCountSetForPR evaluation', () => {
    it('accepts completed normal sets with positive reps and weight', () => {
      const set: ExerciseSet = {
        id: 's1',
        type: 'normal',
        weight: 200,
        reps: 5,
        isCompleted: true
      };
      expect(shouldCountSetForPR(set, benchPress)).toBe(true);
    });

    it('accepts completed failure sets', () => {
      const set: ExerciseSet = {
        id: 's2',
        type: 'failure',
        weight: 225,
        reps: 3,
        isCompleted: true
      };
      expect(shouldCountSetForPR(set, benchPress)).toBe(true);
    });

    it('rejects warmup sets even with high weight', () => {
      const set: ExerciseSet = {
        id: 's3',
        type: 'warmup',
        weight: 315,
        reps: 5,
        isCompleted: true
      };
      expect(shouldCountSetForPR(set, benchPress)).toBe(false);
    });

    it('rejects secondary drop sets (dropset_child)', () => {
      const set: ExerciseSet = {
        id: 's4',
        type: 'dropset_child',
        weight: 185,
        reps: 8,
        isCompleted: true
      };
      expect(shouldCountSetForPR(set, benchPress)).toBe(false);
    });

    it('rejects cardio exercises from strength PR evaluation', () => {
      const cardioSet: ExerciseSet = {
        id: 's5',
        type: 'normal',
        weight: null,
        reps: null,
        distance: 3.1,
        durationSeconds: 1500,
        isCompleted: true
      };
      expect(isCardioExercise(treadmill)).toBe(true);
      expect(shouldCountSetForPR(cardioSet, treadmill)).toBe(false);
    });
  });

  describe('Edge Case PR Comparisons', () => {
    it('allows a failure set to beat an existing normal set PR', () => {
      let currentPR = 200; // Historic PR from a normal set

      const setsInWorkout: ExerciseSet[] = [
        { id: '1', type: 'normal', weight: 185, reps: 5, isCompleted: true },
        { id: '2', type: 'failure', weight: 225, reps: 2, isCompleted: true } // Failure set with higher weight
      ];

      for (const set of setsInWorkout) {
        if (shouldCountSetForPR(set, benchPress)) {
          const load = getSetLoad(set, benchPress);
          if (load > currentPR) {
            currentPR = load;
          }
        }
      }

      expect(currentPR).toBe(225);
    });

    it('ignores a warmup set even if the weight exceeds the current PR', () => {
      let currentPR = 200;

      const setsInWorkout: ExerciseSet[] = [
        { id: '1', type: 'warmup', weight: 275, reps: 1, isCompleted: true }, // Accidental high weight logged as warmup
        { id: '2', type: 'normal', weight: 195, reps: 5, isCompleted: true }
      ];

      for (const set of setsInWorkout) {
        if (shouldCountSetForPR(set, benchPress)) {
          const load = getSetLoad(set, benchPress);
          if (load > currentPR) {
            currentPR = load;
          }
        }
      }

      // PR remains 200 because 275 warmup was ignored and 195 < 200
      expect(currentPR).toBe(200);
    });

    it('evaluates primary drop set weight but ignores child drop set weight', () => {
      let currentPR = 200;

      const setsInWorkout: ExerciseSet[] = [
        { id: '1', type: 'dropset', weight: 215, reps: 6, isCompleted: true }, // Primary drop set (eligible)
        { id: '2', type: 'dropset_child', weight: 165, reps: 8, isCompleted: true } // Secondary drop set (ignored)
      ];

      for (const set of setsInWorkout) {
        if (shouldCountSetForPR(set, benchPress)) {
          const load = getSetLoad(set, benchPress);
          if (load > currentPR) {
            currentPR = load;
          }
        }
      }

      expect(currentPR).toBe(215);
    });

    it('evaluates legacy set with null/undefined set_type as normal', () => {
      let currentPR = 200;

      const legacySet: any = {
        id: 'leg_1',
        type: undefined, // Legacy DB row where type was not set
        weight: 230,
        reps: 5,
        isCompleted: true
      };

      expect(shouldCountSetForPR(legacySet, benchPress)).toBe(true);
      const load = getSetLoad(legacySet, benchPress);
      if (load > currentPR) {
        currentPR = load;
      }
      expect(currentPR).toBe(230);
    });
  });
});

