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
import { isRestDaySession } from "./achievementUtils.js";
import { barbellLiftNames, getBarbellLift, type BarbellLift } from "./barbellLifts.js";

export interface PlannedNotification {
  category: NotificationCategory;
  type: string;
  event_key: string;
  title: string;
  body: string;
  target_type: string;
  target_id: string;
  audience: "self" | "friends";
  /** Matching lift trophy only; the server rechecks each recipient's switches. */
  award_body?: string;
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
  // One PR per standard lift; a merged definition cannot manufacture a record.
  for (const lift of Object.keys(barbellLiftNames) as BarbellLift[]) {
    const liftIds = new Set([...defs.values()].filter(def => getBarbellLift(def) === lift).map(def => def.id));
    const currentEntries = saved.exercises.filter(exercise => liftIds.has(exercise.exerciseId));
    if (!currentEntries.length) continue;
    const def = defs.get(currentEntries[0].exerciseId);
    const historical = getBestPRPerformance(
      before.flatMap((w) =>
        w.exercises
          .filter((e) => liftIds.has(e.exerciseId))
          .flatMap((e) => e.sets),
      ),
      def,
      undefined,
      weight,
    );
    const current = getBestPRPerformance(
      currentEntries.flatMap((e) => e.sets),
      def,
      saved.bodyWeight,
      weight,
    );
    if (!current.set || current.load <= historical.load) continue;
    const body = `${barbellLiftNames[lift]} · ${formatPRPerformance(current, def)}`;
    const trophyIndex = events.findIndex(event => event.event_key.startsWith(`trophy:${workoutId}:${lift}:`));
    const trophy = trophyIndex >= 0 ? events.splice(trophyIndex, 1)[0] : undefined;
    events.push({
      category: "friend_pr",
      type: "personal_record",
      event_key: `pr:${workoutId}:${lift}`,
      title: "set a personal record",
      body,
      target_type: "friend_profile",
      target_id: workoutId,
      audience: "friends",
      ...(trophy ? {award_body: trophy.body} : {}),
    });
  }
  return events.map((event) => ({
    ...event,
    title: event.title.slice(0, 200),
    body: event.body.slice(0, 600),
  }));
}
