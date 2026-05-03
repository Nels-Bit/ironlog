export const STORAGE_KEYS = {
  WORKOUTS: 'ironlog_workouts',
  CUSTOM_EXERCISES: 'ironlog_custom_exercises',
  ACTIVE_WORKOUT: 'ironlog_active_draft', // For recovering data if the page refreshes
  USER_SETTINGS: 'ironlog_settings',
};

// Helper to generate unique IDs
export const generateId = () => crypto.randomUUID();