import { supabase } from '../lib/supabase';
import { exerciseService } from './exerciseService';
import { getLevelProgress, calculateWorkoutStreak, calculateStrengthAchievements } from '../utils/achievementUtils';
import { replayAllXP, getXPForWorkout } from '../utils/xpEngine';
import { parseUserWeight } from '../utils/workoutMath';
import type { FriendRequest, FriendSummary, FriendWithStats, NotificationItem, SocialProfile, FriendProfileData, WorkoutSession, UserProfile, Exercise } from '../types';

type UserProfileRow = {
  user_id: string;
  user_code: string;
  display_name: string;
  is_public: boolean;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  responded_at: string | null;
};

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: 'friend_request' | 'friend_request_accepted' | 'workout_completed' | 'achievement_unlocked';
  message: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const isMissingSocialSchemaError = (error: { message?: string } | null): boolean => {
  if (!error?.message) return false;
  return error.message.includes('Could not find the function public.ensure_current_user_profile')
    || error.message.includes("relation 'public.user_profiles' does not exist")
    || error.message.includes('relation "public.user_profiles" does not exist')
    || error.message.includes("relation 'public.notifications' does not exist")
    || error.message.includes('relation "public.notifications" does not exist')
    || error.message.includes("relation 'public.friendships' does not exist")
    || error.message.includes('relation "public.friendships" does not exist')
    || error.message.includes('function gen_random_bytes(integer) does not exist');
};

const toSummary = (row: UserProfileRow): FriendSummary => ({
  authUserId: row.user_id,
  userId: row.user_code,
  name: row.display_name,
  isPublic: row.is_public
});

const profileMapFromRows = (rows: UserProfileRow[]) => {
  const map = new Map<string, UserProfileRow>();
  rows.forEach((row) => map.set(row.user_id, row));
  return map;
};

const getCurrentAuthUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in.');
  return user.id;
};

const ensureCurrentSocialProfileRow = async (): Promise<UserProfileRow> => {
  const { data, error } = await supabase.rpc('ensure_current_user_profile');
  if (error) {
    if (isMissingSocialSchemaError(error)) {
      throw new Error('Social features are not available yet. Run the latest Supabase migration first.');
    }
    throw error;
  }
  return data as UserProfileRow;
};

const fetchProfilesByAuthUserIds = async (userIds: string[]): Promise<Map<string, UserProfileRow>> => {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, user_code, display_name, is_public')
    .in('user_id', userIds);

  if (error) throw error;
  return profileMapFromRows((data ?? []) as UserProfileRow[]);
};

const mapFriendRequest = (
  row: FriendshipRow,
  profiles: Map<string, UserProfileRow>
): FriendRequest => {
  const requester = profiles.get(row.requester_id);
  const addressee = profiles.get(row.addressee_id);

  if (!requester || !addressee) {
    throw new Error('Friend request references unknown profile.');
  }

  return {
    id: row.id,
    requester: toSummary(requester),
    addressee: toSummary(addressee),
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : null
  };
};

export const socialService = {
  async getMySocialProfile(): Promise<SocialProfile> {
    const row = await ensureCurrentSocialProfileRow();
    return {
      authUserId: row.user_id,
      userId: row.user_code,
      name: row.display_name,
      isPublic: row.is_public
    };
  },

  async searchPublicUsers(query: string): Promise<FriendSummary[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const currentUserId = await getCurrentAuthUserId();
    const searchValue = `%${trimmed}%`;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, user_code, display_name, is_public')
      .eq('is_public', true)
      .neq('user_id', currentUserId)
      .or(`user_code.ilike.${searchValue},display_name.ilike.${searchValue}`)
      .limit(20);

    if (error) throw error;
    return ((data ?? []) as UserProfileRow[]).map(toSummary);
  },

  async sendFriendRequest(targetUserId: string): Promise<void> {
    const selfProfile = await ensureCurrentSocialProfileRow();
    if (!selfProfile.is_public) {
      throw new Error('Set your profile to public before sending friend requests.');
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('user_profiles')
      .select('user_id, user_code, display_name, is_public')
      .eq('user_code', targetUserId.trim())
      .single();

    if (targetError) throw targetError;

    const typedTarget = targetProfile as UserProfileRow;
    if (!typedTarget.is_public) {
      throw new Error('This profile is private and cannot receive friend requests.');
    }

    if (typedTarget.user_id === selfProfile.user_id) {
      throw new Error('You cannot send a friend request to yourself.');
    }

    const { error } = await supabase
      .from('friendships')
      .insert({
        requester_id: selfProfile.user_id,
        addressee_id: typedTarget.user_id,
        status: 'pending'
      });

    if (error) throw error;

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: typedTarget.user_id,
        actor_id: selfProfile.user_id,
        type: 'friend_request',
        message: `${selfProfile.display_name} sent you a friend request.`,
        payload: { userId: selfProfile.user_code }
      });

    if (notificationError) throw notificationError;
  },

  async getIncomingFriendRequests(): Promise<FriendRequest[]> {
    const currentUserId = await getCurrentAuthUserId();

    const { data, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at, responded_at')
      .eq('addressee_id', currentUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as FriendshipRow[];
    const profileIds = rows.flatMap((row) => [row.requester_id, row.addressee_id]);
    const profileMap = await fetchProfilesByAuthUserIds(profileIds);

    return rows.map((row) => mapFriendRequest(row, profileMap));
  },

  async getOutgoingFriendRequests(): Promise<FriendRequest[]> {
    const currentUserId = await getCurrentAuthUserId();

    const { data, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at, responded_at')
      .eq('requester_id', currentUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as FriendshipRow[];
    const profileIds = rows.flatMap((row) => [row.requester_id, row.addressee_id]);
    const profileMap = await fetchProfilesByAuthUserIds(profileIds);

    return rows.map((row) => mapFriendRequest(row, profileMap));
  },

  async respondToFriendRequest(requestId: string, accept: boolean): Promise<void> {
    const currentUserId = await getCurrentAuthUserId();
    const nextStatus = accept ? 'accepted' : 'declined';

    const { data: requestRow, error: requestError } = await supabase
      .from('friendships')
      .update({
        status: nextStatus,
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('addressee_id', currentUserId)
      .eq('status', 'pending')
      .select('id, requester_id, addressee_id, status, created_at, responded_at')
      .single();

    if (requestError) throw requestError;
    const typedRequest = requestRow as FriendshipRow;

    if (accept) {
      const profileMap = await fetchProfilesByAuthUserIds([currentUserId]);
      const actor = profileMap.get(currentUserId);
      const actorName = actor?.display_name || 'A friend';

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: typedRequest.requester_id,
          actor_id: currentUserId,
          type: 'friend_request_accepted',
          message: `${actorName} accepted your friend request.`,
          payload: { friendshipId: typedRequest.id }
        });

      if (notificationError) throw notificationError;
    }
  },

  async getFriendsWithStats(): Promise<FriendWithStats[]> {
    const currentUserId = await getCurrentAuthUserId();

    const { data, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at, responded_at')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

    if (error) throw error;
    const rows = (data ?? []) as FriendshipRow[];
    const friendIds = rows.map((row) => row.requester_id === currentUserId ? row.addressee_id : row.requester_id);
    if (friendIds.length === 0) {
      return [];
    }
    const uniqueFriendIds = Array.from(new Set(friendIds));
    const profileMap = await fetchProfilesByAuthUserIds(uniqueFriendIds);

    const { data: workoutRows, error: workoutError } = await supabase
      .from('workouts')
      .select('user_id, volume_load')
      .in('user_id', uniqueFriendIds);

    if (workoutError) throw workoutError;

    const statsMap = new Map<string, { totalWorkouts: number; totalVolume: number }>();
    (workoutRows ?? []).forEach((row: { user_id: string; volume_load: number | null }) => {
      const current = statsMap.get(row.user_id) ?? { totalWorkouts: 0, totalVolume: 0 };
      current.totalWorkouts += 1;
      current.totalVolume += row.volume_load ?? 0;
      statsMap.set(row.user_id, current);
    });

    return rows.map((row) => {
      const friendAuthUserId = row.requester_id === currentUserId ? row.addressee_id : row.requester_id;
      const friendProfile = profileMap.get(friendAuthUserId);
      if (!friendProfile) {
        throw new Error('Friend profile is missing.');
      }

      const stats = statsMap.get(friendAuthUserId) ?? { totalWorkouts: 0, totalVolume: 0 };

      return {
        authUserId: friendProfile.user_id,
        userId: friendProfile.user_code,
        name: friendProfile.display_name,
        isPublic: friendProfile.is_public,
        totalWorkouts: stats.totalWorkouts,
        totalVolume: stats.totalVolume,
        friendsSince: new Date(row.responded_at ?? row.created_at).getTime()
      };
    });
  },

  async getNotifications(): Promise<NotificationItem[]> {
    const currentUserId = await getCurrentAuthUserId();

    const { data, error } = await supabase
      .from('notifications')
      .select('id, recipient_id, actor_id, type, message, payload, read_at, created_at')
      .eq('recipient_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const rows = (data ?? []) as NotificationRow[];
    const actorIds = rows
      .map((row) => row.actor_id)
      .filter((actorId): actorId is string => Boolean(actorId));
    const actorMap = await fetchProfilesByAuthUserIds(actorIds);

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      payload: row.payload || undefined,
      createdAt: new Date(row.created_at).getTime(),
      readAt: row.read_at ? new Date(row.read_at).getTime() : null,
      actor: row.actor_id && actorMap.get(row.actor_id) ? toSummary(actorMap.get(row.actor_id) as UserProfileRow) : null
    }));
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const currentUserId = await getCurrentAuthUserId();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', currentUserId)
      .is('read_at', null);

    if (error) throw error;
  },

  async markAllNotificationsAsRead(): Promise<void> {
    const currentUserId = await getCurrentAuthUserId();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', currentUserId)
      .is('read_at', null);

    if (error) throw error;
  },

  async getUnreadNotificationCount(): Promise<number> {
    const currentUserId = await getCurrentAuthUserId();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUserId)
      .is('read_at', null);

    if (error) {
      if (isMissingSocialSchemaError(error)) {
        return 0;
      }
      throw error;
    }
    return count ?? 0;
  },

  async getFriendProfile(friendUserCode: string): Promise<FriendProfileData> {
    console.log('[getFriendProfile] Requested user code:', friendUserCode);
    
    // 1. Fetch friend's profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_code', friendUserCode)
      .single();

    if (profileError) throw profileError;
    if (!profileData) throw new Error('Profile not found.');

    console.log('[getFriendProfile] Profile data retrieved:', profileData);

    const userProfile: UserProfile = {
      id: profileData.user_id,
      userId: profileData.user_code,
      name: profileData.display_name,
      email: '', // Not strictly needed for public view
      isPublic: profileData.is_public,
      weight: profileData.weight || undefined,
      height: profileData.height || undefined,
      age: profileData.age || undefined,
      goal: profileData.goal || undefined,
      level: profileData.level || undefined,
      environment: profileData.environment || undefined
    };

    if (!userProfile.isPublic) {
      console.log('[getFriendProfile] Profile is private. Returning early.');
      return { profile: userProfile, isPrivate: true };
    }

    // 2. Fetch workout history
    const { data: workouts, error: workoutsError } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', profileData.user_id)
      .order('start_time', { ascending: false });

    if (workoutsError) throw workoutsError;

    console.log('[getFriendProfile] Raw workouts fetched for user', profileData.user_id, ':', workouts);

    const history: WorkoutSession[] = (workouts ?? []).map(w => {
      let parsedExercises = w.exercises;
      if (typeof parsedExercises === 'string') {
        try { parsedExercises = JSON.parse(parsedExercises); } catch (e) { parsedExercises = []; }
      }
      return {
        id: w.id,
        name: w.name,
        startTime: Number(w.start_time),
        endTime: w.end_time ? Number(w.end_time) : undefined,
        volumeLoad: w.volume_load,
        exercises: Array.isArray(parsedExercises) ? (parsedExercises as import('../types').WorkoutExercise[]) : [],
        bodyWeight: w.body_weight || undefined
      };
    });

    history.sort((a, b) => b.startTime - a.startTime); // sort descending as requested by user

    // 3. Compute stats
    const { data: exercisesData } = await supabase
      .from('exercises')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${profileData.user_id}`);
      
    const allExercises: import('../types').Exercise[] = (exercisesData ?? []).map(ex => ({
      id: ex.id,
      name: ex.name,
      category: ex.category,
      target: ex.target_muscle,
      isCustom: ex.user_id === profileData.user_id,
      isUnilateral: ex.is_unilateral ?? undefined
    }));
    
    const defMap = new Map<string, import('../types').Exercise>(allExercises.map(e => [e.id, e]));
    
    const userWeight = parseUserWeight(userProfile.weight);
    const xp = replayAllXP(history, defMap, userWeight);
    const streakResult = calculateWorkoutStreak(history);
    const strengthAchievements = calculateStrengthAchievements(history, defMap);

    const totalWorkouts = history.length;
    const totalVolume = history.reduce((sum, w) => sum + w.volumeLoad, 0);

    const muscleCounts = new Map<string, number>();
    history.forEach(w => {
      w.exercises.forEach(ex => {
        const def = defMap.get(ex.exerciseId);
        if (def && ex.sets.some(s => s.isCompleted && s.type !== 'warmup')) {
          const m = def.target || def.category || 'Unknown';
          muscleCounts.set(m, (muscleCounts.get(m) || 0) + 1);
        }
      });
    });
    const topMuscle = Array.from(muscleCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Last 3 workouts for preview
    const recentWorkouts = [...history].sort((a, b) => b.startTime - a.startTime).slice(0, 3);

    return {
      profile: userProfile,
      isPrivate: false,
      stats: { totalWorkouts, totalVolume, topMuscle },
      totalXP: xp.totalXP,
      streak: streakResult.currentStreak,
      achievements: strengthAchievements.filter(a => a.unlocked),
      recentWorkouts
    };
  },

  async dispatchFriendMilestones(workoutId: string): Promise<void> {
    try {
      const currentAuthId = await getCurrentAuthUserId();

      // 1. Get history and this workout
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', currentAuthId)
        .order('start_time', { ascending: true });

      if (workoutsError || !workoutsData) return;

      const history: WorkoutSession[] = workoutsData.map(w => ({
        id: w.id,
        name: w.name,
        startTime: w.start_time,
        endTime: w.end_time || undefined,
        volumeLoad: w.volume_load,
        exercises: Array.isArray(w.exercises) ? (w.exercises as import('../types').WorkoutExercise[]) : [],
        bodyWeight: w.body_weight || undefined
      }));

      const allExercises = await exerciseService.getAllExercises();
      const defMap = new Map<string, Exercise>(allExercises.map(e => [e.id, e]));
      
      const { data: myProfileData } = await supabase.from('user_profiles').select('*').eq('user_id', currentAuthId).single();
      if (!myProfileData) return;

      const userWeight = parseUserWeight(myProfileData.weight);

      // 2. XP & Achievements before vs after
      const xpResult = getXPForWorkout(workoutId, history, defMap, userWeight);
      if (!xpResult) return;

      const nextLevelProg = getLevelProgress(xpResult.totalXPAfter);
      
      const prevAchievements = calculateStrengthAchievements(history.filter(w => w.id !== workoutId && w.startTime <= history.find(hw => hw.id === workoutId)!.startTime), defMap).filter(a => a.unlocked);
      const currAchievements = calculateStrengthAchievements(history.filter(w => w.startTime <= history.find(hw => hw.id === workoutId)!.startTime), defMap).filter(a => a.unlocked);
      
      const newlyUnlocked = currAchievements.filter(curr => !prevAchievements.some(prev => prev.lift === curr.lift && prev.threshold === curr.threshold));

      // 3. Find friends
      const { data: friendsData } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentAuthId},addressee_id.eq.${currentAuthId}`);
      
      if (!friendsData || friendsData.length === 0) return;
      const friendIds = friendsData.map(f => f.requester_id === currentAuthId ? f.addressee_id : f.requester_id);

      // 4. Dispatch
      const notifications: Omit<NotificationRow, 'id' | 'created_at' | 'read_at'>[] = [];

      // Workout Completion
      friendIds.forEach(fId => {
        notifications.push({
          recipient_id: fId,
          actor_id: currentAuthId,
          type: 'workout_completed',
          message: `${myProfileData.display_name} just finished a workout and is ${nextLevelProg.xpToNext} XP away from Level ${nextLevelProg.currentLevel + 1}`,
          payload: { remainingXP: nextLevelProg.xpToNext, nextLevel: nextLevelProg.currentLevel + 1, userId: myProfileData.user_code }
        });
      });

      // Achievement Unlocks
      newlyUnlocked.forEach(ach => {
        friendIds.forEach(fId => {
          notifications.push({
            recipient_id: fId,
            actor_id: currentAuthId,
            type: 'achievement_unlocked',
            message: `${myProfileData.display_name} just earned ${ach.currentWeight}lb ${ach.label}`,
            payload: { achievementName: `${ach.currentWeight}lb ${ach.label}`, userId: myProfileData.user_code }
          });
        });
      });

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    } catch (err) {
      console.error('Error dispatching milestones', err);
    }
  }
};
