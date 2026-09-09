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

  async createExercise(ex: Partial<Exercise>): Promise<Exercise> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be signed in to create an exercise.');

    const name = ex.name?.trim();
    if (!name) throw new Error('Enter an exercise name before saving.');

    // The deployed table classifies exercises through `category`; it has no
    // `exercise_category` column. Keep the cardio behavior in the app from
    // that stable category value instead of writing an unsupported field.
    const isCardio = (ex.category || '').toLowerCase() === 'cardio';

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        user_id: user.id, // Link to user
        name,
        category: ex.category,
        target_muscle: isCardio ? null : (ex.target || null),
        is_unilateral: isCardio ? false : (ex.isUnilateral ?? false)
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating exercise:', error);
      throw new Error(error.message || 'Unable to create this exercise. Please try again.');
    }

    if (!data) throw new Error('The exercise was not returned after saving. Please try again.');

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

  async deleteCustomExercise(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be signed in to delete an exercise.');

    // Selecting the deleted id detects RLS policies that silently affect zero rows.
    const { data, error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error deleting exercise:', error);
      throw new Error(error.message || 'Unable to delete this exercise.');
    }
    if (!data) {
      throw new Error('This exercise could not be deleted. Your database needs the custom-exercise delete policy.');
    }
  }
};
