export const ProfileSkeleton = () => {
  return (
    <div className="space-y-6 pb-24 animate-pulse">
      {/* Profile Card Skeleton */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-iron-950/80 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/10 shrink-0" />
            <div className="space-y-3">
              {/* Name */}
              <div className="h-6 w-36 bg-white/10 rounded-lg" />
              {/* Mini Stats Row */}
              <div className="flex flex-wrap gap-2">
                <div className="h-10 w-16 bg-white/5 rounded-xl border border-white/5" />
                <div className="h-10 w-16 bg-white/5 rounded-xl border border-white/5" />
                <div className="h-10 w-14 bg-white/5 rounded-xl border border-white/5" />
                <div className="h-10 w-20 bg-white/5 rounded-xl border border-white/5" />
              </div>
            </div>
          </div>
          {/* Edit Button placeholder */}
          <div className="w-9 h-9 rounded-full bg-white/5 shrink-0" />
        </div>

        {/* XP Progress Skeleton */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="flex justify-between items-center">
            <div className="h-3 w-20 bg-white/10 rounded" />
            <div className="h-3 w-24 bg-white/10 rounded" />
          </div>
          <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div className="h-full w-2/5 bg-white/10 rounded-full" />
          </div>
          <div className="h-3 w-28 bg-white/10 rounded ml-auto" />
        </div>
      </div>

      {/* Tab Navigation Skeleton */}
      <div className="h-12 w-full bg-zinc-900/60 rounded-2xl p-1.5 flex gap-1 border border-white/5">
        <div className="flex-1 h-full rounded-xl bg-white/10" />
        <div className="flex-1 h-full rounded-xl bg-white/5" />
        <div className="flex-1 h-full rounded-xl bg-white/5" />
      </div>

      {/* Overview Stat Cards Skeleton */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4 h-24 flex flex-col justify-between">
          <div className="h-3 w-12 bg-white/10 rounded" />
          <div className="h-7 w-16 bg-white/10 rounded" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4 h-24 flex flex-col justify-between">
          <div className="h-3 w-14 bg-white/10 rounded" />
          <div className="h-7 w-20 bg-white/10 rounded" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4 h-24 flex flex-col justify-between">
          <div className="h-3 w-10 bg-white/10 rounded" />
          <div className="h-7 w-12 bg-white/10 rounded" />
        </div>
      </div>

      {/* Streak / Consistency Card Skeleton */}
      <div className="rounded-3xl border border-white/10 bg-zinc-900/20 p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 w-32 bg-white/10 rounded" />
          <div className="h-6 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-white/5 border border-white/5" />
          ))}
        </div>
      </div>

      {/* Medals & Achievements Skeleton */}
      <div className="rounded-3xl border border-white/10 bg-zinc-900/20 p-4 space-y-3">
        <div className="flex justify-between items-center mb-2">
          <div className="space-y-1">
            <div className="h-4 w-44 bg-white/10 rounded" />
            <div className="h-3 w-32 bg-white/5 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-18 p-4 rounded-2xl border border-white/5 bg-zinc-900/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-28 bg-white/10 rounded" />
              <div className="h-3 w-48 bg-white/5 rounded" />
            </div>
          </div>
          <div className="h-18 p-4 rounded-2xl border border-white/5 bg-zinc-900/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-36 bg-white/10 rounded" />
              <div className="h-3 w-52 bg-white/5 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
