import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Zap, Dumbbell, Clock, BarChart2, Share2, ChevronRight, Trophy, Sparkles, Flame } from 'lucide-react';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { authService } from '../services/authService';
import { getLevelProgress } from '../utils/achievementUtils';
import { getXPForWorkout, PR_BONUS, NEW_EXERCISE_BONUS, type WorkoutXPResult } from '../utils/xpEngine';
import { parseUserWeight } from '../utils/workoutMath';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import type { WorkoutSession, Exercise } from '../types';

// ─── Animated count-up hook ────────────────────────────────────────────────
function useCountUp(target: number, durationMs = 1200, startDelay = 300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start: number | null = null;
    let raf: number;
    const delayId = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / durationMs, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, startDelay);
    return () => {
      clearTimeout(delayId);
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, startDelay]);
  return value;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  delay?: number;
}

const StatCard = ({ label, value, icon, accent = false, delay = 0 }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    className={cn(
      'flex flex-col gap-2 rounded-2xl border p-4',
      accent
        ? 'bg-brand-orange/10 border-brand-orange/30'
        : 'bg-zinc-900/60 border-white/8'
    )}
  >
    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', accent ? 'bg-brand-orange/20 text-brand-orange' : 'bg-white/5 text-zinc-400')}>
      {icon}
    </div>
    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
    <p className={cn('text-2xl font-black tabular-nums leading-none', accent ? 'text-brand-orange' : 'text-white')}>
      {value}
    </p>
  </motion.div>
);

// ─── XP Line Item ──────────────────────────────────────────────────────────
interface XPLineProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  detail?: string;
  accent?: boolean;
  delay?: number;
}

const XPLine = ({ label, value, icon, detail, accent, delay = 0 }: XPLineProps) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3, delay }}
    className="flex items-center justify-between py-1.5"
  >
    <div className="flex items-center gap-2 min-w-0">
      {icon && <span className="shrink-0">{icon}</span>}
      <span className={cn('text-sm font-medium', accent ? 'text-brand-orange' : 'text-zinc-300')}>{label}</span>
      {detail && <span className="text-xs text-zinc-500 truncate">{detail}</span>}
    </div>
    <span className={cn('text-sm font-bold tabular-nums shrink-0 ml-2', accent ? 'text-brand-orange' : 'text-white')}>
      {value}
    </span>
  </motion.div>
);

// ─── Level Up Overlay ──────────────────────────────────────────────────────
const LevelUpOverlay = ({ level, onDismiss }: { level: number; onDismiss: () => void }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: 15 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="relative flex flex-col items-center gap-4 p-10 rounded-3xl bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-red-500/20 border border-yellow-400/30 shadow-2xl shadow-yellow-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-yellow-400/10 to-orange-500/10 blur-xl pointer-events-none" />

        <motion.div
          animate={{ rotate: [0, -5, 5, -5, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeInOut' }}
          className="relative z-10"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
            <Trophy size={40} className="text-white" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative z-10 text-center"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400 mb-1">Level Up!</p>
          <p className="text-5xl font-black text-white">{level}</p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="relative z-10 text-xs text-zinc-400 font-medium"
        >
          Tap anywhere to continue
        </motion.p>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

// ─── Format helpers ─────────────────────────────────────────────────────────
const formatDuration = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatVolume = (lbs: number) =>
  lbs >= 1000 ? `${(lbs / 1000).toFixed(1)}k` : lbs.toLocaleString();

// ─── Main page ──────────────────────────────────────────────────────────────
export const WorkoutSummary = () => {
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const id = params.id || searchParams.get('id');
  const returnTo = searchParams.get('returnTo') || '/profile';
  const navigate = useNavigate();

  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [exerciseDefs, setExerciseDefs] = useState<Map<string, Exercise>>(new Map());
  const [loading, setLoading] = useState(true);
  const [xpBarFilled, setXpBarFilled] = useState(false);
  const [xpData, setXpData] = useState<WorkoutXPResult | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // Load data
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [session, defs, history, user] = await Promise.all([
        workoutService.getWorkoutById(id),
        exerciseService.getAllExercises(),
        workoutService.getHistory(),
        authService.getUser(),
      ]);
      if (session) setWorkout(session);
      const map = new Map(defs.map(d => [d.id, d]));
      setExerciseDefs(map);

      // Compute XP breakdown via replay engine
      const userWeight = parseUserWeight(user?.weight);
      const xpResult = getXPForWorkout(id, history, map, userWeight);
      setXpData(xpResult);

      setLoading(false);

      // Trigger XP bar animation shortly after content appears
      setTimeout(() => setXpBarFilled(true), 600);

      // Show level up overlay if applicable
      if (xpResult) {
        const prev = getLevelProgress(xpResult.totalXPBefore);
        const next = getLevelProgress(xpResult.totalXPAfter);
        if (next.currentLevel > prev.currentLevel) {
          setTimeout(() => setShowLevelUp(true), 1400);
        }
      }
    };
    load();
  }, [id]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalVolume = workout?.volumeLoad ?? 0;
  const duration = workout && workout.endTime ? workout.endTime - workout.startTime : 0;

  const completedSets = workout?.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => s.isCompleted && s.type !== 'warmup').length,
    0
  ) ?? 0;

  // Most worked muscle
  const topMuscle = (() => {
    if (!workout) return '—';
    const counts = new Map<string, number>();
    workout.exercises.forEach(ex => {
      const def = exerciseDefs.get(ex.exerciseId);
      const muscle = def?.target || def?.category || 'Unknown';
      const done = ex.sets.filter(s => s.isCompleted).length;
      counts.set(muscle, (counts.get(muscle) ?? 0) + done);
    });
    if (counts.size === 0) return '—';
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  })();

  // XP derived values
  const breakdown = xpData?.breakdown ?? null;
  const totalXPBefore = xpData?.totalXPBefore ?? 0;
  const totalXPAfter = xpData?.totalXPAfter ?? 0;
  const prevProgress = getLevelProgress(totalXPBefore);
  const newProgress = getLevelProgress(totalXPAfter);
  const leveledUp = newProgress.currentLevel > prevProgress.currentLevel;
  const targetPct = xpBarFilled ? newProgress.progressPercent : prevProgress.progressPercent;

  // Animated volume count-up
  const animatedVolume = useCountUp(totalVolume, 1200, 400);

  const handleShare = async () => {
    if (!workout) return;
    const xpText = breakdown ? `⚡ +${breakdown.finalXP} XP earned\n` : '';
    const text = `💪 Just crushed "${workout.name}"!\n📦 ${formatVolume(totalVolume)} lbs total volume\n⏱ ${formatDuration(duration)}\n🏅 Top muscle: ${topMuscle}\n${xpText}\nLogged on IronLog`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Workout', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Workout stats copied to clipboard!');
      }
    } catch { /* user cancelled */ }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-brand-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-zinc-400">
        <p className="text-lg font-bold">Workout not found.</p>
        <Button onClick={() => navigate('/profile')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-32 overflow-x-hidden">
      <div className="max-w-lg mx-auto p-5 space-y-6">

        {/* ── Hero header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pt-4 text-center space-y-2"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="w-16 h-16 mx-auto rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center"
          >
            <CheckCircle size={32} className="text-green-400" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-2xl font-black text-white"
          >
            Workout Complete!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-zinc-400 text-sm"
          >
            {workout.name}
            {duration > 0 && (
              <span className="text-zinc-600 ml-2">· {formatDuration(duration)}</span>
            )}
          </motion.p>
        </motion.div>

        {/* ── Stat cards (2×2 grid) ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Total Volume"
            value={`${formatVolume(animatedVolume)} lbs`}
            icon={<BarChart2 size={18} />}
            accent
            delay={0.15}
          />
          <StatCard
            label="Sets Completed"
            value={String(completedSets)}
            icon={<Dumbbell size={18} />}
            delay={0.22}
          />
          <StatCard
            label="Duration"
            value={duration > 0 ? formatDuration(duration) : '—'}
            icon={<Clock size={18} />}
            delay={0.29}
          />
          <StatCard
            label="Top Muscle"
            value={topMuscle}
            icon={<Zap size={18} />}
            delay={0.36}
          />
        </div>

        {/* ── XP Breakdown Section ── */}
        {breakdown && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5 space-y-4"
          >
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">XP Earned</span>
                {leveledUp && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.9 }}
                    className="text-[10px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-400/15 border border-yellow-400/25 px-2 py-0.5 rounded-full"
                  >
                    ✨ Level Up!
                  </motion.span>
                )}
              </div>

              {/* Total XP badge */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.55 }}
                className="flex items-center gap-1 bg-brand-orange/15 border border-brand-orange/30 rounded-full px-3 py-1"
              >
                <Zap size={12} className="text-brand-orange" fill="currentColor" />
                <span className="text-sm font-black text-brand-orange">+{breakdown.finalXP} XP</span>
              </motion.div>
            </div>

            {/* ── Itemized Breakdown ── */}
            <div className="border-t border-white/5 pt-3 space-y-0.5">
              <XPLine
                label="Base Workout"
                value={`+${breakdown.base}`}
                icon={<Dumbbell size={13} className="text-zinc-500" />}
                delay={0.55}
              />

              {breakdown.volume > 0 && (
                <XPLine
                  label="Volume"
                  value={`+${breakdown.volume}`}
                  icon={<BarChart2 size={13} className="text-zinc-500" />}
                  detail={`(${formatVolume(totalVolume)} lbs)`}
                  delay={0.62}
                />
              )}

              {breakdown.prExerciseNames.map((name, i) => (
                <XPLine
                  key={`pr-${name}`}
                  label={`PR: ${name}`}
                  value={`+${PR_BONUS}`}
                  icon={<Trophy size={13} className="text-yellow-500" />}
                  delay={0.69 + i * 0.06}
                  accent
                />
              ))}

              {breakdown.newExerciseNames.map((name, i) => (
                <XPLine
                  key={`new-${name}`}
                  label={`New: ${name}`}
                  value={`+${NEW_EXERCISE_BONUS}`}
                  icon={<Sparkles size={13} className="text-blue-400" />}
                  delay={0.69 + (breakdown.prCount + i) * 0.06}
                />
              ))}
            </div>

            {/* ── Subtotal & Streak ── */}
            {breakdown.streakDays > 0 && breakdown.streakBonus !== 0 && (
              <div className="border-t border-white/5 pt-2 space-y-0.5">
                <XPLine
                  label="Subtotal"
                  value={`${breakdown.rawXP}`}
                  delay={0.85}
                />
                <XPLine
                  label={`Streak ×${breakdown.multiplier.toFixed(2)}`}
                  value={`+${breakdown.streakBonus}`}
                  icon={<Flame size={13} className="text-orange-400" />}
                  detail={`(${breakdown.streakDays}d)`}
                  delay={0.92}
                  accent
                />
              </div>
            )}

            {/* ── Level progress bar ── */}
            <div className="border-t border-white/5 pt-3 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-zinc-400">Level {newProgress.currentLevel}</span>
                <span className="text-zinc-500">
                  {Math.round(newProgress.xpIntoLevel)} / {newProgress.xpForNextLevel} XP
                </span>
              </div>

              {/* Animated progress bar */}
              <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_0_12px_rgba(234,88,12,0.5)] relative overflow-hidden"
                  initial={{ width: `${prevProgress.progressPercent}%` }}
                  animate={{ width: `${targetPct}%` }}
                  transition={{ duration: 1.1, delay: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                </motion.div>
              </div>

              <p className="text-right text-[11px] font-bold text-brand-orange">
                {newProgress.xpToNext} XP to Level {newProgress.currentLevel + 1}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Exercise list summary ── */}
        {workout.exercises.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55 }}
            className="rounded-2xl border border-white/8 bg-zinc-900/60 overflow-hidden"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-4 pt-4 pb-2">
              Exercises
            </p>
            <div className="divide-y divide-white/5">
              {workout.exercises.map((ex, i) => {
                const def = exerciseDefs.get(ex.exerciseId);
                const doneSets = ex.sets.filter(s => s.isCompleted && s.type !== 'warmup').length;
                return (
                  <motion.div
                    key={ex.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.06 }}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{def?.name || 'Exercise'}</p>
                      <p className="text-xs text-zinc-500">{def?.target || def?.category || ''}</p>
                    </div>
                    <span className="text-xs font-bold text-zinc-400 tabular-nums">
                      {doneSets} set{doneSets !== 1 ? 's' : ''}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Action buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.65 }}
          className="flex flex-col gap-3 pt-2"
        >
          <Button
            className="w-full py-5 text-base font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-2xl flex items-center justify-center gap-2"
            onClick={() => navigate(returnTo)}
          >
            Done
            <ChevronRight size={18} />
          </Button>

          <Button
            variant="ghost"
            className="w-full py-4 text-zinc-400 hover:text-white border border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-center gap-2"
            onClick={handleShare}
          >
            <Share2 size={16} />
            Share Workout
          </Button>
        </motion.div>

      </div>

      {/* ── Level Up Overlay ── */}
      {showLevelUp && (
        <LevelUpOverlay
          level={newProgress.currentLevel}
          onDismiss={() => setShowLevelUp(false)}
        />
      )}
    </div>
  );
};
