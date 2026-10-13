import { describe, expect, it } from 'vitest';
import { getExerciseProgress, hasSetData, moveWorkoutExercise } from '../src/utils/exerciseLogging';
import type { Exercise, ExerciseSet, WorkoutExercise } from '../src/types';

const blank: ExerciseSet = { id: 's1', type: 'normal', weight: null, reps: null, isCompleted: false };
const strength: Exercise = { id: 'bench', name: 'Bench', category: 'Free Weights' };
const exercise = (...sets: ExerciseSet[]): WorkoutExercise => ({ id: 'e1', exerciseId: strength.id, sets });

describe('workout overview summaries and removal protection', () => {
  it('does not mistake historical hints for entered data', () => {
    const hint = { ...blank, previousBest: 185 };
    expect(hasSetData(hint)).toBe(false);
    expect(getExerciseProgress(exercise(hint), strength)).toMatchObject({ logged: 0, completed: 0, status: 'Not started' });
  });
  it('protects partial drafts and zero extra bodyweight load from removal', () => {
    expect(hasSetData({ ...blank, weight: 0 })).toBe(true);
    expect(hasSetData({ ...blank, repsLeft: 8 })).toBe(true);
    expect(hasSetData({ ...blank, distance: 1.5 })).toBe(true);
  });
  it('distinguishes entered sets from completed sets and updates corrected values', () => {
    const first = { ...blank, weight: 22.5, reps: 8, isCompleted: true };
    const second = { ...blank, id: 's2', weight: 20, reps: 10 };
    expect(getExerciseProgress(exercise(first, second), strength)).toMatchObject({
      logged: 2, completed: 1, total: 2, status: 'In progress', summary: '22.5 lb × 8 · 20 lb × 10'
    });
    expect(getExerciseProgress(exercise({ ...first, weight: 25 }), strength)).toMatchObject({ summary: '25 lb × 8', status: 'Complete' });
  });
  it('shows cardio miles and exact duration without pounds or reps', () => {
    const cardio = { ...strength, category: 'Cardio' };
    expect(getExerciseProgress(exercise({ ...blank, distance: 3.25, durationSeconds: 1815, isCompleted: true }), cardio).summary).toBe('3.25 mi · 30:15');
  });
  it('preserves unilateral, assistance, and bodyweight meaning', () => {
    const set = { ...blank, weight: 5, reps: 10, repsLeft: 8, repsRight: 9 };
    expect(getExerciseProgress(exercise(set), { ...strength, isUnilateral: true }).summary).toBe('5 lb × 8/9');
    expect(getExerciseProgress(exercise(set), { ...strength, category: 'Assisted' }).summary).toBe('5 assist × 10');
    expect(getExerciseProgress(exercise(set), { ...strength, category: 'Bodyweight' }).summary).toBe('BW + 5 lb × 10');
  });
  it('handles exercises with all sets deleted and invalid legacy numbers', () => {
    expect(getExerciseProgress(exercise(), strength).status).toBe('Not started');
    expect(hasSetData({ ...blank, weight: NaN, reps: Infinity })).toBe(false);
  });
});

describe('exercise reordering', () => {
  const first = { ...exercise({ ...blank, weight: 185, reps: 8, isCompleted: true }), id: 'first' };
  // A duplicate definition must still move independently by its workout instance.
  const duplicate = { ...exercise({ ...blank, id: 'second-set', type: 'failure', weight: 190, reps: 7 }), id: 'duplicate' };
  const cardio = { ...exercise({ ...blank, distance: 3, durationSeconds: 1800 }), id: 'cardio', exerciseId: 'run' };

  it('moves an exercise up/down without changing any set data or source order', () => {
    const original = [first, duplicate, cardio];
    const moved = moveWorkoutExercise(original, 'duplicate', 'down');
    expect(moved.map(ex => ex.id)).toEqual(['first', 'cardio', 'duplicate']);
    expect(moved[2]).toBe(duplicate);
    expect(moved[1]).toBe(cardio);
    expect(original.map(ex => ex.id)).toEqual(['first', 'duplicate', 'cardio']);
    expect(moveWorkoutExercise(moved, 'duplicate', 'up')).toEqual(original);
  });
  it('ignores attempts to move beyond the top or bottom or move a missing ID', () => {
    const original = [first, duplicate, cardio];
    expect(moveWorkoutExercise(original, 'first', 'up')).toBe(original);
    expect(moveWorkoutExercise(original, 'cardio', 'down')).toBe(original);
    expect(moveWorkoutExercise(original, 'missing', 'down')).toBe(original);
    expect(moveWorkoutExercise([], 'missing', 'up')).toEqual([]);
  });
  it('retains order and values across the existing JSON persistence round trip', () => {
    const moved = moveWorkoutExercise([first, duplicate, cardio], 'cardio', 'up');
    const restored = JSON.parse(JSON.stringify(moved));
    expect(restored).toEqual([first, cardio, duplicate]);
    expect(new Set(restored.map((ex: WorkoutExercise) => ex.id)).size).toBe(3);
  });
});
