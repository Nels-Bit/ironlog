import { supabase } from '../lib/supabase';
import type { WorkoutSession, WorkoutExercise } from '../types';

export const workoutService = {
  
  // --- CREATE ---
  async saveWorkout(workout: WorkoutSession): Promise<void> {
    const { error } = await supabase
      .from('workouts')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        name: workout.name,
        start_time: workout.startTime,
        end_time: workout.endTime,
        volume_load: workout.volumeLoad,
        exercises: workout.exercises
      });

    if (error) throw error;
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

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      volumeLoad: row.volume_load,
      exercises: row.exercises
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

    return {
      id: data.id,
      name: data.name,
      startTime: data.start_time,
      endTime: data.end_time,
      volumeLoad: data.volume_load,
      exercises: data.exercises
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
      // @ts-ignore
      const ex = (workout.exercises as WorkoutExercise[]).find(e => e.exerciseId === exerciseId);
      if (ex) return ex;
    }

    return null;
  },

  // --- PR CALCULATOR ---
  async getPersonalRecord(exerciseId: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('workouts')
      .select('exercises, start_time')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false });

    if (error || !data) {
      return 0;
    }

    let maxWeight = 0;

    data.forEach(workout => {
      if (Array.isArray(workout.exercises)) {
        const exercise = workout.exercises.find((e: any) => e.exerciseId === exerciseId);
        
        if (exercise && Array.isArray(exercise.sets)) {
          exercise.sets.forEach((set: any) => {
            const weight = parseFloat(set.weight);
            if (!isNaN(weight) && weight > maxWeight) {
              maxWeight = weight;
            }
          });
        }
      }
    });

    return maxWeight;
  }
};