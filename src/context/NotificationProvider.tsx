import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useLocation } from 'react-router-dom';
import {
  notificationService,
  NOTIFICATION_CHANGED,
} from "../services/notificationService";
import { InboxContext } from "./notificationContext.shared";
import { pushService } from "../services/pushService";
import { deviceTimezone } from "../utils/notifications";
import { createNotificationReadReceipts, idleReadFeedback } from '../utils/notificationReadReceipts';
export const NotificationProvider = ({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) => {
  const client = useQueryClient();
  const {pathname} = useLocation();
  const previousPath = useRef(pathname);
  const [readFeedback, setReadFeedback] = useState(idleReadFeedback);
  const receipts = useMemo(() => createNotificationReadReceipts({
    write: ids => notificationService.markRead(ids, userId),
    refresh: async ids => {
      const key = ['notification-inbox', userId];
      await client.cancelQueries({queryKey: key});
      const readAt = Date.now(), selected = ids ? new Set(ids) : undefined;
      type Pages = InfiniteData<Awaited<ReturnType<typeof notificationService.page>>>;
      for (const [queryKey, data] of client.getQueriesData<Pages>({queryKey: key})) {
        if (!data) continue;
        client.setQueryData(queryKey, {...data, pages: data.pages.map(page => ({
          ...page, items: page.items.map(item => !item.readAt && (!selected || selected.has(item.id))
            ? {...item, readAt} : item).filter(item => queryKey[2] !== 'unread' || !item.readAt),
        }))});
      }
      if (!ids) client.setQueryData(['notification-count', userId], 0);
      await Promise.all([
        client.invalidateQueries({queryKey: key}),
        client.invalidateQueries({queryKey: ['notification-count', userId]}),
      ]);
    },
    onChange: setReadFeedback,
  }), [client, userId]);
  useEffect(() => {
    const leaving = previousPath.current === '/alerts' && pathname !== '/alerts';
    previousPath.current = pathname;
    if (leaving) void receipts.leave();
  }, [pathname, receipts]);
  useEffect(() => {
    if (pathname !== '/alerts') return;
    const onHidden = () => { if (document.visibilityState === 'hidden') void receipts.leave(); };
    const onPageHide = () => { void receipts.leave(); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [pathname, receipts]);
  const count = useQuery({
    queryKey: ["notification-count", userId],
    queryFn: notificationService.count,
    staleTime: 15_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    gcTime: 0,
  });
  useEffect(() => {
    let stop: (() => void) | undefined,
      disposed = false;
    let lastZone = "", syncingZone = false;
    const syncTimezone = async () => {
      const zone = deviceTimezone();
      if (disposed || document.visibilityState !== "visible" || syncingZone || lastZone === zone) return;
      syncingZone = true;
      try {
        await notificationService.syncDeviceTimezone();
        if (!disposed) lastZone = zone;
      } catch { /* Retried on resume/next check; never block workout logging. */ }
      finally { syncingZone = false; }
    };
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["notification-count"] });
      void client.invalidateQueries({ queryKey: ["notification-inbox"] });
      void client.invalidateQueries({ queryKey: ["notification-preferences"] });
    };
    const onSubscriptionChange = (event: MessageEvent) => {
      if (event.data?.type === "ironlog-push-subscription-changed") {
        void pushService.reconcile().catch(() => {});
        void client.invalidateQueries({ queryKey: ["device-push-status"] });
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSubscriptionChange);
    window.addEventListener(NOTIFICATION_CHANGED, refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        lastZone = ""; // Most recently active device determines account reminders.
        void syncTimezone();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void syncTimezone();
    const zoneTimer = window.setInterval(() => void syncTimezone(), 60_000);
    void notificationService
      .subscribe(refresh)
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else stop = unsubscribe;
      })
      .catch(() => {
        /* Visible/periodic reads remain a fallback. */
      });
    // Renew an existing subscription only. Never request permission on startup.
    void pushService.reconcile().catch(() => {
      /* Settings provides an explicit repair action. */
    });
    return () => {
      disposed = true;
      window.clearInterval(zoneTimer);
      stop?.();
      window.removeEventListener(NOTIFICATION_CHANGED, refresh);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener(
        "message",
        onSubscriptionChange,
      );
    };
  }, [client, userId]);
  return (
    <InboxContext.Provider value={{ unread: count.data || 0, userId, readFeedback,
      readAll: receipts.readAll, retryRead: receipts.retry,
      observe: receipts.observe, keepUnread: receipts.keepUnread }}>
      {children}
      {readFeedback.error && pathname !== '/alerts' && <div
        role="alert" className="alert fixed bottom-[var(--rest-timer-bottom)] left-4 right-4 z-[120] w-auto border-error/30 bg-iron-950 text-sm text-error md:left-72">
        <span>{readFeedback.message}</span>
        <button className="btn btn-ghost min-h-11" disabled={readFeedback.busy}
          onClick={() => void receipts.retry()}>Retry</button>
      </div>}
    </InboxContext.Provider>
  );
};
