import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CategoryTrophy, TrophyRank } from '../types';
import { getTrophyRank } from '../utils/gamification';

// ─── Rank Styling ──────────────────────────────────────────────────────────

interface RankStyle {
  cardBg: string;
  cardBorder: string;
  badgeBg: string;
  badgeText: string;
  glowShadow: string;
  progressBar: string;
  rankLabel: string;
}

const RANK_STYLES: Record<TrophyRank, RankStyle> = {
  locked: {
    cardBg: 'bg-zinc-900/40 backdrop-blur-sm',
    cardBorder: 'border-white/5',
    badgeBg: 'bg-zinc-800/60',
    badgeText: 'text-zinc-500',
    glowShadow: '',
    progressBar: 'bg-zinc-700',
    rankLabel: 'LOCKED',
  },
  dirt: {
    cardBg: 'bg-gradient-to-b from-amber-950/30 to-black',
    cardBorder: 'border-amber-900/60',
    badgeBg: 'bg-amber-950',
    badgeText: 'text-amber-700',
    glowShadow: '',
    progressBar: 'bg-amber-900',
    rankLabel: 'DIRT',
  },
  wood: {
    cardBg: 'bg-gradient-to-b from-yellow-950/25 to-black',
    cardBorder: 'border-amber-700/50',
    badgeBg: 'bg-amber-900',
    badgeText: 'text-amber-600',
    glowShadow: '',
    progressBar: 'bg-amber-700',
    rankLabel: 'WOOD',
  },
  wood_max: {
    cardBg: 'bg-gradient-to-b from-yellow-950/25 to-black',
    cardBorder: 'border-amber-700/50',
    badgeBg: 'bg-amber-900',
    badgeText: 'text-amber-600',
    glowShadow: '',
    progressBar: 'bg-amber-700',
    rankLabel: 'WOOD MAX',
  },
  bronze: {
    cardBg: 'bg-gradient-to-b from-amber-900/30 to-black',
    cardBorder: 'border-amber-600/60',
    badgeBg: 'bg-amber-800/50',
    badgeText: 'text-amber-500',
    glowShadow: 'shadow-[0_0_20px_rgba(180,83,9,0.2)]',
    progressBar: 'bg-amber-600',
    rankLabel: 'BRONZE',
  },
  bronze_max: {
    cardBg: 'bg-gradient-to-b from-amber-900/30 to-black',
    cardBorder: 'border-amber-600/60',
    badgeBg: 'bg-amber-800/50',
    badgeText: 'text-amber-500',
    glowShadow: 'shadow-[0_0_20px_rgba(180,83,9,0.2)]',
    progressBar: 'bg-amber-600',
    rankLabel: 'BRONZE MAX',
  },
  silver: {
    cardBg: 'bg-gradient-to-b from-slate-700/30 to-black',
    cardBorder: 'border-slate-300/60',
    badgeBg: 'bg-slate-700/50',
    badgeText: 'text-slate-200',
    glowShadow: 'shadow-[0_0_20px_rgba(100,116,139,0.2)]',
    progressBar: 'bg-slate-400',
    rankLabel: 'SILVER',
  },
  silver_max: {
    cardBg: 'bg-gradient-to-b from-slate-700/30 to-black',
    cardBorder: 'border-slate-300/60',
    badgeBg: 'bg-slate-700/50',
    badgeText: 'text-slate-200',
    glowShadow: 'shadow-[0_0_20px_rgba(100,116,139,0.2)]',
    progressBar: 'bg-slate-400',
    rankLabel: 'SILVER MAX',
  },
  gold: {
    cardBg: 'bg-gradient-to-b from-yellow-900/30 to-black',
    cardBorder: 'border-yellow-500/60',
    badgeBg: 'bg-yellow-700/50',
    badgeText: 'text-yellow-400',
    glowShadow: 'shadow-[0_0_20px_rgba(234,179,8,0.25)]',
    progressBar: 'bg-yellow-500',
    rankLabel: 'GOLD',
  },
  gold_max: {
    cardBg: 'bg-gradient-to-b from-yellow-900/30 to-black',
    cardBorder: 'border-yellow-500/60',
    badgeBg: 'bg-yellow-700/50',
    badgeText: 'text-yellow-400',
    glowShadow: 'shadow-[0_0_20px_rgba(234,179,8,0.25)]',
    progressBar: 'bg-yellow-500',
    rankLabel: 'GOLD MAX',
  },
  platinum: {
    cardBg: 'bg-gradient-to-b from-cyan-950/30 to-black',
    cardBorder: 'border-cyan-400/60',
    badgeBg: 'bg-cyan-900/50',
    badgeText: 'text-cyan-300',
    glowShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    progressBar: 'bg-cyan-400',
    rankLabel: 'PLATINUM',
  },
  platinum_max: {
    cardBg: 'bg-gradient-to-b from-cyan-950/30 to-black',
    cardBorder: 'border-cyan-400/60',
    badgeBg: 'bg-cyan-900/50',
    badgeText: 'text-cyan-300',
    glowShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    progressBar: 'bg-cyan-400',
    rankLabel: 'PLATINUM MAX',
  },
  diamond: {
    cardBg: 'bg-gradient-to-b from-cyan-950/30 to-black',
    cardBorder: 'border-cyan-400/60',
    badgeBg: 'bg-cyan-900/50',
    badgeText: 'text-cyan-300',
    glowShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    progressBar: 'bg-cyan-400',
    rankLabel: 'DIAMOND',
  },
  obsidian: {
    cardBg: 'bg-gradient-to-b from-cyan-950/30 to-black',
    cardBorder: 'border-cyan-400/60',
    badgeBg: 'bg-cyan-900/50',
    badgeText: 'text-cyan-300',
    glowShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    progressBar: 'bg-cyan-400',
    rankLabel: 'OBSIDIAN',
  },
  elite: {
    cardBg: 'bg-gradient-to-b from-cyan-950/30 to-black',
    cardBorder: 'border-cyan-400/60',
    badgeBg: 'bg-cyan-900/50',
    badgeText: 'text-cyan-300',
    glowShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    progressBar: 'bg-cyan-400',
    rankLabel: 'ELITE',
  },
};

// ─── Rank Badge ───────────────────────────────────────────────────────────

const RankBadge = ({ style }: { style: RankStyle }) => (
  <span
    className={cn(
      'inline-block text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full',
      style.badgeBg,
      style.badgeText
    )}
  >
    {style.rankLabel}
  </span>
);

// ─── Trophy Card ──────────────────────────────────────────────────────────

interface TrophyCardProps {
  trophy: CategoryTrophy;
  onTap: () => void;
  isReadOnly?: boolean;
}

const TrophyCard = ({ trophy, onTap }: TrophyCardProps) => {
  const style = RANK_STYLES[trophy.rank];
  const isLocked = trophy.rank === 'locked';

  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 text-left w-full transition-all duration-300',
        style.cardBg,
        style.cardBorder,
        style.glowShadow,
        isLocked && 'opacity-60'
      )}
    >
      {/* Background glow blob */}
      {!isLocked && (
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{
            background: trophy.rank.includes('dirt') ? '#451a03' :
              trophy.rank.includes('wood') ? '#78350f' :
              trophy.rank.includes('bronze') ? '#b45309' :
              trophy.rank.includes('silver') ? '#94a3b8' :
              trophy.rank.includes('gold') ? '#eab308' :
              trophy.rank.includes('platinum') ? '#22d3ee' :
              trophy.rank === 'diamond' ? '#a78bfa' : 
              trophy.rank === 'obsidian' ? '#d946ef' : 
              trophy.rank === 'elite' ? '#06b6d4' : '#d946ef'
          }}
        />
      )}

      <div className="relative z-10">
        {/* Emoji + Lock */}
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-2xl', isLocked && 'grayscale opacity-50')}>
            {trophy.emoji}
          </span>
          {isLocked && <Lock size={12} className="text-zinc-600" />}
        </div>

        {/* Category name */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">
          {trophy.categoryLabel}
        </p>

        {/* Current tier / locked */}
        <p className={cn(
          'text-sm font-black leading-tight mb-2',
          isLocked ? 'text-zinc-600' : 'text-white'
        )}>
          {isLocked
            ? (trophy.tiers[0]?.label ?? 'Locked')
            : (trophy.currentTierLabel ?? 'Locked')}
        </p>

        {/* Rank badge */}
        <RankBadge style={style} />

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-black/30 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', style.progressBar)}
            initial={{ width: 0 }}
            animate={{ width: `${trophy.progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>

        {/* Next tier label */}
        {trophy.nextTierLabel && (
          <p className="mt-1 text-[9px] text-zinc-600 font-medium">
            Next: {trophy.nextTierLabel}
          </p>
        )}
        {!trophy.nextTierLabel && !isLocked && (
          <p className="mt-1 text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
            Maxed ✦
          </p>
        )}
      </div>
    </motion.button>
  );
};

// ─── Ladder Detail Modal ──────────────────────────────────────────────────

interface LadderModalProps {
  trophy: CategoryTrophy;
  onClose: () => void;
}

const LadderModal = ({ trophy, onClose }: LadderModalProps) => {
  const style = RANK_STYLES[trophy.rank];
  const isLocked = trophy.rank === 'locked';

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          key="sheet"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-t-3xl max-h-[85dvh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Static Header Container */}
          <div className="p-6 pb-4 shrink-0 border-b border-white/5 relative">
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5 pr-8">
              <span className="text-3xl">{trophy.emoji}</span>
              <div>
                <h3 className="text-xl font-black text-white">{trophy.categoryLabel}</h3>
                <RankBadge style={style} />
              </div>
            </div>

            {/* Current Best Stat Pill */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
              <p className="text-sm font-bold text-white mb-3">
                {trophy.currentValueFormatted}
              </p>
              
              <div className="h-1.5 rounded-full bg-black/40 overflow-hidden mb-2">
                <motion.div
                  className={cn('h-full rounded-full', style.progressBar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${trophy.progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
              
              {trophy.nextDeltaLabel ? (
                <p className="text-[10px] text-zinc-400 font-medium">
                  {trophy.nextDeltaLabel}
                </p>
              ) : !isLocked ? (
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Maxed ✦
                </p>
              ) : null}
            </div>
          </div>

          {/* Scrollable Ladder List */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-6 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-8 space-y-3">
            {trophy.tiers.map((tier, idx) => {
              const tierStyle = RANK_STYLES[getTrophyRank(idx + 1)];
              const isCurrent = idx === trophy.currentTierIndex && trophy.rank !== 'locked';

              return (
                <div
                  key={tier.value}
                  className={cn(
                    'flex items-center gap-3 rounded-xl p-3 border transition-all',
                    tier.unlocked
                      ? cn(tierStyle.cardBg, tierStyle.cardBorder)
                      : 'bg-zinc-900/20 border-white/5 opacity-50'
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    tier.unlocked ? tierStyle.badgeBg : 'bg-zinc-800'
                  )}>
                    {tier.unlocked
                      ? <CheckCircle2 size={16} className={tierStyle.badgeText} />
                      : <Circle size={16} className="text-zinc-600" />
                    }
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-bold text-sm',
                        tier.unlocked ? 'text-white' : 'text-zinc-600'
                      )}>
                        {tier.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-orange">
                          Current
                        </span>
                      )}
                    </div>
                    {tier.unlocked && tier.earnedAt && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Earned {new Date(tier.earnedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                    {tier.unlocked && !tier.earnedAt && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">Earned</p>
                    )}
                  </div>

                  {/* Rank badge */}
                  <span className={cn(
                    'text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0',
                    tierStyle.badgeBg,
                    tierStyle.badgeText
                  )}>
                    {tierStyle.rankLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── TrophyCabinet Component ──────────────────────────────────────────────

interface TrophyCabinetProps {
  trophies: CategoryTrophy[];
  isReadOnly?: boolean;
}

export const TrophyCabinet = ({ trophies, isReadOnly = false }: TrophyCabinetProps) => {
  const [selectedTrophy, setSelectedTrophy] = useState<CategoryTrophy | null>(null);

  if (trophies.length === 0) return null;

  return (
    <>
      <div className="pt-2">
        {/* Open Header */}
        <div className="flex items-center justify-between px-1 mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Trophy Cabinet</h2>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Tap to inspect ladder
          </span>
        </div>

        {/* 2×3 responsive grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {trophies.map(trophy => (
            <TrophyCard
              key={trophy.category}
              trophy={trophy}
              onTap={() => setSelectedTrophy(trophy)}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      </div>

      {/* Ladder Detail Modal */}
      {selectedTrophy && (
        <LadderModal
          trophy={selectedTrophy}
          onClose={() => setSelectedTrophy(null)}
        />
      )}
    </>
  );
};
