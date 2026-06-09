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

export const authService = {
  
  async getUser(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    // We combine the Auth ID/Email with the Metadata (Name, Weight, etc.)
    const meta = user.user_metadata || {};

    return {
      id: user.id,
      email: user.email || '',
      name: meta.name || 'Athlete',
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
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};