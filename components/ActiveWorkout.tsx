
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Exercise, ExerciseSet, WorkoutSession, ExerciseCategory } from '../types';
import { Button } from './Button';
import { 
    saveWorkout, 
    getWorkoutById, 
    getKnownExercises, 
    hideExerciseName, 
    unhideExerciseName, 
    getExerciseStats, 
    getExerciseHistory, 
    getLastExerciseSets,
    ExerciseHistoryPoint,
    saveDraft,
    getDraft,
    clearDraft,
    clearChatHistory,
    WorkoutDraft,
    KnownExercise,
    getRestTimerPreference,
    saveRestTimerPreference
} from '../services/storageService';
import { Trash2, Plus, Check, Save, Clock, X, ChevronDown, ChevronUp, RotateCcw, MessageSquare, Trophy, Activity, TrendingUp, Pencil, Minus, Search, ArrowLeft, Timer, SkipForward } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ActiveWorkoutProps {
  userId: string;
  editWorkoutId: string | null;
  importedTemplate: Partial<WorkoutSession> | null;
  onFinish: () => void;
  onCancel: () => void;
}

export const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({ userId, editWorkoutId, importedTemplate, onFinish, onCancel }) => {
  const [workoutName, setWorkoutName] = useState("New Workout");
  const [startTime, setStartTime] = useState(Date.now());
  const [hasStarted, setHasStarted] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  
  // Timer State
  const [timerDisplay, setTimerDisplay] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerPausedAt, setTimerPausedAt] = useState<number | null>(null);
  const [totalPausedTime, setTotalPausedTime] = useState(0);

  // Rest Timer State
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [defaultRestDuration, setDefaultRestDuration] = useState(90);

  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({}); 
  
  // Autocomplete state
  const [knownExercises, setKnownExercises] = useState<KnownExercise[]>([]);
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [focusedExerciseName, setFocusedExerciseName] = useState<string | null>(null);

  // Add Exercise Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalView, setModalView] = useState<'SEARCH' | 'CREATE'>('SEARCH');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create New Exercise Form State
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState<ExerciseCategory>('Free Weight');
  const [newExUnilateral, setNewExUnilateral] = useState(false);

  // Stats state
  const [exerciseStats, setExerciseStats] = useState<Record<string, { last: string, pr: string } | null>>({});
  const [lastSessionSets, setLastSessionSets] = useState<Record<string, ExerciseSet[] | null>>({});
  
  // Detailed History for Side Panel
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryPoint[]>([]);

  // Undo state for suggestions
  const [justHidden, setJustHidden] = useState<string | null>(null);

  // Audio for timer
  const audioContextRef = useRef<AudioContext | null>(null);

  const categories: ExerciseCategory[] = ['Free Weight', 'Cable', 'Machine', 'Bodyweight', 'Cardio', 'Other'];

  const updateExerciseData = useCallback((id: string, name: string) => {
      if (!userId || !name) return;
      const stats = getExerciseStats(userId, name);
      setExerciseStats(prev => ({...prev, [id]: stats}));
      
      const lastSets = getLastExerciseSets(userId, name, editWorkoutId);
      setLastSessionSets(prev => ({...prev, [id]: lastSets}));
  }, [userId, editWorkoutId]);

  useEffect(() => {
    if (userId && focusedExerciseName) {
        setExerciseHistory(getExerciseHistory(userId, focusedExerciseName));
    } else {
        setExerciseHistory([]);
    }
  }, [userId, focusedExerciseName]);

  useEffect(() => {
    if (!userId) return;

    setKnownExercises(getKnownExercises(userId));
    const prefRest = getRestTimerPreference(userId);
    setDefaultRestDuration(prefRest);

    const draft = getDraft(userId);
    const isDraftRelevant = draft && (draft.editWorkoutId === editWorkoutId);

    if (isDraftRelevant) {
        setWorkoutName(draft.workoutName);
        setStartTime(draft.startTime);
        setHasStarted(draft.hasStarted ?? true);
        setExercises(draft.exercises);
        setExpandedExercises(draft.exercisesExpanded || {});
        setShowNotes(draft.notesExpanded || {});
        
        setIsTimerRunning(!draft.timerPaused);
        setTimerPausedAt(draft.timerPausedAt);
        setTotalPausedTime(draft.totalPausedTime || 0);

        // Restore Rest Timer
        if (draft.restTimer && draft.restTimer.isActive) {
            // Recalculate based on end time to handle closed tab
            if (draft.restTimer.endTime) {
                const remaining = Math.ceil((draft.restTimer.endTime - Date.now()) / 1000);
                if (remaining > 0) {
                    setRestTimerActive(true);
                    setRestTimeLeft(remaining);
                }
            }
        }

        draft.exercises.forEach(e => updateExerciseData(e.id, e.name));
    } else {
        if (editWorkoutId) {
            const existing = getWorkoutById(userId, editWorkoutId);
            if (existing) {
                setWorkoutName(existing.name);
                setStartTime(existing.startTime);
                setHasStarted(true);
                setExercises(existing.exercises);
                
                const exp: Record<string, boolean> = {};
                const notesExp: Record<string, boolean> = {};
                existing.exercises.forEach(e => {
                    exp[e.id] = true;
                    if (e.notes) notesExp[e.id] = true;
                    updateExerciseData(e.id, e.name);
                });
                setExpandedExercises(exp);
                setShowNotes(notesExp);
                
                setIsTimerRunning(false); 
                setTotalPausedTime(0); 
            }
        } else if (importedTemplate) {
            if (importedTemplate.name) setWorkoutName(importedTemplate.name);
            if (importedTemplate.exercises) {
                setExercises(importedTemplate.exercises as Exercise[]);
                
                const exp: Record<string, boolean> = {};
                const notesExp: Record<string, boolean> = {};
                importedTemplate.exercises.forEach(e => {
                    exp[e.id] = true;
                    if (e.notes) notesExp[e.id] = true;
                    updateExerciseData(e.id, e.name);
                });
                setExpandedExercises(exp);
                setShowNotes(notesExp);
            }
            setStartTime(Date.now());
            setHasStarted(true);
            setIsTimerRunning(true);
            setTotalPausedTime(0);
        } else {
            setWorkoutName(`Workout ${new Date().toLocaleDateString()}`);
            setStartTime(Date.now());
            setHasStarted(false);
            setTotalPausedTime(0);
            setIsTimerRunning(false);
        }
    }
  }, [editWorkoutId, importedTemplate, userId, updateExerciseData]);

  // Draft Save Effect
  useEffect(() => {
      if (!userId) return;
      const timeoutId = setTimeout(() => {
        const draft: WorkoutDraft = {
            editWorkoutId,
            workoutName,
            exercises,
            startTime,
            hasStarted,
            timerPaused: !isTimerRunning,
            timerPausedAt,
            totalPausedTime,
            exercisesExpanded: expandedExercises,
            notesExpanded: showNotes,
            restTimer: restTimerActive ? {
                isActive: true,
                timeLeft: restTimeLeft,
                duration: defaultRestDuration,
                endTime: Date.now() + (restTimeLeft * 1000)
            } : undefined
        };
        saveDraft(userId, draft);
      }, 1000);
      return () => clearTimeout(timeoutId);
  }, [userId, editWorkoutId, workoutName, exercises, startTime, isTimerRunning, timerPausedAt, totalPausedTime, expandedExercises, showNotes, hasStarted, restTimerActive, restTimeLeft, defaultRestDuration]);

  // Main Workout Timer
  useEffect(() => {
    let interval: any;
    const updateTimer = () => {
        if (!hasStarted) {
            setTimerDisplay(0);
            return;
        }
        const now = Date.now();
        if (isTimerRunning) {
            const elapsed = now - startTime - totalPausedTime;
            setTimerDisplay(Math.max(0, Math.floor(elapsed / 1000)));
        } else if (timerPausedAt) {
            const elapsed = timerPausedAt - startTime - totalPausedTime;
            setTimerDisplay(Math.max(0, Math.floor(elapsed / 1000)));
        } else {
             const elapsed = now - startTime;
             setTimerDisplay(Math.max(0, Math.floor(elapsed / 1000)));
        }
    };
    updateTimer();
    if (isTimerRunning && hasStarted) {
        interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, startTime, totalPausedTime, timerPausedAt, hasStarted]);

  // Rest Timer Logic
  useEffect(() => {
      let interval: any;
      if (restTimerActive && restTimeLeft > 0) {
          interval = setInterval(() => {
              setRestTimeLeft(prev => prev - 1);
          }, 1000);
      } else if (restTimerActive && restTimeLeft <= 0) {
          // Timer Finished
          setRestTimerActive(false);
          playNotificationSound();
      }
      return () => clearInterval(interval);
  }, [restTimerActive, restTimeLeft]);

  const playNotificationSound = () => {
      try {
          if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioContextRef.current;
          
          // Resume if suspended (browser policy)
          if(ctx.state === 'suspended') {
              ctx.resume();
          }

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          // Simple beep
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
          
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

          osc.start();
          osc.stop(ctx.currentTime + 0.5);
      } catch (e) {
          console.error("Audio play failed", e);
      }
  };

  const toggleTimer = () => {
      if (!hasStarted) {
          setHasStarted(true);
          setStartTime(Date.now());
          setIsTimerRunning(true);
          setTotalPausedTime(0);
          return;
      }
      if (isTimerRunning) {
          setIsTimerRunning(false);
          setTimerPausedAt(Date.now());
      } else {
          setIsTimerRunning(true);
          if (timerPausedAt) {
              const pauseDuration = Date.now() - timerPausedAt;
              setTotalPausedTime(prev => prev + pauseDuration);
          }
          setTimerPausedAt(null);
      }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
      handleSave();
      clearDraft(userId);
      clearChatHistory(userId);
      onFinish();
  };

  const handleCancel = () => {
      if (window.confirm("Are you sure you want to cancel? This workout will be lost.")) {
          clearDraft(userId);
          clearChatHistory(userId);
          onCancel();
      }
  };

  const openAddModal = () => {
      setModalView('SEARCH');
      setSearchQuery('');
      setShowAddModal(true);
  };

  const handleAddExerciseFromModal = (ex: KnownExercise) => {
      addExerciseToWorkout(ex.name, ex.category, ex.isUnilateral);
      setShowAddModal(false);
  };

  const handleCreateExercise = () => {
      if (!newExName.trim()) return;
      addExerciseToWorkout(newExName.trim(), newExCategory, newExUnilateral);
      setNewExName('');
      setNewExCategory('Free Weight');
      setNewExUnilateral(false);
      setShowAddModal(false);
  };

  const addExerciseToWorkout = (name: string, category?: ExerciseCategory, isUnilateral?: boolean) => {
    if (!hasStarted) {
        setHasStarted(true);
        setStartTime(Date.now());
        setIsTimerRunning(true);
        setTotalPausedTime(0);
    }

    const newEx: Exercise = {
        id: generateId(),
        name: name,
        category: category,
        isUnilateral: isUnilateral,
        sets: [
            { id: generateId(), weight: 0, reps: 0, repsLeft: 0, repsRight: 0, distance: 0, time: 0, completed: false }
        ]
    };
    
    setExercises([...exercises, newEx]);
    setExpandedExercises(prev => ({...prev, [newEx.id]: true}));
    updateExerciseData(newEx.id, name);
  };

  const updateExerciseName = (id: string, name: string) => {
    setExercises(exercises.map(e => e.id === id ? { ...e, name } : e));
    if (focusedExerciseId === id) {
        setFocusedExerciseName(name);
    }
  };

  const handleExerciseNameFocus = (id: string, name: string) => {
      setFocusedExerciseId(id);
      setFocusedExerciseName(name);
  };

  const handleExerciseNameBlur = (id: string, name: string) => {
      setTimeout(() => {
          setFocusedExerciseId(null);
          updateExerciseData(id, name);
      }, 200);
  };

  const updateExerciseNotes = (id: string, notes: string) => {
    setExercises(exercises.map(e => e.id === id ? { ...e, notes } : e));
  };

  const addSet = (exerciseId: string) => {
    setExercises(exercises.map(e => {
        if (e.id === exerciseId) {
            const previousSet = e.sets[e.sets.length - 1];
            const newSetIndex = e.sets.length;
            const lastSets = lastSessionSets[exerciseId];
            const hasGhostData = lastSets && lastSets[newSetIndex];
            
            const initialWeight = hasGhostData ? 0 : (previousSet ? previousSet.weight : 0);
            const initialReps = hasGhostData ? 0 : (previousSet ? previousSet.reps : 0);
            const initialRepsLeft = hasGhostData ? 0 : (previousSet?.repsLeft || 0);
            const initialRepsRight = hasGhostData ? 0 : (previousSet?.repsRight || 0);
            const initialDist = hasGhostData ? 0 : (previousSet?.distance || 0);
            const initialTime = hasGhostData ? 0 : (previousSet?.time || 0);

            return {
                ...e,
                sets: [...e.sets, { 
                    id: generateId(), 
                    weight: initialWeight, 
                    reps: initialReps,
                    repsLeft: initialRepsLeft,
                    repsRight: initialRepsRight,
                    distance: initialDist,
                    time: initialTime,
                    completed: false 
                }]
            };
        }
        return e;
    }));
  };

  const removeLastSet = (exerciseId: string) => {
    setExercises(exercises.map(e => {
        if (e.id === exerciseId && e.sets.length > 0) {
            const newSets = [...e.sets];
            newSets.pop();
            return {
                ...e,
                sets: newSets
            };
        }
        return e;
    }));
  };

  const updateSet = (exerciseId: string, setId: string, field: keyof ExerciseSet, value: any) => {
    setExercises(exercises.map(e => {
        if (e.id === exerciseId) {
            return {
                ...e,
                sets: e.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
            };
        }
        return e;
    }));
  };

  const toggleSetComplete = (exerciseId: string, setId: string, index: number) => {
      // Init audio context on first user interaction if needed
      if (!audioContextRef.current) {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      setExercises(exercises.map(e => {
          if (e.id === exerciseId) {
              const set = e.sets.find(s => s.id === setId);
              const lastSets = lastSessionSets[exerciseId];
              const prevSetData = lastSets && lastSets[index];

              if (set && !set.completed) {
                  // Mark as Complete logic
                  const updates: Partial<ExerciseSet> = { completed: true };
                  
                  if (e.category === 'Cardio') {
                      if ((!set.distance || set.distance === 0) && prevSetData?.distance) updates.distance = prevSetData.distance;
                      if ((!set.time || set.time === 0) && prevSetData?.time) updates.time = prevSetData.time;
                  } else {
                      if ((!set.weight || set.weight === 0) && prevSetData?.weight) updates.weight = prevSetData.weight;
                      
                      if (e.isUnilateral) {
                          if ((!set.repsLeft || set.repsLeft === 0) && prevSetData?.repsLeft) updates.repsLeft = prevSetData.repsLeft;
                          if ((!set.repsRight || set.repsRight === 0) && prevSetData?.repsRight) updates.repsRight = prevSetData.repsRight;
                      } else {
                          if ((!set.reps || set.reps === 0) && prevSetData?.reps) updates.reps = prevSetData.reps;
                      }
                  }

                  // TRIGGER REST TIMER
                  setRestTimeLeft(defaultRestDuration);
                  setRestTimerActive(true);

                  return {
                      ...e,
                      sets: e.sets.map(s => s.id === setId ? { ...s, ...updates } : s)
                  };
              }

              // Unmark (Do not stop timer if they uncheck, usually just a mistake)
              return {
                  ...e,
                  sets: e.sets.map(s => s.id === setId ? { ...s, completed: !s.completed } : s)
              };
          }
          return e;
      }));
  };

  const removeExercise = (id: string) => {
    setExercises(exercises.filter(e => e.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpandedExercises(prev => ({...prev, [id]: !prev[id]}));
  };

  const toggleNotes = (id: string) => {
    setShowNotes(prev => ({...prev, [id]: !prev[id]}));
  };

  const handleSave = () => {
    if (!userId) return;
    const workout: WorkoutSession = {
        id: editWorkoutId || generateId(),
        name: workoutName,
        startTime,
        endTime: Date.now(),
        exercises,
    };
    saveWorkout(userId, workout);
  };

  const getSuggestions = (input: string) => {
      if (!input.trim()) return [];
      const lowerInput = input.toLowerCase();
      return knownExercises
        .filter(ex => ex.name.toLowerCase().includes(lowerInput) && ex.name.toLowerCase() !== lowerInput)
        .slice(0, 5)
        .map(ex => ex.name);
  };

  const handleRemoveSuggestion = (e: React.MouseEvent, name: string) => {
      e.preventDefault();
      e.stopPropagation();
      hideExerciseName(userId, name);
      setKnownExercises(getKnownExercises(userId)); 
      setJustHidden(name);
      setTimeout(() => {
          setJustHidden(current => current === name ? null : current);
      }, 5000);
  };

  const handleUndoHidden = () => {
      if (justHidden) {
          unhideExerciseName(userId, justHidden);
          setKnownExercises(getKnownExercises(userId));
          setJustHidden(null);
      }
  };

  const preventNonNumeric = (e: React.KeyboardEvent) => {
      if (['e', 'E', '+', '-'].includes(e.key)) {
          e.preventDefault();
      }
  };

  const updateRestDuration = (delta: number) => {
      const newVal = Math.max(0, defaultRestDuration + delta);
      setDefaultRestDuration(newVal);
      saveRestTimerPreference(userId, newVal);
      // If timer is active, adjust current time too
      if (restTimerActive) {
          setRestTimeLeft(prev => Math.max(0, prev + delta));
      }
  };

  const skipRest = () => {
      setRestTimerActive(false);
  };

  const filteredKnownExercises = knownExercises.filter(ex => 
      ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-slate-950">
        <div className="flex-1 flex flex-col h-full relative border-r border-slate-800">
            <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 pt-6 pb-4 px-4 shadow-sm">
                <div className="flex justify-between items-start mb-5">
                    <div className="relative flex-1 mr-4 group">
                         <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block">Workout Name</label>
                         <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                value={workoutName}
                                onChange={(e) => setWorkoutName(e.target.value)}
                                className="bg-transparent text-3xl font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-lg px-1 -ml-1 w-full placeholder-slate-600 truncate"
                                placeholder="My Workout"
                            />
                            <Pencil size={18} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                         </div>
                    </div>
                    <button 
                        onClick={handleCancel} 
                        className="bg-slate-900 h-10 w-10 flex items-center justify-center rounded-full text-slate-400 hover:text-red-400 border border-slate-800 active:scale-95 transition-all"
                        title="Cancel Workout"
                    >
                        <X size={22} />
                    </button>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                    <div 
                        onClick={toggleTimer} 
                        className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-2xl font-mono text-xl font-bold cursor-pointer transition-all active:scale-95 ${isTimerRunning ? 'bg-indigo-900/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
                    >
                        <Clock size={20} className={isTimerRunning ? "animate-pulse" : ""} />
                        {formatTime(timerDisplay)}
                    </div>
                    <button 
                        onClick={handleFinish} 
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3 rounded-2xl shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2 text-lg active:scale-95 transition-all"
                    >
                        <Save size={20} /> Finish
                    </button>
                </div>
            </div>

            {justHidden && (
                <div className="absolute top-40 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-slate-200 px-4 py-2 rounded-full shadow-lg border border-slate-700 flex items-center gap-3 text-sm animate-fade-in-down w-max">
                    <span>Removed "{justHidden}"</span>
                    <button 
                        onClick={handleUndoHidden}
                        className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                        <RotateCcw size={14} /> Undo
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                {exercises.map((exercise, index) => {
                    const suggestions = focusedExerciseId === exercise.id ? getSuggestions(exercise.name) : [];
                    const stats = exerciseStats[exercise.id];
                    const lastSets = lastSessionSets[exercise.id];
                    const isCardio = exercise.category === 'Cardio';
                    const isBodyweight = exercise.category === 'Bodyweight';
                    const isUnilateral = exercise.isUnilateral;

                    return (
                        <div key={exercise.id} className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm relative overflow-visible transition-colors hover:border-slate-700">
                            <div className="p-3 bg-slate-800/50 flex flex-col gap-2 relative rounded-t-xl">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 flex-1 relative">
                                        <span className="text-slate-500 text-xs font-mono w-5">#{index + 1}</span>
                                        <div className="relative w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white text-base font-bold w-auto max-w-[60%]">{exercise.name}</span>
                                                <div className="flex gap-1">
                                                    {exercise.category && (
                                                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                                                            {exercise.category}
                                                        </span>
                                                    )}
                                                    {exercise.isUnilateral && (
                                                        <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-300 bg-indigo-900/40 px-1.5 py-0.5 rounded">
                                                            UNI
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {stats && stats.pr !== "N/A" && (
                                                <div className="flex items-center gap-4 mt-1 text-[10px] text-slate-400 font-medium">
                                                    <div className="flex items-center gap-1" title="Personal Record">
                                                        <Trophy size={10} className="text-amber-400" />
                                                        PR: <span className="text-slate-300">{stats.pr}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => toggleNotes(exercise.id)} 
                                            className={`p-2 hover:text-white transition-colors ${exercise.notes || showNotes[exercise.id] ? 'text-indigo-400' : 'text-slate-400'}`}
                                            title="Add Notes"
                                        >
                                            <MessageSquare size={18} />
                                        </button>
                                        <button onClick={() => toggleExpand(exercise.id)} className="p-2 text-slate-400 hover:text-white">
                                            {expandedExercises[exercise.id] ? <ChevronUp size={20}/> : <ChevronDown size={20} />}
                                        </button>
                                        <button onClick={() => removeExercise(exercise.id)} className="p-2 text-slate-400 hover:text-red-400">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                
                                {(showNotes[exercise.id] || exercise.notes) && (
                                    <div className="px-7 pb-1">
                                        <input 
                                            value={exercise.notes || ''} 
                                            onChange={(e) => updateExerciseNotes(exercise.id, e.target.value)}
                                            placeholder="Add notes..." 
                                            className="w-full bg-slate-900/50 text-sm text-slate-300 placeholder-slate-600 border border-slate-700 rounded px-2 py-2 focus:outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                )}
                            </div>

                            {expandedExercises[exercise.id] && (
                                <div className="p-2">
                                    <div className="grid grid-cols-10 gap-2 mb-2 px-2 text-[10px] uppercase text-slate-500 font-bold tracking-wider text-center">
                                        <div className="col-span-2">Set</div>
                                        <div className="col-span-3">{isCardio ? 'Dist (mi)' : (isBodyweight ? '+ LBs' : 'LBs')}</div>
                                        <div className="col-span-3">{isCardio ? 'Time (m)' : 'Reps'}</div>
                                        <div className="col-span-2">Done</div>
                                    </div>
                                    
                                    {exercise.sets.map((set, setIndex) => {
                                        const prevSet = lastSets && lastSets[setIndex];
                                        const ghostWeight = prevSet ? prevSet.weight : undefined;
                                        const ghostReps = prevSet ? prevSet.reps : undefined;
                                        const ghostDist = prevSet ? prevSet.distance : undefined;
                                        const ghostTime = prevSet ? prevSet.time : undefined;

                                        return (
                                            <div 
                                                key={set.id} 
                                                className={`grid grid-cols-10 gap-2 items-center mb-2 p-2 rounded-lg transition-all duration-300 ${
                                                    set.completed 
                                                        ? 'bg-emerald-900/10 opacity-60 grayscale-[0.3]' 
                                                        : 'bg-slate-950'
                                                }`}
                                            >
                                                <div className="col-span-2 text-center text-slate-400 text-sm font-mono">{setIndex + 1}</div>
                                                <div className="col-span-3">
                                                    <input 
                                                        type="number"
                                                        inputMode="decimal"
                                                        min="0"
                                                        onKeyDown={preventNonNumeric}
                                                        value={isCardio ? (set.distance || '') : (set.weight || '')} 
                                                        onChange={(e) => updateSet(exercise.id, set.id, isCardio ? 'distance' : 'weight', parseFloat(e.target.value))}
                                                        className={`w-full bg-slate-800 border rounded-lg p-2 text-center text-lg md:text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono placeholder-slate-600 ${set.completed ? 'border-transparent text-slate-400' : 'border-slate-700'}`}
                                                        placeholder={isCardio ? (ghostDist?.toString() || "0") : (ghostWeight?.toString() || "0")}
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    {isCardio ? (
                                                        <input 
                                                            type="number"
                                                            inputMode="decimal"
                                                            min="0"
                                                            onKeyDown={preventNonNumeric}
                                                            value={set.time || ''} 
                                                            onChange={(e) => updateSet(exercise.id, set.id, 'time', parseFloat(e.target.value))}
                                                            className={`w-full bg-slate-800 border rounded-lg p-2 text-center text-lg md:text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono placeholder-slate-600 ${set.completed ? 'border-transparent text-slate-400' : 'border-slate-700'}`}
                                                            placeholder={ghostTime?.toString() || "0"}
                                                        />
                                                    ) : isUnilateral ? (
                                                        <div className="flex gap-1">
                                                            <input 
                                                                type="number"
                                                                inputMode="numeric"
                                                                min="0"
                                                                value={set.repsLeft || ''}
                                                                onChange={(e) => updateSet(exercise.id, set.id, 'repsLeft', parseFloat(e.target.value))}
                                                                className={`w-full bg-slate-800 border rounded-lg p-1 text-center text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono placeholder-slate-600 ${set.completed ? 'border-transparent text-slate-400' : 'border-slate-700'}`}
                                                                placeholder="L"
                                                            />
                                                            <input 
                                                                type="number"
                                                                inputMode="numeric"
                                                                min="0"
                                                                value={set.repsRight || ''}
                                                                onChange={(e) => updateSet(exercise.id, set.id, 'repsRight', parseFloat(e.target.value))}
                                                                className={`w-full bg-slate-800 border rounded-lg p-1 text-center text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono placeholder-slate-600 ${set.completed ? 'border-transparent text-slate-400' : 'border-slate-700'}`}
                                                                placeholder="R"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type="number"
                                                            inputMode="numeric"
                                                            min="0"
                                                            onKeyDown={preventNonNumeric}
                                                            value={set.reps || ''} 
                                                            onChange={(e) => updateSet(exercise.id, set.id, 'reps', parseFloat(e.target.value))}
                                                            className={`w-full bg-slate-800 border rounded-lg p-2 text-center text-lg md:text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono placeholder-slate-600 ${set.completed ? 'border-transparent text-slate-400' : 'border-slate-700'}`}
                                                            placeholder={ghostReps?.toString() || "0"}
                                                        />
                                                    )}
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                    <button 
                                                        onClick={() => toggleSetComplete(exercise.id, set.id, setIndex)}
                                                        className={`h-10 w-10 md:h-8 md:w-8 rounded-lg flex items-center justify-center transition-all active:scale-95 ${set.completed ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                    >
                                                        <Check size={20} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    <div className="flex gap-2 mt-2">
                                        <Button 
                                            variant="ghost" 
                                            size="md" 
                                            onClick={() => removeLastSet(exercise.id)}
                                            className="w-1/3 border border-dashed border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500/50 py-3"
                                            disabled={exercise.sets.length <= 1}
                                        >
                                            <Minus size={16} className="mr-1"/> Remove
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="md" 
                                            fullWidth 
                                            onClick={() => addSet(exercise.id)}
                                            className="border border-dashed border-slate-700 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 py-3"
                                        >
                                            <Plus size={16} className="mr-1"/> Add Set
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                <Button 
                    variant="outline" 
                    fullWidth 
                    onClick={openAddModal}
                    className="py-4 border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 bg-slate-900/50"
                >
                    <Plus size={24} className="mr-2"/> Add Exercise
                </Button>
            </div>
        </div>

        {/* REST TIMER OVERLAY */}
        {restTimerActive && (
             <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
                 <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2 text-indigo-400">
                         <Timer size={18} className="animate-pulse" />
                         <span className="font-bold text-sm tracking-wide uppercase">Resting</span>
                     </div>
                     <button onClick={skipRest} className="text-slate-500 hover:text-white transition-colors">
                         <X size={18} />
                     </button>
                 </div>
                 
                 <div className="flex items-center justify-between">
                     <div className="font-mono text-4xl font-black text-white w-24">
                         {formatTime(restTimeLeft)}
                     </div>
                     
                     <div className="flex gap-2">
                         <button 
                            onClick={() => updateRestDuration(-10)}
                            className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-slate-700 active:bg-slate-700"
                            title="-10s"
                        >
                             -10
                         </button>
                         <button 
                            onClick={() => updateRestDuration(30)}
                            className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-slate-700 active:bg-slate-700"
                            title="+30s"
                        >
                             +30
                         </button>
                         <button 
                            onClick={skipRest}
                            className="h-10 px-4 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-medium hover:bg-indigo-500 shadow-lg shadow-indigo-900/30"
                         >
                             Skip <SkipForward size={16} className="ml-1 fill-white" />
                         </button>
                     </div>
                 </div>
                 <div className="mt-2 text-center">
                    <span className="text-[10px] text-slate-600">Default: {defaultRestDuration}s</span>
                 </div>
             </div>
        )}

        <div className="hidden md:flex flex-col w-96 bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Activity size={18} className="text-indigo-400" />
                    Exercise Insights
                </h3>
            </div>
            
            {focusedExerciseName && exerciseHistory.length > 0 ? (
                <div className="p-4 space-y-6">
                    <div>
                        <h4 className="text-sm text-slate-400 mb-4">{focusedExerciseName} Progress</h4>
                        <div className="h-40 w-full bg-slate-800/50 rounded-xl p-2 border border-slate-800">
                             <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={exerciseHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis 
                                        stroke="#64748b" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip 
                                        contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px'}}
                                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="maxWeight" 
                                        stroke="#818cf8" 
                                        strokeWidth={2} 
                                        dot={{fill: '#818cf8', strokeWidth: 0, r: 3}}
                                        activeDot={{r: 5, fill: '#fff'}}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Performances</h4>
                        <div className="space-y-2">
                            {exerciseHistory.slice().reverse().slice(0, 5).map((point, i) => (
                                <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-slate-400">{new Date(point.date).toLocaleDateString()}</span>
                                        <span className="text-xs font-bold text-white">
                                            {point.maxWeight} {point.bestSet.distance ? 'mi' : 'lbs'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {point.bestSet.distance ? (
                                            `Distance: ${point.bestSet.distance}mi / Time: ${point.bestSet.time}m`
                                        ) : (
                                            `Best set: ${point.bestSet.weight}lbs x ${point.bestSet.repsLeft ? `(L:${point.bestSet.repsLeft} R:${point.bestSet.repsRight})` : point.bestSet.reps}`
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <TrendingUp size={20} />
                    </div>
                    <p className="text-sm">Select an exercise to see your history and progression chart.</p>
                </div>
            )}
        </div>

        {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    {modalView === 'SEARCH' ? (
                        <>
                            <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                                <Search size={20} className="text-slate-400" />
                                <input 
                                    autoFocus
                                    placeholder="Search exercises..."
                                    className="flex-1 bg-transparent text-white text-lg focus:outline-none placeholder-slate-600"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {filteredKnownExercises.length === 0 && searchQuery && (
                                     <div className="p-4 text-center text-slate-500">
                                        <p>No exercises found.</p>
                                        <Button 
                                            variant="primary" 
                                            className="mt-3"
                                            onClick={() => {
                                                setNewExName(searchQuery);
                                                setModalView('CREATE');
                                            }}
                                        >
                                            Create "{searchQuery}"
                                        </Button>
                                     </div>
                                )}
                                <div className="space-y-1">
                                    {filteredKnownExercises.map((ex) => (
                                        <div 
                                            key={ex.name} 
                                            onClick={() => handleAddExerciseFromModal(ex)}
                                            className="p-3 rounded-xl hover:bg-slate-800 cursor-pointer flex justify-between items-center group transition-colors"
                                        >
                                            <div>
                                                <div className="font-medium text-slate-200">{ex.name}</div>
                                                <div className="flex gap-2 mt-1">
                                                    {ex.category && (
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{ex.category}</span>
                                                    )}
                                                    {ex.isUnilateral && (
                                                        <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-900/50">Unilateral</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => handleRemoveSuggestion(e, ex.name)}
                                                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete Exercise"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-800 bg-slate-900">
                                <Button fullWidth variant="secondary" onClick={() => setModalView('CREATE')}>
                                    <Plus size={18} className="mr-2" /> Create New Exercise
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setModalView('SEARCH')} className="text-slate-400 hover:text-white">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <h3 className="font-bold text-white text-lg">Create Exercise</h3>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exercise Name</label>
                                    <input 
                                        autoFocus
                                        value={newExName}
                                        onChange={(e) => setNewExName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder-slate-500"
                                        placeholder="e.g. Bulgarian Split Squat"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setNewExCategory(cat)}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                                                    newExCategory === cat 
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50' 
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div 
                                        onClick={() => setNewExUnilateral(!newExUnilateral)}
                                        className="flex items-center justify-between bg-slate-800 border border-slate-700 p-4 rounded-xl cursor-pointer hover:bg-slate-750 transition-colors"
                                    >
                                        <div>
                                            <span className="font-medium text-white block">Unilateral Exercise</span>
                                            <span className="text-xs text-slate-500">Performed one side at a time (e.g., single-arm row)</span>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full relative transition-colors ${newExUnilateral ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${newExUnilateral ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-800 bg-slate-900">
                                <Button fullWidth size="lg" onClick={handleCreateExercise} disabled={!newExName.trim()}>
                                    Create Exercise
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
