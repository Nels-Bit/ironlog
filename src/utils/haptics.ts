// Lightweight haptics wrapper with safe fallbacks

export type HapticType = 'light' | 'medium' | 'success';

const supportsVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function';

export const haptics = {
  vibrate: (pattern: number | number[]) => {
    if (supportsVibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore vibration errors
      }
    }
  },

  light: () => {
    // short tap
    haptics.vibrate(10);
  },

  medium: () => {
    // slightly stronger
    haptics.vibrate(25);
  },

  success: () => {
    // success pattern
    haptics.vibrate([30, 50, 30]);
  },

  // Safe helper to call by name
  trigger: (type: HapticType) => {
    switch (type) {
      case 'light': return haptics.light();
      case 'medium': return haptics.medium();
      case 'success': return haptics.success();
      default: return;
    }
  }
};
