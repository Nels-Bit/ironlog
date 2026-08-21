import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Check, Trash2, Dumbbell, X, Save, ChevronDown, ArrowDown, Flame, Skull, Circle, Pencil, Play
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { RestTimer } from '../components/RestTimer';
import { cn } from '../lib/utils';
import { useWorkout } from '../context/useWorkout';
import { haptics } from '../utils/haptics';
import { useWakeLock } from '../utils/useWakeLock';
import {
  isAssistedExercise,
  isBodyweightExercise
} from '../utils/workoutMath';
import {
  formatNumberInputValue,
  getNumberPlaceholder,
  parseNumberInputValue
} from '../utils/numberInput';
import type { Exercise, ExerciseSet } from '../types';

export const WorkoutLogger = () => {
  const navigate = useNavigate();
  const { 
    workout, elapsed, isActive, 
    startWorkout, cancelWorkout, finishWorkout, 
    addExercise, removeExercise, 
    addSet, removeSet, updateSet,
    exerciseDefs, historyCache, prCache
  } = useWorkout();

  useWakeLock(isActive);

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingExercises, setEditingExercises] = useState<Set<string>>(new Set());
  const [typeSheetOpen, setTypeSheetOpen] = useState<{ exIndex: number; setIndex: number } | null>(null);

  // --- TIMER STATE & PREFERENCES ---
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerDuration, setTimerDuration] = useState(90);
  const [timerKey, setTimerKey] = useState(0); 
  const [timerType, setTimerType] = useState<string>('normal'); // Tracks which set type triggered it

  // Unilateral manual override tracking
  const [manualOverrides, setManualOverrides] = useState<Set<string>>(new Set());

  // Load user's preferred rest times from storage
  const [restPrefs, setRestPrefs] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('ironlog_rest_prefs');
    if (saved) return JSON.parse(saved);
    return { normal: 90, warmup: 60, dropset: 60, failure: 180 }; // Factory defaults
  });

  // Function to save new defaults forever
  const handleUpdateRestDefault = (newDuration: number) => {
    setTimerDuration(newDuration); // Update current UI
    const updatedPrefs = { ...restPrefs, [timerType]: newDuration };
    setRestPrefs(updatedPrefs); // Update state
    localStorage.setItem('ironlog_rest_prefs', JSON.stringify(updatedPrefs)); // Save to memory
  };

  // Listen for Navbar signal
  useEffect(() => {
    const handleOpenSelector = () => setIsSelectorOpen(true);
    window.addEventListener('open-exercise-selector', handleOpenSelector);
    return () => window.removeEventListener('open-exercise-selector', handleOpenSelector);
  }, []);

  // Auto-collapse all exercises when mounting (returning to page)
  useEffect(() => {
    if (workout?.exercises) {
      const allIds = new Set(workout.exercises.map(e => e.id));
      setCollapsed(allIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleAddExercise = (ex: Exercise) => {
    if (workout?.exercises) {
        const allIds = new Set(workout.exercises.map(e => e.id));
        setCollapsed(allIds);
    }
    addExercise(ex);
    setIsSelectorOpen(false);
  };

  const handleFinish = async () => {
    if (confirm("Finish workout?")) {
      const id = await finishWorkout();
      try { haptics.success(); } catch { /* ignore */ }
      navigate(id ? `/summary/${id}` : '/profile');
    }
  };

  const handleCancel = () => {
    if (confirm("Cancel workout? Data will be lost.")) {
      cancelWorkout();
      navigate(-1);
    }
  };

  const toggleCollapse = (exerciseId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  const toggleExerciseEdit = (exerciseId: string) => {
    setEditingExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  // --- SMART COMPLETE & REST TIMER TRIGGER ---
  const handleSmartComplete = (
    exIndex: number, 
    setIndex: number, 
    currentSet: ExerciseSet, 
    ghostSet?: ExerciseSet
  ) => {
    const isNowComplete = !currentSet.isCompleted;

    // 1. Autofill empty values from ghost set if completing
    if (isNowComplete) {
      const def = workout?.exercises[exIndex] ? exerciseDefs.get(workout.exercises[exIndex].exerciseId) : undefined;
      const weightVal = currentSet.weight ?? ghostSet?.weight ?? null;
      
      if (currentSet.weight === null && weightVal !== null) {
        updateSet(exIndex, setIndex, 'weight', weightVal);
      }

      if (def?.isUnilateral) {
        const leftVal = currentSet.repsLeft ?? ghostSet?.repsLeft ?? null;
        const rightVal = currentSet.repsRight ?? ghostSet?.repsRight ?? null;
        if (currentSet.repsLeft === null && leftVal !== null) updateSet(exIndex, setIndex, 'repsLeft', leftVal);
        if (currentSet.repsRight === null && rightVal !== null) updateSet(exIndex, setIndex, 'repsRight', rightVal);
      } else {
        const repsVal = currentSet.reps ?? ghostSet?.reps ?? null;
        if (currentSet.reps === null && repsVal !== null) {
          updateSet(exIndex, setIndex, 'reps', repsVal);
        }
      }
    }
    
    // 2. Toggle Completion
    updateSet(exIndex, setIndex, 'isCompleted', isNowComplete);

    // Provide haptic feedback for set completion
    if (isNowComplete) {
      try { haptics.success(); } catch { /* ignore */ }

      // 3. Trigger Rest Timer
      const currentType = currentSet.type || 'normal';
      
      // Only set a new default duration if the timer is currently closed.
      // If it's open, we let it keep ticking from where it is.
      if (!timerOpen) {
        let defaultTime = 90;
        if (currentType === 'warmup') defaultTime = restPrefs.warmup || 60;
        else if (currentType === 'failure') defaultTime = restPrefs.failure || 180;
        else if (currentType === 'dropset' || currentType === 'dropset_child') defaultTime = restPrefs.dropset || 60;
        else defaultTime = restPrefs.normal || 90;

        setTimerDuration(defaultTime);
      }

      setTimerType(currentType); // Track category for saving prefs
      setTimerKey(prev => prev + 1); // Reset countdown
      setTimerOpen(true); // Popup timer
    }
  };

  const handleUnilateralChange = (
    exIndex: number,
    setIndex: number,
    setId: string,
    side: 'repsLeft' | 'repsRight',
    rawVal: string
  ) => {
    const num = parseNumberInputValue(rawVal);
    updateSet(exIndex, setIndex, side, num);

    const overrideKey = `${setId}_${side}`;
    const otherSideKey = `${setId}_${side === 'repsLeft' ? 'repsRight' : 'repsLeft'}`;

    if (!manualOverrides.has(otherSideKey)) {
      const otherSide = side === 'repsLeft' ? 'repsRight' : 'repsLeft';
      updateSet(exIndex, setIndex, otherSide, num);
    }

    setManualOverrides(prev => new Set(prev).add(overrideKey));
  };

  // --- ACTIONS FOR SET TYPES ---
  const handleAddDropSet = (exIndex: number, parentSetIndex: number) => {
    const parentSet = workout?.exercises[exIndex].sets[parentSetIndex];
    if (!parentSet) return;

    if (parentSet.type !== 'dropset' && parentSet.type !== 'dropset_child') {
      updateSet(exIndex, parentSetIndex, 'type', 'dropset');
    }

    addSet(exIndex, parentSetIndex + 1);
    setTimeout(() => {
      updateSet(exIndex, parentSetIndex + 1, 'type', 'dropset_child');
      updateSet(exIndex, parentSetIndex + 1, 'parentSetId', parentSet.id);
    }, 0);
    setTypeSheetOpen(null);
  };

  const handleSetTypeSelect = (exIndex: number, setIndex: number, type: ExerciseSet['type']) => {
    updateSet(exIndex, setIndex, 'type', type);
    setTypeSheetOpen(null);
  };

  const handleDeleteSet = (exIndex: number, setIndex: number) => {
    removeSet(exIndex, setIndex);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getTypeIcon = (type: ExerciseSet['type']) => {
    switch(type) {
      case 'warmup': return <Flame size={12} className="text-yellow-500 fill-yellow-500/20" />;
      case 'dropset': 
      case 'dropset_child': return <ArrowDown size={12} className="text-zinc-400" />;
      case 'failure': return <Skull size={12} className="text-red-500" />;
      default: return null;
    }
  };

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-brand-orange/10 border border-brand-orange/20 rounded-full flex items-center justify-center mb-6 text-brand-orange shadow-lg shadow-brand-orange/10">
          <Dumbbell size={40} />
        </div>
        <h1 className="text-3xl font-black text-white italic tracking-tight mb-2 text-center">TIME TO TRAIN</h1>
        <p className="text-zinc-500 mb-8 text-center text-sm max-w-xs">Start a blank canvas or jump into your routine.</p>
        
        <div className="w-full max-w-xs space-y-4">
          <input 
            type="text" 
            placeholder="Workout Name (e.g. Push Day)" 
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center font-bold text-white placeholder:text-zinc-600 focus:border-brand-orange outline-none transition-all shadow-inner"
          />
          <Button 
            size="lg" 
            className="w-full py-6 text-base font-bold shadow-xl shadow-brand-orange/20"
            onClick={() => startWorkout(workoutName)}
          >
            <Play size={18} className="mr-2 fill-current" /> Start Empty Workout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 animate-in fade-in duration-300">
      
      {/* 1. STICKY TOP BAR */}
      <div className="sticky top-0 z-40 bg-iron-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="font-black text-lg text-white leading-tight">{workout?.name}</h1>
          <div className="flex items-center gap-2 text-xs font-mono text-brand-orange font-bold">
            <span className="w-2 h-2 rounded-full bg-brand-orange animate-ping" />
            {formatTime(elapsed)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </Button>
          <Button size="sm" onClick={handleFinish} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold">
            <Save size={16} className="mr-1.5" /> Finish
          </Button>
        </div>
      </div>

      {/* 2. EXERCISES LIST */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {workout?.exercises.map((ex, exIndex) => {
          const def = exerciseDefs.get(ex.exerciseId);
          const isBodyweightMovement = isBodyweightExercise(def);
          const isAssistedMovement = isAssistedExercise(def);
          const weightLabel = isAssistedMovement ? 'Assistance' : isBodyweightMovement ? 'Extra LBS' : 'LBS';
          const ghostSets = historyCache.get(ex.exerciseId);
          const prWeight = prCache.get(ex.exerciseId);
          const isCollapsed = collapsed.has(ex.id);
          const isEditing = editingExercises.has(ex.id);

          return (
            <div 
              key={ex.id} 
              className={cn(
                "bg-zinc-900/50 rounded-2xl border transition-all duration-200 overflow-hidden",
                isEditing ? "border-brand-orange/30 bg-zinc-900/80" : "border-white/10"
              )}
            >
              
              {/* HEADER */}
              <div 
                className="p-4 flex justify-between items-center cursor-pointer select-none"
                onClick={() => toggleCollapse(ex.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                  <ChevronDown 
                    size={18} 
                    className={cn("text-zinc-400 transition-transform duration-200 shrink-0", isCollapsed && "-rotate-90")} 
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-white text-base truncate">{def?.name}</h3>
                      {def?.isUnilateral && (
                        <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded uppercase tracking-wider font-bold shrink-0">
                          Uni
                        </span>
                      )}
                    </div>
                    {prWeight !== undefined && prWeight > 0 && (
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        PR: <span className="text-zinc-300">{prWeight} lbs</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className={cn("w-8 h-8 rounded-lg", isEditing ? "bg-brand-orange/20 text-brand-orange" : "text-zinc-500 hover:text-white")}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExerciseEdit(ex.id);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  
                  {isEditing && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExercise(exIndex);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>

              {/* CONTENT */}
              <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
                <div className="overflow-hidden">
                  <div className="px-3 pb-3">
                      
                      <div className="grid grid-cols-10 gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center mb-2 px-2">
                          <div className="col-span-1">#</div>
                          <div className="col-span-3">{weightLabel}</div>
                          <div className="col-span-3">Reps</div>
                          <div className="col-span-3">{isEditing ? "Delete" : "Done"}</div>
                      </div>

                      <div className="space-y-2">
                      {ex.sets.map((set, setIndex) => {
                          const isDropChild = set.type === 'dropset_child';
                          const ghostSet = ghostSets ? ghostSets[setIndex] : undefined;
                          
                          return (
                              <div key={set.id} className="relative">
                                  {isDropChild && (
                                      <div className="absolute -top-3 left-[-6px] w-4 h-8 border-l-2 border-b-2 border-zinc-700 rounded-bl-xl z-0 pointer-events-none" />
                                  )}

                                  <div className={cn(
                                      "grid grid-cols-10 gap-2 items-center p-2 rounded-xl border transition-all relative z-10",
                                      set.isCompleted ? "opacity-50 border-brand-orange/20 bg-black/40" : "bg-black/40 border-white/5",
                                      isDropChild ? "ml-4 border-l-2 border-l-zinc-700" : ""
                                  )}>
                                    
                                    <div className="col-span-1 flex justify-center">
                                        {isDropChild ? (
                                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 bg-zinc-900/50">
                                            <ArrowDown size={14} />
                                          </div>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTypeSheetOpen({ exIndex, setIndex });
                                            }}
                                            disabled={isEditing}
                                            className={cn(
                                              "w-7 h-7 rounded-lg flex items-center justify-center gap-0.5 text-xs font-bold transition-all active:scale-90",
                                              "bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10"
                                            )}
                                          >
                                            <span className="text-[11px]">{setIndex + 1}</span>
                                            {getTypeIcon(set.type)}
                                          </button>
                                        )}
                                    </div>
                                    
                                    <div className="col-span-3">
                                        <motion.input
                                            type="number"
                                            min={0}
                                            placeholder={getNumberPlaceholder(ghostSet?.weight, "-")}
                                            value={formatNumberInputValue(set.weight)}
                                            disabled={isEditing}
                                            onChange={(e) => updateSet(exIndex, setIndex, 'weight', parseNumberInputValue(e.target.value))}
                                            whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                            className="w-full bg-transparent text-center font-bold text-white text-lg outline-none placeholder:text-zinc-700 focus:text-brand-orange disabled:opacity-50"
                                        />
                                    </div>
                                    
                                    <div className="col-span-3 flex justify-center">
                                        {def?.isUnilateral ? (
                                        <div className="flex gap-1 w-full">
                                            <motion.input
                                              type="number"
                                              min={0}
                                              placeholder={getNumberPlaceholder(ghostSet?.repsLeft, "L")}
                                              value={formatNumberInputValue(set.repsLeft)}
                                              onChange={(e) => handleUnilateralChange(exIndex, setIndex, set.id, 'repsLeft', e.target.value)}
                                              disabled={isEditing}
                                              whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                              transition={{ type: "spring", stiffness: 300 }}
                                              className="w-1/2 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-sm outline-none focus:bg-white/10 disabled:opacity-50"
                                            />
                                            <motion.input
                                              type="number"
                                              min={0}
                                              placeholder={getNumberPlaceholder(ghostSet?.repsRight, "R")}
                                              value={formatNumberInputValue(set.repsRight)}
                                              onChange={(e) => handleUnilateralChange(exIndex, setIndex, set.id, 'repsRight', e.target.value)}
                                              disabled={isEditing}
                                              whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                              transition={{ type: "spring", stiffness: 300 }}
                                              className="w-1/2 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-sm outline-none focus:bg-white/10 disabled:opacity-50"
                                            />
                                        </div>
                                        ) : (
                                        <motion.input
                                            type="number"
                                            min={0}
                                            placeholder={getNumberPlaceholder(ghostSet?.reps, "-")}
                                            value={formatNumberInputValue(set.reps)}
                                            onChange={(e) => updateSet(exIndex, setIndex, 'reps', parseNumberInputValue(e.target.value))}
                                            disabled={isEditing}
                                            whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                            className="w-full bg-white/5 rounded-lg py-2 text-center font-bold text-white text-lg outline-none focus:bg-white/10 disabled:opacity-50"
                                        />
                                        )}
                                    </div>

                                    <div className="col-span-3 flex items-center gap-2">
                                      {isEditing ? (
                                        <motion.button
                                          onClick={() => handleDeleteSet(exIndex, setIndex)}
                                          whileHover={{ scale: 1.03 }}
                                          whileTap={{ scale: 0.97 }}
                                          transition={{ type: "spring", stiffness: 300 }}
                                          className="flex-1 h-10 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white"
                                        >
                                          <Trash2 size={18} />
                                        </motion.button>
                                      ) : (
                                        <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSmartComplete(exIndex, setIndex, set, ghostSet);
                                            }}
                                            className={cn(
                                                "flex-1 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95", 
                                                set.isCompleted ? "bg-brand-orange text-white" : "bg-white/5 text-zinc-600 hover:bg-white/10"
                                            )}
                                        >
                                            <Check size={20} strokeWidth={4} />
                                        </button>
                                      )}
                                    </div>

                                  </div>
                              </div>
                          );
                      })}
                      </div>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-3 py-2 text-xs text-zinc-400 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5"
                        onClick={() => addSet(exIndex)}
                      >
                        <Plus size={14} className="mr-1" /> Add Set
                      </Button>
                  </div>
                </div>
              </div>

            </div>
          );
        })}

        {/* 3. ADD EXERCISE CTA */}
        <Button 
          variant="outline" 
          className="w-full py-6 border-dashed border-zinc-700 hover:border-brand-orange text-zinc-300 hover:text-brand-orange rounded-2xl bg-zinc-900/30"
          onClick={() => setIsSelectorOpen(true)}
        >
          <Plus size={20} className="mr-2" /> Add Exercise
        </Button>
      </div>

      {/* 4. REST TIMER POPUP */}
      <RestTimer 
        isOpen={timerOpen}
        initialSeconds={timerDuration}
        resetKey={timerKey}
        onClose={() => setTimerOpen(false)}
        onUpdateDefault={handleUpdateRestDefault}
        isSelectorOpen={isSelectorOpen}
      />

      {/* 5. EXERCISE PICKER OVERLAY */}
      <ExerciseSelector 
        isOpen={isSelectorOpen} 
        onClose={() => setIsSelectorOpen(false)} 
        onSelect={handleAddExercise}
      />

      {/* 6. SET TYPE BOTTOM SHEET */}
      {typeSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200">
          <div className="bg-iron-950 border border-white/10 rounded-t-3xl p-6 w-full max-w-md space-y-4 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">Select Set Type</h3>
              <Button size="icon" variant="ghost" onClick={() => setTypeSheetOpen(null)} className="rounded-full">
                <X size={18} />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleSetTypeSelect(typeSheetOpen.exIndex, typeSheetOpen.setIndex, 'normal')}
                className="p-4 rounded-xl border border-white/5 bg-white/5 hover:border-brand-orange flex flex-col items-center gap-2 text-zinc-300 hover:text-white"
              >
                <Circle size={20} className="text-zinc-500" />
                <span className="text-xs font-bold uppercase">Normal Set</span>
              </button>

              <button 
                onClick={() => handleSetTypeSelect(typeSheetOpen.exIndex, typeSheetOpen.setIndex, 'warmup')}
                className="p-4 rounded-xl border border-white/5 bg-white/5 hover:border-yellow-500 flex flex-col items-center gap-2 text-yellow-500/80 hover:text-yellow-400"
              >
                <Flame size={20} />
                <span className="text-xs font-bold uppercase">Warm-up Set</span>
              </button>

              <button 
                onClick={() => handleAddDropSet(typeSheetOpen.exIndex, typeSheetOpen.setIndex)}
                className="p-4 rounded-xl border border-white/5 bg-white/5 hover:border-zinc-400 flex flex-col items-center gap-2 text-zinc-400 hover:text-white"
              >
                <ArrowDown size={20} />
                <span className="text-xs font-bold uppercase">Add Drop Set</span>
              </button>

              <button 
                onClick={() => handleSetTypeSelect(typeSheetOpen.exIndex, typeSheetOpen.setIndex, 'failure')}
                className="p-4 rounded-xl border border-white/5 bg-white/5 hover:border-red-500 flex flex-col items-center gap-2 text-red-500/80 hover:text-red-400"
              >
                <Skull size={20} />
                <span className="text-xs font-bold uppercase">Failure Set</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};