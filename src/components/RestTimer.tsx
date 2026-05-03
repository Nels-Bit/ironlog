import { useState, useEffect } from 'react';
import { X, Plus, Minus, Timer } from 'lucide-react';
import { cn } from '../lib/utils';

interface RestTimerProps {
  initialSeconds: number;
  isOpen: boolean;
  resetKey: number;
  onClose: () => void;
  onUpdateDefault: (newSeconds: number) => void;
}

export const RestTimer = ({ initialSeconds, isOpen, resetKey, onClose, onUpdateDefault }: RestTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // 1. Initialize the Timestamp when timer opens/resets
  useEffect(() => {
    if (isOpen) {
      setEndTime(Date.now() + initialSeconds * 1000);
      setTimeLeft(initialSeconds);
      setIsMinimized(false);
    }
  }, [isOpen, resetKey]); // Deliberately ignoring initialSeconds so it doesn't restart when defaults change

  // 2. Countdown Logic (Immune to browser backgrounding!)
  useEffect(() => {
    if (!isOpen || !endTime) return;

    const interval = setInterval(() => {
      // Calculate exactly how much time is left based on the clock, not the interval ticks
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, endTime]);

  // 3. Adjust Time Logic
  const adjustTime = (seconds: number) => {
    // Push the future end-time further out (or bring it closer)
    setEndTime(prev => prev ? prev + (seconds * 1000) : Date.now() + (seconds * 1000));
    setTimeLeft(prev => Math.max(0, prev + seconds));
    
    // Save this as the new permanent default
    onUpdateDefault(initialSeconds + seconds);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed left-4 right-4 z-[200] transition-all duration-300 ease-out",
      "bottom-6 md:bottom-6 md:left-auto md:right-6 md:w-96", 
      isMinimized ? "translate-y-[calc(100%+20px)]" : "translate-y-0"
    )}>
      <div className="bg-iron-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-brand-orange">
            <Timer size={18} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest">Rest Timer</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

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
            <span className="text-4xl font-black text-white tabular-nums tracking-tight">
              {formatTime(timeLeft)}
            </span>
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
        
        <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
          <div 
            className="h-full bg-brand-orange transition-all duration-1000 ease-linear"
            style={{ width: `${Math.min(100, (timeLeft / initialSeconds) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};