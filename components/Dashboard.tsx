
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from './Button';
import { getWorkouts, getHiddenExercises, unhideExerciseName } from '../services/storageService';
import { updateUserProfile } from '../services/authService';
import { WorkoutSession, User, UserSex, UserFrequency, UserGoal, Exercise } from '../types';
import { Plus, TrendingUp, Settings, X, User as UserIcon, Weight, Ruler, BrainCircuit, Dumbbell, Play, ArrowRight, Info } from 'lucide-react';
import { PRESET_WORKOUTS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

interface DashboardProps {
  user: User;
  onStartWorkout: (template?: Partial<WorkoutSession>) => void;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onStartWorkout, onLogout, onUpdateUser }) => {
  const [weeklyVolume, setWeeklyVolume] = useState<{name: string, volume: number}[]>([]);
  
  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [hiddenExercises, setHiddenExercises] = useState<string[]>([]);

  // Profile Modal State
  const [showProfile, setShowProfile] = useState(false);
  const [editProfileMode, setEditProfileMode] = useState(false);
  
  // Preset Modal State
  const [selectedPreset, setSelectedPreset] = useState<any | null>(null);

  // Profile Form State
  const [pWeight, setPWeight] = useState(user.weight?.toString() || '');
  const [pHeightFt, setPHeightFt] = useState(user.heightFt?.toString() || '');
  const [pHeightIn, setPHeightIn] = useState(user.heightIn?.toString() || '');
  const [pSex, setPSex] = useState<UserSex>(user.sex || 'Male');
  const [pFrequency, setPFrequency] = useState<UserFrequency>(user.frequency || '4-5');
  const [pGoal, setPGoal] = useState<UserGoal>(user.goal || 'Strength');
  const [pAllowAI, setPAllowAI] = useState(user.allowAI ?? true);

  // Generate ID helper
  const generateId = () => Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    const data = getWorkouts(user.id);

    // Calculate last 7 days volume
    const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
    });

    const chartData = last7Days.map(date => {
        const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Find workouts on this day
        const dayWorkouts = data.filter(w => {
            const wDate = new Date(w.startTime);
            return wDate.getDate() === date.getDate() && 
                   wDate.getMonth() === date.getMonth() &&
                   wDate.getFullYear() === date.getFullYear();
        });

        // Sum volume (weight * reps * sets)
        // Skip cardio volume in this metric
        const volume = dayWorkouts.reduce((acc, w) => {
            return acc + w.exercises.reduce((exAcc, ex) => {
                if (ex.category === 'Cardio') return exAcc;
                return exAcc + ex.sets.reduce((setAcc, s) => {
                    const reps = ex.isUnilateral ? (s.repsLeft || 0) + (s.repsRight || 0) : s.reps;
                    return s.completed ? setAcc + (s.weight * reps) : setAcc;
                }, 0);
            }, 0);
        }, 0);

        return { name: dayStr, volume: Math.round(volume / 100) / 10 }; // Scale down for display (kilos/lbs)
    });

    setWeeklyVolume(chartData);
  }, [user.id]);

  useEffect(() => {
      if (showSettings) {
          setHiddenExercises(getHiddenExercises(user.id));
      }
  }, [showSettings, user.id]);

  const handleUnhide = (name: string) => {
      unhideExerciseName(user.id, name);
      setHiddenExercises(getHiddenExercises(user.id));
  };

  const handleSaveProfile = () => {
      const updatedUser: User = {
          ...user,
          weight: pWeight ? parseFloat(pWeight) : undefined,
          heightFt: pHeightFt ? parseFloat(pHeightFt) : undefined,
          heightIn: pHeightIn ? parseFloat(pHeightIn) : undefined,
          sex: pSex,
          frequency: pFrequency,
          goal: pGoal,
          allowAI: pAllowAI
      };
      
      updateUserProfile(updatedUser);
      onUpdateUser(updatedUser);
      setEditProfileMode(false);
  };

  const getSuggestedWorkouts = () => {
      const goal = user.goal || 'Overall';
      const exactMatches = PRESET_WORKOUTS[goal] || [];
      const overallMatches = PRESET_WORKOUTS['Overall'] || [];
      
      // If the goal is overall, just return overall, otherwise mix goal + overall
      if (goal === 'Overall') return overallMatches;
      return [...exactMatches, ...overallMatches];
  };

  const handleStartPreset = () => {
      if (!selectedPreset) return;

      const exercises: Exercise[] = selectedPreset.exercises.map((ex: any) => ({
          id: generateId(),
          name: ex.name,
          category: ex.category,
          isUnilateral: ex.isUnilateral,
          notes: ex.notes,
          sets: Array.from({ length: ex.sets }).map(() => ({
              id: generateId(),
              weight: 0,
              reps: ex.reps, // Will serve as target rep count
              repsLeft: 0,
              repsRight: 0,
              distance: 0,
              time: 0,
              completed: false
          }))
      }));

      const template: Partial<WorkoutSession> = {
          name: selectedPreset.name,
          exercises: exercises
      };

      setSelectedPreset(null);
      onStartWorkout(template);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Welcome back, {user.name}.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => {
                    setPWeight(user.weight?.toString() || '');
                    setPHeightFt(user.heightFt?.toString() || '');
                    setPHeightIn(user.heightIn?.toString() || '');
                    setPSex(user.sex || 'Male');
                    setPFrequency(user.frequency || '4-5');
                    setPGoal(user.goal || 'Strength');
                    setPAllowAI(user.allowAI ?? true);
                    setEditProfileMode(false);
                    setShowProfile(true);
                }}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
                <UserIcon size={16} /> View Profile
            </button>
            <button 
                onClick={() => setShowSettings(true)}
                className="h-10 w-10 rounded-full bg-slate-800 hover:bg-indigo-900/30 flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors"
                title="Settings"
            >
            <Settings size={18} />
            </button>
        </div>
      </header>

      {/* Quick Action */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 shadow-lg text-white relative overflow-hidden">
        <div className="relative z-10">
            <h2 className="text-lg font-bold mb-1">Empty Log? Let's Fix That.</h2>
            <p className="text-indigo-100 text-sm mb-4">Start a blank workout or choose a template below.</p>
            <Button 
                onClick={() => onStartWorkout()} 
                className="bg-white text-indigo-600 hover:bg-indigo-50 border-none w-full font-bold shadow-lg"
            >
            <Plus size={18} className="mr-2" /> Start Empty Workout
            </Button>
        </div>
        <Dumbbell className="absolute -right-4 -bottom-4 text-indigo-500/30 rotate-[-15deg]" size={120} />
      </div>

      {/* Suggested Workouts */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <BrainCircuit size={16} className="text-indigo-400"/> Suggested For You
        </h3>
        <p className="text-xs text-slate-500 mb-3">Based on your goal: <span className="text-indigo-400 font-bold uppercase">{user.goal || 'Overall'}</span></p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {getSuggestedWorkouts().map((preset, idx) => (
                <div 
                    key={idx}
                    onClick={() => setSelectedPreset(preset)}
                    className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50 p-4 rounded-xl cursor-pointer transition-all group relative"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-indigo-900/20 rounded-lg text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Dumbbell size={20} />
                        </div>
                        <ArrowRight size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <h4 className="text-white font-bold mb-1">{preset.name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{preset.description}</p>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-wide">
                        <span>{preset.exercises.length} Exercises</span>
                        <span>•</span>
                        <span>{user.goal} Focus</span>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Weekly Volume Chart */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400"/> Volume (Last 7 Days)
            </h3>
        </div>
        <div className="h-40 w-full">
            {weeklyVolume.some(d => d.volume > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyVolume}>
                        <XAxis 
                            dataKey="name" 
                            tick={{fill: '#64748b', fontSize: 10}} 
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip 
                            cursor={{fill: '#1e293b'}}
                            contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9'}}
                        />
                        <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                    No data yet. Go lift!
                </div>
            )}
        </div>
      </div>

      {/* Preset Details Modal */}
      {selectedPreset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
                      <div>
                          <h2 className="text-xl font-bold text-white leading-tight">{selectedPreset.name}</h2>
                          <span className="text-xs text-indigo-400 font-medium">{user.goal} Workout</span>
                      </div>
                      <button onClick={() => setSelectedPreset(null)} className="text-slate-400 hover:text-white p-1">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="p-5 overflow-y-auto space-y-4">
                      <p className="text-sm text-slate-300 italic border-l-2 border-indigo-500 pl-3">
                          {selectedPreset.description}
                      </p>

                      <div className="space-y-3">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exercise List</h3>
                          {selectedPreset.exercises.map((ex: any, idx: number) => (
                              <div key={idx} className="bg-slate-800 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-slate-400 text-xs font-mono">
                                          {idx + 1}
                                      </span>
                                      <div>
                                          <div className="font-medium text-white text-sm">{ex.name}</div>
                                          <div className="flex gap-2 text-[10px] mt-0.5">
                                               <span className="text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">{ex.category}</span>
                                               {ex.notes && <span className="text-indigo-300 bg-indigo-900/20 px-1.5 py-0.5 rounded flex items-center gap-1"><Info size={8}/> Note</span>}
                                          </div>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-lg font-bold text-white leading-none">{ex.sets}</div>
                                      <div className="text-[10px] text-slate-500 uppercase font-bold">Sets</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-800 bg-slate-900">
                      <Button fullWidth size="lg" onClick={handleStartPreset} className="flex items-center justify-center gap-2">
                          <Play size={18} fill="currentColor" /> Start Workout
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-white">Settings</h2>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                          <X size={20} />
                      </button>
                  </div>

                  <div className="space-y-6">
                      <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Account</h3>
                          <div className="bg-slate-800 p-3 rounded-lg">
                              <p className="text-white font-medium">{user.name}</p>
                              <p className="text-slate-400 text-xs">{user.email}</p>
                          </div>
                      </div>

                      <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Hidden Exercises</h3>
                          <p className="text-xs text-slate-500 mb-2">These exercises won't show in autocomplete.</p>
                          {hiddenExercises.length === 0 ? (
                              <p className="text-slate-600 text-sm italic">No hidden exercises.</p>
                          ) : (
                              <div className="max-h-40 overflow-y-auto space-y-2">
                                  {hiddenExercises.map(name => (
                                      <div key={name} className="flex justify-between items-center bg-slate-800 p-2 rounded-md">
                                          <span className="text-sm text-slate-300">{name}</span>
                                          <button 
                                            onClick={() => handleUnhide(name)}
                                            className="text-xs bg-indigo-900 text-indigo-300 px-2 py-1 rounded hover:bg-indigo-800"
                                          >
                                              Restore
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <Button 
                          onClick={onLogout} 
                          variant="danger" 
                          fullWidth 
                          className="mt-4"
                      >
                          Sign Out
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          <UserIcon className="text-indigo-500" /> Your Profile
                      </h2>
                      <button onClick={() => setShowProfile(false)} className="text-slate-400 hover:text-white">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                      {!editProfileMode ? (
                          // View Mode
                          <>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                      <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Weight size={12}/> Weight</div>
                                      <div className="text-xl font-bold text-white">{user.weight || '--'} <span className="text-sm text-slate-400 font-normal">lbs</span></div>
                                  </div>
                                  <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                      <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Ruler size={12}/> Height</div>
                                      <div className="text-xl font-bold text-white">{user.heightFt ? `${user.heightFt}'${user.heightIn||0}"` : '--'}</div>
                                  </div>
                              </div>

                              <div className="space-y-3">
                                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg border border-slate-700">
                                      <span className="text-sm text-slate-400">Sex</span>
                                      <span className="text-sm font-medium text-white">{user.sex || 'Not set'}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg border border-slate-700">
                                      <span className="text-sm text-slate-400">Frequency</span>
                                      <span className="text-sm font-medium text-white">{user.frequency ? `${user.frequency} days/week` : 'Not set'}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg border border-slate-700">
                                      <span className="text-sm text-slate-400">Goal</span>
                                      <span className="text-sm font-medium text-indigo-300 bg-indigo-900/30 px-2 py-0.5 rounded">{user.goal || 'Not set'}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg border border-slate-700">
                                      <span className="text-sm text-slate-400 flex items-center gap-2"><BrainCircuit size={14}/> AI Access</span>
                                      <span className={`text-xs font-bold px-2 py-1 rounded ${user.allowAI ? 'bg-emerald-900/30 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                          {user.allowAI ? 'ALLOWED' : 'DENIED'}
                                      </span>
                                  </div>
                              </div>

                              <Button fullWidth onClick={() => setEditProfileMode(true)}>Edit Profile</Button>
                          </>
                      ) : (
                          // Edit Mode
                          <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Weight (lbs)</label>
                                        <input 
                                            type="number" 
                                            value={pWeight}
                                            onChange={(e) => setPWeight(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Height (ft/in)</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="number" 
                                                value={pHeightFt}
                                                onChange={(e) => setPHeightFt(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm text-center"
                                                placeholder="ft"
                                            />
                                            <input 
                                                type="number" 
                                                value={pHeightIn}
                                                onChange={(e) => setPHeightIn(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm text-center"
                                                placeholder="in"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-2">Sex</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Male', 'Female', 'Other'] as UserSex[]).map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setPSex(s)}
                                                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                                                    pSex === s 
                                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                                }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-2">Frequency</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['1-3', '4-5', '6+'] as UserFrequency[]).map(f => (
                                            <button
                                                key={f}
                                                type="button"
                                                onClick={() => setPFrequency(f)}
                                                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                                                    pFrequency === f 
                                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                                }`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-2">Goal</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Strength', 'Endurance', 'Aesthetics', 'Overall'] as UserGoal[]).map(g => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => setPGoal(g)}
                                                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                                                    pGoal === g 
                                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                                }`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div 
                                    onClick={() => setPAllowAI(!pAllowAI)}
                                    className="flex gap-3 bg-slate-950 border border-slate-800 p-3 rounded-lg cursor-pointer"
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border mt-0.5 ${pAllowAI ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'}`}>
                                        {pAllowAI && <BrainCircuit size={12} className="text-white"/>}
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-white mb-0.5">Allow AI Access</span>
                                        <span className="block text-[10px] text-slate-500">
                                            If unchecked, AI will give generic advice only.
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button variant="secondary" onClick={() => setEditProfileMode(false)} className="flex-1">Cancel</Button>
                                    <Button onClick={handleSaveProfile} className="flex-1">Save Changes</Button>
                                </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
