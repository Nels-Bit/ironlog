import { useState, useEffect, type ReactNode } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  User, Ruler, Weight, Activity, Edit2, Award, Trophy, Zap, Save, X, Loader2, Globe, Lock, Search, Users, UserPlus, Calendar, LogOut
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { authService } from '../services/authService';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { socialService } from '../services/socialService';
import type { UserProfile, WorkoutSession, Exercise, FriendRequest, FriendSummary, FriendWithStats } from '../types';
import { statsUtils, type PersonalRecord } from '../utils/statsUtils';
import { getLevelProgress, getLevelRequirementXP, isRestDaySession, formatStreakLabel } from '../utils/achievementUtils';
import { replayAllXP, type TotalXPResult } from '../utils/xpEngine';
import { parseUserWeight } from '../utils/workoutMath';
import { AchievementList, type AchievementItem } from '../components/ui/achievement-list';
import { FluidTabs } from '../components/ui/fluid-tabs';
import { ProfileSkeleton } from '../components/ProfileSkeleton';

export const Profile = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'friends'>('overview');
  const [stats, setStats] = useState({ totalWorkouts: 0, totalVolume: 0 });
  const [prCount, setPrCount] = useState(0);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [activeWorkouts, setActiveWorkouts] = useState<WorkoutSession[]>([]);
  const [prRecords, setPrRecords] = useState<PersonalRecord[]>([]);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSummary[]>([]);
  const [friends, setFriends] = useState<FriendWithStats[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [actingOnRequest, setActingOnRequest] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [xpResult, setXpResult] = useState<TotalXPResult | null>(null);

  const totalXP = xpResult?.totalXP ?? 0;
  const levelProgress = getLevelProgress(totalXP);
  const currentLevel = levelProgress.currentLevel;
  const xpInCurrentLevel = levelProgress.xpIntoLevel;
  const progressPercent = levelProgress.progressPercent;
  const currentStreak = xpResult?.currentStreak ?? 0;
  const goalOptions: NonNullable<UserProfile['goal']>[] = ['Strength', 'Hypertrophy', 'Endurance', 'Weight Loss'];
  const environmentOptions: NonNullable<UserProfile['environment']>[] = ['Gym', 'Home'];
  const levelOptions: NonNullable<UserProfile['level']>[] = ['Beginner', 'Intermediate', 'Pro'];
  const levelMilestones = [5, 10, 15, 20, 30, 40, 50];



  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'activity' || tab === 'friends' || tab === 'overview') {
      setActiveTab(tab);
      setIsEditing(false);
      return;
    }
    setActiveTab('overview');
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const query = searchTerm.trim();
    if (activeTab !== 'friends' || query.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const results = await socialService.searchPublicUsers(query);
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (error) {
        if (!cancelled) {
          setSocialError(error instanceof Error ? error.message : 'Unable to search users.');
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeTab, searchTerm]);

  const loadData = async () => {
    try {
      const user = await authService.getUser();
      if (user) {
        setProfile(user);
        setFormData({
          name: user.name,
          isPublic: user.isPublic,
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
      setWorkoutHistory(history);
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

      // XP replay: load exercise defs and compute total XP from history
      const allExercises = await exerciseService.getAllExercises();
      const defMap = new Map<string, Exercise>(allExercises.map(e => [e.id, e]));
      const userWeight = parseUserWeight(user?.weight);
      const xp = replayAllXP(history, defMap, userWeight);
      setXpResult(xp);

      try {
        const [friendsData, incoming, outgoing] = await Promise.all([
          socialService.getFriendsWithStats(),
          socialService.getIncomingFriendRequests(),
          socialService.getOutgoingFriendRequests()
        ]);
        setFriends(friendsData);
        setIncomingRequests(incoming);
        setOutgoingRequests(outgoing);
        setSocialError(null);
      } catch (error) {
        setSocialError(error instanceof Error ? error.message : 'Social features are unavailable.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const setTab = (tab: 'overview' | 'activity' | 'friends') => {
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  const handleSendFriendRequest = async (userId: string) => {
    setSendingRequest(userId);
    setSocialError(null);
    try {
      await socialService.sendFriendRequest(userId);
      setSearchTerm('');
      setSearchResults([]);
      const [friendsData, incoming, outgoing] = await Promise.all([
        socialService.getFriendsWithStats(),
        socialService.getIncomingFriendRequests(),
        socialService.getOutgoingFriendRequests()
      ]);
      setFriends(friendsData);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : 'Failed to send friend request.');
    } finally {
      setSendingRequest(null);
    }
  };

  const handleRespondToFriendRequest = async (requestId: string, accept: boolean) => {
    setActingOnRequest(requestId);
    setSocialError(null);
    try {
      await socialService.respondToFriendRequest(requestId, accept);
      const [friendsData, incoming, outgoing] = await Promise.all([
        socialService.getFriendsWithStats(),
        socialService.getIncomingFriendRequests(),
        socialService.getOutgoingFriendRequests()
      ]);
      setFriends(friendsData);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : 'Failed to respond to request.');
    } finally {
      setActingOnRequest(null);
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

  if (loading) return <ProfileSkeleton />;

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

  // Find the workout date when cumulative XP first crossed a level threshold
  const getLevelEarnedAt = (targetLevel: number): number | null => {
    if (!xpResult) return null;
    const requiredXP = getLevelRequirementXP(targetLevel);
    let cumulativeXP = 0;
    const sorted = [...activeWorkouts].sort((a, b) => a.startTime - b.startTime);
    for (const w of sorted) {
      const bd = xpResult.breakdowns.get(w.id);
      if (bd) cumulativeXP += bd.finalXP;
      if (cumulativeXP >= requiredXP) return w.startTime;
    }
    return null;
  };

  const levelMedals: MedalCard[] = levelMilestones.map((level, index) => {
    return {
      id: `level-${level}`,
      title: `Level ${level}`,
      description: `Reach level ${level}`,
      unlocked: currentLevel >= level,
      earnedAt: getLevelEarnedAt(level),
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



  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">

      <div className="p-4 space-y-4 max-w-lg mx-auto mt-2">
        <FluidTabs
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'activity', label: 'Activity' },
            { id: 'friends', label: 'Friends' },
          ]}
          activeTab={activeTab}
          onChange={(id) => setTab(id as 'overview' | 'activity' | 'friends')}
        />

        {activeTab === 'overview' && (
          <>
        
        {!isEditing ? (
          <div className="relative overflow-hidden bg-zinc-900/50 border border-white/10 rounded-3xl p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/20 blur-[100px] rounded-full pointer-events-none" />

            {/* Edit button — top-right of card */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="absolute top-4 right-4 z-20 rounded-full text-brand-orange bg-brand-orange/10 hover:bg-brand-orange/20"
            >
              <Edit2 size={16} />
            </Button>

            <div className="relative z-10 flex items-center gap-5 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-3xl font-black text-white">
                {profile?.name?.charAt(0) || 'U'}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-white">{profile?.name || 'Athlete'}</h2>
                  {currentLevel >= 5 && <Award className="text-yellow-500" size={20} fill="currentColor" />}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MiniStat label="Weight" value={profile?.weight ? `${profile.weight} lbs` : '-'} />
                  <MiniStat label="Height" value={formatHeight(profile?.height)} />
                  <MiniStat label="Age" value={profile?.age ? `${profile.age}` : '-'} />
                  <MiniStat label="Goal" value={profile?.goal || '-'} />
                  {currentStreak > 0 && (
                    <MiniStat label="Streak" value={`🔥 ${formatStreakLabel(currentStreak)}`} />
                  )}
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
                Current Level: {currentLevel}
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
            {/* Edit form header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Profile</h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                className="rounded-full text-zinc-500 hover:text-white"
              >
                <X size={20} />
              </Button>
            </div>
            <InputGroup label="Full Name" icon={<User size={16} />}>
              <input 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                placeholder="John Doe"
              />
            </InputGroup>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Profile Privacy</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: true })}
                  className={cn(
                    "p-3 rounded-xl border font-bold text-sm transition-all inline-flex items-center justify-center gap-2",
                    formData.isPublic
                      ? "bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  <Globe size={14} /> Public
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: false })}
                  className={cn(
                    "p-3 rounded-xl border font-bold text-sm transition-all inline-flex items-center justify-center gap-2",
                    formData.isPublic === false
                      ? "bg-white text-black border-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  <Lock size={14} /> Private
                </button>
              </div>
              <p className="text-xs text-zinc-500 px-1">
                Public profiles can send and receive friend requests. Private profiles keep your user-id but disable friend requests.
              </p>
            </div>

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
                 {goalOptions.map(goal => (
                   <button
                     key={goal}
                     onClick={() => setFormData({...formData, goal})}
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
                 {environmentOptions.map(env => (
                   <button
                     key={env}
                     onClick={() => setFormData({...formData, environment: env})}
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
                 {levelOptions.map(lvl => (
                   <button
                     key={lvl}
                     onClick={() => setFormData({...formData, level: lvl})}
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
          <AchievementList
            items={mergedMedals.map((medal): AchievementItem => ({
              id: medal.id,
              title: medal.title,
              description: medal.description,
              sublabel: medal.unlocked
                ? medal.earnedAt
                  ? `${medal.title} earned (${new Date(medal.earnedAt).toLocaleDateString()})`
                  : `${medal.title} earned`
                : `Unlocks when ${medal.description.toLowerCase()}`,
              unlocked: medal.unlocked,
              category: medal.category,
              icon: medal.icon,
              accentColor: medal.category === 'level' ? 'blue' : 'orange',
            }))}
            initialVisible={2}
          />
        )}

        {!isEditing && (
          <div className="mt-6">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </Button>
          </div>
        )}
          </>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Activity</p>
              <p className="text-sm text-zinc-400">Your logged workout sessions and history.</p>
            </div>

            {workoutHistory.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-md p-6 text-center text-sm text-zinc-500">
                No workouts logged yet.
              </div>
            ) : (
              workoutHistory.map((workout) => {
                const isRest = isRestDaySession(workout);
                return (
                  <div key={workout.id} className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-md p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate">{isRest ? 'Rest Day 🌙' : workout.name}</h3>
                        <p className="mt-1 text-xs text-zinc-500 inline-flex items-center gap-1">
                          <Calendar size={12} /> {new Date(workout.startTime).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link to={`/summary/${workout.id}`}>
                          <Button size="sm" variant="ghost" className="border border-white/10 hover:bg-white/5 text-zinc-300">
                            Summary
                          </Button>
                        </Link>
                        <Link to={`/history/${workout.id}`}>
                          <Button size="sm">
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}


        {activeTab === 'friends' && (
          <div className="space-y-3">
            {socialError && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                {socialError}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your User ID</p>
                  <p className="text-lg font-black text-white">@{profile?.userId}</p>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest border",
                  profile?.isPublic ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-black/30 text-zinc-400"
                )}>
                  {profile?.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                  {profile?.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search size={14} className="text-zinc-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Find Friends</p>
              </div>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by user-id or name"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none"
              />
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.map((result) => (
                    <div key={result.authUserId} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{result.name}</p>
                        <p className="text-xs text-zinc-500">@{result.userId}</p>
                      </div>
                      <Button
                        size="sm"
                        disabled={sendingRequest === result.userId || !profile?.isPublic}
                        onClick={() => handleSendFriendRequest(result.userId)}
                      >
                        {sendingRequest === result.userId ? <Loader2 size={14} className="animate-spin" /> : <><UserPlus size={14} className="mr-1" />Add</>}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-zinc-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Incoming Requests</p>
              </div>
              {incomingRequests.length === 0 ? (
                <p className="text-sm text-zinc-500">No incoming requests.</p>
              ) : (
                <div className="space-y-2">
                  {incomingRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="font-bold text-white">{request.requester.name}</p>
                      <p className="text-xs text-zinc-500 mb-2">@{request.requester.userId}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRespondToFriendRequest(request.id, true)} disabled={actingOnRequest === request.id}>Accept</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRespondToFriendRequest(request.id, false)} disabled={actingOnRequest === request.id}>Decline</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-md p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Outgoing Requests</p>
              {outgoingRequests.length === 0 ? (
                <p className="text-sm text-zinc-500">No pending outgoing requests.</p>
              ) : (
                <div className="space-y-2">
                  {outgoingRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="font-bold text-white">{request.addressee.name}</p>
                      <p className="text-xs text-zinc-500">@{request.addressee.userId}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-md p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Friends</p>
              {friends.length === 0 ? (
                <p className="text-sm text-zinc-500">No friends yet.</p>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div key={friend.authUserId} className="rounded-xl border border-white/5 bg-zinc-900/40 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-brand-orange/20 text-brand-orange flex items-center justify-center font-bold">
                          {friend.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{friend.name}</p>
                          <p className="text-xs text-zinc-500 truncate">@{friend.userId}</p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => navigate(`/friends/${friend.authUserId}`)}
                        className="w-[130px] h-[48px] min-w-[130px] shrink-0 flex items-center justify-center text-sm tracking-normal font-bold"
                      >
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

interface InputGroupProps {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}

const InputGroup = ({ label, icon, children }: InputGroupProps) => (
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
