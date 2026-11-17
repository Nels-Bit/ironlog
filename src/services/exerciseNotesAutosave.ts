import type { Exercise } from '../types';
import { appStorage } from '../lib/demo-session';
import { createNotesAutosave } from '../utils/notesAutosave';
import { exerciseService } from './exerciseService';

type Entry = { controller: ReturnType<typeof createNotesAutosave>; reconcile: (exercise: Exercise) => void };
// One queue per account/exercise survives navigation and duplicate workout instances.
const queues = new Map<string, Entry>();
export const hasPendingExerciseNotes = () => [...queues.values()].some(({controller}) =>
  !['idle','saved'].includes(controller.getSnapshot().status));

export function getExerciseNotesAutosave(exercise: Exercise, userId: string) {
  const key = `ironlog:exercise-notes:v1:${userId}:${exercise.id}`;
  const existing = typeof window === 'undefined' ? undefined : queues.get(key);
  if (existing) return existing;
  const stored = appStorage.getItem(key);
  let current = exercise;
  const controller = createNotesAutosave({
      saved:exercise.notes ?? '', draft:stored,
      storeDraft:value => appStorage.setItem(key, value),
      clearDraft:() => appStorage.removeItem(key),
      save:notes => exerciseService.savePersonalSettings(current, {notes}, userId),
  });
  const entry: Entry = {
    controller,
    reconcile(updated) { current = updated; controller.reconcile(updated.notes ?? ''); },
  };
  if (typeof window !== 'undefined') queues.set(key, entry);
  return entry;
}
