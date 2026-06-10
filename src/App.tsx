import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Analytics } from '@vercel/analytics/react';
import { supabase } from './lib/supabase';
import { WorkoutProvider } from './context/WorkoutContext';
import { authService } from './services/authService';

// Pages
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { WorkoutLogger } from './pages/WorkoutLogger';
import { History } from './pages/History';
import { Profile } from './pages/Profile';
import { EditWorkout } from './pages/EditWorkout';

// Components
import { Navbar } from './components/Navbar';
import { cn } from './lib/utils';

// Wrapper component to handle location-based logic
const AppContent = () => {
  const location = useLocation();
  const [missingWeight, setMissingWeight] = useState(false);
  
  // Define which paths should be "Full Screen" (No padding/container)
  const isFullScreen = location.pathname === '/workout' || location.pathname.startsWith('/history/');
  const showWeightBanner = missingWeight && location.pathname !== '/profile';

  useEffect(() => {
    const loadWeight = async () => {
      const user = await authService.getUser();
      const rawWeight = user?.weight;
      const parsed = typeof rawWeight === 'number' ? rawWeight : typeof rawWeight === 'string' ? parseFloat(rawWeight) : NaN;
      setMissingWeight(!Number.isFinite(parsed) || parsed <= 0);
    };
    loadWeight();
  }, []);

  return (
    <WorkoutProvider>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-orange selection:text-white pb-20 md:pb-0 md:pl-64">
        
        <Navbar />

        <main className={cn(
          "min-h-screen transition-all",
          !isFullScreen && "max-w-3xl mx-auto p-6 md:p-12"
        )}>
          {showWeightBanner && (
            <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium">
                  Add your body weight to enable accurate bodyweight calculations.
                </p>
                <Link to="/profile" className="text-sm font-bold text-amber-100 hover:text-white">
                  Set Weight
                </Link>
              </div>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workout" element={<WorkoutLogger />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<EditWorkout />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </WorkoutProvider>
  );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-black" />;

  return (
    <BrowserRouter>
      {!session ? (
        <Routes>
          <Route path="*" element={<Auth />} />
        </Routes>
      ) : (
        <AppContent />
      )}
      <Analytics />
    </BrowserRouter>
  );
}