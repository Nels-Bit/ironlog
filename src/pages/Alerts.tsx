import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Loader2, Trophy, Zap, CheckCircle, UserPlus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { socialService } from '../services/socialService';
import type { NotificationItem } from '../types';
import { cn } from '../lib/utils';

export const Alerts = () => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await socialService.getNotifications();
        setNotifications(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load alerts.');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, []);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await socialService.markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((item) => item.id === notificationId ? { ...item, readAt: Date.now() } : item)
      );
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Failed to update alert.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await socialService.markAllNotificationsAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })));
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Failed to update alerts.');
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

  const renderAlertIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'achievement_unlocked':
        return <Trophy size={18} className="text-orange-500" />;
      case 'workout_completed':
        return <Zap size={18} className="text-yellow-400" />;
      case 'friend_request_accepted':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'friend_request':
        return <UserPlus size={18} className="text-blue-400" />;
      default:
        return <Bell size={18} className="text-zinc-400" />;
    }
  };

  const renderAlertContent = (notification: NotificationItem) => {
    const friendId = notification.payload?.userId || notification.actor?.userId;

    if (notification.type === 'achievement_unlocked' && notification.payload?.achievementName) {
      const name = notification.actor?.name || 'A friend';
      return (
        <div className="flex-1 min-w-0 text-sm">
          <p className="text-white mb-1">
            <Link to={`/friends/${friendId}`} className="font-bold hover:underline">{name}</Link> just earned:
          </p>
          <span className="inline-block text-orange-500 font-bold bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md text-xs">
            {String(notification.payload.achievementName)}
          </span>
        </div>
      );
    }

    if (notification.type === 'workout_completed' && notification.payload) {
      const name = notification.actor?.name || 'A friend';
      return (
        <div className="flex-1 min-w-0 text-sm">
          <p className="text-zinc-300">
            <Link to={`/friends/${friendId}`} className="font-bold text-white hover:underline">{name}</Link> just finished a workout and is <span className="font-bold text-yellow-400">{String(notification.payload.remainingXP)} XP</span> away from Level {String(notification.payload.nextLevel)}
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 min-w-0 text-sm text-zinc-300">
        <p>
          {friendId && notification.actor ? (
            <Link to={`/friends/${friendId}`} className="font-bold text-white hover:underline">{notification.actor.name}</Link>
          ) : null}
          {friendId && notification.actor ? notification.message.replace(notification.actor.name, '') : notification.message}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-black italic text-white tracking-tighter">
            ACTIVITY<span className="text-brand-orange"> ALERTS</span>
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
            <p className="text-zinc-400">No alerts yet.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "rounded-2xl border p-4 transition-colors",
                notification.readAt ? 'border-white/5 bg-iron-950/40' : 'border-brand-orange/30 bg-brand-orange/10'
              )}
            >
              <div className="flex gap-4">
                <div className="shrink-0 mt-0.5">
                  {renderAlertIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  {renderAlertContent(notification)}
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-2">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>

                {!notification.readAt && (
                  <Button size="sm" variant="ghost" className="shrink-0 h-8 self-center" onClick={() => handleMarkRead(notification.id)}>
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
