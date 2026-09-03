import { supabase } from '../lib/supabase';
import type { Exercise } from '../types';

interface ExerciseRow {
  id: string;
  name: string;
  category: string;
  exercise_category?: 'strength' | 'cardio' | 'mobility' | null;
  target_muscle: string | null;
  user_id: string | null;
  is_unilateral: boolean | null;
}

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

    return (data as ExerciseRow[]).map(ex => {
      const categoryLower = (ex.category || '').toLowerCase();
      const exerciseCategory = ex.exercise_category || (categoryLower === 'cardio' ? 'cardio' : 'strength');
      return {
        id: ex.id,
        name: ex.name,
        category: ex.category,
        exerciseCategory,
        target: ex.target_muscle || null,
        isCustom: ex.user_id === user.id, // If it has a user_id, it's custom
        isUnilateral: ex.is_unilateral ?? undefined // <--- Map from DB column
      };
    });
  },

  async createExercise(ex: Partial<Exercise>): Promise<Exercise | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const isCardio = ex.exerciseCategory === 'cardio' || (ex.category || '').toLowerCase() === 'cardio';
    const exerciseCategory = isCardio ? 'cardio' : (ex.exerciseCategory || 'strength');

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        user_id: user.id, // Link to user
        name: ex.name,
        category: ex.category,
        exercise_category: exerciseCategory,
        target_muscle: isCardio ? null : (ex.target || null),
        is_unilateral: isCardio ? false : (ex.isUnilateral ?? false)
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating exercise:', error);
      return null;
    }

    const row = data as ExerciseRow;

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      exerciseCategory: row.exercise_category || (row.category.toLowerCase() === 'cardio' ? 'cardio' : 'strength'),
      target: row.target_muscle || null,
      isCustom: true,
      isUnilateral: row.is_unilateral ?? undefined
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