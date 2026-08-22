import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface FluidTab {
  id: string;
  label: string;
}

interface FluidTabsProps {
  tabs: FluidTab[];
  activeTab: string;
  onChange: (id: string) => void;
  layoutId?: string;
  className?: string;
}

export const FluidTabs = ({
  tabs,
  activeTab,
  onChange,
  layoutId = 'fluid-tab-indicator',
  className,
}: FluidTabsProps) => {
  return (
    <div
      className={cn(
        'flex gap-1 rounded-2xl border border-white/10 bg-zinc-950/70 p-1',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex-1 rounded-xl py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none',
              isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {/* Animated sliding pill */}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-brand-orange"
                transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
              />
            )}
            {/* Label sits above the pill */}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

