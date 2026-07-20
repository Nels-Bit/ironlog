import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { Dumbbell, User, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkout } from '../context/WorkoutContext';
import { socialService } from '../services/socialService';

export const Navbar = () => {
  const location = useLocation();
  const { isActive } = useWorkout();
  const [unreadCount, setUnreadCount] = useState(0);

  const isActiveRoute = (path: string) => location.pathname === path;

  useEffect(() => {
    let isMounted = true;

    const loadUnreadCount = async () => {
      try {
        const count = await socialService.getUnreadNotificationCount();
        if (isMounted) {
          setUnreadCount(count);
        }
      } catch (error) {
        console.error('Failed to load unread notifications.', error);
      }
    };

    loadUnreadCount();
    const intervalId = window.setInterval(loadUnreadCount, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-iron-950/95 backdrop-blur-xl border-t border-white/10 md:left-0 md:top-0 md:bottom-0 md:w-64 md:border-r md:border-t-0 pb-safe">
      <div className="flex justify-around items-center h-24 md:flex-col md:h-full md:justify-start md:pt-10 md:gap-5">
        
        {/* DESKTOP LOGO */}
        <div className="hidden md:block mb-6">
            <h1 className="text-3xl font-black italic text-white tracking-tighter">
                IRON<span className="text-brand-orange">LOG</span>
            </h1>
        </div>

        <NavItem to="/profile" icon={<User size={28} />} label="Profile" active={isActiveRoute('/profile') || location.pathname.startsWith('/history')} />

        {/* LOG BUTTON (Middle + subtle emphasis) */}
        <NavItem 
          to="/workout" 
          icon={<Dumbbell size={28} />} 
          label="Log" 
          active={isActiveRoute('/workout')} 
          highlight={isActive}
          emphasize
        />

        <NavItem
          to="/notifications"
          icon={<Bell size={28} />}
          label="Alerts"
          active={isActiveRoute('/notifications')}
          badgeCount={unreadCount}
        />
      </div>
    </nav>
  );
};

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  highlight?: boolean;
  badgeCount?: number;
  emphasize?: boolean;
}

const NavItem = ({ to, icon, label, active, highlight, badgeCount = 0, emphasize = false }: NavItemProps) => (
  <Link 
    to={to} 
    className={cn(
      "flex flex-col items-center justify-center w-full h-full md:h-auto md:w-full md:px-6 md:py-4 transition-all duration-200 group active:scale-95",
      active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
    )}
  >
    <div className={cn(
      "relative p-3 rounded-2xl transition-all duration-300 mb-1",
      emphasize && !active && !highlight && "bg-brand-orange/15 border border-brand-orange/25",
      active && !highlight && "bg-white/10 text-white",
      highlight ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20 animate-pulse-slow" : ""
    )}>
      {icon}
      {badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-brand-orange text-white text-[10px] font-black flex items-center justify-center">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </div>
    <span className={cn(
      "text-[10px] font-bold uppercase tracking-wider",
      active || highlight ? "text-white" : "text-zinc-600"
    )}>
      {label}
    </span>
  </Link>
);