
import React, { useEffect, useState } from 'react';
import { WorkoutSession } from '../types';
import { getWorkouts, deleteWorkout, getDraft } from '../services/storageService';
import { Trash2, Calendar, Clock, ChevronDown, ChevronUp, AlertCircle, Edit2 } from 'lucide-react';
import { Button } from './Button';

interface WorkoutHistoryProps {
  userId: string;
  onEdit: (id: string) => void;
}

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ userId, onEdit }) => {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);
  const [hasActiveDraft, setHasActiveDraft] = useState(false);

  useEffect(() => {
    if (userId) {
        setWorkouts(getWorkouts(userId));
        const draft = getDraft(userId);
        if (draft && draft.hasStarted) {
            setHasActiveDraft(true);
        } else {
            setHasActiveDraft(false);
        }
    }
  }, [userId]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (window.confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
        deleteWorkout(userId, id);
        setTimeout(() => {
            setWorkouts(getWorkouts(userId));
        }, 50);
    }
  };

  const getDuration = (start: number, end?: number) => {
    if (!end) return 'In Progress';
    const mins = Math.round((end - start) / 60000);
    return `${mins} min`;
  };

  const getTotalVolume = (workout: WorkoutSession) => {
    return workout.exercises.reduce((acc, ex) => {
        if (ex.category === 'Cardio') return acc; // No volume for cardio in lbs
        return acc + ex.sets.reduce((sAcc, s) => {
            if (!s.completed) return sAcc;
            const reps = ex.isUnilateral ? (s.repsLeft || 0) + (s.repsRight || 0) : s.reps;
            return sAcc + (s.weight * reps);
        }, 0);
    }, 0);
  };

  const toggleExpand = (id: string) => {
      setExpandedWorkoutId(prev => prev === id ? null : id);
  };

  const handleEditClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onEdit(id);
  };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">History</h2>
      
      <div className="space-y-4">
        {workouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center mt-20 p-6 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-500">
                    <Calendar size={32} />
                </div>
                <h3 className="text-white font-medium mb-1">No workouts yet</h3>
                <p className="text-sm text-slate-500 mb-6">Your fitness journey starts with a single rep.</p>
                <p className="text-indigo-400 text-xs font-medium">Head to the 'Log' tab to start!</p>
            </div>
        ) : (
            workouts.map(workout => {
                const isExpanded = expandedWorkoutId === workout.id;
                return (
                    <div 
                        key={workout.id} 
                        onClick={() => toggleExpand(workout.id)}
                        className={`bg-slate-900 border transition-all cursor-pointer group overflow-hidden ${isExpanded ? 'border-indigo-500/50 ring-1 ring-indigo-500/20 rounded-xl' : 'border-slate-800 rounded-xl hover:border-slate-700'}`}
                    >
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-100 text-lg">{workout.name}</h3>
                                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                        <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(workout.startTime).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><Clock size={12}/> {getDuration(workout.startTime, workout.endTime)}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => handleDelete(e, workout.id)}
                                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors z-10"
                                        title="Delete Workout"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            {!isExpanded && (
                                <div className="space-y-1">
                                    {workout.exercises.slice(0, 3).map(ex => (
                                        <div key={ex.id} className="text-sm text-slate-300 flex justify-between">
                                            <span>{ex.sets.length} x {ex.name}</span>
                                            <span className="text-slate-500 text-xs">
                                                {ex.category === 'Cardio' 
                                                    ? `Best: ${Math.max(...ex.sets.map(s => s.distance || 0))} mi`
                                                    : `Best: ${Math.max(...ex.sets.map(s => s.weight))} lbs`
                                                }
                                            </span>
                                        </div>
                                    ))}
                                    {workout.exercises.length > 3 && (
                                        <div className="text-xs text-slate-500 pt-1">
                                            + {workout.exercises.length - 3} more exercises
                                        </div>
                                    )}
                                </div>
                            )}

                            {isExpanded && (
                                <div className="mt-4 space-y-4 animate-fade-in">
                                    {workout.exercises.map((ex, i) => (
                                        <div key={ex.id} className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex flex-col gap-1">
                                                    <h4 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                                                        <span className="text-slate-500 text-xs font-mono">#{i+1}</span>
                                                        {ex.name}
                                                    </h4>
                                                    <div className="flex gap-1 ml-6">
                                                        {ex.category && (
                                                            <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                                                {ex.category}
                                                            </span>
                                                        )}
                                                        {ex.isUnilateral && (
                                                            <span className="text-[9px] uppercase font-bold text-indigo-400 bg-indigo-900/20 px-1.5 py-0.5 rounded border border-indigo-900/30">
                                                                UNI
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {ex.notes && <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded">Has notes</span>}
                                            </div>
                                            <div className="grid grid-cols-6 gap-2 text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 text-center">
                                                <div className="col-span-1">Set</div>
                                                <div className="col-span-2">{ex.category === 'Cardio' ? 'Dist (mi)' : 'LBs'}</div>
                                                <div className="col-span-2">{ex.category === 'Cardio' ? 'Time (m)' : 'Reps'}</div>
                                            </div>
                                            {ex.sets.map((s, idx) => (
                                                <div key={s.id} className="grid grid-cols-6 gap-2 text-sm text-slate-300 py-1 border-b border-slate-800/50 last:border-none text-center">
                                                    <div className="col-span-1 text-slate-600 font-mono">{idx + 1}</div>
                                                    <div className="col-span-2 font-mono">
                                                        {ex.category === 'Cardio' ? s.distance : s.weight}
                                                    </div>
                                                    <div className="col-span-2 font-mono">
                                                        {ex.category === 'Cardio' 
                                                            ? s.time 
                                                            : (ex.isUnilateral ? `L:${s.repsLeft} / R:${s.repsRight}` : s.reps)
                                                        }
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    
                                    <div className="pt-2 flex justify-end">
                                        {hasActiveDraft ? (
                                            <div className="flex items-center gap-2 text-amber-500 text-xs bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-900/30">
                                                <AlertCircle size={14} />
                                                <span>Finish current workout to edit this one</span>
                                            </div>
                                        ) : (
                                            <Button 
                                                onClick={(e) => handleEditClick(e, workout.id)} 
                                                variant="secondary" 
                                                size="sm"
                                                className="flex items-center gap-2"
                                            >
                                                <Edit2 size={14} /> Edit Workout
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-mono">
                                    VOL: {getTotalVolume(workout).toLocaleString()} LBs
                                </span>
                                <span className="text-xs font-medium text-indigo-400 flex items-center gap-1">
                                    {isExpanded ? 'Close Details' : 'View Details'} 
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
};
