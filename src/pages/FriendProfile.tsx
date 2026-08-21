import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Lock, 
  Globe, 
  Dumbbell, 
  Calendar, 
  Clock, 
  Layers, 
  Loader2, 
  Flame, 
  ShieldAlert
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { socialService } from '../services/socialService';
import { exerciseService } from '../services/exerciseService';
import { cn } from '../lib/utils';
import type { FriendProfileDetails, Exercise, WorkoutSession } from '../types';

export const FriendProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [friend, setFriend] = useState<FriendProfileDetails | null>(null);
  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setError('No user identifier provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [profileData, allDefs] = await Promise.all([
          socialService.getFriendProfile(userId),
          exerciseService.getAllExercises()
        ]);

        if (!profileData) {
          setError('User profile not found.');
        } else {
          setFriend(profileData);
        }

        const map = new Map<string, Exercise>();
        allDefs.forEach(ex => map.set(ex.id, ex));
        setExerciseDefs(map);
      } catch (err) {
        console.error('Failed to load friend profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load athlete profile.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  const handleBack = () => {
    navigate('/profile?tab=friends');
  };

  const getPrimaryTarget = (workout: WorkoutSession): string => {
    const counts: Record<string, number> = {};
    workout.exercises.forEach(ex => {
      const def = exerciseDefs.get(ex.exerciseId);
      const target = def?.target || def?.category;
      if (target) {
        counts[target] = (counts[target] || 0) + 1;
      }
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'Full Body';
  };

  const formatDuration = (workout: WorkoutSession): string | null => {
    if (!workout.endTime || !workout.startTime) return null;
    const minutes = Math.max(1, Math.round((workout.endTime - workout.startTime) / 60000));
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-brand-orange" size={32} />
        <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Loading Athlete Profile...</p>
      </div>
    );
  }

  if (error || !friend) {
    return (
      <div className="min-h-screen bg-black p-4 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Profile Unavailable</h2>
        <p className="text-sm text-zinc-400 max-w-xs mb-6">{error || 'This user profile could not be loaded.'}</p>
        <Button onClick={handleBack} variant="ghost" className="border border-white/10 text-white">
          <ChevronLeft size={16} className="mr-1" /> Back to Friends
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center gap-3">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleBack}
          className="rounded-full text-zinc-400 hover:text-white"
        >
          <ChevronLeft size={22} />
        </Button>
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Athlete Profile</span>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto mt-2">
        {/* Profile Card */}
        <div className="relative overflow-hidden bg-zinc-900/50 border border-white/10 rounded-3xl p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/20 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-3xl font-black text-white shrink-0">
              {friend.name?.charAt(0).toUpperCase() || 'A'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-white truncate">{friend.name}</h2>
              </div>

              <div className="inline-flex items-center gap-1.5">
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                  friend.isPublic 
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" 
                    : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                )}>
                  {friend.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                  {friend.isPublic ? 'Public Profile' : 'Private Profile'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Private Profile Guard */}
        {!friend.isPublic ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/30 p-8 text-center space-y-4 animate-in fade-in duration-300">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/80 border border-white/10 flex items-center justify-center text-zinc-400">
              <Lock size={26} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">This profile is private</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                {friend.name} has kept their profile private. Workout history, logs, and statistics are hidden.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Overview / Stats Section */}
            <div className="rounded-3xl border border-white/10 bg-zinc-900/25 p-4 space-y-3">
              <div>
                <h3 className="text-base font-bold text-white">Training Overview</h3>
                <p className="text-xs text-zinc-500">All-time recorded stats</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Flame size={12} className="text-brand-orange" /> Total Workouts
                  </p>
                  <p className="text-2xl font-black text-white mt-1">{friend.totalWorkouts}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Dumbbell size={12} className="text-brand-orange" /> Total Volume
                  </p>
                  <p className="text-2xl font-black text-white mt-1">
                    {Math.round(friend.totalVolume).toLocaleString()} <span className="text-xs text-zinc-500 font-normal">lbs</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Workouts (Last 3 Workouts) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-base font-bold text-white">Recent Workouts</h3>
                  <p className="text-xs text-zinc-500">Last 3 completed sessions</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                  {friend.recentWorkouts.length} / 3 shown
                </span>
              </div>

              {friend.recentWorkouts.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-zinc-900/20 p-8 text-center text-zinc-500 text-sm">
                  No workouts recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {friend.recentWorkouts.map((workout) => {
                    const primaryTarget = getPrimaryTarget(workout);
                    const durationStr = formatDuration(workout);
                    const dateStr = new Date(workout.startTime).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    return (
                      <div
                        key={workout.id}
                        className="rounded-3xl border border-white/10 bg-zinc-900/40 p-4 space-y-3 hover:border-white/20 transition-all"
                      >
                        {/* Header: Title + Target Muscle Group */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base font-bold text-white truncate">{workout.name}</h4>
                            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} className="text-zinc-500" />
                                {dateStr}
                              </span>
                              {durationStr && (
                                <span className="flex items-center gap-1">
                                  <Clock size={12} className="text-zinc-500" />
                                  {durationStr}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-orange/15 text-brand-orange border border-brand-orange/20">
                            {primaryTarget}
                          </span>
                        </div>

                        {/* Exercise Breakdown */}
                        {workout.exercises && workout.exercises.length > 0 && (
                          <div className="rounded-2xl border border-white/5 bg-black/30 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                              <Layers size={11} /> Exercises
                            </div>
                            <div className="space-y-1">
                              {workout.exercises.map((ex, exIdx) => {
                                const def = exerciseDefs.get(ex.exerciseId);
                                const exName = def?.name || 'Exercise';
                                const setsCount = ex.sets?.length || 0;
                                const completedSets = ex.sets?.filter(s => s.isCompleted)?.length ?? setsCount;

                                return (
                                  <div
                                    key={ex.id || exIdx}
                                    className="flex items-center justify-between text-xs py-0.5"
                                  >
                                    <span className="text-zinc-300 font-medium truncate mr-2">
                                      {exName}
                                    </span>
                                    <span className="text-[11px] text-zinc-500 shrink-0 font-mono">
                                      {completedSets} {completedSets === 1 ? 'set' : 'sets'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Total Volume */}
                        {workout.volumeLoad > 0 && (
                          <div className="text-right text-[11px] font-mono text-zinc-500">
                            Volume: <span className="text-zinc-300 font-bold">{Math.round(workout.volumeLoad).toLocaleString()} lbs</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
