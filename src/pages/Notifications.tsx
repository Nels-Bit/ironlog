import { useEffect, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { socialService } from '../services/socialService';
import type { NotificationItem } from '../types';

export const Notifications = () => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await socialService.getNotifications();
      setNotifications(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await socialService.markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((item) => item.id === notificationId ? { ...item, readAt: Date.now() } : item)
      );
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Failed to update notification.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await socialService.markAllNotificationsAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })));
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Failed to update notifications.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-orange" />
      </div>
    );
  }

  const unreadCount = notifications.filter((item) => item.readAt === null).length;

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-black italic text-white tracking-tighter">
            NOTIFICATION<span className="text-brand-orange"> CENTER</span>
          </h1>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
        )}
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-iron-950 p-10 text-center">
            <Bell className="mx-auto text-zinc-500 mb-3" />
            <p className="text-zinc-400">No notifications yet.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-2xl border p-4 ${notification.readAt ? 'border-white/10 bg-iron-950/70' : 'border-brand-orange/30 bg-brand-orange/10'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{notification.message}</p>
                  {notification.actor && (
                    <p className="text-xs text-zinc-500 mt-1">from @{notification.actor.userId}</p>
                  )}
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-2">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.readAt && (
                  <Button size="sm" variant="ghost" onClick={() => handleMarkRead(notification.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
