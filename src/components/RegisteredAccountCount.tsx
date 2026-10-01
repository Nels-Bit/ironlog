import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const RegisteredAccountCount = () => {
  const [count, setCount] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const { data, error } = await supabase.rpc('registered_account_count').abortSignal(controller.signal);
        const value = typeof data === 'number' || typeof data === 'string' ? Number(data) : NaN;
        if (error || !Number.isSafeInteger(value) || value < 0) throw new Error('Count unavailable');
        if (mounted) { setCount(value); setUnavailable(false); }
      } catch {
        if (mounted) { setCount(null); setUnavailable(true); }
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return <p className="mt-6 text-center text-sm text-zinc-400" role="status">
    {unavailable ? 'Account count unavailable' : count === null ? 'Loading account count…' : `${count.toLocaleString()} registered ${count === 1 ? 'account' : 'accounts'}`}
  </p>;
};
