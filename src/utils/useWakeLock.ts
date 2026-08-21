import { useEffect, useRef } from 'react';

/**
 * useWakeLock
 * Requests a screen wake lock while `enabled` is true. Auto-reacquires when the document becomes visible again.
 * No-ops gracefully on browsers that don't support the API.
 */
export const useWakeLock = (enabled: boolean) => {
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let mounted = true;
    const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

    const requestLock = async () => {
      if (!isSupported || !enabled) return;
      try {
        wakeRef.current = await navigator.wakeLock.request('screen');
        // When released by the UA, clear reference
        wakeRef.current?.addEventListener?.('release', () => {
          wakeRef.current = null;
        });
      } catch {
        // Ignore request failures (user agent restrictions, cross-origin, etc.)
        wakeRef.current = null;
      }
    };

    const releaseLock = async () => {
      try {
        await wakeRef.current?.release();
      } catch {
        // ignore
      }
      wakeRef.current = null;
    };

    const handleVisibility = async () => {
      if (!mounted) return;
      if (document.visibilityState === 'visible' && enabled) {
        await requestLock();
      }
    };

    if (enabled && isSupported) {
      requestLock();
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      // best-effort release
      releaseLock();
    };
  }, [enabled]);
};
