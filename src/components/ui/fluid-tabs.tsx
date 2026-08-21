import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
}

export interface FluidTabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  className?: string;
}

export const FluidTabs = <T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  className
}: FluidTabsProps<T>) => {
  return (
    <div
      className={cn(
        "grid grid-flow-col auto-cols-fr rounded-2xl border border-white/10 bg-zinc-950/70 p-1 relative",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest transition-colors duration-200 z-10 select-none",
              isActive ? "text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="fluid-tab-pill"
                className="absolute inset-0 rounded-xl bg-brand-orange shadow-lg shadow-brand-orange/20"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
