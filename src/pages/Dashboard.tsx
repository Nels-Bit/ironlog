import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Dumbbell, TrendingUp, Calendar, ArrowRight, Loader2, Play
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { workoutService } from '../services/workoutService';
import { authService } from '../services/authService';
import { useWorkout } from '../context/WorkoutContext';
import type { WorkoutSession, UserProfile } from '../types';

export const Dashboard = () => {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { startWorkout, isActive } = useWorkout();

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
  const recentWorkouts = history.slice(0, 3);

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
            <h2 className="text-2xl font-black italic mb-2">SESSION ACTIVE</h2>
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
            <h2 className="text-2xl font-black italic text-white mb-2">START TRAINING</h2>
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

      {/* RECENT HISTORY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-white">Recent Activity</h3>
          <Link to="/history" className="text-xs font-bold text-brand-orange hover:text-orange-400 uppercase tracking-widest">View All</Link>
        </div>
        
        <div className="space-y-3">
          {recentWorkouts.length === 0 ? (
            <div className="text-center py-10 text-zinc-600 italic">No workouts yet. Go lift something heavy.</div>
          ) : (
            recentWorkouts.map(session => (
              <Link to={`/history/${session.id}`} key={session.id} className="block group">
                <div className="bg-iron-950 border border-white/5 p-4 rounded-2xl flex items-center justify-between group-hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-brand-orange transition-colors">
                      <Dumbbell size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white group-hover:text-brand-orange transition-colors">{session.name}</h4>
                      <p className="text-xs text-zinc-500 font-medium">
                        {new Date(session.startTime).toLocaleDateString()} • {(session.volumeLoad || 0).toLocaleString()} lbs
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-zinc-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};