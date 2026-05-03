import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Dumbbell, Loader2, ArrowRight, Mail, Lock, AlertCircle, Weight } from 'lucide-react';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [weight, setWeight] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isLogin) {
        // --- LOG IN LOGIC ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Success! App.tsx will automatically redirect because session state changes.
      } else {
        const parsedWeight = Number(weight);
        if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
          throw new Error('Please enter your body weight.');
        }

        // --- SIGN UP LOGIC ---
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin, // Important for confirmation link
            data: {
              weight: parsedWeight
            }
          },
        });
        if (error) throw error;
        setSuccessMsg("Check your email to confirm your account.");
      }
    } catch (error: any) {
      setErrorMsg(error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      
      {/* BACKGROUND IMAGE */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop")',
        }}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]" />
      </div>

      {/* CARD */}
      <div className="relative z-10 w-full max-w-md bg-iron-950/90 border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-orange/10 mb-4 ring-1 ring-brand-orange/20">
            <Dumbbell className="text-brand-orange" size={32} />
          </div>
          <h1 className="text-4xl font-black italic text-white tracking-tighter mb-2">IRONLOG</h1>
          <p className="text-zinc-400 text-sm font-medium">
            {isLogin ? 'Welcome back, athlete.' : 'Start your journey.'}
          </p>
        </div>

        {/* Success Message (For Sign Up) */}
        {successMsg && (
          <div className="mb-6 bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-start gap-3">
            <Mail className="text-green-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-green-200">{successMsg}</p>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-200">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
            
          {/* Email Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider ml-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-4 text-zinc-500" size={20} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                placeholder="swol@example.com"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider ml-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 text-zinc-500" size={20} />
              <input 
                type="password" 
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider ml-1">
                Body Weight (lbs)
              </label>
              <div className="relative">
                <Weight className="absolute left-4 top-4 text-zinc-500" size={20} />
                <input 
                  type="number"
                  min={1}
                  step="0.1"
                  required
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                  placeholder="170"
                />
              </div>
            </div>
          )}
          
          {/* Action Button */}
          <Button 
            className="w-full py-6 text-lg font-bold tracking-wide shadow-lg shadow-brand-orange/20 mt-2" 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={20} />
              </span>
            )}
          </Button>

          {/* Toggle Login/Signup */}
          <div className="text-center pt-2">
            <p className="text-zinc-500 text-sm">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-white font-bold hover:text-brand-orange transition-colors underline decoration-brand-orange/30 underline-offset-4"
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};