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
        'flex gap-4 border-b border-zinc-800/80 mb-2 overflow-x-auto no-scrollbar',
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
              'relative py-3 px-2 text-sm font-bold uppercase tracking-wide transition-colors duration-200 focus-visible:outline-none shrink-0',
              isActive ? 'text-brand-orange' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {/* Animated bottom indicator line */}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute left-0 right-0 bottom-0 h-0.5 bg-brand-orange rounded-t-full"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            {/* Label */}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

