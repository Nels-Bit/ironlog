import { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Timer } from 'lucide-react';
import { cn } from '../lib/utils';

interface RestTimerProps {
  initialSeconds: number;
  isOpen: boolean;
  resetKey: number;
  onClose: () => void;
  onUpdateDefault: (newSeconds: number) => void;
  /** When true, hides the timer behind the exercise picker overlay */
  isSelectorOpen?: boolean;
}

export const RestTimer = ({
  initialSeconds,
  isOpen,
  resetKey,
  onClose,
  onUpdateDefault,
  isSelectorOpen = false,
}: RestTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [overtime, setOvertime] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const overtimeStartRef = useRef<number | null>(null);

  // 1. Initialize timestamp when timer opens/resets
  useEffect(() => {
    if (isOpen) {
      setEndTime(Date.now() + initialSeconds * 1000);
      setTimeLeft(initialSeconds);
      setOvertime(0);
      setIsOvertime(false);
      overtimeStartRef.current = null;
    }
  }, [isOpen, resetKey]); // Deliberately ignoring initialSeconds so it doesn't restart when defaults change

  // 2. Countdown + Overtime logic (immune to browser backgrounding)
  useEffect(() => {
    if (!isOpen || !endTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.ceil((endTime - now) / 1000);

      if (remaining > 0) {
        setTimeLeft(remaining);
        setIsOvertime(false);
        overtimeStartRef.current = null;
      } else {
        setTimeLeft(0);
        setIsOvertime(true);
        if (!overtimeStartRef.current) {
          overtimeStartRef.current = now;
        }
        const elapsed = Math.floor((now - overtimeStartRef.current) / 1000);
        setOvertime(elapsed);
      }
    }, 500); // 500ms ticks for snappier overtime response

    return () => clearInterval(interval);
  }, [isOpen, endTime]);

  // 3. Adjust time ±15s
  const adjustTime = (seconds: number) => {
    if (isOvertime) {
      // In overtime: +15 resets the timer to 15s of positive time
      const newDuration = Math.max(15, seconds);
      setEndTime(Date.now() + newDuration * 1000);
      setTimeLeft(newDuration);
      setIsOvertime(false);
      setOvertime(0);
      overtimeStartRef.current = null;
      onUpdateDefault(newDuration);
    } else {
      setEndTime(prev => (prev ? prev + seconds * 1000 : Date.now() + seconds * 1000));
      setTimeLeft(prev => Math.max(0, prev + seconds));
      onUpdateDefault(initialSeconds + seconds);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const progressPct = isOvertime ? 0 : Math.min(100, (timeLeft / initialSeconds) * 100);

  return (
    <div
      className={cn(
        'fixed left-4 right-4 z-[150] transition-all duration-300 ease-out',
        // bottom-28 on mobile clears the ~96px bottom nav bar with extra breathing room
        'bottom-28 md:bottom-6 md:left-auto md:right-6 md:w-96',
        // Hide behind exercise selector (keep mounted to preserve timer state)
        isSelectorOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      )}
    >
      <div
        className={cn(
          'backdrop-blur-xl border rounded-2xl p-4 shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-10 fade-in duration-300',
          isOvertime
            ? 'bg-red-950/95 border-red-500/40'
            : 'bg-iron-950/95 border-white/10'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className={cn('flex items-center gap-2', isOvertime ? 'text-red-400' : 'text-brand-orange')}>
            <Timer size={18} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {isOvertime ? 'Overtime' : 'Rest Timer'}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Time display + controls */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => adjustTime(-15)}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white active:scale-95 transition-all border border-white/5"
          >
            <div className="flex flex-col items-center leading-none">
              <Minus size={16} />
              <span className="text-[9px] font-bold mt-0.5">15s</span>
            </div>
          </button>

          <div className="flex-1 text-center">
            {isOvertime ? (
              <span className="text-4xl font-black tabular-nums tracking-tight text-red-400 animate-pulse">
                -{formatTime(overtime)}
              </span>
            ) : (
              <span className="text-4xl font-black text-white tabular-nums tracking-tight">
                {formatTime(timeLeft)}
              </span>
            )}
          </div>

          <button
            onClick={() => adjustTime(15)}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white active:scale-95 transition-all border border-white/5"
          >
            <div className="flex flex-col items-center leading-none">
              <Plus size={16} />
              <span className="text-[9px] font-bold mt-0.5">15s</span>
            </div>
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000 ease-linear',
              isOvertime ? 'w-full bg-red-500 animate-pulse' : 'bg-brand-orange'
            )}
            style={isOvertime ? undefined : { width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};