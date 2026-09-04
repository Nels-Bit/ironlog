import { describe, it, expect } from 'vitest';
import {
  calculateTrophyCabinet,
  VOLUME_LADDER,
  PR_LADDER,
  LEVEL_LADDER,
  type TrophyCabinetInput,
} from '../src/utils/gamification';
import type { WorkoutSession, Exercise } from '../src/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeWorkout = (
  id: string,
  startTime: number,
  volumeLoad: number,
  exercises: WorkoutSession['exercises'] = []
): WorkoutSession => ({
  id,
  name: 'Test Workout',
  startTime,
  endTime: startTime + 3600000,
  volumeLoad,
  exercises,
});

const makeExercise = (id: string, name: string): Exercise => ({
  id,
  name,
  category: 'strength',
  exerciseCategory: 'strength',
});

const makeSet = (weight: number, reps = 5): WorkoutSession['exercises'][0]['sets'][0] => ({
  id: crypto.randomUUID(),
  type: 'normal',
  weight,
  reps,
  isCompleted: true,
});

const DAY = 24 * 60 * 60 * 1000;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateTrophyCabinet', () => {
  describe('returns exactly 6 category trophies', () => {
    it('returns 6 trophies for empty history', () => {
      const result = calculateTrophyCabinet({
        history: [],
        exerciseDefs: new Map(),
        totalXP: 0,
        prCount: 0,
      });
      expect(result).toHaveLength(6);
    });

    it('returns trophies with correct categories', () => {
      const result = calculateTrophyCabinet({
        history: [],
        exerciseDefs: new Map(),
        totalXP: 0,
        prCount: 0,
      });
      const categories = result.map(t => t.category);
      expect(categories).toContain('bench_press');
      expect(categories).toContain('squat');
      expect(categories).toContain('deadlift');
      expect(categories).toContain('volume');
      expect(categories).toContain('pr_hunter');
      expect(categories).toContain('level');
    });
  });

  describe('Locked state when no milestones hit', () => {
    it('all trophies are locked with 0 history and 0 XP', () => {
      const result = calculateTrophyCabinet({
        history: [],
        exerciseDefs: new Map(),
        totalXP: 0,
        prCount: 0,
      });
      result.forEach(trophy => {
        expect(trophy.rank).toBe('locked');
        expect(trophy.currentTierIndex).toBe(-1);
        expect(trophy.currentTierLabel).toBeNull();
      });
    });
  });

  describe('Bench Press Ladder', () => {
    const benchDef = makeExercise('bench-id', 'Barbell Bench Press');
    const defs = new Map([['bench-id', benchDef]]);

    it('unlocks first dirt tier at 45 lbs', () => {
      const history = [
        makeWorkout('w1', Date.now() - DAY, 500, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(45, 5)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.rank).toBe('dirt');
      expect(bench.currentTierLabel).toBe('45 lbs');
      expect(bench.currentTierIndex).toBe(0);
    });

    it('unlocks bronze at 115 lbs (tier 4)', () => {
      const history = [
        makeWorkout('w1', Date.now() - 3 * DAY, 1000, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(65, 5)] },
        ]),
        makeWorkout('w2', Date.now() - 2 * DAY, 1200, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(115, 3)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.rank).toBe('bronze');
      expect(bench.currentTierLabel).toBe('115 lbs');
    });

    it('unlocks gold at 275 lbs (tier 8)', () => {
      const history = [
        makeWorkout('w1', Date.now() - DAY, 5000, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(275, 1)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.rank).toBe('gold');
    });

    it('unlocks platinum at 365 lbs (tier 10)', () => {
      const history = [
        makeWorkout('w1', Date.now() - DAY, 8000, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(365, 1)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.rank).toBe('platinum');
    });

    it('unlocks diamond at 455 lbs (tier 12)', () => {
      const history = [
        makeWorkout('w1', Date.now() - DAY, 10000, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(455, 1)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.rank).toBe('diamond');
    });

    it('unlocks elite at 545 lbs (tier 14)', () => {
      const history = [
        makeWorkout('w1', Date.now() - DAY, 12000, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(545, 1)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.rank).toBe('elite');
      expect(bench.nextTierLabel).toBeNull();
      expect(bench.progressPercent).toBe(100);
    });
  });

  describe('Volume Ladder', () => {
    it('locks when no workouts', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 0 });
      const volume = result.find(t => t.category === 'volume')!;
      expect(volume.rank).toBe('locked');
    });

    it('unlocks dirt tier at 1k lbs cumulative', () => {
      const history = [
        makeWorkout('w1', Date.now() - 2 * DAY, 500),
        makeWorkout('w2', Date.now() - DAY, 500),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: new Map(), totalXP: 0, prCount: 0 });
      const volume = result.find(t => t.category === 'volume')!;
      expect(volume.rank).toBe('dirt');
      expect(volume.currentTierLabel).toBe('1k lbs');
    });

    it('has correct label for 1M lbs tier', () => {
      const result = calculateTrophyCabinet({
        history: [makeWorkout('w1', Date.now(), 1_500_000)],
        exerciseDefs: new Map(),
        totalXP: 0,
        prCount: 0,
      });
      const volume = result.find(t => t.category === 'volume')!;
      // Should have unlocked up to the 1M tier (tier 10 = platinum)
      expect(volume.rank).toBe('platinum');
      // formatVolume uses toFixed(1) for millions
      expect(volume.currentTierLabel).toBe('1.0M lbs');
    });
  });

  describe('PR Hunter Ladder', () => {
    it('locks when 0 PRs', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 0 });
      const pr = result.find(t => t.category === 'pr_hunter')!;
      expect(pr.rank).toBe('locked');
    });

    it('unlocks wood at 5 PRs', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 5 });
      const pr = result.find(t => t.category === 'pr_hunter')!;
      expect(pr.rank).toBe('wood');
      expect(pr.currentTierLabel).toBe('5 PRs');
    });

    it('unlocks bronze at 15 PRs (tier 4)', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 15 });
      const pr = result.find(t => t.category === 'pr_hunter')!;
      expect(pr.rank).toBe('bronze');
    });

    it('maxes out at 500 PRs — elite', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 500 });
      const pr = result.find(t => t.category === 'pr_hunter')!;
      expect(pr.rank).toBe('elite');
      expect(pr.nextTierLabel).toBeNull();
      expect(pr.progressPercent).toBe(100);
    });
  });

  describe('Level Ladder', () => {
    it('locks when XP is 0', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 0 });
      const level = result.find(t => t.category === 'level')!;
      expect(level.rank).toBe('locked');
    });

    it('unlocks wood max at Level 5', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 2200, prCount: 0 });
      const level = result.find(t => t.category === 'level')!;
      expect(level.rank).toBe('wood_max');
      expect(level.currentTierLabel).toBe('Level 5');
    });

    it('has correct tier structure', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 0 });
      const level = result.find(t => t.category === 'level')!;
      expect(level.tiers).toHaveLength(LEVEL_LADDER.length);
      expect(level.tiers[0].label).toBe('Level 5');
      expect(level.tiers[level.tiers.length - 1].label).toBe('Level 100');
    });
  });

  describe('Progress percentage', () => {
    it('is 0 for locked trophy', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      // Locked: progress should be 0 (no weight achieved)
      expect(bench.progressPercent).toBe(0);
    });

    it('is 100 for maxed-out trophy', () => {
      const benchDef = makeExercise('bench-id', 'Barbell Bench Press');
      const defs = new Map([['bench-id', benchDef]]);
      const history = [
        makeWorkout('w1', Date.now(), 12000, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(505, 1)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.progressPercent).toBe(100);
    });

    it('is between 0 and 100 for partial progress', () => {
      const benchDef = makeExercise('bench-id', 'Barbell Bench Press');
      const defs = new Map([['bench-id', benchDef]]);
      // 160 lbs bench — past 135 (tier 2), not yet at 185 (tier 3)
      const history = [
        makeWorkout('w1', Date.now(), 3000, [
          { id: 'e1', exerciseId: 'bench-id', sets: [makeSet(160, 3)] },
        ]),
      ];
      const result = calculateTrophyCabinet({ history, exerciseDefs: defs, totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      expect(bench.progressPercent).toBeGreaterThan(0);
      expect(bench.progressPercent).toBeLessThan(100);
    });
  });

  describe('Tier tiers array structure', () => {
    it('all trophies have correct tiers count', () => {
      const result = calculateTrophyCabinet({ history: [], exerciseDefs: new Map(), totalXP: 0, prCount: 0 });
      const bench = result.find(t => t.category === 'bench_press')!;
      const squat = result.find(t => t.category === 'squat')!;
      const dead = result.find(t => t.category === 'deadlift')!;
      const volume = result.find(t => t.category === 'volume')!;
      const pr = result.find(t => t.category === 'pr_hunter')!;
      const level = result.find(t => t.category === 'level')!;

      expect(bench.tiers).toHaveLength(10);
      expect(squat.tiers).toHaveLength(10);
      expect(dead.tiers).toHaveLength(10);
      expect(volume.tiers).toHaveLength(VOLUME_LADDER.length);
      expect(pr.tiers).toHaveLength(PR_LADDER.length);
      expect(level.tiers).toHaveLength(LEVEL_LADDER.length);
    });
  });
});
