import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckCircle2, 
  Trophy, 
  Flame, 
  Layers, 
  Share2, 
  ArrowRight, 
  Loader2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { getLevelProgress } from '../utils/achievementUtils';
import type { WorkoutSession, Exercise } from '../types';

export const WorkoutSummary = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get('id');
  const workoutId = id || queryId;

  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map());
  const [totalWorkoutsCount, setTotalWorkoutsCount] = useState(1);
  const [displayedVolume, setDisplayedVolume] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [allDefs, history] = await Promise.all([
          exerciseService.getAllExercises(),
          workoutService.getHistory()
        ]);

        const defMap = new Map<string, Exercise>();
        allDefs.forEach(ex => defMap.set(ex.id, ex));
        setExerciseDefs(defMap);
        setTotalWorkoutsCount(Math.max(1, history.length));

        let currentSession: WorkoutSession | null = null;
        if (workoutId) {
          currentSession = await workoutService.getWorkoutById(workoutId);
        }

        if (!currentSession && history.length > 0) {
          currentSession = history[0];
        }

        setWorkout(currentSession);
      } catch (err) {
        console.error('Error loading summary data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workoutId]);

  // Animated Count-Up for Total Volume
  useEffect(() => {
    if (!workout?.volumeLoad) {
      setDisplayedVolume(0);
      return;
    }

    const target = Math.round(workout.volumeLoad);
    const duration = 1200; // ms
    const steps = 40;
    const stepTime = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedVolume(Math.round(target * eased));

      if (currentStep >= steps) {
        clearInterval(timer);
        setDisplayedVolume(target);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [workout?.volumeLoad]);

  const handleDone = () => {
    navigate('/profile?tab=activity');
  };

  const handleShare = async () => {
    if (!workout) return;
    const text = `I just crushed "${workout.name}" on IronLog! Total Volume: ${Math.round(workout.volumeLoad).toLocaleString()} lbs 💪`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'IronLog Workout Summary',
          text,
          url: window.location.href
        });
      } catch {
        // Share cancelled or failed
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Workout summary copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-brand-orange" size={32} />
        <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Calculating Workout Stats...</p>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-white mb-2">No Workout Found</h2>
        <p className="text-xs text-zinc-500 mb-6">Could not find workout data for this session.</p>
        <Button onClick={handleDone}>Return to Profile</Button>
      </div>
    );
  }

  // Calculate most worked body part
  const counts: Record<string, number> = {};
  workout.exercises.forEach(ex => {
    const def = exerciseDefs.get(ex.exerciseId);
    const target = def?.target || def?.category;
    if (target) {
      counts[target] = (counts[target] || 0) + 1;
    }
  });
  const sortedTargets = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const mostWorkedMuscle = sortedTargets[0]?.[0] || 'Full Body';

  const totalSetsCount = workout.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  const totalExercisesCount = workout.exercises.length;

  const xpEarned = 100;
  const currentTotalXP = totalWorkoutsCount * 100;
  const progressInfo = getLevelProgress(currentTotalXP);

  const dateStr = new Date(workout.startTime).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-black pb-28 pt-6 px-4 animate-in fade-in duration-500 max-w-lg mx-auto">
      {/* Celebration Header */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="text-center space-y-2 mb-8"
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-brand-orange/20 border border-brand-orange/40 flex items-center justify-center text-brand-orange shadow-lg shadow-brand-orange/20">
          <CheckCircle2 size={36} />
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
          <Sparkles size={12} /> Workout Complete!
        </span>
        <h1 className="text-3xl font-black text-white italic tracking-tight">{workout.name}</h1>
        <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5 font-medium">
          <Calendar size={13} /> {dateStr}
        </p>
      </motion.div>

      {/* Hero Volume Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 p-6 text-center shadow-2xl mb-4"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-orange/15 blur-[80px] rounded-full pointer-events-none" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Total Volume Lifted</p>
        <div className="text-5xl font-black text-white tracking-tight tabular-nums font-mono py-1">
          {displayedVolume.toLocaleString()}
          <span className="text-xl text-brand-orange font-sans font-bold ml-1.5">lbs</span>
        </div>
      </motion.div>

      {/* Stats Breakdown Grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3 mb-4"
      >
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Flame size={14} className="text-brand-orange" /> Targeted Focus
          </div>
          <p className="text-lg font-black text-white truncate">{mostWorkedMuscle}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Layers size={14} className="text-brand-orange" /> Exercises / Sets
          </div>
          <p className="text-lg font-black text-white">
            {totalExercisesCount} <span className="text-xs text-zinc-500 font-normal">ex</span> • {totalSetsCount} <span className="text-xs text-zinc-500 font-normal">sets</span>
          </p>
        </div>
      </motion.div>

      {/* XP & Level Progress Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-3xl border border-white/10 bg-zinc-900/30 p-5 space-y-3 mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
              <Trophy size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">+{xpEarned} XP Earned</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Level {progressInfo.currentLevel} Athlete</p>
            </div>
          </div>
          <span className="text-xs font-bold font-mono text-brand-orange">
            {Math.round(progressInfo.xpIntoLevel)} / {progressInfo.xpForNextLevel} XP
          </span>
        </div>

        <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressInfo.progressPercent}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
            className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-brand-orange rounded-full"
          />
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <Button 
          size="lg" 
          onClick={handleDone}
          className="w-full py-6 text-base font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-2xl shadow-xl shadow-brand-orange/20 flex items-center justify-center gap-2"
        >
          Done <ArrowRight size={18} />
        </Button>

        <Button 
          size="lg" 
          variant="ghost" 
          onClick={handleShare}
          className="w-full py-5 text-sm font-bold text-zinc-400 hover:text-white border border-white/10 rounded-2xl flex items-center justify-center gap-2"
        >
          <Share2 size={16} /> Share Workout
        </Button>
      </motion.div>
    </div>
  );
};
