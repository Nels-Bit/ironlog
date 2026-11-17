/** Download checks never block rendering. Activation/reload wait for a safe screen. */
export function createAppUpdates(options: {
  check: () => Promise<unknown>;
  activate: () => Promise<unknown>;
  reload: () => void;
  canApply: () => boolean;
  now?: () => number;
}) {
  let lastCheck = -Infinity, checking: Promise<void> | undefined;
  let ready = false, activating = false, reloadPending = false, reloaded = false;
  const now = options.now ?? Date.now;
  const apply = () => {
    if (reloaded || !options.canApply()) return;
    if (reloadPending) { reloaded = true; options.reload(); return; }
    if (!ready || activating) return;
    activating = true;
    void options.activate().catch(() => { activating = false; });
  };
  return {
    check(force = false) {
      if (checking) return checking;
      if (!force && now() - lastCheck < 60_000) { apply(); return Promise.resolve(); }
      lastCheck = now();
      checking = Promise.resolve().then(options.check).then(() => {}).catch(() => {}).finally(() => { checking = undefined; apply(); });
      return checking;
    },
    available() { ready = true; apply(); },
    activated() { reloadPending = true; apply(); },
    apply,
  };
}
