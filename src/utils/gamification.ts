import type { WorkoutSession, Exercise } from '../types';
import { getLevelProgress, getLevelRequirementXP } from './achievementUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TrophyRank = 'locked' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'obsidian';

export type TrophyCategory =
  | 'bench_press'
  | 'squat'
  | 'deadlift'
  | 'volume'
  | 'pr_hunter'
  | 'level';

export interface TrophyTier {
  /** The milestone value (lbs, count, or level number). */
  value: number;
  /** Human-readable label for this tier. */
  label: string;
  /** ISO date string or null if not yet earned. */
  earnedAt: number | null;
  /** Whether this tier has been unlocked. */
  unlocked: boolean;
}

export interface CategoryTrophy {
  category: TrophyCategory;
  /** Display name shown on the card. */
  categoryLabel: string;
  /** Emoji icon for the category. */
  emoji: string;
  /** Current visual rank of the highest unlocked tier. */
  rank: TrophyRank;
  /** Index of the current highest unlocked tier (0-based), or -1 if locked. */
  currentTierIndex: number;
  /** The label of the highest unlocked tier (e.g. "225 lbs"). */
  currentTierLabel: string | null;
  /** The label of the next tier (e.g. "275 lbs"), or null if maxed. */
  nextTierLabel: string | null;
  /** Progress percentage (0–100) toward the next tier. */
  progressPercent: number;
  /** Full ordered list of all tiers (for the detail modal). */
  tiers: TrophyTier[];
}

// ─── Ladder Definitions ────────────────────────────────────────────────────

const BENCH_LADDER = [95, 135, 185, 225, 275, 315, 365, 405, 455, 505] as const;
const SQUAT_LADDER = [135, 185, 225, 275, 315, 365, 405, 455, 495, 545] as const;
const DEADLIFT_LADDER = [135, 225, 275, 315, 365, 405, 455, 495, 545, 585] as const;
export const VOLUME_LADDER = [10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000] as const;
export const PR_LADDER = [5, 10, 25, 50, 100, 250] as const;
export const LEVEL_LADDER = [5, 10, 15, 20, 30, 50, 100] as const;

// ─── Rank Mapping ─────────────────────────────────────────────────────────
// Maps 1-based tier index (1 = first threshold unlocked) to a rank.

const RANK_FOR_TIER: TrophyRank[] = [
  'bronze',   // tier 1
  'bronze',   // tier 2
  'silver',   // tier 3
  'silver',   // tier 4
  'gold',     // tier 5
  'gold',     // tier 6
  'platinum', // tier 7
  'platinum', // tier 8
  'diamond',  // tier 9
  'obsidian', // tier 10+
];

function getTrophyRank(unlockedTierCount: number): TrophyRank {
  if (unlockedTierCount <= 0) return 'locked';
  const idx = Math.min(unlockedTierCount - 1, RANK_FOR_TIER.length - 1);
  return RANK_FOR_TIER[idx];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M lbs`;
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(0)}k lbs`;
  return `${lbs.toLocaleString()} lbs`;
}

// ─── Lift Trophy Calculator ────────────────────────────────────────────────

interface LiftConfig {
  category: TrophyCategory;
  label: string;
  emoji: string;
  names: string[];
  ladder: readonly number[];
}

function calcLiftTrophy(
  config: LiftConfig,
  history: WorkoutSession[],
  exerciseDefs: Map<string, Exercise>
): CategoryTrophy {
  const { category, label, emoji, names, ladder } = config;

  // Match exercise IDs for this lift type
  const matchedIds = new Set(
    Array.from(exerciseDefs.values())
      .filter(ex => names.some(n => ex.name.toLowerCase().includes(n)))
      .map(ex => ex.id)
  );

  // Build a chronologically-sorted history
  const sorted = [...history].sort((a, b) => a.startTime - b.startTime);

  // Track per-threshold first-unlock dates
  const tierUnlockTimes = new Map<number, number>(); // threshold → startTime
  let bestWeight = 0;

  for (const workout of sorted) {
    const workoutMax = workout.exercises
      .filter(ex => matchedIds.has(ex.exerciseId))
      .flatMap(ex => ex.sets)
      .reduce((best, set) => {
        const w = typeof set.weight === 'number' && !Number.isNaN(set.weight) ? set.weight : 0;
        return w > best ? w : best;
      }, 0);

    if (workoutMax <= 0) continue;

    bestWeight = Math.max(bestWeight, workoutMax);

    for (const threshold of ladder) {
      if (workoutMax >= threshold && !tierUnlockTimes.has(threshold)) {
        tierUnlockTimes.set(threshold, workout.startTime);
      }
    }
  }

  // Build tiers array
  const tiers: TrophyTier[] = ladder.map(threshold => ({
    value: threshold,
    label: `${threshold} lbs`,
    earnedAt: tierUnlockTimes.get(threshold) ?? null,
    unlocked: tierUnlockTimes.has(threshold),
  }));

  const unlockedCount = tiers.filter(t => t.unlocked).length;
  const currentTierIndex = unlockedCount - 1;
  const currentTier = unlockedCount > 0 ? tiers[currentTierIndex] : null;
  const nextTier = unlockedCount < tiers.length ? tiers[unlockedCount] : null;

  // Progress toward next tier
  const fromWeight = currentTier ? currentTier.value : 0;
  const toWeight = nextTier ? nextTier.value : null;
  let progressPercent = 100;
  if (toWeight !== null) {
    const range = toWeight - fromWeight;
    const achieved = Math.max(0, bestWeight - fromWeight);
    progressPercent = range > 0 ? Math.min(100, (achieved / range) * 100) : 0;
  }

  return {
    category,
    categoryLabel: label,
    emoji,
    rank: getTrophyRank(unlockedCount),
    currentTierIndex,
    currentTierLabel: currentTier?.label ?? null,
    nextTierLabel: nextTier?.label ?? null,
    progressPercent,
    tiers,
  };
}

// ─── Volume Trophy Calculator ──────────────────────────────────────────────

function calcVolumeTrophy(history: WorkoutSession[]): CategoryTrophy {
  const sorted = [...history].sort((a, b) => a.startTime - b.startTime);
  const tierUnlockTimes = new Map<number, number>();
  let cumulativeVolume = 0;

  for (const workout of sorted) {
    cumulativeVolume += workout.volumeLoad || 0;
    for (const threshold of VOLUME_LADDER) {
      if (cumulativeVolume >= threshold && !tierUnlockTimes.has(threshold)) {
        tierUnlockTimes.set(threshold, workout.startTime);
      }
    }
  }

  const tiers: TrophyTier[] = VOLUME_LADDER.map(threshold => ({
    value: threshold,
    label: formatVolume(threshold),
    earnedAt: tierUnlockTimes.get(threshold) ?? null,
    unlocked: tierUnlockTimes.has(threshold),
  }));

  const unlockedCount = tiers.filter(t => t.unlocked).length;
  const currentTierIndex = unlockedCount - 1;
  const currentTier = unlockedCount > 0 ? tiers[currentTierIndex] : null;
  const nextTier = unlockedCount < tiers.length ? tiers[unlockedCount] : null;

  const fromVol = currentTier ? currentTier.value : 0;
  const toVol = nextTier ? nextTier.value : null;
  let progressPercent = 100;
  if (toVol !== null) {
    const range = toVol - fromVol;
    const achieved = Math.max(0, cumulativeVolume - fromVol);
    progressPercent = range > 0 ? Math.min(100, (achieved / range) * 100) : 0;
  }

  return {
    category: 'volume',
    categoryLabel: 'Volume Moved',
    emoji: '⚖️',
    rank: getTrophyRank(unlockedCount),
    currentTierIndex,
    currentTierLabel: currentTier?.label ?? null,
    nextTierLabel: nextTier?.label ?? null,
    progressPercent,
    tiers,
  };
}

// ─── PR Hunter Trophy Calculator ──────────────────────────────────────────

function calcPRTrophy(prCount: number): CategoryTrophy {
  const tiers: TrophyTier[] = PR_LADDER.map(threshold => ({
    value: threshold,
    label: `${threshold} PRs`,
    earnedAt: null, // No per-PR timestamps available in the current data model
    unlocked: prCount >= threshold,
  }));

  const unlockedCount = tiers.filter(t => t.unlocked).length;
  const currentTierIndex = unlockedCount - 1;
  const currentTier = unlockedCount > 0 ? tiers[currentTierIndex] : null;
  const nextTier = unlockedCount < tiers.length ? tiers[unlockedCount] : null;

  const fromPR = currentTier ? currentTier.value : 0;
  const toPR = nextTier ? nextTier.value : null;
  let progressPercent = 100;
  if (toPR !== null) {
    const range = toPR - fromPR;
    const achieved = Math.max(0, prCount - fromPR);
    progressPercent = range > 0 ? Math.min(100, (achieved / range) * 100) : 0;
  }

  return {
    category: 'pr_hunter',
    categoryLabel: 'PR Hunter',
    emoji: '🎯',
    rank: getTrophyRank(unlockedCount),
    currentTierIndex,
    currentTierLabel: currentTier?.label ?? null,
    nextTierLabel: nextTier?.label ?? null,
    progressPercent,
    tiers,
  };
}

// ─── Level Trophy Calculator ───────────────────────────────────────────────

function calcLevelTrophy(
  totalXP: number,
  history: WorkoutSession[],
  xpBreakdowns: Map<string, { finalXP: number }> | null
): CategoryTrophy {
  const { currentLevel } = getLevelProgress(totalXP);

  // Compute per-level unlock dates if XP breakdowns are available
  const tierUnlockTimes = new Map<number, number>();

  if (xpBreakdowns) {
    const sorted = [...history].sort((a, b) => a.startTime - b.startTime);
    let cumulativeXP = 0;

    for (const workout of sorted) {
      const bd = xpBreakdowns.get(workout.id);
      if (bd) cumulativeXP += bd.finalXP;
      for (const levelTarget of LEVEL_LADDER) {
        if (!tierUnlockTimes.has(levelTarget)) {
          const required = getLevelRequirementXP(levelTarget);
          if (cumulativeXP >= required) {
            tierUnlockTimes.set(levelTarget, workout.startTime);
          }
        }
      }
    }
  }

  const tiers: TrophyTier[] = LEVEL_LADDER.map(levelTarget => ({
    value: levelTarget,
    label: `Level ${levelTarget}`,
    earnedAt: tierUnlockTimes.get(levelTarget) ?? null,
    unlocked: currentLevel >= levelTarget,
  }));

  const unlockedCount = tiers.filter(t => t.unlocked).length;
  const currentTierIndex = unlockedCount - 1;
  const currentTier = unlockedCount > 0 ? tiers[currentTierIndex] : null;
  const nextTier = unlockedCount < tiers.length ? tiers[unlockedCount] : null;

  // For the progress bar, use XP progress within the current game level
  const xpProgress = getLevelProgress(totalXP).progressPercent;

  return {
    category: 'level',
    categoryLabel: 'Level Reached',
    emoji: '👑',
    rank: getTrophyRank(unlockedCount),
    currentTierIndex,
    currentTierLabel: currentTier?.label ?? null,
    nextTierLabel: nextTier?.label ?? null,
    progressPercent: nextTier ? xpProgress : 100,
    tiers,
  };
}

// ─── Main Export: calculateTrophyCabinet ──────────────────────────────────

export interface TrophyCabinetInput {
  history: WorkoutSession[];
  exerciseDefs: Map<string, Exercise>;
  totalXP: number;
  prCount: number;
  /** Optional pre-computed XP breakdowns per workout (for level unlock dates). */
  xpBreakdowns?: Map<string, { finalXP: number }> | null;
}

/**
 * Calculates the full Trophy Cabinet for a user — exactly 6 category trophies
 * with progressive tier ladders, rank assignments, and progress bars.
 */
export function calculateTrophyCabinet(input: TrophyCabinetInput): CategoryTrophy[] {
  const { history, exerciseDefs, totalXP, prCount, xpBreakdowns = null } = input;

  const liftConfigs: LiftConfig[] = [
    {
      category: 'bench_press',
      label: 'Bench Press',
      emoji: '🏋️',
      names: ['bench press', 'barbell bench press', 'dumbbell bench press', 'weighted bench press', 'incline bench'],
      ladder: BENCH_LADDER,
    },
    {
      category: 'squat',
      label: 'Squat',
      emoji: '🦵',
      names: ['squat', 'back squat', 'front squat', 'barbell squat', 'goblet squat'],
      ladder: SQUAT_LADDER,
    },
    {
      category: 'deadlift',
      label: 'Deadlift',
      emoji: '💪',
      names: ['deadlift', 'barbell deadlift', 'romanian deadlift', 'sumo deadlift', 'rdl'],
      ladder: DEADLIFT_LADDER,
    },
  ];

  return [
    ...liftConfigs.map(cfg => calcLiftTrophy(cfg, history, exerciseDefs)),
    calcVolumeTrophy(history),
    calcPRTrophy(prCount),
    calcLevelTrophy(totalXP, history, xpBreakdowns ?? null),
  ];
}
