import { supabase } from '../lib/supabase';
import type { FriendProfileDetails, FriendRequest, FriendSummary, FriendWithStats, NotificationItem, SocialProfile, WorkoutSession } from '../types';

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
  type: 'friend_request' | 'friend_request_accepted';
  message: string;
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
      .select('id, recipient_id, actor_id, type, message, read_at, created_at')
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

  async getFriendProfile(userCodeOrId: string): Promise<FriendProfileDetails | null> {
    const trimmed = userCodeOrId.trim();
    if (!trimmed) return null;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('user_id, user_code, display_name, is_public')
      .or(`user_code.eq.${trimmed},user_id.eq.${trimmed}`)
      .maybeSingle();

    if (error || !profile) return null;

    const typedProfile = profile as UserProfileRow;

    if (!typedProfile.is_public) {
      return {
        authUserId: typedProfile.user_id,
        userId: typedProfile.user_code,
        name: typedProfile.display_name,
        isPublic: false,
        totalWorkouts: 0,
        totalVolume: 0,
        recentWorkouts: []
      };
    }

    const [workoutsCountRes, recentWorkoutsRes] = await Promise.all([
      supabase
        .from('workouts')
        .select('volume_load')
        .eq('user_id', typedProfile.user_id),
      supabase
        .from('workouts')
        .select('id, name, start_time, end_time, volume_load, exercises')
        .eq('user_id', typedProfile.user_id)
        .order('start_time', { ascending: false })
        .limit(3)
    ]);

    const allWorkouts = (workoutsCountRes.data ?? []) as { volume_load: number | null }[];
    const totalWorkouts = allWorkouts.length;
    const totalVolume = allWorkouts.reduce((sum, w) => sum + (w.volume_load || 0), 0);

    const recentWorkouts: WorkoutSession[] = ((recentWorkoutsRes.data ?? []) as Array<{
      id: string;
      name: string;
      start_time: number | string;
      end_time?: number | string | null;
      volume_load?: number | null;
      exercises?: WorkoutSession['exercises'];
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      startTime: Number(row.start_time),
      endTime: row.end_time ? Number(row.end_time) : undefined,
      volumeLoad: row.volume_load || 0,
      exercises: row.exercises || []
    }));

    return {
      authUserId: typedProfile.user_id,
      userId: typedProfile.user_code,
      name: typedProfile.display_name,
      isPublic: true,
      totalWorkouts,
      totalVolume,
      recentWorkouts
    };
  }
};
