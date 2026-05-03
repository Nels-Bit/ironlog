import { useState, useEffect } from 'react';
import { 
  User, Ruler, Weight, Activity, Edit2, Award, Trophy, Zap, Save, X, Loader2 
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { authService } from '../services/authService';
import { workoutService } from '../services/workoutService';
import type { UserProfile } from '../types';

export const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ totalWorkouts: 0, totalVolume: 0 });

  const [formData, setFormData] = useState<Partial<UserProfile>>({});

  const XP_PER_WORKOUT = 100;
  const XP_PER_LEVEL = 1000;
  
  const totalXP = stats.totalWorkouts * XP_PER_WORKOUT;
  const currentLevel = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = totalXP % XP_PER_LEVEL;
  const progressPercent = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  const xpToNext = XP_PER_LEVEL - xpInCurrentLevel;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await authService.getUser();
      if (user) {
        setProfile(user);
        setFormData({
          name: user.name,
          weight: user.weight,
          height: user.height,
          age: user.age,
          goal: user.goal,
          level: user.level,
          environment: user.environment
        });
      }

      const history = await workoutService.getHistory();
      const volume = history.reduce((acc, curr) => acc + (curr.volumeLoad || 0), 0);
      setStats({
        totalWorkouts: history.length,
        totalVolume: volume
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    const updated = { ...profile, ...formData };
    setProfile(updated as UserProfile);
    setIsEditing(false);
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-brand-orange" /></div>;

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
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-white">{profile?.name || 'Athlete'}</h2>
                  {currentLevel >= 5 && <Award className="text-yellow-500" size={20} fill="currentColor" />}
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                  <Trophy size={12} className="text-brand-orange" />
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">Level {currentLevel} Athlete</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>XP Progress</span>
                <span>{Math.round(xpInCurrentLevel)} / {XP_PER_LEVEL} XP</span>
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

        {!isEditing && (
          <div className="grid grid-cols-2 gap-3">
            <StatTile 
              icon={<Weight size={18} />} 
              label="Weight" 
              value={`${profile?.weight || '-'} LBS`} 
              sub="Current"
            />
            <StatTile 
              icon={<Ruler size={18} />} 
              label="Height" 
              value={formatHeight(profile?.height)} 
              sub="Stature"
            />
            <StatTile 
              icon={<User size={18} />} 
              label="Age" 
              value={`${profile?.age || '-'} YRS`} 
              sub="Years"
            />
            <StatTile 
              icon={<Activity size={18} />} 
              label="Goal" 
              value={profile?.goal || '-'} 
              sub="Target"
              highlight
            />
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
                  value={formData.weight || ''} 
                  onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                />
              </InputGroup>
              <InputGroup label="Height (cm)" icon={<Ruler size={16} />}>
                <input 
                  type="number"
                  value={formData.height || ''} 
                  onChange={e => setFormData({...formData, height: parseFloat(e.target.value)})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-brand-orange outline-none transition-all"
                />
              </InputGroup>
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
          <div className="mt-6 bg-zinc-900/30 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <div className="relative z-10 flex justify-between items-end">
               <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Sessions</p>
                  <p className="text-4xl font-black text-white">{stats.totalWorkouts}</p>
               </div>
               <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-zinc-600 group-hover:text-white group-hover:bg-brand-orange transition-all duration-500">
                  <Zap size={24} fill="currentColor" />
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const StatTile = ({ icon, label, value, sub, highlight }: any) => (
  <div className={cn(
    "p-4 rounded-2xl border flex flex-col justify-between h-32 transition-colors",
    highlight 
      ? "bg-brand-orange/10 border-brand-orange/20" 
      : "bg-zinc-900/30 border-zinc-800/50"
  )}>
    <div className={cn("flex justify-between items-start", highlight ? "text-brand-orange" : "text-zinc-500")}>
       {icon}
       <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</span>
    </div>
    <div>
      <p className="text-xl font-bold text-white truncate">{value}</p>
      <p className="text-xs text-zinc-500 font-medium">{sub}</p>
    </div>
  </div>
);

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

const formatHeight = (cm?: number) => {
  if (!cm) return '-';
  const realFeet = ((cm * 0.393700) / 12);
  const feet = Math.floor(realFeet);
  const inches = Math.round((realFeet - feet) * 12);
  return `${feet}' ${inches}"`;
};