import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CategoryTrophy, TrophyRank } from '../types';

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
    cardBg: 'bg-zinc-900/40',
    cardBorder: 'border-white/5',
    badgeBg: 'bg-zinc-800/60',
    badgeText: 'text-zinc-500',
    glowShadow: '',
    progressBar: 'bg-zinc-700',
    rankLabel: 'LOCKED',
  },
  bronze: {
    cardBg: 'bg-amber-950/30',
    cardBorder: 'border-amber-700/30',
    badgeBg: 'bg-amber-700/80',
    badgeText: 'text-amber-100',
    glowShadow: 'shadow-[0_0_18px_rgba(180,83,9,0.25)]',
    progressBar: 'bg-gradient-to-r from-amber-700 to-amber-500',
    rankLabel: 'BRONZE',
  },
  silver: {
    cardBg: 'bg-slate-800/30',
    cardBorder: 'border-slate-400/25',
    badgeBg: 'bg-slate-400/80',
    badgeText: 'text-slate-900',
    glowShadow: 'shadow-[0_0_18px_rgba(148,163,184,0.2)]',
    progressBar: 'bg-gradient-to-r from-slate-400 to-slate-300',
    rankLabel: 'SILVER',
  },
  gold: {
    cardBg: 'bg-yellow-950/30',
    cardBorder: 'border-yellow-400/30',
    badgeBg: 'bg-yellow-500/90',
    badgeText: 'text-yellow-950',
    glowShadow: 'shadow-[0_0_22px_rgba(234,179,8,0.3)]',
    progressBar: 'bg-gradient-to-r from-yellow-500 to-yellow-300',
    rankLabel: 'GOLD',
  },
  platinum: {
    cardBg: 'bg-cyan-950/30',
    cardBorder: 'border-cyan-400/30',
    badgeBg: 'bg-cyan-400/90',
    badgeText: 'text-cyan-950',
    glowShadow: 'shadow-[0_0_24px_rgba(34,211,238,0.3)]',
    progressBar: 'bg-gradient-to-r from-cyan-500 to-cyan-300',
    rankLabel: 'PLATINUM',
  },
  diamond: {
    cardBg: 'bg-violet-950/30',
    cardBorder: 'border-violet-400/35',
    badgeBg: 'bg-violet-400/90',
    badgeText: 'text-violet-950',
    glowShadow: 'shadow-[0_0_28px_rgba(167,139,250,0.35)]',
    progressBar: 'bg-gradient-to-r from-violet-500 to-violet-300',
    rankLabel: 'DIAMOND',
  },
  obsidian: {
    cardBg: 'bg-fuchsia-950/30',
    cardBorder: 'border-fuchsia-500/40',
    badgeBg: 'bg-gradient-to-br from-fuchsia-500 to-purple-600',
    badgeText: 'text-white',
    glowShadow: 'shadow-[0_0_32px_rgba(217,70,239,0.4)]',
    progressBar: 'bg-gradient-to-r from-fuchsia-500 to-purple-400',
    rankLabel: 'OBSIDIAN',
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
            background: trophy.rank === 'bronze' ? '#b45309' :
              trophy.rank === 'silver' ? '#94a3b8' :
              trophy.rank === 'gold' ? '#eab308' :
              trophy.rank === 'platinum' ? '#22d3ee' :
              trophy.rank === 'diamond' ? '#a78bfa' : '#d946ef'
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

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          key="sheet"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pr-8">
            <span className="text-3xl">{trophy.emoji}</span>
            <div>
              <h3 className="text-xl font-black text-white">{trophy.categoryLabel}</h3>
              <RankBadge style={style} />
            </div>
          </div>

          {/* Ladder */}
          <div className="space-y-3">
            {trophy.tiers.map((tier, idx) => {
              const tierStyle = RANK_STYLES[
                idx + 1 <= 2 ? 'bronze' :
                idx + 1 <= 4 ? 'silver' :
                idx + 1 <= 6 ? 'gold' :
                idx + 1 <= 8 ? 'platinum' :
                idx + 1 === 9 ? 'diamond' : 'obsidian'
              ];
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
      <div className="rounded-3xl border border-white/10 bg-zinc-900/20 p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🏆</span>
          <div>
            <h3 className="text-lg font-bold text-white">Trophy Cabinet</h3>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              {isReadOnly ? 'Earned trophies' : 'Tap a trophy to view ladder'}
            </p>
          </div>
        </div>

        {/* 2×3 responsive grid */}
        <div className="grid grid-cols-2 gap-3">
          {trophies.map(trophy => (
            <TrophyCard
              key={trophy.category}
              trophy={trophy}
              onTap={() => !isReadOnly ? setSelectedTrophy(trophy) : setSelectedTrophy(trophy)}
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
