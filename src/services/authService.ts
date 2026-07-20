import { supabase } from '../lib/supabase'; // <--- THIS WAS MISSING
import type { UserProfile } from '../types';

const normalizeHeightInInches = (height: unknown): number | undefined => {
  const parsed = typeof height === 'number' ? height : typeof height === 'string' ? parseFloat(height) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;

  // Legacy data was stored in cm; convert obvious cm values to inches.
  if (parsed > 120) {
    return Math.round(parsed / 2.54);
  }

  return Math.round(parsed);
};

type SocialProfileRow = {
  user_id: string;
  user_code: string;
  display_name: string;
  is_public: boolean;
};

const isMissingSocialSchemaError = (error: { message?: string } | null): boolean => {
  if (!error?.message) return false;
  return error.message.includes('Could not find the function public.ensure_current_user_profile')
    || error.message.includes("relation 'public.user_profiles' does not exist")
    || error.message.includes('relation "public.user_profiles" does not exist')
    || error.message.includes('function gen_random_bytes(integer) does not exist');
};

const ensureCurrentSocialProfile = async (): Promise<SocialProfileRow | null> => {
  const { data, error } = await supabase.rpc('ensure_current_user_profile');
  if (error) {
    if (isMissingSocialSchemaError(error)) {
      return null;
    }
    throw new Error(`Unable to load social profile. Please run the latest database migration. ${error.message}`);
  }
  return (data as SocialProfileRow) ?? null;
};

export const authService = {
  
  async getUser(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    // We combine the Auth ID/Email with the Metadata (Name, Weight, etc.)
    const meta = user.user_metadata || {};
    const socialProfile = await ensureCurrentSocialProfile();
    const fallbackUserId = `user_${user.id.slice(0, 8)}`;
    const fallbackName = user.email?.split('@')[0] || 'Athlete';

    return {
      id: user.id,
      userId: socialProfile?.user_code || fallbackUserId,
      email: user.email || '',
      name: meta.name || socialProfile?.display_name || fallbackName,
      isPublic: socialProfile?.is_public ?? false,
      weight: meta.weight,
      height: normalizeHeightInInches(meta.height),
      age: meta.age,
      goal: meta.goal || 'Strength',
      level: meta.level || 'Beginner',
      environment: meta.environment || 'Gym'
    };
  },

  async updateProfile(updates: Partial<UserProfile>) {
    // We save profile data into Supabase's "user_metadata" JSON field
    const { error } = await supabase.auth.updateUser({
      data: {
        name: updates.name,
        weight: updates.weight,
        height: updates.height ? Math.round(updates.height) : updates.height,
        age: updates.age,
        goal: updates.goal,
        level: updates.level,
        environment: updates.environment
      }
    });

    if (error) throw error;

    const socialUpdates: { display_name?: string; is_public?: boolean } = {};
    if (typeof updates.name === 'string') {
      socialUpdates.display_name = updates.name;
    }
    if (typeof updates.isPublic === 'boolean') {
      socialUpdates.is_public = updates.isPublic;
    }

    if (Object.keys(socialUpdates).length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to update your profile.');

      const { error: socialError } = await supabase
        .from('user_profiles')
        .update(socialUpdates)
        .eq('user_id', user.id);

      if (socialError) {
        if (isMissingSocialSchemaError(socialError)) {
          throw new Error('Social profile settings are not available yet. Run the latest Supabase migration first.');
        }
        throw socialError;
      }
    }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};