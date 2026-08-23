import { useEffect, useReducer, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Plus, Minus, Timer, Minimize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { useWorkout } from '../context/useWorkout';

interface RestTimerState {
  timeLeft: number;
  endTime: number | null;
  overtime: number;
  isOvertime: boolean;
}

type RestTimerAction =
  | { type: 'initialize'; initialSeconds: number }
  | { type: 'tick'; now: number }
  | { type: 'adjust'; seconds: number };

const createTimerState = (initialSeconds: number): RestTimerState => ({
  timeLeft: initialSeconds,
  endTime: Date.now() + initialSeconds * 1000,
  overtime: 0,
  isOvertime: false,
});

const restTimerReducer = (state: RestTimerState, action: RestTimerAction): RestTimerState => {
  switch (action.type) {
    case 'initialize':
      return createTimerState(action.initialSeconds);
    case 'tick': {
      if (!state.endTime) return state;
      const remaining = Math.ceil((state.endTime - action.now) / 1000);
      if (remaining > 0) {
        return {
          ...state,
          timeLeft: remaining,
          isOvertime: false,
          overtime: 0,
        };
      } else {
        const overtimeElapsed = Math.floor((action.now - state.endTime) / 1000);
        return {
          ...state,
          timeLeft: 0,
          isOvertime: true,
          overtime: overtimeElapsed,
        };
      }
    }
    case 'adjust': {
      if (state.isOvertime) {
        const newDuration = Math.max(15, action.seconds);
        return {
          timeLeft: newDuration,
          endTime: Date.now() + newDuration * 1000,
          overtime: 0,
          isOvertime: false,
        };
      }
      const newEndTime = state.endTime ? state.endTime + action.seconds * 1000 : Date.now() + action.seconds * 1000;
      return {
        ...state,
        endTime: newEndTime,
        timeLeft: Math.max(0, state.timeLeft + action.seconds),
      };
    }
  }
};

export const RestTimer = () => {
  const location = useLocation();
  const { restTimer, closeRestTimer, dockRestTimer, undockRestTimer, updateRestTimerPref } = useWorkout();

  if (!restTimer) return null;
  const { isOpen, isDocked, duration: initialSeconds, resetKey, type } = restTimer;

  const [timerState, dispatch] = useReducer(restTimerReducer, initialSeconds, createTimerState);
  const { timeLeft, endTime, overtime, isOvertime } = timerState;

  const prevPathRef = useRef(location.pathname);

  // 0. Auto-minimize on navigation away from Workout Logger
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      if (location.pathname !== '/workout' && isOpen && !isDocked) {
        dockRestTimer();
      }
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, isOpen, isDocked, dockRestTimer]);

  // 1. Initialize timestamp when timer opens/resets
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'initialize', initialSeconds });
    }
  }, [isOpen, resetKey, initialSeconds]);

  // 2. Countdown + Overtime logic (immune to browser backgrounding)
  useEffect(() => {
    if (!isOpen || !endTime) return;

    const interval = setInterval(() => {
      dispatch({ type: 'tick', now: Date.now() });
    }, 500); // 500ms ticks for snappier overtime response

    return () => clearInterval(interval);
  }, [isOpen, endTime]);

  // 3. Adjust time
  const adjustTime = (seconds: number) => {
    dispatch({ type: 'adjust', seconds });
    if (isOvertime) {
      updateRestTimerPref(Math.max(15, seconds));
    } else {
      updateRestTimerPref(initialSeconds + seconds);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return "" + m + ":" + s.toString().padStart(2, '0');
  };

  if (!isOpen) return null;

  const progressPct = isOvertime ? 0 : Math.min(100, (timeLeft / initialSeconds) * 100);

  // --- MINIMIZED DOCKED BUBBLE ---
  if (isDocked) {
    return (
      <div className="fixed left-0 bottom-28 md:bottom-6 z-[90] transition-all duration-300">
        <motion.button
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={undockRestTimer}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-r-full shadow-2xl backdrop-blur-md active:scale-95 transition-all",
            isOvertime ? "bg-red-950/90 border-y border-r border-red-500/30 text-red-400" : "bg-zinc-900/90 border-y border-r border-white/10 text-brand-orange"
          )}
        >
          <Timer size={18} className={cn(isOvertime && "animate-pulse")} />
          <span className="font-mono font-bold text-lg tabular-nums">
            {isOvertime ? "-" + formatTime(overtime) : formatTime(timeLeft)}
          </span>
        </motion.button>
      </div>
    );
  }

  // --- FULL REST TIMER ---
  return (
    <div className="fixed left-4 right-4 z-[90] bottom-28 md:bottom-6 md:left-auto md:right-6 md:w-96 transition-all duration-300 ease-out">
      <div
        className={cn(
          'backdrop-blur-xl border rounded-3xl p-5 shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-10 fade-in duration-300',
          isOvertime ? 'bg-red-950/95 border-red-500/40' : 'bg-zinc-900/80 border-white/10'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 w-full px-2">
          {/* Minimize / Hide (Left) */}
          <button
            onClick={dockRestTimer}
            className="btn btn-circle btn-ghost btn-sm text-zinc-400 hover:text-white"
          >
            <Minimize2 size={18} />
          </button>
          
          {/* Label (Center) */}
          <div className={cn('flex items-center gap-2', isOvertime ? 'text-red-400' : 'text-brand-orange')}>
            <Timer size={18} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest badge badge-ghost border-white/10 opacity-80">
              {isOvertime ? 'Overtime' : type + ' Rest'}
            </span>
          </div>

          {/* Close / X (Right) */}
          <button
            onClick={closeRestTimer}
            className="btn btn-circle btn-ghost btn-sm text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Time display + controls */}
        <div className="flex items-center justify-between gap-4 mt-2">
          <button
            onClick={() => adjustTime(-15)}
            className="btn btn-circle btn-ghost bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Minus size={20} />
          </button>

          <div className="flex-1 text-center">
            {isOvertime ? (
              <span className="text-5xl font-black tabular-nums tracking-tight text-red-400 animate-pulse">
                -{formatTime(overtime)}
              </span>
            ) : (
              <span className="text-5xl font-black text-white tabular-nums tracking-tight">
                {formatTime(timeLeft)}
              </span>
            )}
          </div>

          <button
            onClick={() => adjustTime(15)}
            className="btn btn-circle btn-ghost bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-black/40 rounded-full mt-6 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000 ease-linear',
              isOvertime ? 'w-full bg-red-500 animate-pulse' : 'bg-brand-orange'
            )}
            style={isOvertime ? undefined : { width: progressPct + '%' }}
          />
        </div>
      </div>
    </div>
  );
};
