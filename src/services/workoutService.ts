import { supabase } from '../lib/supabase';
import { exerciseService } from './exerciseService';
import { getBestPRPerformance, parseUserWeight } from '../utils/workoutMath';
import type { WorkoutSession, WorkoutExercise, Exercise, PersonalRecordPerformance } from '../types';
import { getWorkoutExercises } from '../utils/workoutSchema';
export { getWorkoutExercises } from '../utils/workoutSchema';

interface WorkoutRow {
  id: string;
  name: string;
  start_time: number;
  end_time: number | null;
  volume_load: number;
  exercises: unknown;
}


export const workoutService = {
  
  // --- CREATE ---
  async saveWorkout(workout: WorkoutSession): Promise<WorkoutSession | null> {
    const payload = {
        user_id: (await supabase.auth.getUser()).data.user?.id,
        name: workout.name,
        start_time: workout.startTime,
        end_time: workout.endTime,
        volume_load: workout.volumeLoad,
        exercises: workout.exercises
      };
    const insert = (live:boolean) => supabase.from('workouts').insert(live ? {...payload,notification_source:'live'} : payload).select().single();
    let {data,error} = await insert(true);
    // Rolling deployments: an old schema must not prevent core workout saving.
    // Only schema validation (which performs no insert) is safe to retry here.
    if (error?.code==='PGRST204' && error.message.includes('notification_source')) {
      ({data,error} = await insert(false));
    }

    if (error) throw error;

    if (!data) return null;

    const row = data as WorkoutRow;

    return {
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      volumeLoad: row.volume_load,
      exercises: getWorkoutExercises(row.exercises)
    };
  },

  // --- READ (List) ---
  async getHistory(): Promise<WorkoutSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }

    return (data as WorkoutRow[]).map(row => ({
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      volumeLoad: row.volume_load,
      exercises: getWorkoutExercises(row.exercises)
    }));
  },

  // --- READ (Single) ---
  async getWorkoutById(id: string): Promise<WorkoutSession | null> {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const row = data as WorkoutRow;

    return {
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      volumeLoad: row.volume_load,
      exercises: getWorkoutExercises(row.exercises)
    };
  },

  // --- UPDATE ---
  async updateWorkout(id: string, workout: WorkoutSession): Promise<void> {
    const { error } = await supabase
      .from('workouts')
      .update({
        name: workout.name,
        start_time: workout.startTime,
        end_time: workout.endTime,
        volume_load: workout.volumeLoad,
        exercises: workout.exercises
      })
      .eq('id', id);

    if (error) throw error;
  },

  // --- DELETE ---
  async deleteWorkout(id: string): Promise<void> {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // --- GHOST DATA ---
  async getLastLog(exerciseId: string): Promise<WorkoutExercise | null | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // The normal path is a JSONB containment query: one newest completed workout
    // that contains this exercise, without a date window or arbitrary history cap.
    const { data: targetedData, error: targetedError } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .contains('exercises', [{ exerciseId }])
      .limit(1)
      .maybeSingle();

    if (!targetedError && targetedData) {
      return getWorkoutExercises((targetedData as WorkoutRow).exercises)
        .find(exercise => exercise.exerciseId === exerciseId) ?? null;
    }

    // Older installations can have stringified JSON or a legacy key shape that
    // JSON containment cannot match. Fall back to all completed history, still
    // ordered newest-first, so those users receive a useful ghost set as well.
    const { data, error } = await supabase
      .from('workouts')
      .select('exercises, start_time')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false });

    if (error || !data) {
      console.error('Error fetching exercise ghost sets:', targetedError ?? error);
      return undefined;
    }

    for (const workout of data) {
      const ex = getWorkoutExercises((workout as WorkoutRow).exercises).find(e => e.exerciseId === exerciseId);
      if (ex) return ex;
    }

    return null;
  },

  // --- PR CALCULATOR ---
  async getPersonalRecord(exerciseId: string): Promise<number> {
    return (await workoutService.getPersonalRecordPerformance(exerciseId)).load;
  },

  async getPersonalRecordPerformance(exerciseId: string): Promise<PersonalRecordPerformance> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { load: 0, set: null };

    const userWeight = parseUserWeight(user.user_metadata?.weight);

    const allExercises = await exerciseService.getAllExercises();
    const defMap = new Map<string, Exercise>(allExercises.map(ex => [ex.id, ex]));

    const { data, error } = await supabase
      .from('workouts')
      .select('exercises, start_time')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false });

    if (error || !data) {
      // Keep the context's readiness gate closed on failure rather than treating
      // an unavailable historical baseline as a real zero-load PR.
      throw error ?? new Error('Unable to load historical personal records.');
    }

    const sets = (data as WorkoutRow[]).flatMap(workout => getWorkoutExercises(workout.exercises)
      .filter(entry => entry.exerciseId === exerciseId).flatMap(entry => entry.sets));
    return getBestPRPerformance(sets, defMap.get(exerciseId), undefined, userWeight);
  }
};
