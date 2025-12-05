
import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ActiveWorkout } from './components/ActiveWorkout';
import { WorkoutHistory } from './components/WorkoutHistory';
import { AICoach } from './components/AICoach';
import { AuthScreen } from './components/AuthScreen';
import { WorkoutSession, User } from './types';
import { getCurrentUser, signOut } from './services/authService';

export enum Tab {
  DASHBOARD = 'DASHBOARD',
  LOG = 'LOG',
  HISTORY = 'HISTORY',
  COACH = 'COACH'
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.DASHBOARD);
  const [editWorkoutId, setEditWorkoutId] = useState<string | null>(null);
  const [importedTemplate, setImportedTemplate] = useState<Partial<WorkoutSession> | null>(null);

  useEffect(() => {
    // Load persisted user on mount
    const currentUser = getCurrentUser();
    if (currentUser) {
        setUser(currentUser);
    }
  }, []);

  const handleLogout = () => {
    signOut();
    setUser(null);
    setCurrentTab(Tab.DASHBOARD);
  };

  const handleUpdateUser = (updatedUser: User) => {
      setUser(updatedUser);
  };

  // Handle navigation to edit a workout
  const handleEditWorkout = (id: string) => {
    setEditWorkoutId(id);
    setCurrentTab(Tab.LOG);
  };

  // Handle importing a workout from AI
  const handleImportWorkout = (template: Partial<WorkoutSession>) => {
    setImportedTemplate(template);
    setEditWorkoutId(null); // Ensure we are in "new" mode, not edit mode
    setCurrentTab(Tab.LOG);
  };

  const handleStartWorkout = (template?: Partial<WorkoutSession>) => {
      if (template) {
          setImportedTemplate(template);
      } else {
          setImportedTemplate(null);
      }
      setEditWorkoutId(null);
      setCurrentTab(Tab.LOG);
  };

  const handleFinishLog = () => {
    setEditWorkoutId(null);
    setImportedTemplate(null);
    setCurrentTab(Tab.HISTORY);
  };

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-slate-950 text-slate-200 overflow-hidden">
      
      {/* Responsive Navigation */}
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-950">
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0 h-full w-full overscroll-none">
            {currentTab === Tab.DASHBOARD && (
              <Dashboard 
                user={user} 
                onStartWorkout={handleStartWorkout} 
                onLogout={handleLogout}
                onUpdateUser={handleUpdateUser}
              />
            )}
            
            {currentTab === Tab.LOG && (
              <ActiveWorkout 
                userId={user.id}
                editWorkoutId={editWorkoutId} 
                importedTemplate={importedTemplate}
                onFinish={handleFinishLog}
                onCancel={() => {
                    setEditWorkoutId(null);
                    setImportedTemplate(null);
                    setCurrentTab(Tab.DASHBOARD);
                }}
              />
            )}

            {currentTab === Tab.HISTORY && (
              <WorkoutHistory 
                userId={user.id} 
                onEdit={handleEditWorkout} 
              />
            )}

            {currentTab === Tab.COACH && (
              <AICoach 
                user={user}
                onImportWorkout={handleImportWorkout} 
              />
            )}
        </div>
      </main>
      
    </div>
  );
}
