import { supabase } from '../lib/supabase'; // <--- THIS WAS MISSING
import type { UserProfile } from '../types';

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
      height: meta.height,
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
        height: updates.height,
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