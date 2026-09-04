import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Loader2, ArrowLeft, Lock, Flame, ShieldAlert, BarChart2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { socialService } from '../services/socialService';
import type { FriendProfileData } from '../types';
import { getLevelProgress } from '../utils/achievementUtils';
import { TrophyCabinet } from '../components/TrophyCabinet';

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

  const { profile, isPrivate, stats, totalXP = 0, streak = 0, trophies = [], recentWorkouts = [] } = data;
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
        
        {/* Profile Identity */}
        <div className="relative py-4 flex flex-col items-center gap-4 text-center">
          <div className="w-24 h-24 rounded-full border-[3px] border-zinc-800 bg-brand-orange/10 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/10">
            <User size={40} className="text-brand-orange" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">{profile.name}</h2>
            <p className="text-sm font-medium text-zinc-400 mt-1">@{profile.userId}</p>
          </div>
        </div>

        {/* Privacy Guard */}
        {isPrivate ? (
          <div className="rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-md p-10 flex flex-col items-center justify-center gap-4 text-center mt-4">
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
            {/* Inline Key Stats Cluster */}
            <div className="flex flex-wrap justify-center items-center gap-3 mb-6 text-xs font-semibold text-white">
              <span className="flex items-center gap-1.5">
                Level {levelProgress.currentLevel}
              </span>
              
              {streak > 0 && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="flex items-center gap-1.5">
                    🔥 {streak} Day{streak !== 1 ? 's' : ''}
                  </span>
                </>
              )}

              {stats && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="flex items-center gap-1.5">
                    🏋️ {stats.totalWorkouts} Workouts
                  </span>
                  
                  {stats.topMuscle && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="flex items-center gap-1.5 capitalize">
                        💪 {stats.topMuscle}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Trophy Cabinet (replaces flat medal chips) */}
            {trophies.length > 0 && (
              <TrophyCabinet trophies={trophies} isReadOnly />
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
