import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Clock, 
  Check, 
  Trash2, 
  Save, 
  ChevronLeft,
  Loader2,
  Calendar,
  Flame,
  Skull,
  ArrowDown,
  CornerDownRight
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '../components/ui/Button';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { authService } from '../services/authService';
import { cn } from '../lib/utils';
import {
  applyBodyWeightToExercises,
  getSetLoad,
  getTotalReps,
  isBodyweightExercise,
  parseUserWeight,
  shouldCountSetForVolume
} from '../utils/workoutMath';
import {
  formatNumberInputValue,
  parseNumberInputValue
} from '../utils/numberInput';
import type { WorkoutSession, WorkoutExercise, Exercise, ExerciseSet } from '../types';

export const EditWorkout = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map());
  
  // Custom State for Editing
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [userWeight, setUserWeight] = useState<number | null>(null);
  
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);


  // --- EFFECTS ---

  // 1. Listen for Navbar "Add Exercise" signal
  useEffect(() => {
    const handleOpenSelector = () => setIsSelectorOpen(true);
    window.addEventListener('open-exercise-selector', handleOpenSelector);
    return () => window.removeEventListener('open-exercise-selector', handleOpenSelector);
  }, []);

  // 2. Load Data
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      
      // Load definitions
      const allDefs = await exerciseService.getAllExercises();
      const map = new Map();
      allDefs.forEach(ex => map.set(ex.id, ex));
      setExerciseDefs(map);

      const user = await authService.getUser();
      setUserWeight(parseUserWeight(user?.weight));

      // Load Workout
      const data = await workoutService.getWorkoutById(id);
      if (data) {
        setWorkout(data);
        // Calculate duration in minutes from start/end time
        const durationMs = (data.endTime || Date.now()) - data.startTime;
        setDurationMinutes(Math.max(1, Math.floor(durationMs / 1000 / 60)));
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // --- HELPER: Get Icon ---
  const getTypeIcon = (type: ExerciseSet['type']) => {
    switch(type) {
      case 'warmup': return <Flame size={14} className="text-yellow-500" />;
      case 'dropset': 
      case 'dropset_child': return <ArrowDown size={14} className="text-zinc-400" />;
      case 'failure': return <Skull size={14} className="text-red-500" />;
      default: return null;
    }
  };

  // --- ACTIONS ---

  const handleAddExercise = (exDef: Exercise) => {
    if (!workout) return;
    
    // Update local definitions immediately
    setExerciseDefs(prev => new Map(prev).set(exDef.id, exDef));

    const newExercise: WorkoutExercise = {
      id: uuidv4(),
      exerciseId: exDef.id,
      sets: [{ 
        id: uuidv4(), type: 'normal', weight: null, reps: null, isCompleted: false 
      }]
    };
    setWorkout({ ...workout, exercises: [...workout.exercises, newExercise] });
    setIsSelectorOpen(false);
  };

  const updateSet = (exIndex: number, setIndex: number, field: string, value: any) => {
    if (!workout) return;
    const updated = { ...workout };
    // @ts-ignore
    updated.exercises[exIndex].sets[setIndex][field] = value;
    setWorkout(updated);
  };

  const addSet = (exIndex: number) => {
    if (!workout) return;
    const updated = { ...workout };
    const prev = updated.exercises[exIndex].sets[updated.exercises[exIndex].sets.length - 1];
    updated.exercises[exIndex].sets.push({ 
        ...prev, id: uuidv4(), isCompleted: false 
    });
    setWorkout(updated);
  };

  const removeSet = (exIndex: number, setIndex: number) => {
      if (!workout) return;
      const updated = { ...workout };
      updated.exercises[exIndex].sets.splice(setIndex, 1);
      setWorkout(updated);
  };

  const removeExercise = (exIndex: number) => {
    if (!workout) return;
    if (confirm("Remove this exercise?")) {
        const updated = { ...workout };
        updated.exercises.splice(exIndex, 1);
        setWorkout(updated);
    }
  };

  const handleDeleteWorkout = async () => {
    if (!id) return;
    if (confirm("Are you sure you want to delete this entire workout history? This cannot be undone.")) {
        try {
            await workoutService.deleteWorkout(id);
            navigate('/history');
        } catch (error: any) {
            console.error(error);
            alert("Failed to delete workout. Check console for details.");
        }
    }
  };

  const handleSave = async () => {
    if (!workout || !id) return;

    // Recalculate Volume
    const workoutBodyWeight = workout.bodyWeight ?? userWeight ?? undefined;
    let totalVolume = 0;
    workout.exercises.forEach(ex => {
      const def = exerciseDefs.get(ex.exerciseId);
      ex.sets.forEach(set => {
        if (!shouldCountSetForVolume(set, def, workoutBodyWeight, userWeight)) return;
        const load = getSetLoad(set, def, workoutBodyWeight, userWeight);
        const totalReps = getTotalReps(set, def);
        totalVolume += load * totalReps;
      });
    });

    const exercisesWithBodyWeight = applyBodyWeightToExercises(
      workout.exercises,
      exerciseDefs,
      workoutBodyWeight
    );

    const newEndTime = workout.startTime + (durationMinutes * 60 * 1000);

    const finalWorkout = { 
      ...workout, 
      volumeLoad: totalVolume,
      endTime: newEndTime,
      exercises: exercisesWithBodyWeight,
      bodyWeight: workoutBodyWeight
    };

    await workoutService.updateWorkout(id, finalWorkout);
    navigate('/history');
  };

  if (loading || !workout) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-orange"/></div>;

  return (
    <div className="min-h-screen pb-32 animate-in fade-in bg-black">
      
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-iron-950/90 backdrop-blur border-b border-white/5 px-4 py-4 flex justify-between items-center">
        <Button size="icon" variant="ghost" onClick={() => navigate('/history')}>
          <ChevronLeft />
        </Button>
        <h1 className="font-bold text-white">Edit Workout</h1>
        <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
          <Save size={16} className="mr-2"/> Save
        </Button>
      </div>

      <div className="p-4 space-y-6">
        
        {/* META DATA CARD */}
        <div className="bg-iron-base p-4 rounded-xl border border-white/5 space-y-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Workout Name</label>
                <input 
                    value={workout.name}
                    onChange={e => setWorkout({...workout, name: e.target.value})}
                    className="w-full bg-transparent text-xl font-bold text-white border-b border-white/10 focus:border-brand-orange outline-none py-1"
                />
            </div>
            
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
                        <Calendar size={12}/> Date
                    </label>
                    <div className="py-2 text-zinc-300 font-mono text-sm">
                        {new Date(workout.startTime).toLocaleDateString()}
                    </div>
                </div>
                <div className="flex-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
                        <Clock size={12}/> Duration (Mins)
                    </label>
                    <input 
                        type="number"
                        value={durationMinutes}
                        onChange={e => setDurationMinutes(parseInt(e.target.value) || 0)}
                        className="w-full bg-black/20 text-white font-mono rounded-lg p-2 mt-1 border border-white/10 focus:border-brand-orange outline-none"
                    />
                </div>
            </div>
        </div>

        {/* EXERCISES */}
        {workout.exercises.map((ex, exIndex) => {
            const def = exerciseDefs.get(ex.exerciseId);
            const weightLabel = isBodyweightExercise(def) ? 'Extra LBS' : 'LBS';
            return (
              <div key={ex.id} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    {def?.name || 'Unknown'}
                    {def?.isUnilateral && (
                       <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded uppercase tracking-wider">Uni</span>
                    )}
                  </h3>
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeExercise(exIndex)}>
                    <Trash2 size={16} />
                  </Button>
                </div>

                {/* HEADER ROW */}
                <div className="grid grid-cols-10 gap-2 text-[10px] text-zinc-500 uppercase font-bold text-center px-2">
                    <div className="col-span-1">#</div>
                  <div className="col-span-3">{weightLabel}</div>
                    <div className="col-span-3">Reps</div>
                    <div className="col-span-3">Done</div>
                </div>

                {/* SETS */}
                {ex.sets.map((set, setIndex) => {
                    const isDropChild = set.type === 'dropset_child';
                    
                    return (
                        <div key={set.id} className="relative">
                            {/* Drop Set Visual Connector */}
                            {isDropChild && (
                                <div className="absolute -top-3 left-[-6px] w-4 h-8 border-l-2 border-b-2 border-zinc-700 rounded-bl-xl z-0 pointer-events-none" />
                            )}

                            <div className={cn(
                                "grid grid-cols-10 gap-2 items-center p-2 rounded-xl border border-white/5",
                                set.isCompleted ? "bg-black/40" : "bg-black/40",
                                isDropChild ? "ml-4 border-l-2 border-l-zinc-700" : ""
                            )}>
                                {/* Set Number / Icon */}
                                <div className="col-span-1 flex justify-center">
                                     <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center gap-0.5 text-xs font-bold transition-all",
                                        set.type === 'warmup' ? "bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50" :
                                        set.type === 'failure' ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/50" :
                                        set.type === 'dropset' || isDropChild ? "bg-zinc-700 text-white ring-1 ring-zinc-500" :
                                        "bg-white/5 text-zinc-400"
                                     )}>
                                         {isDropChild ? <CornerDownRight size={12}/> : (getTypeIcon(set.type) || setIndex + 1)}
                                     </div>
                                </div>
                                
                                <div className="col-span-3">
                                    <input 
                                        type="number" 
                                    min={0}
                                      value={formatNumberInputValue(set.weight)} 
                                      onChange={e => updateSet(exIndex, setIndex, 'weight', parseNumberInputValue(e.target.value))}
                                        className="w-full bg-transparent text-center text-white font-bold outline-none"
                                        placeholder="-"
                                    />
                                </div>

                                <div className="col-span-3">
                                    {def?.isUnilateral ? (
                                        <div className="flex gap-1">
                                          <input type="number" min={0} placeholder="L" className="w-1/2 bg-white/5 text-center text-white text-xs py-1 rounded" value={formatNumberInputValue(set.repsLeft)} onChange={e => updateSet(exIndex, setIndex, 'repsLeft', parseNumberInputValue(e.target.value))}/>
                                          <input type="number" min={0} placeholder="R" className="w-1/2 bg-white/5 text-center text-white text-xs py-1 rounded" value={formatNumberInputValue(set.repsRight)} onChange={e => updateSet(exIndex, setIndex, 'repsRight', parseNumberInputValue(e.target.value))}/>
                                        </div>
                                    ) : (
                                        <input 
                                            type="number" 
                                          min={0}
                                          value={formatNumberInputValue(set.reps)} 
                                          onChange={e => updateSet(exIndex, setIndex, 'reps', parseNumberInputValue(e.target.value))}
                                            className="w-full bg-transparent text-center text-white font-bold outline-none"
                                            placeholder="-"
                                        />
                                    )}
                                </div>

                                <div className="col-span-3 flex justify-center items-center gap-2">
                                    <button 
                                        onClick={() => updateSet(exIndex, setIndex, 'isCompleted', !set.isCompleted)}
                                        className={cn("p-2 rounded-lg transition-colors", set.isCompleted ? "bg-brand-orange text-white" : "bg-white/5 text-zinc-600")}
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button onClick={() => removeSet(exIndex, setIndex)} className="text-zinc-700 hover:text-red-500">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                <Button variant="ghost" size="sm" className="w-full text-zinc-500 py-2 bg-white/5" onClick={() => addSet(exIndex)}>
                    <Plus size={14} className="mr-2"/> Add Set
                </Button>
              </div>
            );
        })}

        {/* ACTIONS FOOTER */}
        <div className="pt-8 space-y-4">
            <Button variant="ghost" className="w-full text-red-500 hover:bg-red-500/10 py-4" onClick={handleDeleteWorkout}>
                <Trash2 size={18} className="mr-2"/> Delete Workout Record
            </Button>
        </div>
      </div>

      <ExerciseSelector 
        isOpen={isSelectorOpen} 
        onClose={() => setIsSelectorOpen(false)} 
        onSelect={handleAddExercise}
      />
    </div>
  );
};