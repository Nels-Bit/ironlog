import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Check, Trash2, Dumbbell, X, Save, ChevronDown, ArrowDown, Flame, Skull, Circle, Pencil, Play
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { RestTimer } from '../components/RestTimer';
import { cn } from '../lib/utils';
import { useWorkout } from '../context/WorkoutContext';
import { authService } from '../services/authService';
import {
  getSetLoad,
  isBodyweightExercise,
  parseUserWeight,
  shouldCountSetForPR
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
    workout, elapsed, isActive, historyCache, prCache,
    startWorkout, cancelWorkout, finishWorkout, 
    addExercise, removeExercise, addSet, removeSet, updateSet, exerciseDefs 
  } = useWorkout();

  // --- UI STATE ---
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingExercises, setEditingExercises] = useState<Set<string>>(new Set());
  const [typeSheetOpen, setTypeSheetOpen] = useState<{ exIndex: number; setIndex: number } | null>(null);

  // --- TIMER STATE & PREFERENCES ---
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerDuration, setTimerDuration] = useState(90);
  const [timerKey, setTimerKey] = useState(0); 
  const [timerType, setTimerType] = useState<string>('normal'); // Tracks which set type triggered it

  // Load user's preferred rest times from storage
  const [restPrefs, setRestPrefs] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('ironlog_rest_prefs');
    if (saved) return JSON.parse(saved);
    return { normal: 90, warmup: 60, dropset: 60, failure: 180 }; // Factory defaults
  });
  const [userWeight, setUserWeight] = useState<number | null>(null);

  useEffect(() => {
    const loadUserWeight = async () => {
      const user = await authService.getUser();
      setUserWeight(parseUserWeight(user?.weight));
    };
    loadUserWeight();
  }, []);

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
    // Collapse all existing exercises before adding the new one
    if (workout?.exercises) {
      const currentIds = workout.exercises.map(e => e.id);
      setCollapsed(new Set(currentIds));
    }
    addExercise(ex);
    setIsSelectorOpen(false);
  };

  const handleFinish = async () => {
    if(confirm("Finish workout?")) {
        await finishWorkout();
        navigate('/history');
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

  const toggleEditMode = (exerciseId: string) => {
    setEditingExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  const handleSetType = (exIndex: number, setIndex: number, newType: ExerciseSet['type']) => {
    if (!workout) return;
    const currentSet = workout.exercises[exIndex].sets[setIndex];
    if (!currentSet) return;
    const currentType = currentSet.type;

    if (newType === 'dropset' && currentType !== 'dropset') {
      updateSet(exIndex, setIndex, 'type', 'dropset');
      setTimeout(() => {
        addSet(exIndex, setIndex + 1);
        setTimeout(() => {
          updateSet(exIndex, setIndex + 1, 'type', 'dropset_child');
          updateSet(exIndex, setIndex + 1, 'parentSetId', currentSet.id);
        }, 0);
      }, 0);
    } else if (currentType === 'dropset' && newType !== 'dropset') {
      const childIndex = workout.exercises[exIndex].sets.findIndex(
        (s, i) => i > setIndex && s.type === 'dropset_child' && s.parentSetId === currentSet.id
      );
      if (childIndex !== undefined && childIndex > -1) removeSet(exIndex, childIndex);
      updateSet(exIndex, setIndex, 'type', newType);
    } else {
      updateSet(exIndex, setIndex, 'type', newType);
    }
    setTypeSheetOpen(null);
  };

  const getTypeIcon = (type: ExerciseSet['type']) => {
    switch(type) {
      case 'warmup': return <Flame size={14} className="text-yellow-500" />;
      case 'dropset': return <ArrowDown size={14} className="text-zinc-400" />;
      case 'failure': return <Skull size={14} className="text-red-500" />;
      default: return null;
    }
  };

  const handleDeleteSet = (exIndex: number, setIndex: number) => {
    const set = workout?.exercises[exIndex].sets[setIndex];
    if (set?.type === 'dropset') {
      const childIndex = workout?.exercises[exIndex].sets.findIndex(
        (s, i) => i > setIndex && s.type === 'dropset_child' && s.parentSetId === set.id
      );
      if (childIndex !== undefined && childIndex > -1) removeSet(exIndex, childIndex);
    }
    removeSet(exIndex, setIndex);
  };

  const handleSmartComplete = (exIndex: number, setIndex: number, currentSet: ExerciseSet, ghostSet?: ExerciseSet) => {
    const isNowComplete = !currentSet.isCompleted;

    // 1. Auto-Fill Logic
    if (isNowComplete && ghostSet) {
      const isWeightEmpty = currentSet.weight === null || currentSet.weight === undefined || Number.isNaN(currentSet.weight);
      const isRepsEmpty = currentSet.reps === null &&
        (currentSet.repsLeft === null || currentSet.repsLeft === undefined) &&
        (currentSet.repsRight === null || currentSet.repsRight === undefined);

      if (isWeightEmpty && ghostSet.weight !== null && ghostSet.weight !== undefined) {
        updateSet(exIndex, setIndex, 'weight', ghostSet.weight);
      }
      if (isRepsEmpty) {
        if (ghostSet.reps !== null && ghostSet.reps !== undefined) updateSet(exIndex, setIndex, 'reps', ghostSet.reps);
        if (ghostSet.repsLeft !== null && ghostSet.repsLeft !== undefined) updateSet(exIndex, setIndex, 'repsLeft', ghostSet.repsLeft);
        if (ghostSet.repsRight !== null && ghostSet.repsRight !== undefined) updateSet(exIndex, setIndex, 'repsRight', ghostSet.repsRight);
      }
    }
    
    // 2. Toggle Completion
    updateSet(exIndex, setIndex, 'isCompleted', isNowComplete);

    // 3. Trigger Rest Timer
    if (isNowComplete) {
      const currentType = currentSet.type || 'normal';
      
      // Only set a new default duration if the timer is currently closed.
      // If it's open, we let it keep ticking from where it is.
      if (!timerOpen) {
          const duration = restPrefs[currentType] || 90; // Pull from memory
          setTimerDuration(duration);
          setTimerType(currentType); // Track which type we are resting for
      }
      
      setTimerKey(prev => prev + 1); // Force reset to full time
      setTimerOpen(true);
    }
  };

  // --- RENDER: SETUP SCREEN ---
  if (!isActive || !workout) {
    return <SetupScreen onStart={startWorkout} onCancel={() => navigate(-1)} />;
  }

  // --- RENDER: ACTIVE LOGGER ---
  return (
    <div className="min-h-screen pb-48 animate-in fade-in duration-500 bg-black">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-iron-950/90 backdrop-blur-md border-b border-white/5 px-4 h-16 flex justify-between items-center shadow-2xl">
        <button onClick={handleCancel} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-red-500 transition-colors">
            <X size={20} />
        </button>

        <div className="flex flex-col items-center">
            <h1 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{workout.name}</h1>
            <div className="font-mono text-xl font-black text-brand-orange tabular-nums leading-none">
                {formatTime(elapsed)}
            </div>
        </div>

        <button onClick={handleFinish} className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-orange text-white shadow-lg shadow-brand-orange/20 hover:scale-105 transition-transform">
            <Save size={20} />
        </button>
      </header>

      {/* WORKOUT LIST */}
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        
        {/* EMPTY STATE */}
        {workout.exercises.length === 0 ? (
          <button 
            onClick={() => setIsSelectorOpen(true)}
            className="w-full text-center py-20 opacity-50 space-y-4 hover:opacity-80 active:scale-95 transition-all"
          >
            <div className="w-20 h-20 mx-auto bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                <Plus className="text-zinc-500" size={32} />
            </div>
            <p className="text-zinc-500 font-bold">Tap to add first exercise</p>
          </button>
        ) : (
          <>
            {workout.exercises.map((ex, exIndex) => {
              const def = exerciseDefs.get(ex.exerciseId);
              const isCollapsed = collapsed.has(ex.id);
              const isEditing = editingExercises.has(ex.id);
              const isBodyweightMovement = isBodyweightExercise(def);
              
              const ghostSets = historyCache.get(ex.exerciseId);
              const historicPR = prCache.get(ex.exerciseId) || 0;

              // Calculate Best Set (Current Session)
              const currentBestLoad = ex.sets.reduce((best, current) => {
                  if (!shouldCountSetForPR(current, def, undefined, userWeight)) return best;

                  const load = getSetLoad(current, def, undefined, userWeight);
                  return load > best ? load : best;
              }, 0);
              
              // DISPLAY PR LOGIC: Max of Historic vs Current
              const displayPR = Math.max(historicPR, currentBestLoad);
              const isNewPR = currentBestLoad > historicPR && currentBestLoad > 0;

              return (
                <div key={ex.id} className="relative overflow-hidden">
                  <div className="bg-iron-950 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
                      
                      {/* EXERCISE HEADER */}
                      <div 
                        className="flex justify-between items-center p-4 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors"
                        onClick={() => toggleCollapse(ex.id)}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={cn("transition-transform duration-300 text-zinc-500", isCollapsed ? "-rotate-90" : "rotate-0")}>
                              <ChevronDown size={20} />
                          </div>
                          <div>
                              <h3 className="text-white font-bold text-lg flex items-center gap-2 truncate">
                                  {def?.name || 'Loading...'}
                                  {def?.isUnilateral && <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded uppercase">Uni</span>}
                              </h3>
                              <p className={cn(
                                  "text-xs font-mono mt-1 transition-colors",
                                  isNewPR ? "text-brand-orange font-bold" : "text-zinc-500"
                              )}>
                                  {isNewPR ? '🏆 NEW PR ' : 'PR '} 
                                  {displayPR} lbs
                              </p>
                          </div>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); 
                            toggleEditMode(ex.id);
                          }}
                          className={cn(
                            "w-9 h-9 flex items-center justify-center rounded-full transition-colors",
                            isEditing ? "bg-red-500/20 text-red-500" : "bg-white/5 text-zinc-500 hover:text-white"
                          )}
                        >
                          {isEditing ? <Check size={18} /> : <Pencil size={16} />}
                        </button>
                      </div>

                      {/* CONTENT */}
                      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
                        <div className="overflow-hidden">
                          <div className="px-3 pb-3">
                              
                              <div className="grid grid-cols-10 gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center mb-2 px-2">
                                  <div className="col-span-1">#</div>
                                  <div className="col-span-3">{isBodyweightMovement ? 'Extra LBS' : 'LBS'}</div>
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
                                                <input 
                                                    type="number" 
                                                min={0}
                                                placeholder={getNumberPlaceholder(ghostSet?.weight, "-")}
                                                value={formatNumberInputValue(set.weight)} 
                                                    disabled={isEditing}
                                                onChange={(e) => updateSet(exIndex, setIndex, 'weight', parseNumberInputValue(e.target.value))}
                                                    className="w-full bg-transparent text-center font-bold text-white text-lg outline-none placeholder:text-zinc-700 focus:text-brand-orange disabled:opacity-50" 
                                                />
                                            </div>
                                            
                                            <div className="col-span-3 flex justify-center">
                                                {def?.isUnilateral ? (
                                                <div className="flex gap-1 w-full">
                                                    <input type="number" min={0} placeholder={getNumberPlaceholder(ghostSet?.repsLeft, "L")} value={formatNumberInputValue(set.repsLeft)} onChange={(e) => updateSet(exIndex, setIndex, 'repsLeft', parseNumberInputValue(e.target.value))} disabled={isEditing} className="w-1/2 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-sm outline-none focus:bg-white/10 disabled:opacity-50" />
                                                    <input type="number" min={0} placeholder={getNumberPlaceholder(ghostSet?.repsRight, "R")} value={formatNumberInputValue(set.repsRight)} onChange={(e) => updateSet(exIndex, setIndex, 'repsRight', parseNumberInputValue(e.target.value))} disabled={isEditing} className="w-1/2 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-sm outline-none focus:bg-white/10 disabled:opacity-50" />
                                                </div>
                                                ) : (
                                                <input 
                                                    type="number" 
                                                min={0}
                                                  placeholder={getNumberPlaceholder(ghostSet?.reps, "-")}
                                                  value={formatNumberInputValue(set.reps)} 
                                                  onChange={(e) => updateSet(exIndex, setIndex, 'reps', parseNumberInputValue(e.target.value))}
                                                    disabled={isEditing}
                                                    className="w-full bg-white/5 rounded-lg py-2 text-center font-bold text-white text-lg outline-none focus:bg-white/10 disabled:opacity-50" 
                                                />
                                                )}
                                            </div>

                                            <div className="col-span-3 flex items-center gap-2">
                                              {isEditing ? (
                                                <button 
                                                  onClick={() => handleDeleteSet(exIndex, setIndex)}
                                                  className="flex-1 h-10 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                                >
                                                  <Trash2 size={18} />
                                                </button>
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
                              
                              <div className="flex gap-2 mt-2">
                                {isEditing ? (
                                  <Button variant="destructive" size="sm" className="w-full py-3" onClick={() => removeExercise(exIndex)}>
                                      Delete Exercise
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" className="w-full bg-white/5 hover:bg-white/10 text-zinc-400 py-3" onClick={() => addSet(exIndex)}>
                                      <Plus size={16} className="mr-2" /> Add Set
                                  </Button>
                                )}
                              </div>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              );
            })}

            {/* --- ADD EXERCISE BUTTON --- */}
            <Button 
              className="w-full py-8 text-lg font-bold bg-zinc-900/50 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-900 active:scale-[0.98] transition-all rounded-2xl"
              onClick={() => setIsSelectorOpen(true)}
            >
              <Plus className="mr-2" size={24} /> Add Another Exercise
            </Button>
          </>
        )}
      </div>

      {/* Set Type Sheet */}
      {typeSheetOpen && (() => {
        const currentSet = workout.exercises[typeSheetOpen.exIndex].sets[typeSheetOpen.setIndex];
        const currentType = currentSet?.type || 'normal';
        
        const availableTypes = [
          { type: 'normal' as const, icon: <Circle size={32} className="text-zinc-400" />, label: 'Normal' },
          { type: 'warmup' as const, icon: <Flame size={32} className="text-yellow-500" />, label: 'Warmup' },
          { type: 'dropset' as const, icon: <ArrowDown size={32} className="text-zinc-400" />, label: 'Drop' },
          { type: 'failure' as const, icon: <Skull size={32} className="text-red-500" />, label: 'Failure' },
        ].filter(t => t.type !== currentType);

        return (
          <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] animate-in fade-in duration-200" onClick={() => setTypeSheetOpen(null)} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 pointer-events-none">
              <div className="bg-iron-950 border border-white/10 rounded-3xl p-6 shadow-2xl pointer-events-auto animate-in zoom-in-95 duration-200 max-w-xs w-full">
                <h3 className="text-center text-sm font-bold text-zinc-400 uppercase tracking-wider mb-6">Set Type</h3>
                <div className="flex flex-col gap-3">
                  {availableTypes.map(({ type, icon, label }) => (
                    <button
                      key={type}
                      onClick={() => handleSetType(typeSheetOpen.exIndex, typeSheetOpen.setIndex, type)}
                      className="flex items-center gap-4 p-4 rounded-xl bg-black/40 border border-white/10 hover:border-white/30 hover:bg-white/5 active:scale-98 transition-all"
                    >
                      <div className="shrink-0">{icon}</div>
                      <span className="text-white font-bold text-lg">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      <ExerciseSelector isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} onSelect={handleAddExercise} />
      
      {/* REST TIMER */}
      <RestTimer 
        isOpen={timerOpen} 
        onClose={() => setTimerOpen(false)} 
        initialSeconds={timerDuration}
        resetKey={timerKey}
        onUpdateDefault={handleUpdateRestDefault}
      />

    </div>
  );
};

const SetupScreen = ({ onStart, onCancel }: { onStart: (name: string) => void, onCancel: () => void }) => {
  const [name, setName] = useState('');
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 animate-in fade-in">
      <div className="w-full max-w-sm bg-iron-950 border border-white/10 rounded-3xl p-6 space-y-6">
        <div className="text-center"><div className="inline-flex w-12 h-12 bg-white/5 rounded-full items-center justify-center mb-4 text-zinc-500"><Dumbbell size={24} /></div><h2 className="text-xl font-bold text-white">Start Workout</h2></div>
        <input autoFocus type="text" placeholder={`Workout ${new Date().toLocaleDateString()}`} value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white text-center font-bold focus:border-brand-orange outline-none" />
        <div className="space-y-3"><Button className="w-full py-4" onClick={() => onStart(name)}><Play size={18} className="mr-2" /> Start Session</Button><Button variant="ghost" className="w-full text-zinc-500 hover:text-white" onClick={onCancel}>Cancel</Button></div>
      </div>
    </div>
  );
};

const formatTime = (sec: number) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${s.toString().padStart(2, '0')}`; };