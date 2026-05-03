import type { Exercise, WorkoutSession } from './types'; // <--- Added "type" keyword

export const EXERCISE_LIBRARY: Exercise[] = [
  // CHEST
  { id: 'ex_bench_barbell', name: 'Barbell Bench Press', target: 'chest', category: 'barbell' },
  { id: 'ex_incline_db', name: 'Incline Dumbbell Press', target: 'chest', category: 'dumbbell' },
  { id: 'ex_fly_cable', name: 'Cable Chest Fly', target: 'chest', category: 'cable' },
  
  // BACK
  { id: 'ex_deadlift', name: 'Deadlift', target: 'back', category: 'barbell' },
  { id: 'ex_pullup', name: 'Weighted Pull-Up', target: 'back', category: 'bodyweight' },
  { id: 'ex_row_barbell', name: 'Bent Over Row', target: 'back', category: 'barbell' },

  // LEGS
  { id: 'ex_squat', name: 'Back Squat', target: 'legs', category: 'barbell' },
  { id: 'ex_lunge', name: 'Walking Lunge', target: 'legs', category: 'dumbbell' },
  { id: 'ex_leg_ext', name: 'Leg Extension', target: 'legs', category: 'machine' },

  // SHOULDERS
  { id: 'ex_ohp', name: 'Overhead Press', target: 'shoulders', category: 'barbell' },
  { id: 'ex_lat_raise', name: 'Lateral Raise', target: 'shoulders', category: 'dumbbell' },

  // ARMS
  { id: 'ex_curl_barbell', name: 'Barbell Curl', target: 'arms', category: 'barbell' },
  { id: 'ex_tricep_push', name: 'Tricep Pushdown', target: 'arms', category: 'cable' },
];

// Initial Empty State for a new workout
export const NEW_WORKOUT_TEMPLATE: WorkoutSession = {
  id: '',
  name: 'New Workout',
  startTime: Date.now(),
  exercises: [],
  volumeLoad: 0,
};