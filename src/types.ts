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

export interface FriendProfileDetails {
  authUserId: string;
  userId: string;
  name: string;
  isPublic: boolean;
  totalWorkouts: number;
  totalVolume: number;
  recentWorkouts: WorkoutSession[];
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
  type: 'friend_request' | 'friend_request_accepted';
  message: string;
  createdAt: number;
  readAt: number | null;
  actor: FriendSummary | null;
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