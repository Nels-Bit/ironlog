export interface UserProfile {
  id: string;
  email: string;
  name: string;
  weight?: number;
  height?: number;
  age?: number;
  goal?: 'Strength' | 'Hypertrophy' | 'Endurance' | 'Weight Loss';
  level?: 'Beginner' | 'Intermediate' | 'Pro';
  environment?: 'Gym' | 'Home';
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  target: string;
  isCustom?: boolean;
  isUnilateral?: boolean;
}

export interface ExerciseSet {
  id: string;
  type: 'normal' | 'warmup' | 'dropset' | 'dropset_child' | 'failure';
  weight: number | null;
  reps: number | null;
  repsLeft?: number | null;
  repsRight?: number | null;
  isCompleted: boolean;
  previousBest?: number;
  parentSetId?: string;
  bodyWeight?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: ExerciseSet[];
}

export interface WorkoutSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  volumeLoad: number;
  exercises: WorkoutExercise[];
  bodyWeight?: number;
}