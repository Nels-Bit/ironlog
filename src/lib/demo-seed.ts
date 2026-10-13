import type { User } from '@supabase/supabase-js';
import type { DemoSeed, DemoRow } from './demo-transport';

/** Fictional recruiter preview. Relative dates keep the activity calendar useful. */
export function createIronLogSeed(now = Date.now()): DemoSeed {
  const people = [
    { user_id: 'demo-alex', user_code: 'demo_alex', display_name: 'Alex Morgan', is_public: true, weight: 178, height: 71, age: 27, goal: 'Hypertrophy', level: 'Intermediate', environment: 'Gym' },
    { user_id: 'demo-jordan', user_code: 'demo_jordan', display_name: 'Jordan Lee', is_public: true, weight: 165 },
    { user_id: 'demo-taylor', user_code: 'demo_taylor', display_name: 'Taylor Reed', is_public: true, weight: 145 },
    { user_id: 'demo-casey', user_code: 'demo_casey', display_name: 'Casey Chen', is_public: true, weight: 170 },
    { user_id: 'demo-riley', user_code: 'demo_riley', display_name: 'Riley Brooks', is_public: true, weight: 155 },
  ];
  const exercises = [
    ['bench', 'Barbell Bench Press', 'Chest', 'Chest'], ['squat', 'Barbell Squat', 'Legs', 'Quads'],
    ['deadlift', 'Deadlift', 'Back', 'Back'], ['row', 'Dumbbell Row', 'Back', 'Back'],
    ['press', 'Overhead Press', 'Shoulders', 'Shoulders'], ['curl', 'Dumbbell Curl', 'Arms', 'Biceps'],
    ['pullup', 'Pull Up', 'Back', 'Back'], ['run', 'Treadmill Run', 'Cardio', 'Cardio'],
  ].map(([id, name, category, target_muscle]) => ({ id: `demo-${id}`, name, category, target_muscle, user_id: null, is_unilateral: id === 'row' || id === 'curl' }));
  const workouts: DemoRow[] = people.slice(0, 4).flatMap((person, personIndex) => Array.from({ length: 30 }, (_, index) => {
    const start = new Date(now); start.setDate(start.getDate() - (29 - index) * 2 - personIndex); start.setHours(17, 30, 0, 0);
    const ids = index % 3 === 0 ? ['bench', 'press', 'curl'] : index % 3 === 1 ? ['squat', 'deadlift'] : ['row', 'pullup'];
    let volume = 0;
    const logged = ids.map((id, exerciseIndex) => ({ id: `demo-ex-${personIndex}-${index}-${id}`, exerciseId: `demo-${id}`, sets: Array.from({ length: 3 }, (_, setIndex) => {
      const weight = id === 'pullup' ? 178 : [115, 155, 95][exerciseIndex] + Math.floor(index / 6) * 5 - personIndex * 5;
      const reps = 8 + (index + setIndex) % 3;
      volume += weight * reps;
      return { id: `demo-set-${personIndex}-${index}-${id}-${setIndex}`, type: 'normal', weight, reps, isCompleted: true, bodyWeight: person.weight };
    }) }));
    return { id: `demo-workout-${personIndex}-${index}`, user_id: person.user_id, name: ['Push Day', 'Lower Body', 'Pull Day'][index % 3], start_time: start.getTime(), end_time: start.getTime() + 48 * 60_000, volume_load: volume, exercises: logged };
  }));
  const created_at = new Date(now - 2 * 86400_000).toISOString();
  return {
    user: { id: 'demo-alex', email: 'alex@example.invalid', aud: 'demo', created_at, app_metadata: {}, user_metadata: { name: 'Alex Morgan', weight: 178, height: 71, age: 27, goal: 'Hypertrophy', level: 'Intermediate', environment: 'Gym' } } as User,
    profileTable: 'user_profiles',
    tables: {
      user_profiles: people, workouts, exercises,
      friendships: [
        { id: 'demo-friend-1', requester_id: 'demo-alex', addressee_id: 'demo-jordan', status: 'accepted', created_at, responded_at: created_at },
        { id: 'demo-friend-2', requester_id: 'demo-taylor', addressee_id: 'demo-alex', status: 'accepted', created_at, responded_at: created_at },
        { id: 'demo-friend-3', requester_id: 'demo-casey', addressee_id: 'demo-alex', status: 'pending', created_at, responded_at: null },
      ],
      notifications: [
        { id: 'demo-note-1', recipient_id: 'demo-alex', actor_id: 'demo-jordan', type: 'workout_completed', message: 'Jordan Lee finished a Pull Day workout.', payload: { userId: 'demo_jordan' }, read_at: null, created_at },
        { id: 'demo-note-2', recipient_id: 'demo-alex', actor_id: 'demo-casey', type: 'friend_request', message: 'Casey Chen sent you a friend request.', payload: { userId: 'demo_casey' }, read_at: null, created_at },
      ],
    },
  };
}
