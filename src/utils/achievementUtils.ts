import type { Exercise, WorkoutSession } from '../types';

export interface StreakSummary {
  currentStreak: number;
  lastWorkoutDate: string | null;
  longestStreak: number;
}

export interface StrengthAchievement {
  lift: 'bench' | 'squat' | 'deadlift';
  label: string;
  threshold: number;
  previousThreshold: number;
  currentWeight: number;
  progressPercent: number;
  achievedAt: number | null;
  achievedDateLabel: string | null;
  unlocked: boolean;
  nextThreshold: number | null;
}

export interface LevelProgress {
  currentLevel: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNext: number;
  progressPercent: number;
  totalXP: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const XP_BASE = 120;
const XP_STEP = 25;

const normalizeDateKey = (value: number) => new Date(value).toISOString().slice(0, 10);
const getDateKeyForToday = () => normalizeDateKey(Date.now());

const countStreakEndingAt = (activeDays: Set<string>, endDateKey: string) => {
  let streak = 0;
  let cursor = new Date(`${endDateKey}T00:00:00.000Z`).getTime();

  while (activeDays.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1;
    cursor -= DAY_MS;
  }

  return streak;
};

export const isRestDaySession = (session: WorkoutSession) => session.name.toLowerCase().includes('rest day');

const getNextLevelXP = (level: number) => XP_BASE + ((level - 1) * XP_STEP);

export const getLevelRequirementXP = (level: number) => {
  let requiredXP = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    requiredXP += getNextLevelXP(currentLevel);
  }
  return requiredXP;
};

export const getLevelProgress = (totalXP: number): LevelProgress => {
  let currentLevel = 1;
  let xpSpent = 0;

  while (true) {
    const xpForNextLevel = getNextLevelXP(currentLevel);
    if (xpSpent + xpForNextLevel > totalXP) break;
    xpSpent += xpForNextLevel;
    currentLevel += 1;
  }

  const xpForNextLevel = getNextLevelXP(currentLevel);
  const xpIntoLevel = totalXP - xpSpent;
  const xpToNext = Math.max(0, xpForNextLevel - xpIntoLevel);

  return {
    currentLevel,
    xpIntoLevel,
    xpForNextLevel,
    xpToNext,
    progressPercent: xpForNextLevel > 0 ? (xpIntoLevel / xpForNextLevel) * 100 : 0,
    totalXP
  };
};

const formatDateLabel = (value: number | null) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const calculateWorkoutStreak = (history: WorkoutSession[]): StreakSummary => {
  const todayKey = getDateKeyForToday();
  const yesterdayKey = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
  const activeDays = new Set(history.filter(session => !isRestDaySession(session)).map(workout => normalizeDateKey(workout.startTime)));
  const sortedActiveDays = Array.from(activeDays).sort((a, b) => b.localeCompare(a));
  const hasWorkoutToday = sortedActiveDays.includes(todayKey);
  const hasRestToday = history.some(session => isRestDaySession(session) && normalizeDateKey(session.startTime) === todayKey);

  if (sortedActiveDays.length === 0) {
    return { currentStreak: 0, lastWorkoutDate: null, longestStreak: 0 };
  }

  let streak = 1;
  let longestStreak = 1;
  let currentRun = 1;

  const ascendingDays = [...sortedActiveDays].sort((a, b) => a.localeCompare(b));

  for (let index = 1; index < ascendingDays.length; index += 1) {
    const current = new Date(ascendingDays[index]).getTime();
    const previous = new Date(ascendingDays[index - 1]).getTime();
    if (current - previous === DAY_MS) {
      currentRun += 1;
    } else {
      longestStreak = Math.max(longestStreak, currentRun);
      currentRun = 1;
    }
  }

  longestStreak = Math.max(longestStreak, currentRun);

  for (let index = 0; index < sortedActiveDays.length - 1; index += 1) {
    const current = new Date(sortedActiveDays[index]).getTime();
    const next = new Date(sortedActiveDays[index + 1]).getTime();
    if (current - next === DAY_MS) {
      streak += 1;
    } else {
      break;
    }
  }

  const latestActiveDay = sortedActiveDays[0];
  const activeYesterdayOrToday = latestActiveDay === todayKey || latestActiveDay === yesterdayKey;

  if (!hasWorkoutToday && !hasRestToday) {
    return {
      currentStreak: 0,
      lastWorkoutDate: latestActiveDay,
      longestStreak
    };
  }

  if (hasRestToday && !hasWorkoutToday && !activeYesterdayOrToday) {
    return {
      currentStreak: 0,
      lastWorkoutDate: null,
      longestStreak
    };
  }

  const streakEndDate = hasWorkoutToday ? todayKey : latestActiveDay;
  const currentStreak = countStreakEndingAt(activeDays, streakEndDate);

  return {
    currentStreak,
    lastWorkoutDate: streakEndDate,
    longestStreak
  };
};

export const calculateStrengthAchievements = (history: WorkoutSession[], exerciseDefs: Map<string, Exercise>) => {
  const liftMap: Array<{ lift: 'bench' | 'squat' | 'deadlift'; label: string; names: string[]; thresholds: number[] }> = [
    { lift: 'bench', label: 'Bench Press', names: ['bench press', 'barbell bench press', 'dumbbell bench press', 'weighted bench press'], thresholds: [135, 225, 315, 405] },
    { lift: 'squat', label: 'Squat', names: ['squat', 'back squat', 'front squat', 'barbell squat'], thresholds: [135, 225, 315, 405] },
    { lift: 'deadlift', label: 'Deadlift', names: ['deadlift', 'barbell deadlift', 'romanian deadlift'], thresholds: [135, 225, 315, 405] }
  ];

  return liftMap.map(({ lift, label, names, thresholds }) => {
    const matchingExerciseIds = new Set(
      Array.from(exerciseDefs.values())
        .filter(exercise => names.some(name => exercise.name.toLowerCase().includes(name)))
        .map(exercise => exercise.id)
    );

    let bestThreshold = 0;
    let achievedAt: number | null = null;
    let bestWeight = 0;

    [...history].sort((a, b) => a.startTime - b.startTime).forEach(workout => {
      const workoutMax = workout.exercises
        .filter(exercise => matchingExerciseIds.has(exercise.exerciseId))
        .flatMap(exercise => exercise.sets)
        .reduce((best, set) => {
          const weight = typeof set.weight === 'number' && !Number.isNaN(set.weight) ? set.weight : 0;
          return weight > best ? weight : best;
        }, 0);

      bestWeight = Math.max(bestWeight, workoutMax);

      thresholds.forEach(threshold => {
        if (workoutMax >= threshold && threshold > bestThreshold) {
          bestThreshold = threshold;
          achievedAt = workout.startTime;
        }
      });
    });

    const nextThreshold = thresholds.find(threshold => threshold > bestThreshold) ?? null;
    const previousThreshold = thresholds.filter(threshold => threshold <= bestThreshold).at(-1) ?? 0;
    const progressPercent = nextThreshold
      ? Math.max(0, Math.min(100, (bestWeight / nextThreshold) * 100))
      : 100;

    return {
      lift,
      label,
      threshold: bestThreshold,
      previousThreshold,
      currentWeight: bestWeight,
      progressPercent,
      achievedAt,
      achievedDateLabel: formatDateLabel(achievedAt),
      unlocked: bestThreshold > 0,
      nextThreshold
    };
  });
};

export const formatStreakLabel = (streak: number) => {
  if (streak === 1) return '1 day';
  return `${streak} days`;
};
