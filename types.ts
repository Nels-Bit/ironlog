
export interface ExerciseSet {
  id: string;
  weight: number;
  reps: number;
  repsLeft?: number;
  repsRight?: number;
  completed: boolean;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  distance?: number;
  time?: number;
}

export type ExerciseCategory = 'Free Weight' | 'Cable' | 'Machine' | 'Bodyweight' | 'Cardio' | 'Other';

export interface Exercise {
  id: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
  category?: ExerciseCategory;
  isUnilateral?: boolean;
}

export interface WorkoutSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  exercises: Exercise[];
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface AIWorkoutPlan {
    workoutName: string;
    exercises: {
        name: string;
        sets: number;
        reps: number;
        suggestedWeight?: string;
        category?: ExerciseCategory;
        isUnilateral?: boolean;
    }[];
}

export type UserSex = 'Male' | 'Female' | 'Other';
export type UserFrequency = '1-3' | '4-5' | '6+';
export type UserGoal = 'Strength' | 'Endurance' | 'Aesthetics' | 'Overall';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Stored locally for mock auth
  
  // Profile Stats
  weight?: number; // lbs
  heightFt?: number;
  heightIn?: number;
  sex?: UserSex;
  frequency?: UserFrequency;
  goal?: UserGoal;
  allowAI?: boolean;
}
