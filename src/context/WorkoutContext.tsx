import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

  // --- REST TIMER STATE ---
  const [restTimerPrefs, setRestTimerPrefs] = useState<Record<string, number>>(() => {
    const savedPrefs = localStorage.getItem('ironlog_rest_prefs');
    return savedPrefs ? JSON.parse(savedPrefs) : { normal: 90, warmup: 60, dropset: 45 };
  });
  const [restTimerState, setRestTimerState] = useState({
    isOpen: false,
    isDocked: false,
    duration: 90,
    resetKey: 0,
    type: 'normal'
  });

  const openRestTimer = (type: string) => {
    setRestTimerState(prev => {
      const duration = restTimerPrefs[type] || 90;
      return {
        ...prev,
        isOpen: true,
        duration: prev.isOpen ? prev.duration : duration,
        resetKey: prev.resetKey + 1,
        type
      };
    });
  };

  const closeRestTimer = () => setRestTimerState(prev => ({ ...prev, isOpen: false, isDocked: false }));
  const dockRestTimer = () => setRestTimerState(prev => ({ ...prev, isDocked: true }));
  const undockRestTimer = () => setRestTimerState(prev => ({ ...prev, isDocked: false }));
  const updateRestTimerPref = (newDuration: number) => {
    setRestTimerState(prev => ({ ...prev, duration: newDuration }));
    setRestTimerPrefs(prev => {
      const updated = { ...prev, [restTimerState.type]: newDuration };
      localStorage.setItem('ironlog_rest_prefs', JSON.stringify(updated));
      return updated;
    });
  };

  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map<string, Exercise>());
  const [historyCache, setHistoryCache] = useState<Map<string, ExerciseSet[]>>(new Map());
  const [prCache, setPrCache] = useState<Map<string, number>>(new Map());
  /**
   * Tracks which exercise IDs have had their historical PR baseline fetched from Supabase.
   * This is distinct from prCache to handle the "0 PR" case (exercise exists in history
   * but user has never hit a qualifying PR). An empty prCache entry and a missing prCache
   * entry would otherwise be indistinguishable, causing false positives.
   */
  const [prCacheReady, setPrCacheReady] = useState<Set<string>>(new Set());
  const [userWeight, setUserWeight] = useState<number | null>(null);

  // Ref so the rehydration effect doesn't re-run if prCacheReady changes during the fetch
  const prCacheReadyRef = useRef(prCacheReady);
  prCacheReadyRef.current = prCacheReady;

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

  /**
   * Shared helper: fetch the historical PR baseline for a single exercise from Supabase
   * and update both prCache and prCacheReady. This is the ONE source of truth used by
   * both addExercise() (new exercises) and the rehydration effect (restored exercises).
   *
   * Crucially, getPersonalRecord() scans COMPLETED workouts in Supabase — the active
   * workout is not yet saved, so it is never included in the baseline. This means
   * a 230 lb set in the active workout does NOT inflate historicPR to 230 lb;
   * the baseline correctly remains at whatever was logged in prior completed sessions.
   */
  const fetchAndCacheHistoricalPR = useCallback((exerciseId: string) => {
    void workoutService.getPersonalRecord(exerciseId).then(prValue => {
      setPrCache(prev => new Map(prev).set(exerciseId, prValue));
      setPrCacheReady(prev => new Set(prev).add(exerciseId));
    });
  }, []);

  /**
   * PWA Rehydration Effect: when the app cold-starts and restores an active workout from
   * localStorage, prCache is empty. This effect backfills the historical PR baseline
   * for every exercise already present in the rehydrated session.
   *
   * Guard: only runs when exerciseDefs has loaded (size > 0 or we've attempted the load)
   * and only for exercises whose PR isn't already in the ready set.
   */
  useEffect(() => {
    if (!resolvedWorkout) return;
    // Only backfill exercises that are not yet in the ready set
    const missing = resolvedWorkout.exercises.filter(
      ex => !prCacheReadyRef.current.has(ex.exerciseId)
    );
    if (missing.length === 0) return;
    missing.forEach(ex => fetchAndCacheHistoricalPR(ex.exerciseId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedWorkout?.id, fetchAndCacheHistoricalPR]);
  // ^^ Keyed on workout.id: fires once when a workout is rehydrated/started, not on every set update.

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
    setPrCacheReady(new Set());
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
    setPrCache(new Map());
    setPrCacheReady(new Set());
    closeRestTimer();
  };

  const finishWorkout = async (): Promise<string | null> => {
    if (!resolvedWorkout) return null;
    closeRestTimer();
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
    setPrCache(new Map());
    setPrCacheReady(new Set());
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

  const addExercise = (exDef: Exercise) => {
    if (!resolvedWorkout) return;
    setExerciseDefs(prev => new Map(prev).set(exDef.id, exDef));

    const newExercise: WorkoutExercise = {
      id: uuidv4(),
      exerciseId: exDef.id,
      sets: [createSet()]
    };

    setWorkout(prev => prev ? ({ ...prev, exercises: [...prev.exercises, newExercise] }) : null);

    // Use the shared helper so addExercise and rehydration share the same fetch logic
    fetchAndCacheHistoricalPR(exDef.id);
  };

  const hydrateExerciseGhostSets = useCallback((
    workoutExerciseId: string,
    exerciseId: string,
    ghostSets: ExerciseSet[]
  ) => {
    setHistoryCache(prev => new Map(prev).set(exerciseId, ghostSets));
    if (ghostSets.length === 0) return;

    setWorkout(prev => {
      if (!prev) return null;
      const exerciseIndex = prev.exercises.findIndex(exercise => exercise.id === workoutExerciseId);
      if (exerciseIndex < 0) return prev;
      const current = prev.exercises[exerciseIndex];
      const onlyUntouchedDefault = current.sets.length === 1
        && !current.sets[0].isCompleted
        && current.sets[0].weight === null
        && current.sets[0].reps === null
        && current.sets[0].distance === null
        && current.sets[0].durationSeconds === null;
      if (!onlyUntouchedDefault) return prev;

      const ids = new Map<string, string>();
      const hydratedSets = ghostSets.map(ghost => {
        const id = uuidv4();
        ids.set(ghost.id, id);
        return {
          ...createSet(ghost),
          id,
          type: ghost.type,
          previousBest: ghost.weight ?? undefined,
          parentSetId: ghost.parentSetId ? ids.get(ghost.parentSetId) : undefined
        };
      });
      const exercises = [...prev.exercises];
      exercises[exerciseIndex] = { ...current, sets: hydratedSets };
      return { ...prev, exercises };
    });
  }, []);

  const removeExercise = (index: number) => {
    setWorkout(prev => {
      if (!prev) return null;
      const copy = [...prev.exercises];
      copy.splice(index, 1);
      return { ...prev, exercises: copy };
    });
  };

  const addSet = (exIndex: number, insertIndex?: number) => {
    setWorkout(prev => {
      if (!prev) return null;
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
      if (!prev) return null;
      const exs = [...prev.exercises];
      const sets = [...exs[exIndex].sets];
      sets.splice(setIndex, 1);
      exs[exIndex] = { ...exs[exIndex], sets };
      return { ...prev, exercises: exs };
    });
  };

  const updateSet = <K extends keyof ExerciseSet>(exIndex: number, setIndex: number, field: K, value: ExerciseSet[K]) => {
    setWorkout(prev => {
      if (!prev) return null;
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
      historyCache, prCache, prCacheReady,
      startWorkout, logRestDay, cancelWorkout, finishWorkout,
      addExercise, hydrateExerciseGhostSets, removeExercise, addSet, removeSet, updateSet,
      exerciseDefs,
      restTimer: { ...restTimerState, prefs: restTimerPrefs },
      openRestTimer, closeRestTimer, dockRestTimer, undockRestTimer, updateRestTimerPref
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};
