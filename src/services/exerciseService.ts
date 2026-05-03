import { supabase } from '../lib/supabase';
import type { Exercise } from '../types';

export const exerciseService = {
  
  async getAllExercises(): Promise<Exercise[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Fetch defaults (where user_id is null) AND user's custom exercises
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('name');

    if (error) {
      console.error('Error fetching exercises:', error);
      return [];
    }

    return data.map((ex: any) => ({
      id: ex.id,
      name: ex.name,
      category: ex.category,
      target: ex.target_muscle,
      isCustom: ex.user_id === user.id, // If it has a user_id, it's custom
      isUnilateral: ex.is_unilateral // <--- Map from DB column
    }));
  },

  async createExercise(ex: Partial<Exercise>): Promise<Exercise | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        user_id: user.id, // Link to user
        name: ex.name,
        category: ex.category,
        target_muscle: ex.target,
        is_unilateral: ex.isUnilateral // <--- Save this field
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating exercise:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      category: data.category,
      target: data.target_muscle,
      isCustom: true,
      isUnilateral: data.is_unilateral
    };
  },

  async deleteCustomExercise(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting exercise:', error);
      return false;
    }
    return true;
  }
};