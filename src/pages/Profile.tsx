import { useState, useEffect, type ReactNode } from 'react';
import { 
  User, Ruler, Weight, Activity, Edit2, Award, Trophy, Zap, Save, X, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { authService } from '../services/authService';
import { exerciseService } from '../services/exerciseService';
import { workoutService } from '../services/workoutService';
import type { UserProfile, WorkoutSession } from '../types';
import { statsUtils, type PersonalRecord } from '../utils/statsUtils';
import { calculateStrengthAchievements, calculateWorkoutStreak, getLevelProgress, getLevelRequirementXP, isRestDaySession, type StrengthAchievement } from '../utils/achievementUtils';

export const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ totalWorkouts: 0, totalVolume: 0 });
  const [prCount, setPrCount] = useState(0);
  const [streakSummary, setStreakSummary] = useState({ currentStreak: 0, longestStreak: 0 });
  const [activeWorkouts, setActiveWorkouts] = useState<WorkoutSession[]>([]);
  const [prRecords, setPrRecords] = useState<PersonalRecord[]>([]);
  const [strengthAchievements, setStrengthAchievements] = useState<StrengthAchievement[]>([]);
  const [showAllMedals, setShowAllMedals] = useState(false);
  const [restDayToday, setRestDayToday] = useState(false);

  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');

  const XP_PER_WORKOUT = 100;
  const totalXP = stats.totalWorkouts * XP_PER_WORKOUT;
  const levelProgress = getLevelProgress(totalXP);
  const currentLevel = levelProgress.currentLevel;
  const xpInCurrentLevel = levelProgress.xpIntoLevel;
  const progressPercent = levelProgress.progressPercent;
  const xpToNext = levelProgress.xpToNext;
  const levelMilestones = [5, 10, 15, 20, 30, 40, 50];
  const streakMilestones = [3, 7, 14, 30];
  const nextStreakGoal = streakMilestones.find(goal => goal > streakSummary.currentStreak) ?? null;
  const streakProgressPercent = nextStreakGoal ? (streakSummary.currentStreak / nextStreakGoal) * 100 : 100;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const exercises = await exerciseService.getAllExercises();
      const exerciseDefs = new Map(exercises.map(exercise => [exercise.id, exercise]));

      const user = await authService.getUser();
      if (user) {
        setProfile(user);
        setFormData({
          name: user.name,
          weight: user.weight,
          age: user.age,
          goal: user.goal,
          level: user.level,
          environment: user.environment
        });
        const { feet, inches } = splitHeight(user.height);
        setHeightFeet(feet ? String(feet) : '');
        setHeightInches(inches ? String(inches) : '');
      }

      const history = await workoutService.getHistory();
      const activeWorkouts = history.filter(session => !isRestDaySession(session));
      const todayKey = new Date().toISOString().slice(0,10);
      const hasRestToday = history.some(s => isRestDaySession(s) && new Date(s.startTime).toISOString().slice(0,10) === todayKey);
      setRestDayToday(hasRestToday);
      const activeWorkoutsAscending = [...activeWorkouts].sort((a, b) => a.startTime - b.startTime);
      const volume = activeWorkouts.reduce((acc, curr) => acc + (curr.volumeLoad || 0), 0);
      const prs = await statsUtils.calculatePRs(activeWorkouts);
      setStats({
        totalWorkouts: activeWorkouts.length,
        totalVolume: volume
      });
      setPrCount(prs.length);
      setActiveWorkouts(activeWorkoutsAscending);
      setPrRecords(prs);
      setStreakSummary(calculateWorkoutStreak(history));
      setStrengthAchievements(calculateStrengthAchievements(activeWorkouts, exerciseDefs));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const nextHeight = buildHeightInInches(heightFeet, heightInches);
      const updated = {
        ...profile,
        ...formData,
        height: nextHeight
      } as UserProfile;

      await authService.updateProfile(updated);
      setProfile(updated);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-brand-orange" /></div>;

  const workoutsAscending = activeWorkouts;

  const getWorkoutDate = (index: number) => workoutsAscending[index]?.startTime ?? null;

  const getVolumeMilestoneDate = (targetVolume: number) => {
    let runningVolume = 0;
    for (const workout of workoutsAscending) {
      runningVolume += workout.volumeLoad || 0;
      if (runningVolume >= targetVolume) {
        return workout.startTime;
      }
    }
    return null;
  };

  type MedalCard = {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
    earnedAt: number | null;
    icon: ReactNode;
    category: 'achievement' | 'level';
    sortOrder: number;
  };

  const baseMedals: MedalCard[] = [
    { id: 'first-rep', title: 'First Rep', description: 'Complete 1 workout', unlocked: stats.totalWorkouts >= 1, earnedAt: getWorkoutDate(0), icon: <Trophy size={18} />, category: 'achievement', sortOrder: 1 },
    { id: 'consistent', title: 'Consistent', description: 'Complete 10 workouts', unlocked: stats.totalWorkouts >= 10, earnedAt: getWorkoutDate(9), icon: <Activity size={18} />, category: 'achievement', sortOrder: 2 },
    { id: 'volume-builder', title: 'Volume Builder', description: 'Move 50,000 lbs', unlocked: stats.totalVolume >= 50000, earnedAt: getVolumeMilestoneDate(50000), icon: <Weight size={18} />, category: 'achievement', sortOrder: 3 },
    { id: 'iron-titan', title: 'Iron Titan', description: 'Move 100,000 lbs', unlocked: stats.totalVolume >= 100000, earnedAt: getVolumeMilestoneDate(100000), icon: <Zap size={18} />, category: 'achievement', sortOrder: 4 },
    { id: 'pr-hunter', title: 'PR Hunter', description: 'Set 5 personal records', unlocked: prCount >= 5, earnedAt: prRecords[4]?.date ?? null, icon: <Award size={18} />, category: 'achievement', sortOrder: 5 }
  ];

  const levelMedals: MedalCard[] = levelMilestones.map((level, index) => {
    const requiredXP = getLevelRequirementXP(level);
    const requiredWorkouts = Math.max(1, Math.ceil(requiredXP / XP_PER_WORKOUT));
    return {
      id: `level-${level}`,
      title: `Level ${level}`,
      description: `Reach level ${level}`,
      unlocked: currentLevel >= level,
      earnedAt: getWorkoutDate(requiredWorkouts - 1),
      icon: <Award size={18} />,
      category: 'level',
      sortOrder: 100 + index
    };
  });

  const mergedMedals = [...baseMedals, ...levelMedals].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    const aTime = a.earnedAt ?? 0;
    const bTime = b.earnedAt ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.sortOrder - b.sortOrder;
  });

  const visibleMedals = showAllMedals ? mergedMedals : mergedMedals.slice(0, 4);

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 h-14 flex justify-between items-center">
        <h1 className="text-xl font-black italic text-white tracking-tighter">ATHLETE PROFILE</h1>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => isEditing ? setIsEditing(false) : setIsEditing(true)}
          className={cn("rounded-full", isEditing ? "text-zinc-500" : "text-brand-orange bg-brand-orange/10")}
        >
          {isEditing ? <X size={20} /> : <Edit2 size={18} />}
        </Button>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto mt-2">
        
        {!isEditing ? (
          <div className="relative overflow-hidden bg-zinc-900/50 border border-white/10 rounded-3xl p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/20 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex items-center gap-5 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-3xl font-black text-white">
                {profile?.name?.charAt(0) || 'U'}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-white">{profile?.name || 'Athlete'}</h2>
                  {currentLevel >= 5 && <Award className="text-yellow-500" size={20} fill="currentColor" />}
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                  <Trophy size={12} className="text-brand-orange" />
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">Level {currentLevel} Athlete</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MiniStat label="Weight" value={profile?.weight ? `${profile.weight} lbs` : '-'} />
                  <MiniStat label="Height" value={formatHeight(profile?.height)} />
                  <MiniStat label="Age" value={profile?.age ? `${profile.age}` : '-'} />
                  <MiniStat label="Goal" value={profile?.goal || '-'} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>XP Progress</span>
                <span>{Math.round(xpInCurrentLevel)} / {levelProgress.xpForNextLevel} XP</span>
              </div>
              <div className="h-4 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.6)] transition-all duration-1000 ease-out relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                </div>
              </div>
              <p className="text-right text-[10px] font-bold text-brand-orange mt-1">
                {xpToNext} XP to Level {currentLevel + 1}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 mx-auto rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-500">
               <User size={32} />
            </div>
            <p className="text-zinc-500 text-sm">Tap to change photo</p>
          </div>
        )}

        {isEditing && (
          <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-500">
            <InputGroup label="Full Name" icon={<User size={16} />}>
              <input 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                placeholder="John Doe"
              />
            </InputGroup>

              <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Weight (lbs)" icon={<Weight size={16} />}>
                <input 
                  type="number"
                  min={0}
                  value={formData.weight ?? ''} 
                  onChange={e => setFormData({...formData, weight: e.target.value === '' ? undefined : parseFloat(e.target.value)})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                />
              </InputGroup>
              <InputGroup label="Age" icon={<User size={16} />}>
                <input 
                  type="number"
                  min={0}
                  value={formData.age ?? ''} 
                  onChange={e => setFormData({...formData, age: e.target.value === '' ? undefined : parseInt(e.target.value, 10)})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                />
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Height (ft)" icon={<Ruler size={16} />}>
                <input 
                  type="number"
                  min={0}
                  value={heightFeet}
                  onChange={e => setHeightFeet(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                  placeholder="5"
                />
              </InputGroup>
              <InputGroup label="Height (in)" icon={<Ruler size={16} />}>
                <input 
                  type="number"
                  min={0}
                  max={11}
                  value={heightInches}
                  onChange={e => setHeightInches(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                  placeholder="10"
                />
              </InputGroup>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Goal</label>
              <div className="grid grid-cols-2 gap-2">
                 {['Strength', 'Hypertrophy', 'Endurance', 'Weight Loss'].map(goal => (
                   <button
                     key={goal}
                     onClick={() => setFormData({...formData, goal: goal as any})}
                     className={cn(
                       "p-3 rounded-xl border font-bold text-xs transition-all",
                       formData.goal === goal 
                         ? "bg-white text-black border-white" 
                         : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                     )}
                   >
                     {goal}
                   </button>
                 ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Environment</label>
              <div className="grid grid-cols-2 gap-3">
                 {['Gym', 'Home'].map(env => (
                   <button
                     key={env}
                     onClick={() => setFormData({...formData, environment: env as any})}
                     className={cn(
                       "p-3 rounded-xl border font-bold text-sm transition-all",
                       formData.environment === env 
                         ? "bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20" 
                         : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                     )}
                   >
                     {env}
                   </button>
                 ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Experience Level</label>
              <div className="grid grid-cols-3 gap-2">
                 {['Beginner', 'Intermediate', 'Pro'].map(lvl => (
                   <button
                     key={lvl}
                     onClick={() => setFormData({...formData, level: lvl as any})}
                     className={cn(
                       "p-3 rounded-xl border font-bold text-xs transition-all",
                       formData.level === lvl 
                         ? "bg-white text-black border-white" 
                         : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                     )}
                   >
                     {lvl}
                   </button>
                 ))}
              </div>
            </div>

            <Button className="w-full py-6 mt-4 text-lg" onClick={handleSave}>
              <Save size={20} className="mr-2" /> Save Profile
            </Button>
          </div>
        )}

        {!isEditing && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Workouts</p>
              <p className="text-3xl font-black text-white">{stats.totalWorkouts}</p>
            </div>
            <div className="bg-blue-950/10 border border-blue-400/10 rounded-2xl p-5">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Best Streak</p>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-black text-white">🔥</div>
                <div>
                  <p className="text-2xl font-black text-white">{streakSummary.longestStreak}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="space-y-3 mt-6">
            <div className="flex items-center justify-between px-1 gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">Medals & Achievements</h3>
                <p className="text-xs text-zinc-500 font-medium">Unlocked first, locked last</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllMedals(prev => !prev)}
                className="shrink-0 text-brand-orange hover:text-white"
              >
                {showAllMedals ? 'Collapse' : 'See all'}
              </Button>
            </div>

            <div className={cn(
              "grid gap-3",
              showAllMedals ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
            )}>
              {visibleMedals.map(medal => (
                <div
                  key={medal.id}
                  className={cn(
                    "rounded-2xl border p-4 flex items-start gap-3 transition-all",
                    medal.unlocked
                      ? medal.category === 'level'
                        ? "bg-blue-950/25 border-blue-400/20"
                        : "bg-brand-orange/10 border-brand-orange/20"
                      : "bg-zinc-900/30 border-white/5 opacity-70"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    medal.unlocked
                      ? medal.category === 'level'
                        ? "bg-blue-500 text-white"
                        : "bg-brand-orange text-white"
                      : "bg-white/5 text-zinc-500"
                  )}>
                    {medal.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-white">{medal.title}</h4>
                      {medal.unlocked && <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Unlocked</span>}
                      {!medal.unlocked && <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Locked</span>}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{medal.description}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-2">
                      {medal.unlocked
                        ? medal.earnedAt
                          ? `${medal.title} earned (${new Date(medal.earnedAt).toLocaleDateString()})`
                          : `${medal.title} earned`
                        : `Unlocks when ${medal.description.toLowerCase()}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="space-y-3 mt-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-white">Streak Medal</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Moon lit</span>
            </div>
            <div className="rounded-2xl border border-blue-400/15 bg-blue-950/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-200/70 mb-1">Current Streak</p>
                  <p className="text-3xl font-black text-white flex items-center gap-2"><span>{restDayToday && streakSummary.currentStreak > 0 ? '🌙' : '🔥'}</span>{streakSummary.currentStreak}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-200/70 mb-1">Goal</p>
                  <p className="text-2xl font-black text-blue-100">{nextStreakGoal ?? 'Max'}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="relative pt-4">
                  <div className="absolute -top-2 z-20 flex flex-col items-center" style={{ left: `${Math.max(6, Math.min(100, streakProgressPercent))}%`, transform: 'translateX(-50%)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                      {streakSummary.currentStreak} / {nextStreakGoal ?? '—'} Day(s)
                    </div>
                    <div className="h-3 w-px bg-zinc-300/80" />
                  </div>
                  <div className="h-3 rounded-full bg-black/40 overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, streakProgressPercent)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs text-zinc-500 px-1">🌙 marks a logged rest day. Rest days protect your current streak but do not increase it.</div>
          </div>
        )}

        {!isEditing && (
          <div className="space-y-3 mt-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-white">Strength Medals</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">The 3 Major Lifts</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {strengthAchievements.map(achievement => (
                <div key={achievement.lift} className={cn(
                  "relative rounded-2xl border p-4 flex items-start justify-between gap-4 overflow-hidden",
                  achievement.unlocked ? "bg-brand-orange/10 border-brand-orange/20" : "bg-zinc-900/30 border-white/5 opacity-70"
                )}>
                  <div className="absolute top-4 right-4 text-right">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Next Achievement</div>
                    <div className="text-sm font-black text-white">
                      {achievement.nextThreshold ?? achievement.threshold} lbs
                    </div>
                  </div>
                  <div className="min-w-0 flex items-start gap-3 flex-1">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      achievement.unlocked ? "bg-brand-orange text-white" : "bg-white/5 text-zinc-500"
                    )}>
                      <Trophy size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white">{achievement.label}</h4>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {achievement.unlocked
                          ? `${achievement.threshold} Medal earned (${achievement.achievedDateLabel || 'recently'})`
                          : `Keep pushing to unlock the ${achievement.nextThreshold ?? achievement.threshold} Medal.`}
                      </p>
                      <div className="mt-3 space-y-2">
                        <div className="relative pt-4">
                          <div className="absolute -top-1 z-20 flex flex-col items-center" style={{ left: `${Math.max(18, Math.min(100, achievement.progressPercent))}%`, transform: 'translateX(-50%)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                              PR: {achievement.currentWeight} / {achievement.nextThreshold ?? achievement.threshold}
                            </div>
                            <div className="h-3 w-px bg-zinc-300/80" />
                          </div>
                          <div className="h-3 rounded-full bg-black/50 overflow-hidden border border-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-brand-orange transition-all duration-700 shadow-[0_0_12px_rgba(56,189,248,0.45)]"
                            style={{ width: `${Math.max(18, Math.min(100, achievement.progressPercent))}%` }}
                          />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const InputGroup = ({ label, icon, children }: any) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">{label}</label>
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
        {icon}
      </div>
      {children}
    </div>
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
    <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">{label}</div>
    <div className="text-sm font-bold text-white truncate">{value}</div>
  </div>
);

const formatHeight = (cm?: number) => {
  if (!cm) return '-';
  const totalInches = Math.max(0, Math.round(cm));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}' ${inches}"`;
};

const splitHeight = (height?: number) => {
  if (!height) return { feet: 0, inches: 0 };
  const totalInches = Math.max(0, Math.round(height));
  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12
  };
};

const buildHeightInInches = (feet: string, inches: string) => {
  const parsedFeet = parseInt(feet, 10);
  const parsedInches = parseInt(inches, 10);
  const safeFeet = Number.isFinite(parsedFeet) ? parsedFeet : 0;
  const safeInches = Number.isFinite(parsedInches) ? parsedInches : 0;
  return safeFeet * 12 + safeInches;
};