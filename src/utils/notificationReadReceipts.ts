import type { NotificationItem } from '../types';

export type ReadFeedback = {
  busy: boolean;
  markingAll: boolean;
  message: string;
  error: boolean;
};
export const idleReadFeedback: ReadFeedback = {busy: false, markingAll: false, message: '', error: false};

/** A visit only acknowledges loaded rows. Reads are serialized and duplicate
 * Read-all clicks share one promise, including while cached counts refresh. */
export function createNotificationReadReceipts(options: {
  write: (ids?: string[]) => Promise<void>;
  refresh: (ids?: string[]) => Promise<void>;
  onChange: (feedback: ReadFeedback) => void;
}) {
  const seen = new Set<string>(), keepUnread = new Set<string>(), pendingIds = new Set<string>();
  let tail = Promise.resolve(), all: Promise<boolean> | undefined;
  let coveredByAll = new Set<string>(), pending = 0;
  let message = '', error = false;
  let failed: {ids?: string[]} | undefined;
  const publish = () => options.onChange({busy: pending > 0, markingAll: Boolean(all), message, error});
  const run = (ids?: string[]) => {
    ids?.forEach(id => pendingIds.add(id));
    pending++;
    error = false;
    message = ids ? 'Marking viewed notifications as read…' : 'Marking all as read…';
    publish();
    const work = tail.then(async () => {
      try {
        await options.write(ids);
        await options.refresh(ids);
        failed = undefined;
        error = false;
        message = ids ? '' : 'All notifications marked as read.';
        return true;
      } catch {
        failed = {ids};
        error = true;
        message = 'Could not mark notifications as read. Please retry.';
        return false;
      } finally {
        ids?.forEach(id => pendingIds.delete(id));
        pending--;
        publish();
      }
    });
    tail = work.then(() => {});
    return work;
  };
  const readAll = () => {
    if (all) return all;
    coveredByAll = new Set(seen);
    all = run().finally(() => {
      all = undefined;
      coveredByAll.clear();
      publish();
    });
    publish();
    return all;
  };
  return {
    readAll,
    observe(items: NotificationItem[]) {
      for (const item of items) {
        if (!item.readAt && !keepUnread.has(item.id) && !pendingIds.has(item.id)) seen.add(item.id);
        else seen.delete(item.id);
      }
    },
    keepUnread(id: string) { keepUnread.add(id); seen.delete(id); },
    leave() {
      const ids = [...seen].filter(id => !coveredByAll.has(id) && !pendingIds.has(id));
      seen.clear();
      keepUnread.clear();
      return ids.length ? run(ids) : Promise.resolve(true);
    },
    retry() {
      if (pending) return tail.then(() => !error);
      return failed ? failed.ids ? run(failed.ids) : readAll() : Promise.resolve(true);
    },
  };
}
