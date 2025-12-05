
import React from 'react';
import { Tab } from '../App';
import { LayoutDashboard, Dumbbell, History, Bot, LogOut } from 'lucide-react';

interface NavbarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, className = '' }) => {
  const navItems = [
    { id: Tab.DASHBOARD, label: 'Home', icon: LayoutDashboard },
    { id: Tab.LOG, label: 'Log', icon: Dumbbell },
    { id: Tab.HISTORY, label: 'History', icon: History },
    { id: Tab.COACH, label: 'Coach', icon: Bot },
  ];

  return (
    <>
      {/* Mobile Bottom Bar - Taller and larger icons */}
      <div className={`md:hidden bg-slate-900 border-t border-slate-800 px-2 pb-safe flex justify-around items-center fixed bottom-0 left-0 right-0 h-20 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] ${className}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all duration-200 active:scale-95 ${
                isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-indigo-500/10' : ''}`}>
                 <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 h-full p-4 ${className}`}>
        <div className="flex items-center gap-3 px-4 py-6 mb-4">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Dumbbell size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">IronLog AI</h1>
        </div>

        <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isActive 
                                ? 'bg-indigo-600/10 text-indigo-400' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                    >
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        {item.label}
                    </button>
                );
            })}
        </nav>

        <div className="mt-auto px-4 py-4 border-t border-slate-800">
             <p className="text-xs text-slate-600 text-center">Version 1.0.0</p>
        </div>
      </div>
    </>
  );
};
