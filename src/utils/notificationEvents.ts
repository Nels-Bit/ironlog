import type { Exercise, WorkoutSession } from "../types.js";
import type { NotificationCategory } from "./notifications.js";
import { getWorkoutExercises } from "./workoutSchema.js";
import { getBestPRPerformance, parseUserWeight } from "./workoutMath.js";
import { formatPRPerformance } from "./exerciseLogging.js";
import {
  buildFriendMilestoneEvents,
  countPersonalRecords,
} from "./friendMilestones.js";
import { replayAllXP } from "./xpEngine.js";
import { calculateWorkoutStreak, isRestDaySession } from "./achievementUtils.js";

export interface PlannedNotification {
  category: NotificationCategory;
  type: string;
  event_key: string;
  title: string;
  body: string;
  target_type: string;
  target_id: string;
  audience: "self" | "friends";
}
export interface WorkoutEventSnapshot {
  workouts: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
  weight?: unknown;
}
/** Only the trusted completion worker calls this with a database-captured snapshot.
 * UI mounts, edited history and client PR claims cannot generate these events. */
export function buildWorkoutNotifications(
  workoutId: string,
  snapshot: WorkoutEventSnapshot,
): PlannedNotification[] {
  const history: WorkoutSession[] = snapshot.workouts.map((w) => ({
    id: String(w.id),
    name: String(w.name || "Workout"),
    startTime: Number(w.start_time),
    endTime: Number(w.end_time) || undefined,
    volumeLoad: Number(w.volume_load) || 0,
    bodyWeight: parseUserWeight(w.body_weight) ?? undefined,
    exercises: getWorkoutExercises(w.exercises),
  }));
  const saved = history.find((w) => w.id === workoutId);
  if (
    !saved?.endTime ||
    isRestDaySession(saved) ||
    !saved.exercises.some((e) => e.sets.some((s) => s.isCompleted))
  )
    return [];
  const defs = new Map<string, Exercise>(
    snapshot.exercises.map((e) => [
      String(e.id),
      {
        id: String(e.id),
        name: String(e.name),
        category: String(e.category),
        target: String(e.target_muscle || ""),
        exerciseCategory:
          e.exercise_category === "cardio" ||
          String(e.category).toLowerCase() === "cardio"
            ? "cardio"
            : "strength",
        isUnilateral: e.is_unilateral === true,
      },
    ]),
  );
  const weight = parseUserWeight(snapshot.weight);
  const after = history.filter(
    (w) => w.endTime && w.startTime <= saved.startTime,
  );
  const before = after.filter((w) => w.id !== workoutId);
  const xpBefore = replayAllXP(before, defs, weight),
    xpAfter = replayAllXP(after, defs, weight);
  const milestones = buildFriendMilestoneEvents({
    workoutId,
    historyBefore: before,
    historyAfter: after,
    exerciseDefs: defs,
    totalXPBefore: xpBefore.totalXP,
    totalXPAfter: xpAfter.totalXP,
    prCountBefore: countPersonalRecords(before, defs, weight),
    prCountAfter: countPersonalRecords(after, defs, weight),
  });
  const events: PlannedNotification[] = [];
  const exercises = saved.exercises.filter((e) =>
    e.sets.some((s) => s.isCompleted),
  ).length;
  events.push({
    category: "friend_workout",
    type: "workout_completed",
    event_key: `workout:${workoutId}`,
    title: "Workout completed",
    body: `${saved.name} · ${exercises} exercises completed`,
    target_type: "friend_workout",
    target_id: workoutId,
    audience: "friends",
  });
  for (const milestone of milestones.filter(
    (m) => m.kind !== "workout_completed",
  )) {
    const level = milestone.kind === "level_up";
    events.push({
      category: level ? "personal_level" : "personal_achievement",
      type: level ? "level_up" : "achievement_unlocked",
      event_key: milestone.eventKey,
      title: level ? "Level up!" : "Trophy earned",
      body: milestone.achievementName || "New milestone",
      target_type: "progress",
      target_id: workoutId,
      audience: "self",
    });
    events.push({
      category: "friend_achievement",
      type: level ? "level_up" : "achievement_unlocked",
      event_key: milestone.eventKey,
      title: level ? "leveled up" : "earned a trophy",
      body: milestone.achievementName || "New milestone",
      target_type: "friend_profile",
      target_id: workoutId,
      audience: "friends",
    });
  }
  for (const exerciseId of new Set(saved.exercises.map((e) => e.exerciseId))) {
    const def = defs.get(exerciseId);
    const historical = getBestPRPerformance(
      before.flatMap((w) =>
        w.exercises
          .filter((e) => e.exerciseId === exerciseId)
          .flatMap((e) => e.sets),
      ),
      def,
      undefined,
      weight,
    );
    const current = getBestPRPerformance(
      saved.exercises
        .filter((e) => e.exerciseId === exerciseId)
        .flatMap((e) => e.sets),
      def,
      saved.bodyWeight,
      weight,
    );
    if (!current.set || current.load <= historical.load) continue;
    const body = `${def?.name || "Exercise"} · ${formatPRPerformance(current, def)}`;
    events.push({
      category: "personal_pr",
      type: "personal_record",
      event_key: `pr:${workoutId}:${exerciseId}`,
      title: "New personal record!",
      body,
      target_type: "workout",
      target_id: workoutId,
      audience: "self",
    });
    events.push({
      category: "friend_pr",
      type: "personal_record",
      event_key: `pr:${workoutId}:${exerciseId}`,
      title: "set a personal record",
      body,
      target_type: "friend_profile",
      target_id: workoutId,
      audience: "friends",
    });
  }
  // Same UI streak rules at completion time, not the possibly delayed worker clock.
  const streak = calculateWorkoutStreak(after, saved.endTime).currentStreak;
  if (
    [3, 7, 14, 30, 60, 100, 365].includes(streak) &&
    streak > calculateWorkoutStreak(before, saved.endTime).currentStreak
  ) {
    events.push({
      category: "personal_streak",
      type: "streak_milestone",
      event_key: `streak:${workoutId}:${streak}`,
      title: `${streak}-day streak!`,
      body: "Your consistency is paying off.",
      target_type: "progress",
      target_id: workoutId,
      audience: "self",
    });
  }
  return events.map((event) => ({
    ...event,
    title: event.title.slice(0, 200),
    body: event.body.slice(0, 600),
  }));
}
