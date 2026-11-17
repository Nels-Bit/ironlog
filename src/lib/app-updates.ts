import { appStorage, isDemoSession } from './demo-session';
import { hasPendingExerciseNotes } from '../services/exerciseNotesAutosave';
import { createAppUpdates } from '../utils/appUpdates';

const UPDATE_CHECK = 'ironlog:update-check';
export function checkAppUpdate(afterSignIn = false) {
  window.dispatchEvent(new CustomEvent(UPDATE_CHECK, {detail:afterSignIn}));
}

export function startAppUpdates() {
  if (!import.meta.env.PROD || isDemoSession() || !('serviceWorker' in navigator)) return;
  const start = async () => {
    const {registerSW} = await import('virtual:pwa-register');
    let registration: ServiceWorkerRegistration | undefined;
    let lastInput = -Infinity;
    const safe = () => document.visibilityState === 'visible' && Date.now() - lastInput >= 2000
      && !appStorage.getItem('current_workout') && !hasPendingExerciseNotes()
      && !/^\/(workout|history\/|summary)/.test(window.location.pathname)
      && !document.querySelector('[role="dialog"]')
      && !Array.from(document.querySelectorAll('input,textarea,select,[contenteditable="true"]'))
        .some(element => element.getClientRects().length > 0);
    const manager = createAppUpdates({
      canApply:safe,
      check:async () => { if (navigator.onLine && document.visibilityState === 'visible') await registration?.update(); },
      activate:async () => { await updateWorker(); },
      reload:() => window.location.reload(),
    });
    const updateWorker = registerSW({
      immediate:true,
      onNeedRefresh:() => manager.available(),
      onNeedReload:() => manager.activated(),
      onRegisteredSW:(_url, value) => { registration = value; void manager.check(true); },
      // Network/install failures must not stop sign-in or workout logging.
      onRegisterError:() => {},
    });
    window.addEventListener(UPDATE_CHECK, event => { void manager.check(Boolean((event as CustomEvent).detail)); });
    const resumed = () => { void manager.check(); };
    window.addEventListener('online', () => { void manager.check(true); });
    document.addEventListener('visibilitychange', resumed);
    window.addEventListener('focus', resumed);
    const activity = () => { lastInput = Date.now(); };
    window.addEventListener('pointerdown', activity, {passive:true});
    window.addEventListener('keydown', activity);
    setInterval(() => { void manager.check(); }, 15 * 60_000);
    setInterval(() => manager.apply(), 5000);
  };
  const launch = () => { void start().catch(() => {}); };
  if (document.readyState === 'complete') launch();
  else window.addEventListener('load', launch, {once:true});
}
