export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  name: string;
  isPublic: boolean;
  weight?: number;
  height?: number;
  age?: number;
  goal?: 'Strength' | 'Hypertrophy' | 'Endurance' | 'Weight Loss';
  level?: 'Beginner' | 'Intermediate' | 'Pro';
  environment?: 'Gym' | 'Home';
}

export interface SocialProfile {
  authUserId: string;
  userId: string;
  name: string;
  isPublic: boolean;
}

export interface FriendSummary {
  authUserId: string;
  userId: string;
  name: string;
  isPublic: boolean;
}

export interface FriendWithStats {
  authUserId: string;
  userId: string;
  name: string;
  isPublic: boolean;
  totalWorkouts: number;
  totalVolume: number;
  friendsSince: number;
}

export interface FriendRequest {
  id: string;
  requester: FriendSummary;
  addressee: FriendSummary;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: number;
  respondedAt: number | null;
}

export interface NotificationItem {
  id: string;
  type: 'friend_request' | 'friend_request_accepted' | 'workout_completed' | 'achievement_unlocked';
  message: string;
  createdAt: number;
  readAt: number | null;
  actor: FriendSummary | null;
  payload?: Record<string, unknown>;
}

export interface FriendProfileData {
  profile: UserProfile;
  isPrivate: boolean;
  stats?: {
    totalWorkouts: number;
    totalVolume: number;
    topMuscle: string;
  };
  totalXP?: number;
  streak?: number;
  achievements?: { lift: string; label: string; currentWeight: number; threshold: number }[];
  recentWorkouts?: WorkoutSession[];
}

export type SetType = 'normal' | 'warmup' | 'dropset' | 'dropset_child' | 'failure';
export type ExerciseCategory = 'strength' | 'cardio' | 'mobility';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  exerciseCategory?: ExerciseCategory;
  target?: string | null;
  isCustom?: boolean;
  isUnilateral?: boolean | null;
}

export interface ExerciseSet {
  id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  repsLeft?: number | null;
  repsRight?: number | null;
  distance?: number | null;
  durationSeconds?: number | null;
  pace?: number | null;
  caloriesBurned?: number | null;
  incline?: number | null;
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