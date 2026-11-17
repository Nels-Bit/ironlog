import { supabase } from '../lib/supabase';
import type { Exercise } from '../types';
import { canonicalBarbellName, getBarbellLift } from '../utils/barbellLifts';
import { EXERCISE_CHANGED, validateExerciseSettings } from '../utils/exerciseDetails';

interface ExerciseRow {
  id: string;
  name: string;
  category: string;
  exercise_category?: 'strength' | 'cardio' | 'mobility' | null;
  target_muscle: string | null;
  user_id: string | null;
  is_unilateral: boolean | null;
  starting_resistance?: number | string;
  notes?: string;
}

const mapExercise = (row: ExerciseRow, userId: string): Exercise => ({
  id: row.id, name: canonicalBarbellName({name:row.name,category:row.category,isUnilateral:row.is_unilateral}),
  category: row.category, exerciseCategory: row.exercise_category || (row.category.toLowerCase()==='cardio'?'cardio':'strength'),
  target: row.target_muscle, isCustom: row.user_id===userId, isUnilateral: row.is_unilateral ?? undefined,
  startingResistance: Number(row.starting_resistance ?? 0), notes: row.notes ?? '', settingsAvailable: true,
});
const changed = (exercise: Exercise) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EXERCISE_CHANGED,{detail:exercise}));
  return exercise;
};
const saveError = (error: {code?:string;message?:string} | null) => new Error(
  error?.code === 'PGRST202' || error?.code === '42883'
    ? 'Exercise details are not installed on the database yet. Your existing workouts are safe.'
    : error?.message || 'Unable to save exercise details. Please retry.');

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

    const [aliases, settings] = await Promise.all([exerciseService.getAliases(),
      supabase.from('exercise_settings').select('exercise_id,starting_resistance,notes').eq('user_id',user.id)]);
    const unavailable = settings.error && ['PGRST205','42P01'].includes(settings.error.code);
    if (settings.error && !unavailable) throw new Error('Unable to load your exercise notes and resistance. Please retry.');
    const personal = new Map((settings.data || []).map(row => [row.exercise_id,row]));
    return (data as ExerciseRow[]).filter(ex => !aliases.has(ex.id)).map(ex => {
      return {...mapExercise({...ex,...personal.get(ex.id)},user.id),settingsAvailable: !unavailable};
    });
  },

  async createExercise(ex: Partial<Exercise>): Promise<Exercise> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be signed in to create an exercise.');

    let name = ex.name?.trim();
    if (!name) throw new Error('Enter an exercise name before saving.');
    validateExerciseSettings(ex);
    const lift = getBarbellLift({ name, category: ex.category || '', isUnilateral: ex.isUnilateral });
    if (lift) {
      name = canonicalBarbellName({ name, category: ex.category || '' });
      const existing = (await exerciseService.getAllExercises()).find(candidate => getBarbellLift(candidate) === lift);
      if (existing) return ex.notes !== undefined || ex.startingResistance !== undefined
        ? exerciseService.savePersonalSettings(existing,ex) : existing;
    }

    // The deployed table classifies exercises through `category`; it has no
    // `exercise_category` column. Keep the cardio behavior in the app from
    // that stable category value instead of writing an unsupported field.
    const isCardio = (ex.category || '').toLowerCase() === 'cardio';

    const { data, error } = await supabase.rpc('save_custom_exercise', {
      p_id:null, p_name:name, p_category:ex.category || 'Other', p_target:isCardio?'Cardio':(ex.target || 'Other'),
      p_unilateral:isCardio?false:(ex.isUnilateral ?? false), p_starting_resistance:ex.startingResistance ?? 0, p_notes:ex.notes ?? '',
    });

    if (error) {
      console.error('Error creating exercise:', error);
      throw saveError(error);
    }

    if (!data) throw new Error('The exercise was not returned after saving. Please try again.');

    return changed(mapExercise(data as ExerciseRow,user.id));
  },

  async updateExercise(id: string, ex: Partial<Exercise>): Promise<Exercise> {
    validateExerciseSettings(ex);
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in to edit an exercise.');
    const all = await exerciseService.getAllExercises(), existing = all.find(candidate => candidate.id===id);
    if (!existing?.isCustom) throw new Error('Only exercises you created can be edited.');
    const merged = {...existing,...ex}, name = canonicalBarbellName(merged).trim();
    if (!name || name.length>100) throw new Error('Exercise names must be 1–100 characters.');
    const lift = getBarbellLift({...merged,name});
    if (lift && all.some(candidate=>candidate.id!==id && getBarbellLift(candidate)===lift))
      throw new Error('That barbell lift already exists in your library. Use the existing exercise.');
    const cardio = merged.category.toLowerCase()==='cardio';
    const {data,error} = await supabase.rpc('save_custom_exercise',{
      p_id:id,p_name:name,p_category:merged.category,p_target:cardio?'Cardio':merged.target || 'Other',
      p_unilateral:cardio?false:merged.isUnilateral ?? false,p_starting_resistance:merged.startingResistance ?? 0,p_notes:ex.notes ?? null,
    });
    if (error || !data) throw saveError(error);
    return changed(mapExercise(data as ExerciseRow,user.id));
  },

  async savePersonalSettings(exercise: Exercise, patch: {notes?:string;startingResistance?:number}, expectedUserId?: string): Promise<Exercise> {
    validateExerciseSettings(patch);
    if (expectedUserId) {
      const {data:{user}} = await supabase.auth.getUser();
      if (user?.id !== expectedUserId) throw new Error('Sign in to your account to finish saving notes.');
    }
    const {data,error} = await supabase.rpc('save_exercise_settings',{
      p_exercise:exercise.id,p_starting_resistance:patch.startingResistance ?? null,p_notes:patch.notes ?? null,
    });
    if (error || !data) throw saveError(error);
    return changed({...exercise,startingResistance:Number(data.starting_resistance),notes:data.notes,settingsAvailable:true});
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
