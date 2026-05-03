import { Link, useLocation } from 'react-router-dom';
import { Home, Dumbbell, History, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkout } from '../context/WorkoutContext';

export const Navbar = () => {
  const location = useLocation();
  const { isActive } = useWorkout();

  const isActiveRoute = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-iron-950/95 backdrop-blur-xl border-t border-white/10 md:left-0 md:top-0 md:bottom-0 md:w-64 md:border-r md:border-t-0 pb-safe">
      <div className="flex justify-around items-center h-24 md:flex-col md:h-full md:justify-start md:pt-10 md:gap-8">
        
        {/* DESKTOP LOGO */}
        <div className="hidden md:block mb-6">
            <h1 className="text-3xl font-black italic text-white tracking-tighter">
                IRON<span className="text-brand-orange">LOG</span>
            </h1>
        </div>

        <NavItem to="/" icon={<Home size={28} />} label="Home" active={isActiveRoute('/')} />
        
        {/* LOG BUTTON (Highlights if Active) */}
        <NavItem 
          to="/workout" 
          icon={<Dumbbell size={28} />} 
          label="Log" 
          active={isActiveRoute('/workout')} 
          highlight={isActive} // Makes it orange if workout is active
        />
        
        <NavItem to="/history" icon={<History size={28} />} label="History" active={isActiveRoute('/history') || location.pathname.startsWith('/history')} />
        <NavItem to="/profile" icon={<User size={28} />} label="Profile" active={isActiveRoute('/profile')} />
      </div>
    </nav>
  );
};

const NavItem = ({ to, icon, label, active, highlight }: any) => (
  <Link 
    to={to} 
    className={cn(
      "flex flex-col items-center justify-center w-full h-full md:h-auto md:w-full md:px-6 md:py-4 transition-all duration-200 group active:scale-95",
      active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
    )}
  >
    <div className={cn(
      "p-3 rounded-2xl transition-all duration-300 mb-1",
      active && !highlight && "bg-white/10 text-white",
      highlight ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20 animate-pulse-slow" : ""
    )}>
      {icon}
    </div>
    <span className={cn(
      "text-[10px] font-bold uppercase tracking-wider",
      active || highlight ? "text-white" : "text-zinc-600"
    )}>
      {label}
    </span>
  </Link>
);