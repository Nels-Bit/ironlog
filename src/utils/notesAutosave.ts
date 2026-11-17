import { EXERCISE_NOTES_LIMIT } from './exerciseDetails';

type Status = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export type NotesSnapshot = { value: string; status: Status; error: string };

/** Serial saves keep slow responses from overwriting newer typing or cleared notes. */
export function createNotesAutosave(options: {
  saved: string;
  draft: string | null;
  save: (value: string) => Promise<unknown>;
  storeDraft: (value: string) => void;
  clearDraft: () => void;
}) {
  let acknowledged = options.saved;
  let snapshot: NotesSnapshot = {
    value: options.draft ?? options.saved,
    status: options.draft != null && options.draft !== options.saved ? 'pending' : 'idle', error: '',
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let flushAfterSave = false;
  let failures = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<NotesSnapshot>) => {
    snapshot = {...snapshot, ...patch};
    listeners.forEach(listener => listener());
  };
  const schedule = (delay = 700) => {
    clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, delay);
  };
  const flush = (): Promise<void> => {
    clearTimeout(timer);
    if (inFlight) { flushAfterSave = true; return inFlight; }
    if (snapshot.value === acknowledged) {
      options.clearDraft();
      if (snapshot.status === 'pending') publish({status:'saved', error:''});
      return Promise.resolve();
    }
    const value = snapshot.value;
    publish({status:'saving', error:''});
    inFlight = (async () => {
      try {
        await options.save(value);
        acknowledged = value;
        failures = 0;
        if (snapshot.value === value) {
          options.clearDraft();
          publish({status:'saved', error:''});
        } else publish({status:'pending'});
      } catch (error) {
        failures++;
        publish({status:'error', error:error instanceof Error ? error.message : 'Could not sync notes.'});
      } finally {
        inFlight = undefined;
        if (snapshot.value !== acknowledged && failures < 3)
          schedule(failures ? 5000 : flushAfterSave ? 0 : 700);
        flushAfterSave = false;
      }
    })();
    return inFlight;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(value: string) {
      value = value.slice(0, EXERCISE_NOTES_LIMIT);
      if (value === snapshot.value) return;
      options.storeDraft(value);
      failures = 0;
      publish({value, status:'pending', error:''});
      schedule();
    },
    reconcile(saved: string) {
      // An acknowledgement for older text must never replace an unsaved edit.
      if (inFlight || snapshot.value !== acknowledged || saved === acknowledged) return;
      acknowledged = saved;
      publish({value:saved, status:'idle', error:''});
    },
    start() { if (snapshot.value !== acknowledged) schedule(); },
    retry() { failures = 0; return flush(); },
    flush,
  };
}
