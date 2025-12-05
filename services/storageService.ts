
import { WorkoutSession, ExerciseSet, Exercise, ExerciseCategory, ChatMessage } from '../types';

// Helper to get user-specific storage key
const getStorageKey = (userId: string) => `ironlog_workouts_${userId}`;
const getHiddenExercisesKey = (userId: string) => `ironlog_hidden_exercises_${userId}`;
const getDraftKey = (userId: string) => `ironlog_workout_draft_${userId}`;
const getChatKey = (userId: string) => `ironlog_chat_history_${userId}`;
const getRestPrefKey = (userId: string) => `ironlog_rest_pref_${userId}`;

export const getWorkouts = (userId: string): WorkoutSession[] => {
  if (!userId) return [];
  try {
    const data = localStorage.getItem(getStorageKey(userId));
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load workouts", e);
    return [];
  }
};

export const saveWorkout = (userId: string, workout: WorkoutSession): void => {
  if (!userId) return;
  const workouts = getWorkouts(userId);
  const index = workouts.findIndex(w => w.id === workout.id);
  
  if (index >= 0) {
    workouts[index] = workout;
  } else {
    workouts.unshift(workout); // Add new to top
  }
  
  localStorage.setItem(getStorageKey(userId), JSON.stringify(workouts));

  // Auto-restore hidden exercises if they are explicitly used
  const hidden = getHiddenExercises(userId);
  if (hidden.length > 0) {
    const hiddenSet = new Set(hidden.map(h => h.toLowerCase()));
    let changed = false;
    let newHidden = [...hidden];

    workout.exercises.forEach(ex => {
        if (ex.name && hiddenSet.has(ex.name.trim().toLowerCase())) {
            newHidden = newHidden.filter(h => h.toLowerCase() !== ex.name.trim().toLowerCase());
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem(getHiddenExercisesKey(userId), JSON.stringify(newHidden));
    }
  }
};

export const deleteWorkout = (userId: string, id: string): void => {
  if (!userId) return;
  const workouts = getWorkouts(userId);
  const newWorkouts = workouts.filter(w => w.id !== id);
  localStorage.setItem(getStorageKey(userId), JSON.stringify(newWorkouts));
};

export const getWorkoutById = (userId: string, id: string): WorkoutSession | undefined => {
  if (!userId) return undefined;
  return getWorkouts(userId).find(w => w.id === id);
};

export const hideExerciseName = (userId: string, name: string): void => {
  if (!userId || !name) return;
  const key = getHiddenExercisesKey(userId);
  let hidden: string[] = [];
  try {
    hidden = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) { hidden = []; }
  
  if (!hidden.includes(name)) {
    hidden.push(name);
    localStorage.setItem(key, JSON.stringify(hidden));
  }
};

export const unhideExerciseName = (userId: string, name: string): void => {
  if (!userId || !name) return;
  const key = getHiddenExercisesKey(userId);
  let hidden: string[] = [];
  try {
    hidden = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) { hidden = []; }
  
  const newHidden = hidden.filter(h => h !== name);
  localStorage.setItem(key, JSON.stringify(newHidden));
};

export const getHiddenExercises = (userId: string): string[] => {
    if (!userId) return [];
    try {
        return JSON.parse(localStorage.getItem(getHiddenExercisesKey(userId)) || '[]');
    } catch (e) { return []; }
};

export interface KnownExercise {
    name: string;
    category?: ExerciseCategory;
    isUnilateral?: boolean;
}

export const getKnownExercises = (userId: string): KnownExercise[] => {
    if (!userId) return [];

    const hidden = getHiddenExercises(userId);
    const hiddenSet = new Set(hidden.map(h => h.toLowerCase()));

    const workouts = getWorkouts(userId);
    const exerciseMap = new Map<string, KnownExercise>();

    workouts.forEach(w => {
        w.exercises.forEach(e => {
            if (e.name && e.name.trim()) {
                const cleanName = e.name.trim();
                const lowerName = cleanName.toLowerCase();
                
                if (!hiddenSet.has(lowerName) && !exerciseMap.has(lowerName)) {
                    exerciseMap.set(lowerName, {
                        name: cleanName,
                        category: e.category,
                        isUnilateral: e.isUnilateral
                    });
                }
            }
        });
    });

    return Array.from(exerciseMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const getUniqueExerciseNames = (userId: string): string[] => {
    return getKnownExercises(userId).map(e => e.name);
};

// Returns stats formatted for display: { last: "100lbs x 10", pr: "120lbs x 5" }
export const getExerciseStats = (userId: string, exerciseName: string): { last: string, pr: string } | null => {
  if (!userId || !exerciseName) return null;
  
  const cleanName = exerciseName.trim().toLowerCase();
  const workouts = getWorkouts(userId);
  
  // Filter workouts that contain this exercise
  const relevantWorkouts = workouts.filter(w => 
    w.exercises.some(e => e.name.toLowerCase().trim() === cleanName)
  ).sort((a, b) => b.startTime - a.startTime); // Newest first

  if (relevantWorkouts.length === 0) return null;

  const lastWorkout = relevantWorkouts[0];
  const lastExercise = lastWorkout.exercises.find(e => e.name.toLowerCase().trim() === cleanName);
  
  const isCardio = lastExercise?.category === 'Cardio';
  const isUnilateral = lastExercise?.isUnilateral;

  // 1. Get Last Session Stats
  let lastStats = "N/A";
  
  if (lastExercise && lastExercise.sets.length > 0) {
      const completedSets = lastExercise.sets.filter(s => s.completed);
      
      if (completedSets.length > 0) {
          if (isCardio) {
             // Best Cardio Set (Max Dist or Time)
             const bestSet = completedSets.reduce((prev, current) => {
                const prevDist = prev.distance || 0;
                const currDist = current.distance || 0;
                if (currDist > prevDist) return current;
                return prev;
             }, completedSets[0]);
             if (bestSet) lastStats = `${bestSet.distance || 0}mi / ${bestSet.time || 0}m`;
          } else {
             // Best Strength Set
             const bestSet = completedSets.reduce((prev, current) => {
                if (current.weight > prev.weight) return current;
                if (current.weight === prev.weight && current.reps > prev.reps) return current;
                return prev;
             }, completedSets[0]);
             
             if (bestSet) {
                 if (isUnilateral) {
                     // For unilateral, display just the weight x reps (implied per side)
                     // Using repsLeft as representative if exists, else standard reps
                     const r = bestSet.repsLeft || bestSet.reps;
                     lastStats = `${bestSet.weight}lbs x ${r}`;
                 } else {
                     lastStats = `${bestSet.weight}lbs x ${bestSet.reps}`;
                 }
             }
          }
      }
  }

  // 2. Get Personal Record
  let prStats = "N/A";
  
  if (isCardio) {
      let maxDistance = 0;
      let associatedTime = 0;
      relevantWorkouts.forEach(w => {
          const ex = w.exercises.find(e => e.name.toLowerCase().trim() === cleanName);
          ex?.sets.forEach(s => {
              if (s.completed && (s.distance || 0) > maxDistance) {
                  maxDistance = s.distance || 0;
                  associatedTime = s.time || 0;
              }
          });
      });
      if (maxDistance > 0) prStats = `${maxDistance}mi / ${associatedTime}m`;
  } else {
      let maxWeight = 0;
      let maxWeightReps = 0;

      relevantWorkouts.forEach(w => {
          const ex = w.exercises.find(e => e.name.toLowerCase().trim() === cleanName);
          ex?.sets.forEach(s => {
              if (s.completed && s.weight > 0) {
                  if (s.weight > maxWeight) {
                      maxWeight = s.weight;
                      maxWeightReps = s.repsLeft || s.reps;
                  } else if (s.weight === maxWeight) {
                      const r = s.repsLeft || s.reps;
                      if (r > maxWeightReps) maxWeightReps = r;
                  }
              }
          });
      });

      if (maxWeight > 0) {
          prStats = `${maxWeight}lbs x ${maxWeightReps}`;
      }
  }

  return { last: lastStats, pr: prStats };
};

export const getLastExerciseSets = (userId: string, exerciseName: string, excludeWorkoutId?: string | null): ExerciseSet[] | null => {
    if (!userId || !exerciseName) return null;
    const cleanName = exerciseName.trim().toLowerCase();
    let workouts = getWorkouts(userId);
    
    if (excludeWorkoutId) {
        workouts = workouts.filter(w => w.id !== excludeWorkoutId);
    }

    workouts.sort((a, b) => b.startTime - a.startTime);

    const lastWorkout = workouts.find(w => 
        w.exercises.some(e => e.name.toLowerCase().trim() === cleanName)
    );

    if (!lastWorkout) return null;

    const lastExercise = lastWorkout.exercises.find(e => e.name.toLowerCase().trim() === cleanName);
    return lastExercise ? lastExercise.sets : null;
};

export interface ExerciseHistoryPoint {
    date: number;
    maxWeight: number; // Or distance for cardio
    volume: number;
    bestSet: ExerciseSet;
}

export const getExerciseHistory = (userId: string, exerciseName: string): ExerciseHistoryPoint[] => {
  if (!userId || !exerciseName) return [];
  
  const cleanName = exerciseName.trim().toLowerCase();
  const workouts = getWorkouts(userId);

  const history: ExerciseHistoryPoint[] = [];

  workouts.forEach(w => {
      const ex = w.exercises.find(e => e.name.toLowerCase().trim() === cleanName);
      if (ex && ex.sets.length > 0) {
          const isCardio = ex.category === 'Cardio';
          const isUnilateral = ex.isUnilateral;
          
          let maxValue = 0; // Weight or Distance
          let bestSet = ex.sets[0];
          let volume = 0;

          ex.sets.forEach(s => {
              if (s.completed) {
                  if (isCardio) {
                      // Volume for cardio could be total distance
                      volume += (s.distance || 0);
                      if ((s.distance || 0) > maxValue) {
                          maxValue = s.distance || 0;
                          bestSet = s;
                      }
                  } else {
                      // Strength
                      let reps = s.reps;
                      if (isUnilateral) {
                          reps = (s.repsLeft || 0) + (s.repsRight || 0);
                      }
                      
                      volume += s.weight * reps;
                      
                      if (s.weight > maxValue) {
                          maxValue = s.weight;
                          bestSet = s;
                      }
                  }
              }
          });

          if (maxValue > 0) {
              history.push({
                  date: w.startTime,
                  maxWeight: maxValue,
                  volume,
                  bestSet
              });
          }
      }
  });

  return history.sort((a, b) => a.date - b.date);
};

export const getRecentWorkoutsContext = (userId: string): string => {
    const workouts = getWorkouts(userId).slice(0, 5); // Last 5 workouts
    if (workouts.length === 0) return "No previous workout history.";

    let context = "RECENT WORKOUT HISTORY:\n";
    workouts.forEach(w => {
        context += `\nWorkout: ${w.name} (${new Date(w.startTime).toLocaleDateString()})\n`;
        w.exercises.forEach(ex => {
            context += `  - ${ex.name} (${ex.category || 'Free Weight'}): `;
            const completedSets = ex.sets.filter(s => s.completed);
            if (completedSets.length === 0) {
                context += "No sets completed.";
            } else {
                context += completedSets.map(s => {
                    if (ex.category === 'Cardio') return `${s.distance}mi/${s.time}m`;
                    return `${s.weight}lbs x ${ex.isUnilateral ? `(L:${s.repsLeft} R:${s.repsRight})` : s.reps}`;
                }).join(", ");
            }
            context += "\n";
        });
    });
    return context;
};

// --- CHAT STORAGE ---
export const saveChatHistory = (userId: string, messages: ChatMessage[]) => {
    if (!userId) return;
    localStorage.setItem(getChatKey(userId), JSON.stringify(messages));
};

export const getChatHistory = (userId: string): ChatMessage[] => {
    if (!userId) return [];
    try {
        const data = localStorage.getItem(getChatKey(userId));
        return data ? JSON.parse(data) : [];
    } catch { return []; }
};

export const clearChatHistory = (userId: string) => {
    if (!userId) return;
    localStorage.removeItem(getChatKey(userId));
};

export interface WorkoutDraft {
    editWorkoutId: string | null;
    workoutName: string;
    startTime: number;
    hasStarted?: boolean;
    exercises: Exercise[];
    timerPaused: boolean;
    timerPausedAt: number | null;
    totalPausedTime: number;
    notesExpanded: Record<string, boolean>;
    exercisesExpanded: Record<string, boolean>;
    restTimer?: {
        isActive: boolean;
        timeLeft: number;
        duration: number;
        endTime: number | null;
    };
}

export const saveDraft = (userId: string, draft: WorkoutDraft) => {
    if (!userId) return;
    localStorage.setItem(getDraftKey(userId), JSON.stringify(draft));
};

export const getDraft = (userId: string): WorkoutDraft | null => {
    if (!userId) return null;
    try {
        const data = localStorage.getItem(getDraftKey(userId));
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

export const clearDraft = (userId: string) => {
    if (!userId) return;
    localStorage.removeItem(getDraftKey(userId));
};

// --- PREFERENCES ---
export const saveRestTimerPreference = (userId: string, seconds: number) => {
    if(!userId) return;
    localStorage.setItem(getRestPrefKey(userId), seconds.toString());
}

export const getRestTimerPreference = (userId: string): number => {
    if(!userId) return 90; // Default 90s
    const val = localStorage.getItem(getRestPrefKey(userId));
    return val ? parseInt(val, 10) : 90;
}
