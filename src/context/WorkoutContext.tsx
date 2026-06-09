import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import type { WorkoutSession, WorkoutExercise, Exercise, ExerciseSet } from '../types';

interface WorkoutContextType {
  workout: WorkoutSession | null;
  elapsed: number;
  isActive: boolean;
  historyCache: Map<string, ExerciseSet[]>;
  prCache: Map<string, number>;
  startWorkout: (name: string) => void;
  logRestDay: () => Promise<string | null>;
  cancelWorkout: () => void;
  finishWorkout: () => Promise<void>;
  addExercise: (exDef: Exercise) => void;
  removeExercise: (index: number) => void;
  addSet: (exIndex: number, insertIndex?: number) => void; 
  removeSet: (exIndex: number, setIndex: number) => void;
  updateSet: (exIndex: number, setIndex: number, field: keyof ExerciseSet, value: any) => void;
  exerciseDefs: Map<string, Exercise>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider = ({ children }: { children: ReactNode }) => {
  const [workout, setWorkout] = useState<WorkoutSession | null>(() => {
    const saved = localStorage.getItem('current_workout');
    return saved ? JSON.parse(saved) : null;
  });

  const [elapsed, setElapsed] = useState(() => {
    const saved = localStorage.getItem('workout_start_time');
    return saved ? Math.floor((Date.now() - parseInt(saved)) / 1000) : 0;
  });

  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map());
  const [historyCache, setHistoryCache] = useState<Map<string, ExerciseSet[]>>(new Map());
  const [prCache, setPrCache] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const loadDefs = async () => {
      const all = await exerciseService.getAllExercises();
      const map = new Map();
      all.forEach(ex => map.set(ex.id, ex));
      setExerciseDefs(map);
    };
    loadDefs();
  }, []);

  useEffect(() => {
    let interval: any;
    if (workout) {
      interval = setInterval(() => {
        const start = workout.startTime;
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [workout]);

  useEffect(() => {
    if (workout) {
      localStorage.setItem('current_workout', JSON.stringify(workout));
      localStorage.setItem('workout_start_time', workout.startTime.toString());
    } else {
      localStorage.removeItem('current_workout');
      localStorage.removeItem('workout_start_time');
    }
  }, [workout]);

  const startWorkout = (name: string) => {
    const newWorkout: WorkoutSession = {
      id: uuidv4(),
      name: name.trim() || `Workout ${new Date().toLocaleDateString()}`,
      startTime: Date.now(),
      volumeLoad: 0,
      exercises: []
    };
    setWorkout(newWorkout);
    setElapsed(0);
    setHistoryCache(new Map());
    setPrCache(new Map());
  };

  const logRestDay = async () => {
    const restDay: WorkoutSession = {
      id: uuidv4(),
      name: 'Rest Day 🌙',
      startTime: Date.now(),
      endTime: Date.now(),
      volumeLoad: 0,
      exercises: []
    };
    const saved = await workoutService.saveWorkout(restDay);
    return saved?.id ?? null;
  };

  const cancelWorkout = () => {
    setWorkout(null);
    setElapsed(0);
  };

  const finishWorkout = async () => {
    if (!workout) return;
    
    let totalVolume = 0;
    workout.exercises.forEach(ex => {
      const def = exerciseDefs.get(ex.exerciseId);
      ex.sets.forEach(set => {
        if (set.isCompleted && set.weight) {
          if (def?.isUnilateral && set.repsLeft && set.repsRight) {
             totalVolume += set.weight * (set.repsLeft + set.repsRight);
          } else if (set.reps) {
             totalVolume += set.weight * set.reps;
          }
        }
      });
    });

    const final = { ...workout, volumeLoad: totalVolume, endTime: Date.now() };
    await workoutService.saveWorkout(final);
    setWorkout(null);
  };

  const createSet = (historySet?: ExerciseSet): ExerciseSet => ({
    id: uuidv4(),
    type: 'normal',
    weight: null,
    reps: null,
    repsLeft: null,
    repsRight: null,
    isCompleted: false,
    previousBest: historySet?.weight || undefined 
  });

  const addExercise = async (exDef: Exercise) => {
    if (!workout) return;
    
    setExerciseDefs(prev => new Map(prev).set(exDef.id, exDef));

    const [lastLog, prValue] = await Promise.all([
      workoutService.getLastLog(exDef.id),
      workoutService.getPersonalRecord(exDef.id)
    ]);
    
    const ghostSets = lastLog?.sets || [];

    setHistoryCache(prev => new Map(prev).set(exDef.id, ghostSets));
    setPrCache(prev => new Map(prev).set(exDef.id, prValue));

    // SMART SET GENERATION: Copy exact structure (Warmups, Dropsets, etc.)
    let initialSets: ExerciseSet[] = [];

    if (ghostSets.length > 0) {
      const idMap = new Map<string, string>(); 
      initialSets = ghostSets.map(ghost => {
        const newId = uuidv4();
        idMap.set(ghost.id, newId);

        return {
          id: newId,
          type: ghost.type,
          weight: null,     
          reps: null,       
          repsLeft: null,
          repsRight: null,
          isCompleted: false,
          previousBest: ghost.weight || undefined,
          parentSetId: ghost.parentSetId ? idMap.get(ghost.parentSetId) : undefined
        };
      });
    } else {
      initialSets = [createSet()];
    }

    const newExercise: WorkoutExercise = {
      id: uuidv4(),
      exerciseId: exDef.id,
      sets: initialSets
    };

    setWorkout(prev => prev ? ({...prev, exercises: [...prev.exercises, newExercise]}) : null);
  };

  const removeExercise = (index: number) => {
    setWorkout(prev => {
        if(!prev) return null;
        const copy = [...prev.exercises];
        copy.splice(index, 1);
        return { ...prev, exercises: copy };
    });
  };

  const addSet = (exIndex: number, insertIndex?: number) => {
    setWorkout(prev => {
        if(!prev) return null;
        const exs = [...prev.exercises];
        const sets = [...exs[exIndex].sets];
        const newSet = createSet(); 
        if (insertIndex !== undefined) sets.splice(insertIndex, 0, newSet);
        else sets.push(newSet);
        exs[exIndex] = { ...exs[exIndex], sets };
        return { ...prev, exercises: exs };
    });
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    setWorkout(prev => {
        if(!prev) return null;
        const exs = [...prev.exercises];
        const sets = [...exs[exIndex].sets];
        sets.splice(setIndex, 1);
        exs[exIndex] = { ...exs[exIndex], sets };
        return { ...prev, exercises: exs };
    });
  };

  const updateSet = (exIndex: number, setIndex: number, field: keyof ExerciseSet, value: any) => {
    setWorkout(prev => {
        if(!prev) return null;
        const exs = [...prev.exercises];
        const sets = [...exs[exIndex].sets];
        // @ts-ignore
        sets[setIndex] = { ...sets[setIndex], [field]: value };
        exs[exIndex] = { ...exs[exIndex], sets };
        return { ...prev, exercises: exs };
    });
  };

  return (
    <WorkoutContext.Provider value={{
      workout, elapsed, isActive: !!workout, 
      historyCache, prCache,
      startWorkout, logRestDay, cancelWorkout, finishWorkout,
      addExercise, removeExercise, addSet, removeSet, updateSet,
      exerciseDefs
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) throw new Error('useWorkout must be used within a WorkoutProvider');
  return context;
};