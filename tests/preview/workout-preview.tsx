// Development review harness: real app components/context, fictional service data.
// This HTML entry is not part of the production build. All network calls fail closed.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkoutProvider } from '../../src/context/WorkoutContext';
import { WorkoutLogger } from '../../src/pages/WorkoutLogger';
import { WorkoutSummary } from '../../src/pages/WorkoutSummary';
import { RestTimer } from '../../src/components/RestTimer';
import { Navbar } from '../../src/components/Navbar';
import { authService } from '../../src/services/authService';
import { exerciseService } from '../../src/services/exerciseService';
import { workoutService } from '../../src/services/workoutService';
import { socialService } from '../../src/services/socialService';
import type { Exercise, ExerciseSet, WorkoutSession } from '../../src/types';
import { getBestPRPerformance } from '../../src/utils/workoutMath';
import '../../src/index.css';

if (!import.meta.env.DEV) throw new Error('The workout review is available in development only.');
window.fetch = async () => { throw new Error('Network requests are disabled in this fictional workout preview.'); };

let definitions: Exercise[] = JSON.parse(localStorage.getItem('preview_definitions') || 'null') || [
  { id: 'bench', name: 'Bench Press', category: 'Free Weights', exerciseCategory: 'strength', target: 'Chest' },
  { id: 'incline', name: 'Incline Dumbbell Press', category: 'Free Weights', exerciseCategory: 'strength', target: 'Chest' },
  { id: 'fly', name: 'Cable Fly', category: 'Cables', exerciseCategory: 'strength', target: 'Chest' },
  { id: 'run', name: 'Treadmill Run', category: 'Cardio', exerciseCategory: 'cardio', target: 'Cardio' },
  { id: 'row', name: 'Single Arm Dumbbell Row', category: 'Free Weights', exerciseCategory: 'strength', target: 'Back', isUnilateral: true },
  { id: 'pullup', name: 'Assisted Pull Up', category: 'Assisted', exerciseCategory: 'strength', target: 'Back' },
  { id: 'pushup', name: 'Push Up', category: 'Bodyweight', exerciseCategory: 'strength', target: 'Chest' }
];
const blank = (id: string): ExerciseSet => ({ id, type: 'normal', weight: null, reps: null, isCompleted: false });
const historicSets: Record<string, ExerciseSet[]> = {
  bench: [{ ...blank('old-b1'), weight: 185, reps: 8, isCompleted: true }, { ...blank('old-b2'), weight: 175, reps: 10, isCompleted: true }],
  incline: [{ ...blank('old-i1'), weight: 70, reps: 10, isCompleted: true }],
  fly: [{ ...blank('old-f1'), weight: 25, reps: 12, isCompleted: true }, { ...blank('old-f2'), weight: 25, reps: 10, isCompleted: true }],
  run: [{ ...blank('old-r1'), distance: 3, durationSeconds: 1800, isCompleted: true }]
};
const past: WorkoutSession = {
  id: 'previous-workout', name: 'Previous upper body', startTime: Date.now() - 45 * 86400000,
  endTime: Date.now() - 45 * 86400000 + 3600000, volumeLoad: 8100,
  exercises: Object.entries(historicSets).map(([exerciseId, sets]) => ({ id: `old-${exerciseId}`, exerciseId, sets }))
};
const seed = (): WorkoutSession => ({
  id: 'preview-active', name: 'Upper Body + Cardio', startTime: Date.now() - 720000, volumeLoad: 0, bodyWeight: 180,
  exercises: [
    { id: 'active-bench', exerciseId: 'bench', sets: [{ ...historicSets.bench[0], id: 'active-b1' }, { ...historicSets.bench[1], id: 'active-b2' }, blank('active-b3')] },
    { id: 'active-incline', exerciseId: 'incline', sets: [blank('active-i1'), blank('active-i2')] },
    { id: 'active-fly', exerciseId: 'fly', sets: [blank('active-f1')] },
    { id: 'active-run', exerciseId: 'run', sets: [blank('active-r1')] }
  ]
});
const savedWorkouts: WorkoutSession[] = JSON.parse(localStorage.getItem('preview_saved_workouts') || '[]');
if (!localStorage.getItem('preview_initialized')) {
  localStorage.setItem('current_workout', JSON.stringify(seed()));
  localStorage.setItem('preview_initialized', 'true');
}
authService.getUser = async () => ({ id: 'preview-user', userId: 'PREVIEW', name: 'Preview Athlete', email: 'preview@example.invalid', isPublic: false, weight: 180 });
exerciseService.getAllExercises = async () => definitions;
exerciseService.createExercise = async ex => {
  const created: Exercise = { ...ex, id: crypto.randomUUID(), name: ex.name || 'Custom exercise', category: ex.category || 'Free Weights', isCustom: true };
  definitions = [...definitions, created];
  localStorage.setItem('preview_definitions', JSON.stringify(definitions));
  return created;
};
exerciseService.deleteCustomExercise = async id => {
  definitions = definitions.filter(ex => ex.id !== id);
  localStorage.setItem('preview_definitions', JSON.stringify(definitions));
};
workoutService.getLastLog = async exerciseId => historicSets[exerciseId] ? { id: `old-${exerciseId}`, exerciseId, sets: historicSets[exerciseId] } : null;
workoutService.getPersonalRecordPerformance = async exerciseId => getBestPRPerformance(historicSets[exerciseId] || [], definitions.find(ex => ex.id === exerciseId), undefined, 180);
workoutService.getPersonalRecord = async exerciseId => (await workoutService.getPersonalRecordPerformance(exerciseId)).load;
workoutService.getHistory = async () => [past, ...savedWorkouts];
workoutService.getWorkoutById = async id => [past, ...savedWorkouts].find(workout => workout.id === id) || null;
workoutService.saveWorkout = async workout => {
  savedWorkouts.push(structuredClone(workout));
  localStorage.setItem('preview_saved_workouts', JSON.stringify(savedWorkouts));
  window.dispatchEvent(new Event('preview-saved'));
  return workout;
};
socialService.dispatchFriendMilestones = async () => ({ recipients: 0, notifications: 0 });
socialService.getUnreadNotificationCount = async () => 0;
socialService.subscribeToNotifications = async () => () => {};
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

export const Preview = () => {
  const [saveCount, setSaveCount] = useState(savedWorkouts.length);
  // The harness records save calls so lifecycle testing can detect duplicates.
  useEffect(() => {
    const update = () => setSaveCount(savedWorkouts.length);
    window.addEventListener('preview-saved', update);
    return () => window.removeEventListener('preview-saved', update);
  }, []);
  const reset = (empty: boolean) => {
    localStorage.removeItem('current_workout');
    localStorage.removeItem('workout_start_time');
    localStorage.removeItem('preview_saved_workouts');
    localStorage.removeItem('preview_definitions');
    if (!empty) localStorage.setItem('current_workout', JSON.stringify(seed()));
    window.location.hash = '#/workout';
    window.location.reload();
  };
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <WorkoutProvider>
          <div className="min-h-screen bg-black text-white md:pl-64">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-iron-950 px-4 py-2 text-xs text-zinc-400">
              <span>Local review · fictional data · {saveCount} saved workouts</span>
              <div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => reset(false)}>Reset preview</button><button className="btn btn-ghost btn-sm" onClick={() => reset(true)}>Empty session</button></div>
            </div>
            <RestTimer /><Navbar />
            <Routes>
              <Route path="/workout" element={<WorkoutLogger />} />
              <Route path="/summary/:id" element={<WorkoutSummary />} />
              <Route path="/profile" element={<div className="p-6"><h1 className="text-xl font-bold">Session closed</h1><Link className="btn mt-4" to="/workout">Start another workout</Link></div>} />
              <Route path="*" element={<Navigate to="/workout" replace />} />
            </Routes>
          </div>
        </WorkoutProvider>
      </HashRouter>
    </QueryClientProvider>
  );
};
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<StrictMode><Preview /></StrictMode>);
