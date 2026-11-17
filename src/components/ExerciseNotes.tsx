import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { NotebookPen } from 'lucide-react';
import type { Exercise } from '../types';
import { useNotificationIdentity } from '../context/notificationContext.shared';
import { getExerciseNotesAutosave } from '../services/exerciseNotesAutosave';
import { EXERCISE_NOTES_LIMIT } from '../utils/exerciseDetails';

export function ExerciseNotes({exercise}: {exercise: Exercise}) {
  const id = useId();
  const userId = useNotificationIdentity();
  const entry = useMemo(() => getExerciseNotesAutosave(exercise, userId), [exercise, userId]);
  const controller = entry.controller;
  const {value, status, error} = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const available = exercise.settingsAvailable !== false;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fitNotes = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.clientWidth === 0) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`;
  }, []);

  useLayoutEffect(() => { fitNotes(); }, [value, available, fitNotes]);
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return;
    let lastWidth = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === lastWidth) return;
      lastWidth = textarea.clientWidth;
      fitNotes();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [available, fitNotes]);

  useEffect(() => {
    entry.reconcile(exercise);
  }, [exercise, entry, controller]);

  useEffect(() => {
    if (!available) return;
    controller.start();
    const flush = () => { void controller.flush(); };
    const hide = () => { if (document.visibilityState === 'hidden') flush(); };
    const retry = () => { void controller.retry(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', hide);
      flush();
    };
  }, [available, controller]);

  return <details data-theme="dark" onToggle={event => { if (event.currentTarget.open) fitNotes(); }} className="collapse collapse-arrow mb-4 rounded-2xl border border-base-content/10 bg-base-content/[0.03]">
    <summary className="collapse-title min-h-12 py-3 pl-3 pr-10 focus-visible:outline-2 focus-visible:outline-brand-orange">
      <span className="flex items-center gap-2 sm:gap-3">
        <NotebookPen size={16} aria-hidden="true" className="shrink-0 text-brand-orange" />
        <span className="text-sm font-semibold tracking-wide text-base-content">Exercise notes</span>
        <span className="ml-auto text-xs font-normal text-base-content/50">{error ? 'Waiting to sync' : 'Private'}</span>
      </span>
    </summary>
    <div className="collapse-content px-3">
      {!available ? <p className="text-sm text-warning">Notes and starting resistance need the database update before they can be saved.</p> : <>
        <label htmlFor={id} className="sr-only">Exercise notes</label>
        <textarea ref={textareaRef} id={id} value={value} maxLength={EXERCISE_NOTES_LIMIT} rows={1}
          onChange={event => controller.update(event.target.value)} onBlur={() => void controller.flush()}
          placeholder="Seat setting, machine setup, form reminders…"
          className="textarea min-h-20 w-full min-w-0 resize-none overflow-hidden rounded-xl border-base-content/10 bg-base-100 text-base text-base-content focus:border-brand-orange focus:outline-brand-orange" />
        <div className="mt-2 flex items-center justify-between gap-3 sm:gap-4 text-xs text-base-content/50">
          <span role="status" aria-live="polite">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'pending' ? 'Saving soon…' : status === 'error' ? 'Waiting to sync' : 'Saves automatically'}</span>
          <span>{value.length}/{EXERCISE_NOTES_LIMIT}</span>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-error">{error} Your draft is kept on this device. Reconnecting or reopening notes retries the save.</p>}
      </>}
    </div>
  </details>;
}
