import { describe, it, expect } from 'vitest';
import {
  calculateCardioXP,
  calculateWorkoutXP,
  CARDIO_XP_PER_MINUTE,
  CARDIO_XP_PER_MILE,
  BASE_XP,
} from '../src/utils/xpEngine';
import type { WorkoutSession, Exercise, ExerciseSet } from '../src/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

const treadmill: Exercise = {
  id: 'ex_treadmill',
  name: 'Treadmill Run',
  category: 'Cardio',
  exerciseCategory: 'cardio',
  target: null,
};

const bike: Exercise = {
  id: 'ex_bike',
  name: 'Stationary Bike',
  category: 'Cardio',
  exerciseCategory: 'cardio',
  target: null,
};

const benchPress: Exercise = {
  id: 'ex_bench',
  name: 'Barbell Bench Press',
  category: 'Free Weights',
  exerciseCategory: 'strength',
  target: 'Chest',
};

const makeDefs = (...exercises: Exercise[]): Map<string, Exercise> =>
  new Map(exercises.map(e => [e.id, e]));

const makeSet = (overrides: Partial<ExerciseSet>): ExerciseSet => ({
  id: 'set-1',
  type: 'normal',
  weight: null,
  reps: null,
  isCompleted: true,
  ...overrides,
});

const makeWorkout = (exerciseId: string, sets: ExerciseSet[]): WorkoutSession => ({
  id: 'workout-1',
  name: 'Test Workout',
  startTime: Date.now(),
  volumeLoad: 0,
  exercises: [{ id: 'we-1', exerciseId, sets }],
});

// ── calculateCardioXP unit tests ────────────────────────────────────────────

describe('calculateCardioXP', () => {
  it('awards 0 XP for an empty workout', () => {
    const workout: WorkoutSession = {
      id: 'w1', name: 'Empty', startTime: 0, volumeLoad: 0, exercises: [],
    };
    expect(calculateCardioXP(workout, makeDefs())).toBe(0);
  });

  it('ignores strength exercises entirely', () => {
    const workout = makeWorkout(benchPress.id, [makeSet({ weight: 200, reps: 5 })]);
    expect(calculateCardioXP(workout, makeDefs(benchPress))).toBe(0);
  });

  it('awards 0 XP for incomplete cardio sets', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds: 600, isCompleted: false })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(0);
  });

  // ── Duration-only ──────────────────────────────────────────────────────────

  it('awards 2 XP per minute: 1 minute = 2 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds: 60 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(2);
  });

  it('awards 2 XP per minute: 5 minutes = 10 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds: 300 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(10);
  });

  it('awards 2 XP per minute: 30 minutes = 60 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds: 1800 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(60);
  });

  it('awards fractional minute XP without flooring input: 90 seconds = 3 XP', () => {
    // 90s / 60 = 1.5 min × 2 = 3 XP
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds: 90 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(3);
  });

  it('awards fractional minute XP: 12.5 minutes = 25 XP', () => {
    // 12.5 min × 60 = 750 s; 750/60 × 2 = 25
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds: 750 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(25);
  });

  // ── Distance-only ──────────────────────────────────────────────────────────

  it('awards 20 XP per mile: 0.5 miles = 10 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ distance: 0.5 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(10);
  });

  it('awards 20 XP per mile: 1 mile = 20 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ distance: 1 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(20);
  });

  it('awards proportional XP for partial distance: 0.25 miles = 5 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ distance: 0.25 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(5);
  });

  it('awards proportional XP for partial distance: 0.75 miles = 15 XP (not rounded down to 0.5)', () => {
    // Must NOT floor distance before calculating: 0.75 × 20 = 15
    const workout = makeWorkout(treadmill.id, [makeSet({ distance: 0.75 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(15);
  });

  it('awards proportional XP for partial distance: 1.2 miles = 24 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ distance: 1.2 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(24);
  });

  it('awards proportional XP for partial distance: 3.5 miles = 70 XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ distance: 3.5 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(70);
  });

  // ── Duration + Distance combined ───────────────────────────────────────────

  it('awards both time and distance XP when both are present', () => {
    // 20 min + 1.5 miles = (20×2) + (1.5×20) = 40 + 30 = 70 XP
    const durationSeconds = 20 * 60;
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds, distance: 1.5 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(70);
  });

  it('awards both for 10.5 min + 0.75 miles = 21 + 15 = 36 XP', () => {
    const durationSeconds = 10.5 * 60; // 630 s
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds, distance: 0.75 })]);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(36);
  });

  // ── Multiple sets and exercises ────────────────────────────────────────────

  it('sums XP across multiple cardio sets', () => {
    const sets: ExerciseSet[] = [
      makeSet({ id: 's1', durationSeconds: 300 }),   // 10 XP
      makeSet({ id: 's2', distance: 1.0 }),            // 20 XP
    ];
    const workout = makeWorkout(treadmill.id, sets);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(30);
  });

  it('sums XP across multiple cardio exercises', () => {
    const workout: WorkoutSession = {
      id: 'w1',
      name: 'Multi-cardio',
      startTime: 0,
      volumeLoad: 0,
      exercises: [
        { id: 'we-1', exerciseId: treadmill.id, sets: [makeSet({ id: 's1', durationSeconds: 300 })] },  // 10 XP
        { id: 'we-2', exerciseId: bike.id, sets: [makeSet({ id: 's2', distance: 1.0 })] },                // 20 XP
      ],
    };
    expect(calculateCardioXP(workout, makeDefs(treadmill, bike))).toBe(30);
  });

  it('skips incomplete sets and only counts completed ones', () => {
    const sets: ExerciseSet[] = [
      makeSet({ id: 's1', durationSeconds: 300, isCompleted: true }),  // 10 XP
      makeSet({ id: 's2', durationSeconds: 600, isCompleted: false }), // 0 XP (incomplete)
    ];
    const workout = makeWorkout(treadmill.id, sets);
    expect(calculateCardioXP(workout, makeDefs(treadmill))).toBe(10);
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  it('is idempotent: calling twice on the same workout returns the same XP', () => {
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds: 600, distance: 1 })]);
    const defs = makeDefs(treadmill);
    const first = calculateCardioXP(workout, defs);
    const second = calculateCardioXP(workout, defs);
    expect(first).toBe(second);
    expect(first).toBe(40); // 20 XP duration + 20 XP distance
  });
});

// ── Integration: cardioXP in calculateWorkoutXP ─────────────────────────────

describe('calculateWorkoutXP with cardio', () => {
  it('includes cardioXP in the finalXP and rawXP totals', () => {
    const durationSeconds = 30 * 60; // 30 min = 60 XP
    const workout = makeWorkout(treadmill.id, [makeSet({ durationSeconds })]);
    const context = {
      seenExerciseIds: new Set([treadmill.id]),
      bestWeights: new Map<string, number>(),
      streakDays: 1,
      exerciseDefs: makeDefs(treadmill),
      userWeight: null,
    };
    const result = calculateWorkoutXP(workout, context);
    expect(result.cardioXP).toBe(60);
    expect(result.rawXP).toBe(BASE_XP + 0 + 60); // base + volume + cardioXP
    expect(result.finalXP).toBeGreaterThan(BASE_XP); // streak multiplier applies on top
  });

  it('cardioXP is 0 for a pure strength workout', () => {
    const workout = makeWorkout(benchPress.id, [makeSet({ weight: 200, reps: 5 })]);
    const context = {
      seenExerciseIds: new Set([benchPress.id]),
      bestWeights: new Map<string, number>(),
      streakDays: 1,
      exerciseDefs: makeDefs(benchPress),
      userWeight: null,
    };
    const result = calculateWorkoutXP(workout, context);
    expect(result.cardioXP).toBe(0);
  });

  it('exposes CARDIO_XP_PER_MINUTE and CARDIO_XP_PER_MILE constants for external reference', () => {
    expect(CARDIO_XP_PER_MINUTE).toBe(2);
    expect(CARDIO_XP_PER_MILE).toBe(20);
  });
});

