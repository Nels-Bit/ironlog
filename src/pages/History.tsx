import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Calendar, Clock, Flame, Skull, ArrowDown, ChevronDown } from 'lucide-react';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import type { WorkoutSession, Exercise } from '../types';

export const History = () => {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [historyData, exercisesData] = await Promise.all([
          workoutService.getHistory(),
          exerciseService.getAllExercises()
        ]);
        
        setHistory(historyData);

        const defMap = new Map();
        exercisesData.forEach(ex => defMap.set(ex.id, ex));
        setExerciseDefs(defMap);
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'warmup': return <Flame size={12} className="text-yellow-500" />;
      case 'dropset': return <ArrowDown size={12} className="text-zinc-400" />;
      case 'failure': return <Skull size={12} className="text-red-500" />;
      default: return null;
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const getTopTarget = (workout: WorkoutSession) => {
    const counts = new Map<string, number>();

    workout.exercises.forEach(exercise => {
      const def = exerciseDefs.get(exercise.exerciseId);
      const target = def?.target || def?.category;
      if (!target) return;

      const setCount = Math.max(exercise.sets.length, 1);
      counts.set(target, (counts.get(target) || 0) + setCount);
    });

    let topTarget = 'Unknown';
    let topCount = -1;

    counts.forEach((count, target) => {
      if (count > topCount) {
        topTarget = target;
        topCount = count;
      }
    });

    return topTarget;
  };

  const formatDate = (timestamp: number, includeWeekday = false) => new Date(timestamp).toLocaleDateString([], {
    weekday: includeWeekday ? 'long' : undefined,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const getDurationMinutes = (workout: WorkoutSession) => {
    if (!workout.endTime) return null;
    return Math.max(1, Math.round((workout.endTime - workout.startTime) / 60000));
  };

  const workoutExerciseIds = new Set<string>();
  history.forEach(workout => {
    workout.exercises.forEach(ex => workoutExerciseIds.add(ex.exerciseId));
  });

  const exerciseOptions = Array.from(workoutExerciseIds)
    .map(id => ({ id, name: exerciseDefs.get(id)?.name || 'Unknown Exercise' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const targetOptions = Array.from(new Set(
    Array.from(workoutExerciseIds).map(id => (exerciseDefs.get(id)?.target || '').toLowerCase()).filter(Boolean)
  )).sort();

  const formatTargetLabel = (value: string) => value
    .split(' ')
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

  const filteredHistory = history.filter(workout => {
    if (dateFrom) {
      const fromDate = new Date(`${dateFrom}T00:00:00`);
      if (workout.startTime < fromDate.getTime()) return false;
    }

    if (dateTo) {
      const toDate = new Date(`${dateTo}T23:59:59.999`);
      if (workout.startTime > toDate.getTime()) return false;
    }

    if (exerciseFilter) {
      const hasExercise = workout.exercises.some(ex => ex.exerciseId === exerciseFilter);
      if (!hasExercise) return false;
    }

    if (targetFilter) {
      const hasTarget = workout.exercises.some(ex => {
        const def = exerciseDefs.get(ex.exerciseId);
        return (def?.target || '').toLowerCase() === targetFilter;
      });
      if (!hasTarget) return false;
    }

    return true;
  });

  const isFiltered = Boolean(dateFrom || dateTo || targetFilter || exerciseFilter);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTargetFilter('');
    setExerciseFilter('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 p-6">
        <h1 className="text-2xl font-black italic text-white tracking-tighter">
          WORKOUT<span className="text-brand-orange"> HISTORY</span>
        </h1>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {history.length === 0 ? (
          <div className="text-center py-20 opacity-50 space-y-4">
            <Dumbbell className="mx-auto w-16 h-16 text-zinc-600" />
            <p className="text-zinc-500">No workouts completed yet.</p>
          </div>
        ) : (
          <>
            <div className="bg-iron-950 border border-white/10 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                aria-expanded={filtersOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Filters</div>
                  {isFiltered && (
                    <div className="text-[10px] uppercase tracking-widest font-bold text-brand-orange">Active</div>
                  )}
                </div>
                <div className={cn(
                  "w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 transition-transform",
                  filtersOpen ? "rotate-180" : ""
                )}>
                  <ChevronDown size={14} />
                </div>
              </button>

              <div className={cn(
                "px-4 pb-4 overflow-hidden transition-all duration-300 ease-out",
                filtersOpen ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              )}>
                <div className="flex items-center justify-between pb-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Filter workouts</div>
                  {isFiltered && (
                    <Button size="sm" variant="ghost" className="text-zinc-400" onClick={clearFilters}>
                      Clear
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Muscle Group</label>
                    <select
                      value={targetFilter}
                      onChange={(e) => setTargetFilter(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none"
                    >
                      <option value="">All</option>
                      {targetOptions.map(target => (
                        <option key={target} value={target}>{formatTargetLabel(target)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Exercise</label>
                    <select
                      value={exerciseFilter}
                      onChange={(e) => setExerciseFilter(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none"
                    >
                      <option value="">All</option>
                      {exerciseOptions.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-16 opacity-60 space-y-3">
                <p className="text-zinc-400">No workouts match your filters.</p>
                {isFiltered && (
                  <Button size="sm" variant="ghost" className="text-zinc-300" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              filteredHistory.map((workout, index) => {
                const isExpanded = expandedId === workout.id;
                const showWeekday = index < 7;

                return (
                <div key={workout.id} className="bg-iron-950 border border-white/10 rounded-2xl overflow-hidden relative group">
              <button
                type="button"
                className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-white/5 transition-colors"
                onClick={() => toggleExpanded(workout.id)}
                aria-expanded={isExpanded}
                aria-controls={`workout-${workout.id}`}
              >
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white mb-1 truncate">{workout.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-mono">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(workout.startTime, showWeekday)}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(workout.startTime)}</span>
                    {getDurationMinutes(workout) && (
                      <span className="flex items-center gap-1">{getDurationMinutes(workout)} min</span>
                    )}
                  </div>
                  <div className="mt-3 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Most worked</div>
                  <div className="text-sm text-zinc-200 font-semibold">{getTopTarget(workout)}</div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  {workout.volumeLoad > 0 && (
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Volume</div>
                      <div className="text-brand-orange font-mono font-bold">{workout.volumeLoad.toLocaleString()} lbs</div>
                    </div>
                  )}
                  <div className={cn(
                    "w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 transition-transform",
                    isExpanded ? "rotate-180" : ""
                  )}>
                    <ChevronDown size={16} />
                  </div>
                </div>
              </button>

              <div
                id={`workout-${workout.id}`}
                className={cn(
                  "px-5 pb-5 overflow-hidden transition-all duration-300 ease-out",
                  isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                )}
              >
                <div className="border-t border-white/5 pt-4 space-y-4">
                  {workout.exercises.length === 0 ? (
                    <div className="text-xs text-zinc-500">No exercises logged.</div>
                  ) : (
                    workout.exercises.map((ex, i) => {
                      const def = exerciseDefs.get(ex.exerciseId);
                      return (
                        <div key={ex.id || i}>
                          <h4 className="text-sm font-bold text-white mb-2">{def?.name || 'Unknown Exercise'}</h4>

                          <div className="space-y-1">
                            {ex.sets.map((set, setIndex) => {
                              const isDropChild = set.type === 'dropset_child';

                              return (
                                <div key={set.id || setIndex} className="relative flex items-center text-xs font-mono">

                                  {/* Visual Drop Set Line */}
                                  {isDropChild && (
                                    <div className="absolute -top-2 left-[11px] w-2 h-6 border-l-2 border-b-2 border-zinc-700 rounded-bl-lg z-0 pointer-events-none" />
                                  )}

                                  <div className={cn(
                                    "flex items-center gap-3 w-full p-1.5 rounded-lg z-10 relative",
                                    isDropChild ? "ml-4" : ""
                                  )}>

                                    {/* Set Number & Icon */}
                                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center gap-0.5 text-zinc-400 font-bold border border-white/5">
                                      {isDropChild ? <ArrowDown size={10} /> : <span className="text-[9px]">{setIndex + 1}</span>}
                                      {!isDropChild && getTypeIcon(set.type)}
                                    </div>

                                    {/* Weight & Reps */}
                                    <div className="flex-1 text-zinc-300">
                                      {set.weight ? `${set.weight} lbs` : '-'}
                                      <span className="text-zinc-600 mx-1">×</span>
                                      {def?.isUnilateral ? `${set.repsLeft}L / ${set.repsRight}R` : set.reps}
                                    </div>

                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-4">
                  <Link to={`/history/${workout.id}`} className="block">
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                      Edit
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};