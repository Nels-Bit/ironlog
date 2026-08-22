import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  sublabel?: string;
  unlocked: boolean;
  category: 'achievement' | 'level';
  icon: ReactNode;
  accentColor?: 'orange' | 'blue';
}

interface AchievementListProps {
  items: AchievementItem[];
  initialVisible?: number;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.96,
    transition: { duration: 0.18, ease: 'easeIn' as const },
  },
};

const accentMap = {
  orange: {
    card: 'bg-brand-orange/10 border-brand-orange/20',
    badge: 'bg-brand-orange text-white',
    tag: 'text-brand-orange',
  },
  blue: {
    card: 'bg-blue-950/25 border-blue-400/20',
    badge: 'bg-blue-500 text-white',
    tag: 'text-blue-300',
  },
};

const AchievementRow = ({ item }: { item: AchievementItem }) => {
  const accent = item.accentColor ?? (item.category === 'level' ? 'blue' : 'orange');
  const colors = accentMap[accent];

  return (
    <motion.div
      layout
      variants={itemVariants}
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 transition-colors',
        item.unlocked
          ? colors.card
          : 'bg-zinc-900/30 border-white/5 opacity-60'
      )}
    >
      {/* Icon badge */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          item.unlocked ? colors.badge : 'bg-white/5 text-zinc-500'
        )}
      >
        {item.icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-bold text-white">{item.title}</h4>
          {item.unlocked ? (
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest',
                colors.tag
              )}
            >
              Unlocked
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Locked
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>
        {item.sublabel && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {item.sublabel}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export const AchievementList = ({
  items,
  initialVisible = 5,
}: AchievementListProps) => {
  const [showAll, setShowAll] = useState(false);

  const visibleItems = showAll ? items : items.slice(0, initialVisible);
  const hasMore = items.length > initialVisible;

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/20 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Medals &amp; Achievements</h3>
          <p className="text-xs font-medium text-zinc-500">
            Unlocked first, locked last.
          </p>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="shrink-0 text-sm font-semibold text-brand-orange hover:text-white transition-colors"
          >
            {showAll ? 'Collapse' : 'See all'}
          </button>
        )}
      </div>

      {/* Animated list */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {visibleItems.map((item) => (
            <AchievementRow key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Expand / collapse with smooth height */}
      <AnimatePresence>
        {!showAll && hasMore && (
          <motion.div
            key="gradient-fade"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none h-6 -mt-1 bg-gradient-to-t from-zinc-900/60 to-transparent rounded-b-3xl"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
