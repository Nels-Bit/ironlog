import { getLevelProgress, isRestDaySession } from './achievementUtils';
import { calculateTrophyCabinet, getRankLabel } from './gamification';
import { getSetLoad, shouldCountSetForPR } from './workoutMath';
import type { Exercise, WorkoutSession } from '../types';

export type FriendMilestoneKind = 'workout_completed' | 'level_up' | 'trophy_unlocked';

export interface FriendMilestoneEvent {
  kind: FriendMilestoneKind;
  /** Stable across retries so each friend receives a particular event only once. */
  eventKey: string;
  achievementName?: string;
}

const activeHistory = (history: WorkoutSession[]) => history.filter(workout => !isRestDaySession(workout));

/** Counts exercises with a valid completed strength PR; no network access required. */
export const countPersonalRecords = (
  history: WorkoutSession[],
  exerciseDefs: Map<string, Exercise>,
  userWeight: number | null
) => {
  const bestLoads = new Map<string, number>();
  for (const workout of history) {
    for (const exercise of workout.exercises) {
      const definition = exerciseDefs.get(exercise.exerciseId);
      for (const set of exercise.sets) {
        if (!shouldCountSetForPR(set, definition, workout.bodyWeight, userWeight)) continue;
        const load = getSetLoad(set, definition, workout.bodyWeight, userWeight);
        if (load > (bestLoads.get(exercise.exerciseId) ?? 0)) bestLoads.set(exercise.exerciseId, load);
      }
    }
  }
  return bestLoads.size;
};

interface Input {
  workoutId: string;
  historyBefore: WorkoutSession[];
  historyAfter: WorkoutSession[];
  exerciseDefs: Map<string, Exercise>;
  totalXPBefore: number;
  totalXPAfter: number;
  prCountBefore: number;
  prCountAfter: number;
}

/**
 * Builds the exact social events earned by one saved workout. Kept pure so
 * level and trophy transitions can be tested without Supabase or a UI.
 */
export const buildFriendMilestoneEvents = ({
  workoutId,
  historyBefore,
  historyAfter,
  exerciseDefs,
  totalXPBefore,
  totalXPAfter,
  prCountBefore,
  prCountAfter
}: Input): FriendMilestoneEvent[] => {
  const events: FriendMilestoneEvent[] = [{
    kind: 'workout_completed',
    eventKey: `workout:${workoutId}`
  }];

  const levelBefore = getLevelProgress(totalXPBefore).currentLevel;
  const levelAfter = getLevelProgress(totalXPAfter).currentLevel;
  if (levelAfter > levelBefore) {
    events.push({
      kind: 'level_up',
      eventKey: `level:${workoutId}:${levelAfter}`,
      achievementName: `Level ${levelAfter}`
    });
  }

  const cabinetBefore = calculateTrophyCabinet({
    history: activeHistory(historyBefore),
    exerciseDefs,
    totalXP: totalXPBefore,
    prCount: prCountBefore
  });
  const cabinetAfter = calculateTrophyCabinet({
    history: activeHistory(historyAfter),
    exerciseDefs,
    totalXP: totalXPAfter,
    prCount: prCountAfter
  });

  for (const afterTrophy of cabinetAfter) {
    const beforeTrophy = cabinetBefore.find(trophy => trophy.category === afterTrophy.category);
    const beforeCount = beforeTrophy?.tiers.filter(tier => tier.unlocked).length ?? 0;
    const afterCount = afterTrophy.tiers.filter(tier => tier.unlocked).length;
    if (afterCount <= beforeCount || afterTrophy.rank === 'locked') continue;

    const achievementName = `${getRankLabel(afterTrophy.rank)} ${afterTrophy.categoryLabel} Trophy`;
    events.push({
      kind: 'trophy_unlocked',
      eventKey: `trophy:${workoutId}:${afterTrophy.category}:${afterCount}`,
      achievementName
    });
  }

  return events;
};
