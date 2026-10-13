const DEMO_KEY = 'ironlog-demo-v1';
let activeDemo = false;
export function isDemoSession() {
  if (typeof window === 'undefined') return false;
  if (activeDemo) return true;
  if (window.location.pathname === '/demo') { activeDemo = true; return true; }
  try { activeDemo = sessionStorage.getItem(DEMO_KEY) === '1'; return activeDemo; } catch { return false; }
}
export function startDemo() {
  try { sessionStorage.setItem(DEMO_KEY, '1'); } catch { /* The direct URL still works. */ }
  window.location.assign('/demo');
}
export function rememberDemo() { try { sessionStorage.setItem(DEMO_KEY, '1'); } catch { /* Memory-only still works. */ } }
export function exitDemo(signup = false) {
  try { sessionStorage.removeItem(DEMO_KEY); } catch { /* No marker. */ }
  window.location.replace(signup ? '/?signup=1' : '/');
}

// Real profile caches, workout drafts and timer preferences must never be read or
// overwritten by the demo. Only the session-mode marker survives a refresh.
const temporary = new Map<string, string>();
export const appStorage = {
  getItem(key: string) { if (isDemoSession()) return temporary.get(key) ?? null; try { return localStorage.getItem(key); } catch { return null; } },
  setItem(key: string, value: string) { if (isDemoSession()) { temporary.set(key, value); return; } try { localStorage.setItem(key, value); } catch { /* Unavailable device storage. */ } },
  removeItem(key: string) { if (isDemoSession()) { temporary.delete(key); return; } try { localStorage.removeItem(key); } catch { /* Unavailable device storage. */ } },
};
