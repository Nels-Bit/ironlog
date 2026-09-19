import { describe, expect, it } from 'vitest';
import { buildFriendMilestoneEvents, countPersonalRecords } from '../src/utils/friendMilestones';
import type { Exercise, WorkoutSession } from '../src/types';

const workout = (id: string, startTime: number, exercises: WorkoutSession['exercises'] = []): WorkoutSession => ({
  id,
  name: 'Training',
  startTime,
  endTime: startTime + 3_600_000,
  volumeLoad: 0,
  exercises
});

const bench: Exercise = { id: 'bench', name: 'Bench Press', category: 'Free Weights', exerciseCategory: 'strength' };
const definitions = new Map([[bench.id, bench]]);

describe('friend milestone events', () => {
  it('always creates one stable workout-completed event', () => {
    const after = [workout('saved-workout', 1_000)];
    const events = buildFriendMilestoneEvents({
      workoutId: 'saved-workout', historyBefore: [], historyAfter: after, exerciseDefs: definitions,
      totalXPBefore: 0, totalXPAfter: 85, prCountBefore: 0, prCountAfter: 0
    });

    expect(events).toContainEqual({ kind: 'workout_completed', eventKey: 'workout:saved-workout' });
    expect(events.filter(event => event.kind === 'workout_completed')).toHaveLength(1);
    expect(events).toContainEqual({
      kind: 'trophy_unlocked', eventKey: 'trophy:saved-workout:workouts:1', achievementName: 'Dirt Workouts Trophy'
    });
  });

  it('reports a level-up and the first workouts trophy', () => {
    const before = [workout('one', 1_000), workout('two', 2_000), workout('three', 3_000)];
    const after = [...before, workout('four', 4_000)];
    const events = buildFriendMilestoneEvents({
      workoutId: 'four', historyBefore: before, historyAfter: after, exerciseDefs: definitions,
      totalXPBefore: 300, totalXPAfter: 400, prCountBefore: 0, prCountAfter: 0
    });

    expect(events).toContainEqual({ kind: 'level_up', eventKey: 'level:four:2', achievementName: 'Level 2' });
    expect(events).toContainEqual({
      kind: 'trophy_unlocked', eventKey: 'trophy:four:level:1', achievementName: 'Dirt Level Reached Trophy'
    });
  });

  it('counts valid PR exercises but excludes cardio from PR trophies', () => {
    const history = [workout('lift', 1_000, [{
      id: 'bench-block', exerciseId: 'bench', sets: [{ id: 'set', type: 'failure', weight: 225, reps: 3, isCompleted: true }]
    }])];
    const cardio: Exercise = { id: 'run', name: 'Run', category: 'Cardio', exerciseCategory: 'cardio' };
    history[0].exercises.push({
      id: 'run-block', exerciseId: 'run', sets: [{ id: 'run-set', type: 'normal', weight: null, reps: null, distance: 3, durationSeconds: 1_800, isCompleted: true }]
    });

    expect(countPersonalRecords(history, new Map([...definitions, [cardio.id, cardio]]), null)).toBe(1);
  });
});
