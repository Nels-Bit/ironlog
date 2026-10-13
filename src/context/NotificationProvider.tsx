import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationService,
  NOTIFICATION_CHANGED,
} from "../services/notificationService";
import { InboxContext } from "./notificationContext.shared";
import { pushService } from "../services/pushService";
export const NotificationProvider = ({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) => {
  const client = useQueryClient();
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
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
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
    <InboxContext.Provider value={{ unread: count.data || 0, userId }}>
      {children}
    </InboxContext.Provider>
  );
};
