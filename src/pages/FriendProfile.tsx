import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Weight, Loader2, ArrowLeft, Lock, Flame, ShieldAlert, Dumbbell, BarChart2, Calendar
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { socialService } from '../services/socialService';
import type { FriendProfileData } from '../types';
import { getLevelProgress } from '../utils/achievementUtils';

export const FriendProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FriendProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[FriendProfile] Route param userId:', userId);
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const profileData = await socialService.getFriendProfile(userId!);
        console.log('[FriendProfile] Loaded profile data:', profileData);
        setData(profileData);
      } catch (err) {
        console.error('[FriendProfile] Error loading profile:', err);
        setError(err instanceof Error ? err.message : 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadProfile();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-orange" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black p-6 flex flex-col items-center justify-center gap-4 text-center">
        <ShieldAlert size={48} className="text-red-500" />
        <p className="text-zinc-400 max-w-sm">{error || 'Profile not found'}</p>
        <Button onClick={() => navigate('/profile?tab=friends')} variant="ghost" className="text-brand-orange border border-brand-orange/30">
          Go Back
        </Button>
      </div>
    );
  }

  const { profile, isPrivate, stats, totalXP = 0, streak = 0, achievements = [], recentWorkouts = [] } = data;
  const levelProgress = getLevelProgress(totalXP);

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile?tab=friends')} className="text-zinc-400 hover:text-white shrink-0">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-lg font-bold text-white truncate flex-1">{profile.name}</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        
        {/* Profile Identity Card */}
        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md p-6 flex flex-col items-center gap-4 relative overflow-hidden text-center">
          <div className="w-24 h-24 rounded-full bg-brand-orange/20 border-2 border-brand-orange/50 flex items-center justify-center shrink-0">
            <User size={40} className="text-brand-orange" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">{profile.name}</h2>
            <p className="text-sm font-medium text-zinc-400 mt-1">@{profile.userId}</p>
            {profile.goal && (
              <span className="inline-block mt-3 bg-white/5 border border-white/5 text-xs px-2.5 py-1 rounded-full text-zinc-300">
                Goal: <span className="font-bold text-white">{profile.goal}</span>
              </span>
            )}
          </div>
        </div>

        {/* Privacy Guard */}
        {isPrivate ? (
          <div className="rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-md p-10 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
              <Lock size={28} className="text-zinc-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">This profile is private</h3>
              <p className="text-sm text-zinc-500 max-w-sm mt-1">
                {profile.name} has chosen to keep their stats and workout history private.
              </p>
            </div>
          </div>
        ) : (
          /* Public View */
          <>
            {/* Badges Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-4 flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-brand-orange/80">Current Level</span>
                <span className="text-3xl font-black text-brand-orange">{levelProgress.currentLevel}</span>
              </div>
              <div className="rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md p-4 flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Active Streak</span>
                <div className="flex items-center gap-1.5 text-3xl font-black text-white">
                  {streak > 0 ? (
                    <>
                      <Flame size={28} className="text-orange-500 fill-orange-500" />
                      {streak}
                    </>
                  ) : (
                    <span className="text-zinc-600">0</span>
                  )}
                </div>
              </div>
            </div>

            {/* Overview Stats */}
            {stats && (
              <div className="rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md p-5 space-y-4">
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2">Overview</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-400 flex items-center gap-1"><Calendar size={12}/> Workouts</span>
                    <span className="font-bold text-white text-lg tabular-nums">{stats.totalWorkouts}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-400 flex items-center gap-1"><Weight size={12}/> Volume</span>
                    <span className="font-bold text-white text-lg tabular-nums">
                      {stats.totalVolume >= 1000 ? `${(stats.totalVolume / 1000).toFixed(1)}k` : stats.totalVolume} lbs
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-400 flex items-center gap-1"><Dumbbell size={12}/> Top Muscle</span>
                    <span className="font-bold text-white text-sm truncate">{stats.topMuscle}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Achievements */}
            {achievements.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md p-5 space-y-4">
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Earned Medals</h3>
                <div className="flex flex-wrap gap-2">
                  {achievements.map((ach, idx: number) => (
                    <div key={idx} className="bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl flex items-center gap-2">
                      <span className="text-lg">🏅</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-amber-500">{ach.currentWeight}lb {ach.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Workouts */}
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 px-2 mt-4">Recent Workouts (Last 3)</h3>
              {recentWorkouts.length === 0 ? (
                <div className="text-center p-6 border border-white/5 rounded-2xl bg-white/[0.02] text-sm text-zinc-500">
                  No workouts logged yet.
                </div>
              ) : (
                recentWorkouts.map(workout => {
                  const setMap = workout.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.isCompleted).length, 0);
                  const duration = workout.endTime ? Math.floor((workout.endTime - workout.startTime) / 60000) : 0;
                  return (
                    <div key={workout.id} className="rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md p-4 space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <h4 className="font-bold text-white text-base">{workout.name}</h4>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {new Date(workout.startTime).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => navigate(`/summary/${workout.id}?returnTo=/friends/${userId}`)}
                            className="h-8 text-xs border border-white/5 hover:bg-white/5 text-zinc-300"
                          >
                            Summary
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-300 bg-white/5 px-2 py-1 rounded-md">
                          <BarChart2 size={12} className="text-brand-orange" />
                          {setMap} sets
                        </span>
                        {duration > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-300 bg-white/5 px-2 py-1 rounded-md">
                            <Flame size={12} className="text-brand-orange" />
                            {duration} min
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
