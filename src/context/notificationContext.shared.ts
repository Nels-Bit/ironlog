import { createContext, useContext } from "react";
import type { NotificationItem } from '../types';
import { idleReadFeedback, type ReadFeedback } from '../utils/notificationReadReceipts';
type InboxState = {
  unread: number;
  userId: string;
  readFeedback: ReadFeedback;
  readAll: () => Promise<boolean>;
  retryRead: () => Promise<boolean>;
  observe: (items: NotificationItem[]) => void;
  keepUnread: (id: string) => void;
};
export const InboxContext = createContext<InboxState>({
  unread: 0, userId: 'preview', readFeedback: idleReadFeedback,
  readAll: async () => true, retryRead: async () => true,
  observe: () => {}, keepUnread: () => {},
});
export const useUnreadNotifications = () => useContext(InboxContext).unread;
export const useNotificationIdentity = () => useContext(InboxContext).userId;
export const useNotificationReadReceipts = () => useContext(InboxContext);
