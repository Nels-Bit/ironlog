import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Check, Trash2, Dumbbell, X, Save, ArrowUp, ArrowDown, Flame, Skull, Circle, Play, MoreHorizontal, Trophy
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { motion, useReducedMotion } from 'framer-motion';
import { WorkoutNumberInput as NumericInput } from '../components/WorkoutNumberInput';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { GhostSetHydrator } from '../components/GhostSetHydrator';
import { cn } from '../lib/utils';
import { useWorkout } from '../context/useWorkout';
import { authService } from '../services/authService';
import { haptics } from '../utils/haptics';
import { useWakeLock } from '../utils/useWakeLock';
import {
  getBestPRPerformance,
  isAssistedExercise,
  isBodyweightExercise,
  isCardioExercise,
  parseUserWeight,
} from '../utils/workoutMath';
import {
  formatNumberInputValue,
  getNumberPlaceholder,
  parseNumberInputValue
} from '../utils/numberInput';
import type { Exercise, ExerciseSet } from '../types';
import { formatPRPerformance, getDisplayedPRPerformance, getExerciseProgress, hasSetData } from '../utils/exerciseLogging';

export const WorkoutLogger = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Only navigation lives in the URL. All workout data stays in WorkoutContext.
  const focusedId = searchParams.get('exercise');

  const blockInvalidNumberChars = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const {
    workout, elapsed, isActive, historyCache, prCache, prSetCache, prCacheReady,
    startWorkout, logRestDay, cancelWorkout, finishWorkout,
    addExercise, hydrateExerciseGhostSets, removeExercise, moveExercise, addSet, removeSet, updateSet, exerciseDefs, restTimer
  } = useWorkout();

  // Keep the screen awake while an active workout session is running
  useWakeLock(Boolean(isActive));

  // --- UI STATE ---
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [typeSheetOpen, setTypeSheetOpen] = useState<{ exIndex: number; setIndex: number } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const addedCardRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // Tracks which set-sides have been manually edited to break unilateral auto-mirror
  // Key format: `${setId}-left` or `${setId}-right`
  const [manualOverrides, setManualOverrides] = useState<Set<string>>(new Set());

  // Use global Rest Timer
  const { openRestTimer } = useWorkout();

  const [userWeight, setUserWeight] = useState<number | null>(null);

  useEffect(() => {
    const loadUserWeight = async () => {
      const user = await authService.getUser();
      setUserWeight(parseUserWeight(user?.weight));
    };
    loadUserWeight();
  }, []);

  // Listen for Navbar signal
  useEffect(() => {
    const handleOpenSelector = () => setIsSelectorOpen(true);
    window.addEventListener('open-exercise-selector', handleOpenSelector);
    return () => window.removeEventListener('open-exercise-selector', handleOpenSelector);
  }, []);

  // Exercise navigation behaves like a screen change, including browser/PWA back.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [focusedId]);

  const openExercise = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('exercise', id);
    setSearchParams(next, { state: { exerciseLogger: true } });
  };

  const showOverview = () => {
    setTypeSheetOpen(null);
    if (location.state?.exerciseLogger) {
      navigate(-1);
    } else {
      // A refreshed or directly opened focus URL may have no overview in history.
      const next = new URLSearchParams(searchParams);
      next.delete('exercise');
      setSearchParams(next, { replace: true });
    }
  };

  const handleAddExercise = (ex: Exercise) => {
    const id = addExercise(ex);
    if (id) setRecentlyAddedId(id);
    setIsSelectorOpen(false);
    if (focusedId) showOverview();
  };

  useEffect(() => {
    if (recentlyAddedId && !focusedId) addedCardRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'instant' : 'smooth', block: 'center',
    });
  }, [recentlyAddedId, focusedId, reduceMotion]);

  const handleFinish = async () => {
    if (isFinishing || !confirm("Finish workout?")) return;
    setIsFinishing(true);
    setSaveError(null);
    try {
      const id = await finishWorkout();
      try { haptics.success(); } catch { /* ignore */ }
      navigate(id ? `/summary/${id}` : '/profile');
    } catch {
      setSaveError('Unable to finish your workout. Your session is still saved on this device. Please try again.');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleCancel = () => {
    if (confirm("Cancel workout? Data will be lost.")) {
      cancelWorkout();
      navigate('/profile', { replace: true });
    }
  };

  const handleRemoveExercise = (exIndex: number) => {
    const ex = workout?.exercises[exIndex];
    if (!ex) return;
    if (ex.sets.some(hasSetData)) {
      setPendingRemoval(ex.id);
      return;
    }
    removeExercise(exIndex);
  };

  const handleSetType = (exIndex: number, setIndex: number, newType: ExerciseSet['type']) => {
    if (!workout) return;
    if (isCardioExercise(exerciseDefs.get(workout.exercises[exIndex]?.exerciseId))) return;
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
    switch (type) {
      case 'warmup': return <Flame size={14} className="text-yellow-500" />;
      case 'dropset': return <ArrowDown size={14} className="text-zinc-400" />;
      case 'dropset_child': return <ArrowDown size={14} className="text-zinc-400" />;
      case 'failure': return <Skull size={14} className="text-red-500" />;
      default: return <Circle size={18} className="text-zinc-400" />;
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

  /**
   * Smart unilateral rep change.
   * Mirrors the new value to the opposite side unless that side has a manual override.
   * Once the user types into a side, it is flagged as overridden and will never be
   * auto-overwritten again (until the set is cleared/reset).
   */
  const handleUnilateralChange = (
    exIndex: number,
    setIndex: number,
    setId: string,
    side: 'repsLeft' | 'repsRight',
    rawValue: string
  ) => {
    const parsed = parseNumberInputValue(rawValue);
    const thisKey = `${setId}-${side === 'repsLeft' ? 'left' : 'right'}`;
    const otherSide = side === 'repsLeft' ? 'repsRight' : 'repsLeft';
    const otherKey = `${setId}-${side === 'repsLeft' ? 'right' : 'left'}`;

    // Mark this side as manually touched
    setManualOverrides(prev => {
      const next = new Set(prev);
      next.add(thisKey);
      return next;
    });

    // Update the edited side
    updateSet(exIndex, setIndex, side, parsed);

    // Mirror to the other side only if it hasn't been manually overridden yet
    if (!manualOverrides.has(otherKey)) {
      updateSet(exIndex, setIndex, otherSide, parsed);
    }
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
      if ((currentSet.distance === null || currentSet.distance === undefined) && ghostSet.distance !== null && ghostSet.distance !== undefined) {
        updateSet(exIndex, setIndex, 'distance', ghostSet.distance);
      }
      if ((currentSet.durationSeconds === null || currentSet.durationSeconds === undefined) && ghostSet.durationSeconds !== null && ghostSet.durationSeconds !== undefined) {
        updateSet(exIndex, setIndex, 'durationSeconds', ghostSet.durationSeconds);
      }
    }

    // 2. Toggle Completion
    updateSet(exIndex, setIndex, 'isCompleted', isNowComplete);

    // Provide haptic feedback for set completion
    if (isNowComplete) {
      try { haptics.success(); } catch { /* ignore */ }

      // 3. Trigger Rest Timer
      const currentType = currentSet.type || 'normal';
      openRestTimer(currentType);
    }
  };

  // --- RENDER: SETUP SCREEN ---
  if (!isActive || !workout) {
    return <SetupScreen onStart={startWorkout} onRestDay={async () => {
      await logRestDay();
      navigate('/profile?tab=activity');
    }} onCancel={() => navigate(-1)} />;
  }

  // The expanded timer is fixed above the navigation. Give the scrollable
  // workout enough tail room to bring its final controls above that overlay.
  const needsExpandedTimerClearance = restTimer.isOpen && !restTimer.isDocked;
  const focusedExercise = workout.exercises.find(ex => ex.id === focusedId);
  const isFocused = Boolean(focusedExercise);

  // --- RENDER: ACTIVE LOGGER ---
  return (
    <div className={cn(
      'min-h-screen animate-in fade-in duration-500 bg-black md:pb-48',
      needsExpandedTimerClearance ? 'pb-[calc(23rem+env(safe-area-inset-bottom,0px))]' : 'pb-48'
    )}>

      {/* HEADER */}
      {/* Equal side tracks keep the title centered despite different button widths. */}
      <header className={cn('sticky top-0 z-50 bg-iron-950/90 backdrop-blur-md border-b border-white/5 px-4 h-[calc(4.25rem+env(safe-area-inset-top,0px))] grid items-center shadow-2xl', isFocused ? 'grid-cols-1' : 'grid-cols-[6.5rem_minmax(0,1fr)_6.5rem]')}>
        {!isFocused && <button onClick={handleCancel} aria-label="Cancel workout" className="btn btn-ghost btn-circle justify-self-start min-h-11 min-w-11 text-zinc-400 hover:text-white">
          <X size={20} />
        </button>}

        <div className="min-w-0 flex flex-col items-center">
          <h1 className="max-w-full truncate text-[10px] font-bold text-zinc-500 uppercase tracking-widest" title={workout.name}>{workout.name}</h1>
          <div className="font-mono text-xl font-black text-brand-orange tabular-nums leading-none">
            {formatTime(elapsed)}
          </div>
        </div>

        {!isFocused && <button onClick={handleFinish} disabled={isFinishing} className="btn justify-self-end min-h-11 rounded-full border-0 bg-brand-orange text-white px-4 hover:bg-brand-orange-secondary">
          <Save size={18} /> {isFinishing ? 'Saving…' : 'Finish'}
        </button>}
      </header>

      {/* WORKOUT LIST */}
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        {saveError && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-error">{saveError}</p>}
        {/* Keep hydration mounted across overview/focus navigation. */}
        {workout.exercises.map(ex => <GhostSetHydrator key={ex.id} workoutExerciseId={ex.id} exerciseId={ex.exerciseId} onHydrate={hydrateExerciseGhostSets} />)}

        {/* EMPTY STATE */}
        {workout.exercises.length === 0 ? (
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="w-full text-center py-16 px-6 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] space-y-4 hover:bg-white/[0.05] hover:border-white/20 active:scale-[0.98] transition-all duration-300"
          >
            <div className="w-16 h-16 mx-auto bg-brand-orange/10 rounded-full flex items-center justify-center">
              <Plus className="text-brand-orange" size={28} />
            </div>
            <p className="text-zinc-400 font-medium">Tap to add your first exercise</p>
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {workout.exercises.map((ex, exIndex) => {
              const def = exerciseDefs.get(ex.exerciseId);
              if (isFocused && ex.id !== focusedId) return null;
              const isCardio = isCardioExercise(def);
              const isBodyweightMovement = isBodyweightExercise(def);
              const isAssisted = isAssistedExercise(def);
              const setRowColumns = isCardio
                ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px_44px]'
                : def?.isUnilateral
                  ? 'grid-cols-[44px_minmax(0,1fr)_minmax(96px,1fr)_44px_44px]'
                  : 'grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_44px_44px]';

              const ghostSets = historyCache.get(ex.exerciseId);
              const historicPR = prCache.get(ex.exerciseId) || 0;
              // Only show PR indicator once historical baseline has been loaded from Supabase.
              // This prevents the false-positive "NEW PR" flash that occurs on PWA restart
              // when prCache is empty and every set with any weight appears to beat a baseline of 0.
              const prReady = prCacheReady.has(ex.exerciseId);

              // Calculate Best Set (Current Session)
              const currentBest = getBestPRPerformance(ex.sets, def, undefined, userWeight);
              const currentBestLoad = currentBest.load;

              // DISPLAY PR LOGIC: Max of Historic vs Current
              const displayPR = getDisplayedPRPerformance(
                { load: historicPR, set: prSetCache.get(ex.exerciseId) ?? null }, currentBest, def
              );
              const prText = formatPRPerformance(displayPR, def);
              // Only compute isNewPR after the historical baseline is confirmed loaded
              const isNewPR = prReady && currentBestLoad > historicPR && currentBestLoad > 0;

              if (!isFocused) {
                const progress = getExerciseProgress(ex, def);
                return (
                  <motion.div key={ex.id} ref={recentlyAddedId === ex.id ? addedCardRef : undefined}
                    initial={false}
                    data-added-exercise={recentlyAddedId === ex.id || undefined}
                    animate={recentlyAddedId === ex.id ? {
                      x: reduceMotion ? 0 : [0, -5, 5, -3, 3, 0],
                      boxShadow: ['0 0 0 2px rgba(234,88,12,0)', '0 0 0 2px rgba(234,88,12,0.65)', '0 0 0 2px rgba(234,88,12,0)'],
                    } : {x: 0, boxShadow: '0 0 0 2px rgba(234,88,12,0)'}}
                    transition={{duration: 0.65, ease: 'easeOut'}}
                    onAnimationComplete={() => {
                      if (recentlyAddedId === ex.id) setRecentlyAddedId(current => current === ex.id ? null : current);
                    }}
                    className="card flex-row items-center rounded-2xl border border-white/10 bg-zinc-900/60">
                    <button onClick={() => openExercise(ex.id)} className="min-w-0 flex-1 p-4 text-left rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-orange">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold text-white break-words">{def?.name || 'Loading exercise…'}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-brand-orange">{isCardio ? 'Cardio' : [def?.target, def?.category].filter(Boolean).join(' · ')}</span>
                        {progress.status === 'Complete' && <Check size={14} className="text-brand-orange" />}
                        {isNewPR && <span className="flex items-center gap-1 font-bold text-brand-orange"><Trophy size={13} /> NEW PR {prText}</span>}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500 break-words">{progress.summary}</p>
                    </button>
                    <details className="dropdown dropdown-end self-start mr-2 mt-2">
                      <summary aria-label={`Actions for ${def?.name || 'exercise'}`} className="btn btn-ghost btn-square list-none min-h-11 min-w-11 text-zinc-400"><MoreHorizontal size={24} /></summary>
                      <ul className="menu dropdown-content z-30 w-48 rounded-xl border border-white/10 bg-iron-950 p-2 shadow-xl">
                        {exIndex > 0 && <li><button onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); moveExercise(ex.id, 'up'); }} className="min-h-11 text-zinc-300"><ArrowUp size={16} /> Move up</button></li>}
                        {exIndex < workout.exercises.length - 1 && <li><button onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); moveExercise(ex.id, 'down'); }} className="min-h-11 text-zinc-300"><ArrowDown size={16} /> Move down</button></li>}
                        <li><button onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); handleRemoveExercise(exIndex); }} className="min-h-11 text-error"><Trash2 size={16} /> Remove exercise</button></li>
                      </ul>
                    </details>
                  </motion.div>
                );
              }

              return (
                <div key={ex.id} className="relative">
                  <div>

                    {/* EXERCISE HEADER */}
                    <div className="py-4 mb-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div>
                          <h2 className="text-white font-black text-2xl flex flex-wrap items-center gap-2 break-words">
                            {def?.name || 'Loading...'}
                            {def?.isUnilateral && <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded uppercase">Uni</span>}
                          </h2>
                          <p className="mt-1 text-sm text-zinc-500">{isCardio ? 'Cardio' : [def?.target, def?.category].filter(Boolean).join(' · ')}</p>
                          {!isCardio && (
                            <p className={cn(
                              "text-xs font-mono mt-1 transition-colors",
                              isNewPR ? "text-brand-orange font-bold" : "text-zinc-500"
                            )}>
                              {/* Show a brief loading state while historical PR baseline is being fetched */}
                              {!prReady ? '— loading PR' : !displayPR.set ? 'No PR yet' : isNewPR ? `🏆 NEW PR ${prText}` : `PR ${prText}`}
                            </p>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* CONTENT */}
                    <div>
                      <div>
                        <div>

                          <div className={cn('grid gap-1 sm:gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center mb-2', setRowColumns, isCardio && 'px-2 gap-2')}>
                            {!isCardio && <div>Type</div>}
                            <div>
                              {isCardio ? 'Miles' : isAssisted ? 'Assistance' : isBodyweightMovement ? 'Extra LBS' : 'LBS'}
                            </div>
                            <div>{isCardio ? 'Time (min)' : def?.isUnilateral ? 'Reps L / R' : 'Reps'}</div>
                            <div>Done</div><div><span className="sr-only">Remove</span></div>
                          </div>

                          <div className="space-y-3">
                            {ex.sets.map((set, setIndex) => {
                              const isDropChild = !isCardio && set.type === 'dropset_child';
                              const ghostSet = ghostSets ? ghostSets[setIndex] : undefined;

                              return (
                                <div key={set.id} className="relative">
                                  {/* Start inside the inter-row gap, clear of the parent border. */}
                                  {isDropChild && (
                                    <div aria-hidden="true" className="absolute -top-2 bottom-1/2 left-3 w-5 border-l-2 border-b-2 border-zinc-700 rounded-bl-lg z-0 pointer-events-none" />
                                  )}

                                  <div className={cn(
                                    "grid gap-1 sm:gap-2 items-center py-2 rounded-xl border transition-all relative z-10",
                                    setRowColumns,
                                    set.isCompleted ? "border-brand-orange/20 bg-brand-orange/5" : "bg-zinc-900/40 border-white/5",
                                    isDropChild ? "ml-8" : "",
                                    // Keep the row full-width; only the cardio inputs are capped.
                                    isCardio && "px-2 gap-2"
                                  )}>

                                    {!isCardio && <div className="flex justify-center">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTypeSheetOpen({ exIndex, setIndex });
                                          }}
                                          aria-label={`Set ${setIndex + 1} type: ${set.type.replace('_', ' ')}`}
                                          className={cn(
                                            "min-w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-all active:scale-90",
                                            "bg-transparent text-zinc-400 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-orange"
                                          )}
                                        >
                                          {getTypeIcon(set.type)}
                                        </button>
                                    </div>}

                                    {isCardio ? (
                                      <>
                                        <div className="min-w-0 flex justify-center">
                                          <NumericInput
                                            label={`Set ${setIndex + 1} distance in miles`}
                                            inputMode="decimal" step="any" onKeyDown={blockInvalidNumberChars}
                                            min={0}
                                            placeholder={getNumberPlaceholder(ghostSet?.distance, "-")}
                                            value={formatNumberInputValue(set.distance)}
                                            onChange={(e) => updateSet(exIndex, setIndex, 'distance', parseNumberInputValue(e.target.value))}
                                            whileFocus={{ boxShadow: "inset 0 0 0 2px rgba(234, 88, 12, 0.4)" }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                            className="w-full max-w-28 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-lg outline-none focus:bg-white/10 disabled:opacity-50"
                                          />
                                        </div>
                                        <div className="min-w-0 flex justify-center">
                                          <NumericInput
                                            label={`Set ${setIndex + 1} duration in minutes`}
                                            inputMode="decimal" step="any" onKeyDown={blockInvalidNumberChars}
                                            min={0}
                                            placeholder={getNumberPlaceholder(ghostSet?.durationSeconds ? Math.round((ghostSet.durationSeconds / 60) * 10) / 10 : null, "-")}
                                            value={formatNumberInputValue(set.durationSeconds ? Math.round((set.durationSeconds / 60) * 10) / 10 : null)}
                                            onChange={(e) => {
                                              const val = parseNumberInputValue(e.target.value);
                                              updateSet(exIndex, setIndex, 'durationSeconds', val !== null ? Math.round(val * 60) : null);
                                            }}
                                            whileFocus={{ boxShadow: "inset 0 0 0 2px rgba(234, 88, 12, 0.4)" }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                            className="w-full max-w-28 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-lg outline-none focus:bg-white/10 disabled:opacity-50"
                                          />
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="min-w-0">
                                          <NumericInput
                                            label={`Set ${setIndex + 1} ${isAssisted ? 'assistance' : isBodyweightMovement ? 'extra weight' : 'weight'} in pounds`}
                                            inputMode="decimal" step="any" onKeyDown={blockInvalidNumberChars}
                                            min={0}
                                            placeholder={getNumberPlaceholder(ghostSet?.weight, "-")}
                                            value={formatNumberInputValue(set.weight)}
                                            onChange={(e) => updateSet(exIndex, setIndex, 'weight', parseNumberInputValue(e.target.value))}
                                            whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                            className="w-full bg-white/5 rounded-lg py-2 text-center font-bold text-white text-lg outline-none focus:bg-white/10 disabled:opacity-50"
                                          />
                                        </div>

                                        <div className="min-w-0 flex justify-center">
                                          {def?.isUnilateral ? (
                                            <div className="flex gap-1 w-full">
                                              <NumericInput
                                                label={`Set ${setIndex + 1} left reps`}
                                                inputMode="decimal" step="any" onKeyDown={blockInvalidNumberChars}
                                                min={0}
                                                placeholder={getNumberPlaceholder(ghostSet?.repsLeft, "L")}
                                                value={formatNumberInputValue(set.repsLeft)}
                                                onChange={(e) => handleUnilateralChange(exIndex, setIndex, set.id, 'repsLeft', e.target.value)}
                                                whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                                className="w-1/2 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-sm outline-none focus:bg-white/10 disabled:opacity-50"
                                              />
                                              <NumericInput
                                                label={`Set ${setIndex + 1} right reps`}
                                                inputMode="decimal" step="any" onKeyDown={blockInvalidNumberChars}
                                                min={0}
                                                placeholder={getNumberPlaceholder(ghostSet?.repsRight, "R")}
                                                value={formatNumberInputValue(set.repsRight)}
                                                onChange={(e) => handleUnilateralChange(exIndex, setIndex, set.id, 'repsRight', e.target.value)}
                                                whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                                className="w-1/2 bg-white/5 rounded-lg py-2 text-center font-bold text-white text-sm outline-none focus:bg-white/10 disabled:opacity-50"
                                              />
                                            </div>
                                          ) : (
                                            <NumericInput
                                              label={`Set ${setIndex + 1} reps`}
                                              inputMode="decimal" step="any" onKeyDown={blockInvalidNumberChars}
                                              min={0}
                                              placeholder={getNumberPlaceholder(ghostSet?.reps, "-")}
                                              value={formatNumberInputValue(set.reps)}
                                              onChange={(e) => updateSet(exIndex, setIndex, 'reps', parseNumberInputValue(e.target.value))}
                                              whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.2)" }}
                                              transition={{ type: "spring", stiffness: 300 }}
                                              className="w-full bg-white/5 rounded-lg py-2 text-center font-bold text-white text-lg outline-none focus:bg-white/10 disabled:opacity-50"
                                            />
                                          )}
                                        </div>
                                      </>
                                    )}

                                    <div>
                                        <button
                                          aria-label={`${set.isCompleted ? 'Uncomplete' : 'Complete'} set ${setIndex + 1}`}
                                          aria-pressed={set.isCompleted}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSmartComplete(exIndex, setIndex, set, ghostSet);
                                          }}
                                          className={cn(
                                            "w-11 h-11 rounded-lg flex items-center justify-center transition-all active:scale-95",
                                            set.isCompleted ? "bg-brand-orange text-white" : "bg-white/5 text-zinc-600 hover:bg-white/10"
                                          )}
                                        >
                                          <Check size={20} strokeWidth={4} />
                                        </button>
                                    </div>
                                    <button aria-label={`Delete set ${setIndex + 1}`} onClick={() => handleDeleteSet(exIndex, setIndex)} className="btn btn-ghost btn-square min-h-11 min-w-11 text-zinc-500 hover:text-error"><Trash2 size={17} /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3 flex items-stretch gap-2">
                              <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                onClick={() => addSet(exIndex)}
                                className="min-w-0 flex-1 min-h-11 py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 shadow-sm"
                              >
                                <Plus size={15} className="text-brand-orange" strokeWidth={2.5} />
                                <span>Add Set</span>
                              </motion.button>
                              <button onClick={showOverview} className="btn min-h-11 shrink-0 rounded-xl border-0 bg-brand-orange px-5 text-white hover:bg-brand-orange-secondary"><Check size={18} /> Done</button>
                          </div>
                          <p className="mt-3 text-center text-xs text-zinc-500">Changes save automatically on this device.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* --- ADD EXERCISE BUTTON --- */}
            {!isFocused && <Button
              className="w-full py-6 text-sm font-bold bg-white/[0.03] hover:bg-white/[0.07] border border-dashed border-white/20 hover:border-brand-orange/50 text-zinc-400 hover:text-white active:scale-[0.98] transition-all rounded-2xl flex items-center justify-center gap-2"
              onClick={() => setIsSelectorOpen(true)}
            >
              <Plus className="mr-2" size={20} /> Add Another Exercise
            </Button>}
          </motion.div>
        )}
      </div>

      {/* Set Type Sheet */}
      {isFocused && typeSheetOpen && !isCardioExercise(exerciseDefs.get(workout.exercises[typeSheetOpen.exIndex]?.exerciseId)) && (() => {
        const currentSet = workout.exercises[typeSheetOpen.exIndex].sets[typeSheetOpen.setIndex];
        const currentType = currentSet?.type || 'normal';

        const availableTypes = [
          { type: 'normal' as const, icon: <Circle size={32} className="text-zinc-400" />, label: 'Normal' },
          { type: 'warmup' as const, icon: <Flame size={32} className="text-yellow-500" />, label: 'Warmup' },
          { type: 'dropset' as const, icon: <ArrowDown size={32} className="text-zinc-400" />, label: 'Drop' },
          { type: 'failure' as const, icon: <Skull size={32} className="text-red-500" />, label: 'Failure' },
          ...(currentSet?.parentSetId ? [{ type: 'dropset_child' as const, icon: <ArrowDown size={32} className="text-zinc-400" />, label: 'Drop child' }] : [])
        ];

        return (
          <LoggerDialog label="Set type" onClose={() => setTypeSheetOpen(null)}>
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-zinc-400">Set {typeSheetOpen.setIndex + 1} type</h3><button autoFocus aria-label="Close set type" className="btn btn-ghost btn-square min-h-11 min-w-11" onClick={() => setTypeSheetOpen(null)}><X size={18} /></button></div>
                <div className="flex flex-col gap-2">
                  {availableTypes.map(({ type, icon, label }) => (
                    <button
                      key={type}
                      aria-pressed={type === currentType}
                      onClick={() => handleSetType(typeSheetOpen.exIndex, typeSheetOpen.setIndex, type)}
                      className={cn('flex items-center gap-3 min-h-11 px-3 py-2 rounded-xl border hover:bg-white/5', type === currentType ? 'border-brand-orange/40 bg-brand-orange/10' : 'bg-black/40 border-white/10')}
                    >
                      <div className="shrink-0">{icon}</div>
                      <span className="text-white font-bold text-lg">{label}</span>
                      {type === currentType && <Check size={16} className="ml-auto text-brand-orange" />}
                    </button>
                  ))}
                </div>
          </LoggerDialog>
        );
      })()}

      {pendingRemoval && <LoggerDialog label="Remove exercise?" onClose={() => setPendingRemoval(null)}>
        <h3 className="text-lg font-bold text-white">Remove exercise?</h3>
        <p className="mt-2 text-sm text-zinc-400">This removes {exerciseDefs.get(workout.exercises.find(ex => ex.id === pendingRemoval)?.exerciseId || '')?.name || 'the exercise'} and its entered sets from this workout.</p>
        <div className="modal-action">
          <button autoFocus className="btn btn-ghost min-h-11" onClick={() => setPendingRemoval(null)}>Keep exercise</button>
          <button className="btn btn-error min-h-11" onClick={() => {
            const index = workout.exercises.findIndex(ex => ex.id === pendingRemoval);
            if (index >= 0) removeExercise(index);
            setPendingRemoval(null);
          }}>Remove exercise</button>
        </div>
      </LoggerDialog>}

      <ExerciseSelector isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} onSelect={handleAddExercise} />
    </div>
  );
};

const SetupScreen = ({ onStart, onCancel, onRestDay }: { onStart: (name: string) => void, onCancel: () => void, onRestDay: () => void }) => {
  const [name, setName] = useState('');
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 animate-in fade-in">
      <div className="w-full max-w-sm bg-iron-950 border border-white/10 rounded-3xl p-6 space-y-6">
        <div className="text-center"><div className="inline-flex w-12 h-12 bg-white/5 rounded-full items-center justify-center mb-4 text-zinc-500"><Dumbbell size={24} /></div><h2 className="text-xl font-bold text-white">Start Workout</h2></div>
        <input autoFocus type="text" placeholder={`Workout ${new Date().toLocaleDateString()}`} value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white text-center font-bold focus:border-brand-orange outline-none" />
        <div className="space-y-3">
          <button
            type="button"
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-accent to-amber-500 hover:from-brand-orange hover:to-brand-orange-secondary text-white font-bold text-sm tracking-wide shadow-lg shadow-brand-orange/20 transition-all flex items-center justify-center gap-2"
            onClick={() => onStart(name)}
          >
            <Play size={18} className="mr-2" /> Start Session
          </button>
          <Button
            onClick={onRestDay}
            className="w-full py-4 bg-blue-950/90 border border-blue-400/20 text-blue-100 hover:bg-blue-900/90 hover:text-white shadow-lg shadow-blue-950/30"
          >
            🌙 Log Rest Day
          </Button>
          <Button variant="ghost" className="w-full text-zinc-500 hover:text-white" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
};

const formatTime = (sec: number) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${s.toString().padStart(2, '0')}`; };

const LoggerDialog = ({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Removing the dialog closes it. Explicit cleanup would emit a close event
    // during StrictMode's effect replay and dismiss a newly opened dialog.
  }, []);
  return (
    <dialog ref={ref} aria-label={label} className="modal" onCancel={onClose} onClose={onClose}>
      <div className="modal-box max-w-xs rounded-3xl border border-white/10 bg-iron-950 p-4">{children}</div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>Close</button></form>
    </dialog>
  );
};
