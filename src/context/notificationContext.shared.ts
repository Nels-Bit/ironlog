import { createContext, useContext } from "react";
export const InboxContext = createContext({ unread: 0, userId: "preview" });
export const useUnreadNotifications = () => useContext(InboxContext).unread;
export const useNotificationIdentity = () => useContext(InboxContext).userId;
