import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  earnedAt: number | null;
  icon: ReactNode;
  category: 'achievement' | 'level';
  sortOrder: number;
}

export interface AchievementListProps {
  items: AchievementItem[];
  className?: string;
}

export const AchievementList = ({ items, className }: AchievementListProps) => {
  const [showAll, setShowAll] = useState(false);

  const sortedItems = [...items].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    const aTime = a.earnedAt ?? 0;
    const bTime = b.earnedAt ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.sortOrder - b.sortOrder;
  });

  const visibleItems = showAll ? sortedItems : sortedItems.slice(0, 4);

  return (
    <div className={cn("rounded-3xl border border-white/10 bg-zinc-900/20 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Medals & Achievements</h3>
          <p className="text-xs text-zinc-500 font-medium">Unlocked first, locked last.</p>
        </div>
        {items.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((prev) => !prev)}
            className="shrink-0 text-brand-orange hover:text-white text-xs font-bold uppercase tracking-wider"
          >
            {showAll ? 'Collapse' : 'See all'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {visibleItems.map((medal) => (
          <div
            key={medal.id}
            className={cn(
              "rounded-2xl border p-4 flex items-start gap-3 transition-all",
              medal.unlocked
                ? medal.category === 'level'
                  ? "bg-blue-950/25 border-blue-400/20"
                  : "bg-brand-orange/10 border-brand-orange/20"
                : "bg-zinc-900/30 border-white/5 opacity-70"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md",
                medal.unlocked
                  ? medal.category === 'level'
                    ? "bg-blue-500 text-white shadow-blue-500/20"
                    : "bg-brand-orange text-white shadow-brand-orange/20"
                  : "bg-white/5 text-zinc-500"
              )}
            >
              {medal.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-white text-sm">{medal.title}</h4>
                {medal.unlocked ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                    Unlocked
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Locked
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{medal.description}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-2">
                {medal.unlocked
                  ? medal.earnedAt
                    ? `${medal.title} earned (${new Date(medal.earnedAt).toLocaleDateString()})`
                    : `${medal.title} earned`
                  : `Unlocks when ${medal.description.toLowerCase()}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
