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

  const isOpen = restTimer?.isOpen ?? false;
  const isDocked = restTimer?.isDocked ?? false;
  const initialSeconds = restTimer?.duration ?? 0;
  const resetKey = restTimer?.resetKey ?? 0;

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

  if (!restTimer) return null;

  if (!isOpen) return null;

  // --- MINIMIZED DOCKED BUBBLE ---
  if (isDocked) {
    return (
      <div role="region" aria-label="Rest timer" className="fixed left-4 bottom-[var(--rest-timer-bottom)] md:bottom-6 z-40 transition-all duration-300">
        <motion.button
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={undockRestTimer}
          aria-label="Expand rest timer"
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl backdrop-blur-md active:scale-95 transition-all",
            isOvertime ? "bg-red-950/90 border border-red-500/30 text-red-400" : "bg-zinc-900/90 border border-white/10 text-brand-orange"
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

  // All four actions share one compact row; every button stays 44px on phones.
  return (
    <div role="region" aria-label="Rest timer" className="fixed bottom-[var(--rest-timer-bottom)] left-0 right-0 z-40 px-4 md:bottom-6 md:left-auto md:right-6 md:w-96 md:px-0 transition-all duration-300 ease-out">
      <div
        className={cn(
          'grid grid-cols-[44px_44px_minmax(0,1fr)_44px_44px] items-center gap-1 rounded-2xl border px-2 py-2 backdrop-blur-xl shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-10 fade-in duration-300',
          isOvertime ? 'bg-red-950/95 border-red-500/40' : 'bg-zinc-900/80 border-white/10'
        )}
      >
          <button
            onClick={dockRestTimer}
            aria-label="Minimize rest timer"
            className="btn btn-circle btn-ghost h-11 w-11 min-h-11 text-zinc-400 hover:text-white"
          >
            <Minimize2 size={18} />
          </button>
          
          <button
            onClick={() => adjustTime(-15)}
            aria-label="Subtract 15 seconds"
            className="btn btn-circle btn-ghost h-11 w-11 min-h-11 bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Minus size={20} />
          </button>

          <span
            aria-label={isOvertime ? `Overtime ${formatTime(overtime)}` : `${formatTime(timeLeft)} remaining`}
            className={cn('min-w-0 text-center font-mono text-xl font-black tabular-nums tracking-tight sm:text-2xl', isOvertime ? 'text-red-400' : 'text-white')}
          >
            {isOvertime ? '-' + formatTime(overtime) : formatTime(timeLeft)}
          </span>

          <button
            onClick={() => adjustTime(15)}
            aria-label="Add 15 seconds"
            className="btn btn-circle btn-ghost h-11 w-11 min-h-11 bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={closeRestTimer}
            aria-label="Close rest timer"
            className="btn btn-circle btn-ghost h-11 w-11 min-h-11 text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
      </div>
    </div>
  );
};
