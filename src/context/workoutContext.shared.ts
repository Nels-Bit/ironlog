import { createContext } from 'react';
import type { Exercise, ExerciseSet, WorkoutSession } from '../types';

export interface WorkoutContextType {
  workout: WorkoutSession | null;
  elapsed: number;
  isActive: boolean;
  historyCache: Map<string, ExerciseSet[]>;
  prCache: Map<string, number>;
  startWorkout: (name: string) => void;
  logRestDay: () => Promise<string | null>;
  cancelWorkout: () => void;
  finishWorkout: () => Promise<string | null>;
  addExercise: (exDef: Exercise) => void;
  removeExercise: (index: number) => void;
  addSet: (exIndex: number, insertIndex?: number) => void;
  removeSet: (exIndex: number, setIndex: number) => void;
  updateSet: <K extends keyof ExerciseSet>(exIndex: number, setIndex: number, field: K, value: ExerciseSet[K]) => void;
  exerciseDefs: Map<string, Exercise>;
}

export const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);