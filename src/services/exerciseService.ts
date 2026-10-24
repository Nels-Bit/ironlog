import { supabase } from '../lib/supabase';
import type { Exercise } from '../types';
import { canonicalBarbellName, getBarbellLift } from '../utils/barbellLifts';

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

  async getAliases(): Promise<Map<string, string>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Map();
    const { data, error } = await supabase.from('exercise_id_aliases')
      .select('old_exercise_id,exercise_id').eq('user_id', user.id);
    // Allow a rolling release against a schema that has not gained aliases yet.
    if (error && ['PGRST205', '42P01'].includes(error.code)) return new Map();
    if (error) throw new Error('Unable to load merged exercise identities. Please retry.');
    return new Map((data || []).map(row => [row.old_exercise_id, row.exercise_id]));
  },
  
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

    const aliases = await exerciseService.getAliases();
    return (data as ExerciseRow[]).filter(ex => !aliases.has(ex.id)).map(ex => {
      const categoryLower = (ex.category || '').toLowerCase();
      const exerciseCategory = ex.exercise_category || (categoryLower === 'cardio' ? 'cardio' : 'strength');
      return {
        id: ex.id,
        name: canonicalBarbellName({ name: ex.name, category: ex.category, isUnilateral: ex.is_unilateral }),
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

    let name = ex.name?.trim();
    if (!name) throw new Error('Enter an exercise name before saving.');
    const lift = getBarbellLift({ name, category: ex.category || '', isUnilateral: ex.isUnilateral });
    if (lift) {
      name = canonicalBarbellName({ name, category: ex.category || '' });
      const existing = (await exerciseService.getAllExercises()).find(candidate => getBarbellLift(candidate) === lift);
      if (existing) return existing; // Reuse rather than creating another barbell identity.
    }

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
        target_muscle: isCardio ? 'Cardio' : (ex.target || 'Other'),
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
