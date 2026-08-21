import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Analytics } from '@vercel/analytics/react';
import { supabase } from './lib/supabase';
import { WorkoutProvider } from './context/WorkoutContext';
import { authService } from './services/authService';

// Pages
import { Auth } from './pages/Auth';
import { WorkoutLogger } from './pages/WorkoutLogger';
import { Profile } from './pages/Profile';
import { FriendProfile } from './pages/FriendProfile';
import { EditWorkout } from './pages/EditWorkout';
import { Notifications } from './pages/Notifications';
import { WorkoutSummary } from './pages/WorkoutSummary';

// Components
import { Navbar } from './components/Navbar';
import { cn } from './lib/utils';

// Resets scroll position to top on every route change (fixes PWA scroll retention)
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Wrapper component to handle location-based logic
const AppContent = () => {
  const location = useLocation();
  const [missingWeight, setMissingWeight] = useState(false);
  
  // Define which paths should be "Full Screen" (No padding/container)
  const isFullScreen = 
    location.pathname === '/workout' || 
    location.pathname.startsWith('/history/') ||
    location.pathname.startsWith('/summary/') ||
    location.pathname.startsWith('/workout/summary/') ||
    location.pathname === '/summary';

  const showWeightBanner = missingWeight && location.pathname !== '/profile' && !location.pathname.startsWith('/profile/');

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
      <ScrollToTop />
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
            <Route path="/" element={<Navigate to="/profile" replace />} />
            <Route path="/workout" element={<WorkoutLogger />} />
            <Route path="/history" element={<Navigate to="/profile?tab=activity" replace />} />
            <Route path="/history/:id" element={<EditWorkout />} />
            <Route path="/summary/:id" element={<WorkoutSummary />} />
            <Route path="/workout/summary/:id" element={<WorkoutSummary />} />
            <Route path="/summary" element={<WorkoutSummary />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<FriendProfile />} />
            <Route path="/friends/:userId" element={<FriendProfile />} />
            <Route path="/friends" element={<Navigate to="/profile?tab=friends" replace />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="*" element={<Navigate to="/profile" replace />} />
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