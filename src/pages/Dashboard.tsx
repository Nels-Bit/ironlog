import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Dumbbell, TrendingUp, Calendar, ArrowRight, Loader2, Play
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { workoutService } from '../services/workoutService';
import { authService } from '../services/authService';
import { useWorkout } from '../context/WorkoutContext';
import type { WorkoutSession, UserProfile } from '../types';
import { calculateWorkoutStreak, formatStreakLabel } from '../utils/achievementUtils';

export const Dashboard = () => {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { startWorkout, logRestDay, isActive } = useWorkout();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [historyData, userData] = await Promise.all([
          workoutService.getHistory(),
          authService.getUser()
        ]);
        setHistory(historyData);
        setUser(userData);
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-orange" /></div>;

  const totalVolume = history.reduce((acc, curr) => acc + (curr.volumeLoad || 0), 0);
  const streak = calculateWorkoutStreak(history).currentStreak;

  const handleLogRestDay = async () => {
    const id = await logRestDay();
    const updatedHistory = await workoutService.getHistory();
    setHistory(updatedHistory);
    if (id) navigate(`/history/${id}`);
    else navigate('/history');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black italic tracking-tighter text-white">
          WAKE UP, <span className="text-brand-orange uppercase">{user?.name || 'ATHLETE'}</span>
        </h1>
        <p className="text-zinc-500 font-medium">It's time to build the iron.</p>
      </div>

      {/* QUICK START / ACTIVE SESSION */}
      {isActive ? (
        <div className="bg-brand-orange text-white p-6 rounded-3xl shadow-lg shadow-brand-orange/20 relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-2xl font-black italic">SESSION ACTIVE</h2>
              <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5">
                <span className="text-lg animate-pulse">🔥</span>
                <span className="text-xs font-black uppercase tracking-widest">{formatStreakLabel(streak)}</span>
              </div>
            </div>
            <p className="text-white/80 mb-6 font-medium">You are currently logged in a workout.</p>
            <Link to="/workout">
              <Button variant="secondary" className="bg-white text-brand-orange hover:bg-zinc-100 border-none font-bold">
                Continue Session <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
          </div>
          <Dumbbell className="absolute -right-4 -bottom-4 text-white/20 rotate-[-15deg] group-hover:rotate-0 transition-transform duration-500" size={140} />
        </div>
      ) : (
        <div className="bg-iron-950 border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-brand-orange/50 transition-colors">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-2xl font-black italic text-white">START TRAINING</h2>
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 border border-white/10">
                <span className="text-lg animate-pulse">🔥</span>
                <span className="text-xs font-black uppercase tracking-widest text-white">{formatStreakLabel(streak)}</span>
              </div>
            </div>
            <p className="text-zinc-500 mb-6">Log a new session and track your progress.</p>
            <Button onClick={() => startWorkout("New Workout")} className="w-full sm:w-auto font-bold">
              <Play className="mr-2 fill-current" size={18} /> Start Empty Workout
            </Button>
          </div>
        </div>
      )}

      {/* STATS GRID */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-iron-950 border border-white/5 p-5 rounded-3xl flex flex-col justify-between h-32">
          <TrendingUp className="text-brand-orange mb-2" size={24} />
          <div>
            <span className="text-3xl font-black text-white">{(totalVolume / 1000).toFixed(1)}k</span>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Volume (lbs)</p>
          </div>
        </div>
        <div className="bg-iron-950 border border-white/5 p-5 rounded-3xl flex flex-col justify-between h-32">
          <Calendar className="text-brand-orange mb-2" size={24} />
          <div>
            <span className="text-3xl font-black text-white">{history.length}</span>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Sessions Completed</p>
          </div>
        </div>
      </div>

      {/* HOW TO / INSTALL CARD */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-white">How To</h3>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Install as an app</span>
        </div>

        <div className="bg-iron-950 border border-white/5 p-4 rounded-2xl">
          <p className="text-sm text-zinc-400 mb-3">Make Iron Log feel like a native app on your phone.</p>
          <ol className="text-sm text-zinc-300 list-decimal list-inside space-y-2">
            <li><strong>iOS (Safari):</strong> Open the Share menu → tap "Add to Home Screen".</li>
            <li><strong>Android (Chrome):</strong> Open the browser menu → tap "Install app" or "Add to Home screen".</li>
            <li><strong>Desktop:</strong> Use the browser install prompt or the menu to "Install" the app for a standalone window.</li>
          </ol>
        </div>
      </div>

      <Button
        onClick={handleLogRestDay}
        className="w-full bg-blue-950/90 border border-blue-400/20 text-blue-100 hover:bg-blue-900/90 hover:text-white shadow-lg shadow-blue-950/30"
      >
        🌙 Log Rest Day
      </Button>
    </div>
  );
};