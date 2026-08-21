import { supabase } from '../lib/supabase';
import { exerciseService } from './exerciseService';
import { getSetLoad, parseUserWeight, shouldCountSetForPR } from '../utils/workoutMath';
import type { WorkoutSession, WorkoutExercise, Exercise } from '../types';

interface WorkoutRow {
  id: string;
  name: string;
  start_time: number;
  end_time: number | null;
  volume_load: number;
  exercises: unknown;
}

const getWorkoutExercises = (value: unknown): WorkoutExercise[] =>
  Array.isArray(value) ? (value as WorkoutExercise[]) : [];

export const workoutService = {
  
  // --- CREATE ---
  async saveWorkout(workout: WorkoutSession): Promise<WorkoutSession | null> {
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        name: workout.name,
        start_time: workout.startTime,
        end_time: workout.endTime,
        volume_load: workout.volumeLoad,
        exercises: workout.exercises
      })
      .select()
      .single();

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
  async getLastLog(exerciseId: string): Promise<WorkoutExercise | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(10);

    if (error || !data) return null;

    for (const workout of data) {
      const ex = getWorkoutExercises((workout as WorkoutRow).exercises).find(e => e.exerciseId === exerciseId);
      if (ex) return ex;
    }

    return null;
  },

  // --- PR CALCULATOR ---
  async getPersonalRecord(exerciseId: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const userWeight = parseUserWeight(user.user_metadata?.weight);

    const allExercises = await exerciseService.getAllExercises();
    const defMap = new Map<string, Exercise>(allExercises.map(ex => [ex.id, ex]));

    const { data, error } = await supabase
      .from('workouts')
      .select('exercises, start_time')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false });

    if (error || !data) {
      return 0;
    }

    let maxWeight = 0;

    (data as WorkoutRow[]).forEach(workout => {
      const exercise = getWorkoutExercises(workout.exercises).find(entry => entry.exerciseId === exerciseId);
      const def = defMap.get(exerciseId);

      if (exercise && Array.isArray(exercise.sets)) {
        exercise.sets.forEach(set => {
          if (!shouldCountSetForPR(set, def, undefined, userWeight)) return;

          const load = getSetLoad(set, def, undefined, userWeight);
          if (load > maxWeight) {
            maxWeight = load;
          }
        });
      }
    });

    return maxWeight;
  }
};