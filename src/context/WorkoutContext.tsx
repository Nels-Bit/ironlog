import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { authService } from '../services/authService';
import { socialService } from '../services/socialService';
import {
  applyBodyWeightToExercises,
  getSetLoad,
  getTotalReps,
  parseUserWeight,
  shouldCountSetForVolume
} from '../utils/workoutMath';
import type { WorkoutSession, WorkoutExercise, Exercise, ExerciseSet } from '../types';
import { WorkoutContext } from './workoutContext.shared';

export const WorkoutProvider = ({ children }: { children: ReactNode }) => {
  const [workout, setWorkout] = useState<WorkoutSession | null>(() => {
    const saved = localStorage.getItem('current_workout');
    return saved ? JSON.parse(saved) : null;
  });

  const [elapsed, setElapsed] = useState(() => {
    const saved = localStorage.getItem('workout_start_time');
    return saved ? Math.floor((Date.now() - parseInt(saved)) / 1000) : 0;
  });

  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map<string, Exercise>());
  const [historyCache, setHistoryCache] = useState<Map<string, ExerciseSet[]>>(new Map());
  const [prCache, setPrCache] = useState<Map<string, number>>(new Map());
  const [userWeight, setUserWeight] = useState<number | null>(null);

  useEffect(() => {
    const loadDefs = async () => {
      const all = await exerciseService.getAllExercises();
      const map = new Map<string, Exercise>();
      all.forEach(ex => map.set(ex.id, ex));
      setExerciseDefs(map);
    };
    loadDefs();
  }, []);

  useEffect(() => {
    const loadUserWeight = async () => {
      const user = await authService.getUser();
      setUserWeight(parseUserWeight(user?.weight));
    };
    loadUserWeight();
  }, []);

  const resolvedWorkout = useMemo(() => {
    if (!workout) return null;
    if (workout.bodyWeight !== undefined || userWeight === null) return workout;
    return { ...workout, bodyWeight: userWeight ?? undefined };
  }, [workout, userWeight]);

  useEffect(() => {
    if (!resolvedWorkout) return;

    const interval = setInterval(() => {
      const start = resolvedWorkout.startTime;
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [resolvedWorkout]);

  useEffect(() => {
    if (resolvedWorkout) {
      localStorage.setItem('current_workout', JSON.stringify(resolvedWorkout));
      localStorage.setItem('workout_start_time', resolvedWorkout.startTime.toString());
    } else {
      localStorage.removeItem('current_workout');
      localStorage.removeItem('workout_start_time');
    }
  }, [resolvedWorkout]);

  const startWorkout = (name: string) => {
    const newWorkout: WorkoutSession = {
      id: uuidv4(),
      name: name.trim() || `Workout ${new Date().toLocaleDateString()}`,
      startTime: Date.now(),
      volumeLoad: 0,
      exercises: [],
      bodyWeight: userWeight ?? undefined
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

  const finishWorkout = async (): Promise<string | null> => {
    if (!resolvedWorkout) return null;
    const workoutBodyWeight = resolvedWorkout.bodyWeight ?? userWeight ?? undefined;
    let totalVolume = 0;
    resolvedWorkout.exercises.forEach(ex => {
      const def = exerciseDefs.get(ex.exerciseId);
      ex.sets.forEach(set => {
        if (!shouldCountSetForVolume(set, def, workoutBodyWeight, userWeight)) return;
        const load = getSetLoad(set, def, workoutBodyWeight, userWeight);
        const totalReps = getTotalReps(set, def);
        totalVolume += load * totalReps;
      });
    });

    const exercisesWithBodyWeight = applyBodyWeightToExercises(
      resolvedWorkout.exercises,
      exerciseDefs,
      workoutBodyWeight
    );

    const final = {
      ...resolvedWorkout,
      volumeLoad: totalVolume,
      endTime: Date.now(),
      exercises: exercisesWithBodyWeight,
      bodyWeight: workoutBodyWeight
    };
    const saved = await workoutService.saveWorkout(final);
    setWorkout(null);
    if (saved?.id) {
      socialService.dispatchFriendMilestones(saved.id).catch(err => {
        console.error('Failed to dispatch friend milestones:', err);
      });
    }
    return saved?.id ?? null;
  };

  const createSet = (historySet?: ExerciseSet): ExerciseSet => ({
    id: uuidv4(),
    type: 'normal',
    weight: null,
    reps: null,
    repsLeft: null,
    repsRight: null,
    isCompleted: false,
    previousBest: historySet?.weight ?? undefined 
  });

  const addExercise = async (exDef: Exercise) => {
    if (!resolvedWorkout) return;
    
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

  const updateSet = <K extends keyof ExerciseSet>(exIndex: number, setIndex: number, field: K, value: ExerciseSet[K]) => {
    setWorkout(prev => {
        if(!prev) return null;
        const exs = [...prev.exercises];
        const sets = [...exs[exIndex].sets];
        sets[setIndex] = { ...sets[setIndex], [field]: value } as ExerciseSet;
        exs[exIndex] = { ...exs[exIndex], sets };
        return { ...prev, exercises: exs };
    });
  };

  return (
    <WorkoutContext.Provider value={{
      workout: resolvedWorkout, elapsed, isActive: !!resolvedWorkout, 
      historyCache, prCache,
      startWorkout, logRestDay, cancelWorkout, finishWorkout,
      addExercise, removeExercise, addSet, removeSet, updateSet,
      exerciseDefs
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};
