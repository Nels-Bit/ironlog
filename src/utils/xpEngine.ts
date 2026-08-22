import type { WorkoutSession, Exercise } from '../types';
import { isRestDaySession } from './achievementUtils';
import { getSetLoad } from './workoutMath';

// ─── Constants ──────────────────────────────────────────────────────────────
export const BASE_XP = 85;
export const VOLUME_XP_PER_THOUSAND = 2;
export const PR_BONUS = 85;
export const NEW_EXERCISE_BONUS = 15;
export const MAX_STREAK_MULTIPLIER = 1.30;
export const STREAK_PER_DAY = 0.01;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Types ──────────────────────────────────────────────────────────────────

/** Itemized XP breakdown for a single completed workout. */
export interface XPBreakdown {
  base: number;
  volume: number;
  prCount: number;
  prBonus: number;
  newExerciseCount: number;
  newExerciseBonus: number;
  rawXP: number;
  streakDays: number;
  multiplier: number;
  streakBonus: number;
  finalXP: number;
  prExerciseNames: string[];
  newExerciseNames: string[];
}

/** Historical context needed to evaluate a single workout's XP. */
export interface XPContext {
  /** Exercise IDs the user has logged in previous workouts. */
  seenExerciseIds: Set<string>;
  /** Best load achieved per exercise across all prior workouts. */
  bestWeights: Map<string, number>;
  /** Current consecutive-day streak at time of this workout. */
  streakDays: number;
  /** Map of exercise ID → Exercise definition. */
  exerciseDefs: Map<string, Exercise>;
  /** User's body weight (for bodyweight/assisted exercise load calc). */
  userWeight: number | null;
}

/** Result of replaying entire workout history for total XP. */
export interface TotalXPResult {
  totalXP: number;
  breakdowns: Map<string, XPBreakdown>;
  currentStreak: number;
}

/** Result for a single workout with before/after totals. */
export interface WorkoutXPResult {
  breakdown: XPBreakdown;
  totalXPBefore: number;
  totalXPAfter: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const normalizeDateKey = (value: number) =>
  new Date(value).toISOString().slice(0, 10);

/** Streak multiplier: 1% per day, capped at 30%. */
export const getStreakMultiplier = (streakDays: number): number =>
  Math.min(1 + streakDays * STREAK_PER_DAY, MAX_STREAK_MULTIPLIER);

// ─── Core: Single Workout XP ───────────────────────────────────────────────

/**
 * Calculate the deterministic XP earned by a single workout,
 * given historical context (seen exercises, best weights, streak).
 */
export const calculateWorkoutXP = (
  workout: WorkoutSession,
  context: XPContext
): XPBreakdown => {
  const { seenExerciseIds, bestWeights, streakDays, exerciseDefs, userWeight } = context;

  // Base
  const base = BASE_XP;

  // Volume: 2 XP per full 1,000 lbs moved
  const volume = Math.floor((workout.volumeLoad || 0) / 1000) * VOLUME_XP_PER_THOUSAND;

  // PR & New Exercise detection
  let prCount = 0;
  let newExerciseCount = 0;
  const prExerciseNames: string[] = [];
  const newExerciseNames: string[] = [];

  for (const ex of workout.exercises) {
    const def = exerciseDefs.get(ex.exerciseId);
    const exerciseName = def?.name || 'Unknown';

    if (!seenExerciseIds.has(ex.exerciseId)) {
      // First time logging this exercise → new exercise bonus, no PR check
      newExerciseCount += 1;
      newExerciseNames.push(exerciseName);
      continue;
    }

    // PR check: only if exercise has historical data (previousBest > 0)
    const previousBest = bestWeights.get(ex.exerciseId) || 0;
    if (previousBest <= 0) continue;

    let currentBest = 0;
    for (const set of ex.sets) {
      if (set.type !== 'normal' || !set.isCompleted) continue;
      const load = getSetLoad(set, def, workout.bodyWeight, userWeight);
      if (load > currentBest) currentBest = load;
    }

    if (currentBest > previousBest) {
      prCount += 1;
      prExerciseNames.push(exerciseName);
    }
  }

  const prBonus = prCount * PR_BONUS;
  const newExerciseBonus = newExerciseCount * NEW_EXERCISE_BONUS;
  const rawXP = base + volume + prBonus + newExerciseBonus;

  // Streak multiplier
  const multiplier = getStreakMultiplier(streakDays);
  const finalXP = Math.round(rawXP * multiplier);
  const streakBonus = finalXP - rawXP;

  return {
    base,
    volume,
    prCount,
    prBonus,
    newExerciseCount,
    newExerciseBonus,
    rawXP,
    streakDays,
    multiplier,
    streakBonus,
    finalXP,
    prExerciseNames,
    newExerciseNames,
  };
};

// ─── Replay: Full History → Total XP ───────────────────────────────────────

/**
 * Replay all workouts chronologically to compute deterministic total XP.
 * Maintains rolling state: seen exercises, best weights, and streak counter.
 */
export const replayAllXP = (
  history: WorkoutSession[],
  exerciseDefs: Map<string, Exercise>,
  userWeight: number | null
): TotalXPResult => {
  // Sort chronologically, keep rest days for streak gap detection
  const allSorted = [...history].sort((a, b) => a.startTime - b.startTime);
  const activeSorted = allSorted.filter(w => !isRestDaySession(w));

  const seenExerciseIds = new Set<string>();
  const bestWeights = new Map<string, number>();
  const breakdowns = new Map<string, XPBreakdown>();

  let totalXP = 0;
  let streakDays = 0;
  let lastActiveDate: string | null = null;

  for (const workout of activeSorted) {
    const workoutDate = normalizeDateKey(workout.startTime);

    // ── Update streak ──────────────────────────────────────────────
    if (lastActiveDate === null) {
      streakDays = 1;
    } else if (workoutDate === lastActiveDate) {
      // Multiple workouts same day — streak unchanged
    } else {
      const prevMs = new Date(`${lastActiveDate}T00:00:00Z`).getTime();
      const currMs = new Date(`${workoutDate}T00:00:00Z`).getTime();
      const dayDiff = Math.round((currMs - prevMs) / DAY_MS);

      if (dayDiff === 1) {
        streakDays += 1;
      } else {
        streakDays = 1; // gap > 1 day → reset
      }
    }

    // ── Calculate XP with snapshot of context ──────────────────────
    const context: XPContext = {
      seenExerciseIds: new Set(seenExerciseIds),
      bestWeights: new Map(bestWeights),
      streakDays,
      exerciseDefs,
      userWeight,
    };

    const breakdown = calculateWorkoutXP(workout, context);
    totalXP += breakdown.finalXP;
    breakdowns.set(workout.id, breakdown);

    // ── Advance rolling state ──────────────────────────────────────
    for (const ex of workout.exercises) {
      seenExerciseIds.add(ex.exerciseId);

      const def = exerciseDefs.get(ex.exerciseId);
      for (const set of ex.sets) {
        if (set.type !== 'normal' || !set.isCompleted) continue;
        const load = getSetLoad(set, def, workout.bodyWeight, userWeight);
        const prev = bestWeights.get(ex.exerciseId) || 0;
        if (load > prev) bestWeights.set(ex.exerciseId, load);
      }
    }

    lastActiveDate = workoutDate;
  }

  return { totalXP, breakdowns, currentStreak: streakDays };
};

// ─── Convenience: Single-Workout with Before/After Totals ──────────────────

/**
 * Get the XP breakdown for a specific workout, plus the user's total XP
 * before and after that workout. Used by the post-workout summary page.
 */
export const getXPForWorkout = (
  workoutId: string,
  history: WorkoutSession[],
  exerciseDefs: Map<string, Exercise>,
  userWeight: number | null
): WorkoutXPResult | null => {
  const result = replayAllXP(history, exerciseDefs, userWeight);
  const breakdown = result.breakdowns.get(workoutId);

  if (!breakdown) return null;

  // Sum XP of all workouts that came before this one
  const activeSorted = [...history]
    .filter(w => !isRestDaySession(w))
    .sort((a, b) => a.startTime - b.startTime);

  let totalXPBefore = 0;
  for (const w of activeSorted) {
    if (w.id === workoutId) break;
    const wb = result.breakdowns.get(w.id);
    if (wb) totalXPBefore += wb.finalXP;
  }

  const totalXPAfter = totalXPBefore + breakdown.finalXP;

  return { breakdown, totalXPBefore, totalXPAfter };
};

