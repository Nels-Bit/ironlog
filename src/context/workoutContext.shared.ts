import { createContext } from 'react';
import type { Exercise, ExerciseSet, WorkoutSession } from '../types';

export interface WorkoutContextType {
  workout: WorkoutSession | null;
  elapsed: number;
  isActive: boolean;
  historyCache: Map<string, ExerciseSet[]>;
  prCache: Map<string, number>;
  /** Actual historical PR set, used only to display matching reps. */
  prSetCache: Map<string, ExerciseSet | null>;
  /** Exercise IDs whose historical PR baseline has been loaded from Supabase.
   *  Until an exercise's ID appears in this set, suppress PR indicators to prevent
   *  the false-positive flash that occurs after a cold PWA restart when prCache is empty. */
  prCacheReady: Set<string>;
  startWorkout: (name: string) => void;
  logRestDay: () => Promise<string | null>;
  cancelWorkout: () => void;
  finishWorkout: () => Promise<string | null>;
  addExercise: (exDef: Exercise) => string | undefined;
  hydrateExerciseGhostSets: (workoutExerciseId: string, exerciseId: string, sets: ExerciseSet[]) => void;
  removeExercise: (index: number) => void;
  moveExercise: (workoutExerciseId: string, direction: 'up' | 'down') => void;
  addSet: (exIndex: number, insertIndex?: number) => void;
  removeSet: (exIndex: number, setIndex: number) => void;
  updateSet: <K extends keyof ExerciseSet>(exIndex: number, setIndex: number, field: K, value: ExerciseSet[K]) => void;
  exerciseDefs: Map<string, Exercise>;

  // Global Rest Timer State
  restTimer: {
    isOpen: boolean;
    isDocked: boolean;
    duration: number;
    resetKey: number;
    type: string;
    prefs: Record<string, number>;
  };
  openRestTimer: (type: string) => void;
  closeRestTimer: () => void;
  dockRestTimer: () => void;
  undockRestTimer: () => void;
  updateRestTimerPref: (newDuration: number) => void;
}

export const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);
