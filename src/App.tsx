import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { WorkoutProvider } from './context/WorkoutContext';

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
  
  // Define which paths should be "Full Screen" (No padding/container)
  const isFullScreen = location.pathname === '/workout' || location.pathname.startsWith('/history/');

  return (
    <WorkoutProvider>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-orange selection:text-white pb-20 md:pb-0 md:pl-64">
        
        <Navbar />

        <main className={cn(
          "min-h-screen transition-all",
          !isFullScreen && "max-w-3xl mx-auto p-6 md:p-12"
        )}>
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
    </BrowserRouter>
  );
}