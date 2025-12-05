
import React, { useState } from 'react';
import { Button } from './Button';
import { signIn, signUp } from '../services/authService';
import { User, UserSex, UserFrequency, UserGoal } from '../types';
import { Dumbbell, Lock, Mail, User as UserIcon, AlertCircle, ArrowRight, ArrowLeft, Ruler, Weight, Calendar, Target, BrainCircuit } from 'lucide-react';

interface AuthScreenProps {
    onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1); // 1 = Creds, 2 = Profile
    const [error, setError] = useState<string | null>(null);

    // Creds
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Profile
    const [weight, setWeight] = useState('');
    const [heightFt, setHeightFt] = useState('');
    const [heightIn, setHeightIn] = useState('');
    const [sex, setSex] = useState<UserSex>('Male');
    const [frequency, setFrequency] = useState<UserFrequency>('4-5');
    const [goal, setGoal] = useState<UserGoal>('Strength');
    const [allowAI, setAllowAI] = useState(true);

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name.trim() || !email.trim() || !password) {
            setError("All fields are required.");
            return;
        }
        setStep(2);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanEmail = email.trim();
        const cleanName = name.trim();

        if (isLogin) {
            const result = signIn(cleanEmail, password);
            if (result.user) {
                onLogin(result.user);
            } else {
                setError(result.error || 'Login failed');
            }
        } else {
            // Complete Signup with Profile
            const profileData: Partial<User> = {
                name: cleanName,
                email: cleanEmail,
                password: password,
                weight: weight ? parseFloat(weight) : undefined,
                heightFt: heightFt ? parseFloat(heightFt) : undefined,
                heightIn: heightIn ? parseFloat(heightIn) : undefined,
                sex,
                frequency,
                goal,
                allowAI
            };

            const result = signUp(profileData);
            if (result.user) {
                onLogin(result.user);
            } else {
                setError(result.error || 'Sign up failed');
            }
        }
    };

    return (
        <div className="flex flex-col min-h-screen h-[100dvh] max-w-md mx-auto bg-slate-950 px-6 justify-center overflow-y-auto py-10">
            <div className="text-center mb-8 shrink-0">
                <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-900/50">
                    <Dumbbell size={32} className="text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">IronLog AI</h1>
                <p className="text-slate-400">Track workouts. Crush goals.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shrink-0">
                {step === 1 && (
                    <>
                        <div className="flex gap-4 mb-6 border-b border-slate-800 pb-2">
                            <button 
                                className={`flex-1 pb-2 text-sm font-medium transition-colors ${isLogin ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'}`}
                                onClick={() => { setIsLogin(true); setError(null); }}
                            >
                                Sign In
                            </button>
                            <button 
                                className={`flex-1 pb-2 text-sm font-medium transition-colors ${!isLogin ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'}`}
                                onClick={() => { setIsLogin(false); setError(null); }}
                            >
                                Sign Up
                            </button>
                        </div>

                        <form onSubmit={isLogin ? handleSubmit : handleNextStep} className="space-y-4">
                            {!isLogin && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                                    <div className="relative">
                                        <UserIcon size={16} className="absolute left-3 top-3 text-slate-500" />
                                        <input 
                                            type="text" 
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                            placeholder="John Doe"
                                            required={!isLogin}
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="john@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 p-2 rounded border border-red-900/50">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}

                            <Button type="submit" fullWidth className="mt-2" size="lg">
                                {isLogin ? 'Sign In' : (
                                    <span className="flex items-center gap-2">Next Step <ArrowRight size={16} /></span>
                                )}
                            </Button>
                        </form>
                    </>
                )}

                {step === 2 && !isLogin && (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-2 mb-6 text-indigo-400">
                             <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="p-0 hover:bg-transparent text-slate-400 hover:text-white mr-2">
                                <ArrowLeft size={20} />
                             </Button>
                             <h2 className="text-lg font-bold text-white">Your Profile</h2>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Weight (lbs)</label>
                                    <div className="relative">
                                        <Weight size={14} className="absolute left-3 top-3 text-slate-500" />
                                        <input 
                                            type="number" 
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                            placeholder="175"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Height</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input 
                                                type="number" 
                                                value={heightFt}
                                                onChange={(e) => setHeightFt(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-center"
                                                placeholder="5"
                                            />
                                            <span className="absolute right-2 top-2.5 text-slate-600 text-xs">ft</span>
                                        </div>
                                        <div className="relative flex-1">
                                            <input 
                                                type="number" 
                                                value={heightIn}
                                                onChange={(e) => setHeightIn(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-center"
                                                placeholder="10"
                                            />
                                            <span className="absolute right-2 top-2.5 text-slate-600 text-xs">in</span>
                                        </div>
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
                                            onClick={() => setSex(s)}
                                            className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                                                sex === s 
                                                ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Workout Frequency (Weekly)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['1-3', '4-5', '6+'] as UserFrequency[]).map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setFrequency(f)}
                                            className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                                                frequency === f 
                                                ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                            }`}
                                        >
                                            {f} Days
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Primary Goal</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['Strength', 'Endurance', 'Aesthetics', 'Overall'] as UserGoal[]).map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setGoal(g)}
                                            className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                                                goal === g 
                                                ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div 
                                onClick={() => setAllowAI(!allowAI)}
                                className="flex gap-3 bg-slate-950 border border-slate-800 p-3 rounded-lg cursor-pointer hover:border-slate-700"
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center border mt-0.5 ${allowAI ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'}`}>
                                    {allowAI && <BrainCircuit size={12} className="text-white"/>}
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-white mb-0.5">Share profile with AI Coach</span>
                                    <span className="block text-[10px] text-slate-500 leading-tight">
                                        Allows the AI to personalize workout plans based on your stats and goals.
                                    </span>
                                </div>
                            </div>

                            <Button type="submit" fullWidth className="mt-4" size="lg">
                                Create Account
                            </Button>
                        </form>
                    </div>
                )}
            </div>
            
            <p className="text-center text-xs text-slate-600 mt-6 shrink-0">
                By continuing, you agree to lift heavy things occasionally.
            </p>
        </div>
    );
};
