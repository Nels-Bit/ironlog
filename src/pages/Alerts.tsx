import { useEffect, useState } from 'react';
import { Bell, Loader2, Trophy, Zap, CheckCircle, UserPlus } from 'lucide-react';
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
        <Loader2 className="animate-spin text-white" />
      </div>
    );
  }

  const unreadCount = notifications.filter((item) => item.readAt === null).length;

  const renderAlertIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'achievement_unlocked':
        return <Trophy size={18} className="text-yellow-500" />;
      case 'workout_completed':
        return <Zap size={18} className="text-orange-500" />;
      case 'friend_request_accepted':
        return <CheckCircle size={18} className="text-emerald-500" />;
      case 'friend_request':
        return <UserPlus size={18} className="text-blue-400" />;
      default:
        return <Bell size={18} className="text-neutral-400" />;
    }
  };

  const renderAlertContent = (notification: NotificationItem, isRead: boolean) => {
    const name = notification.actor?.name || 'A friend';
    
    const nameColor = isRead ? "text-neutral-400" : "text-white";
    const eventColor = isRead ? "text-neutral-500" : "text-neutral-300";
    const highlightColor = isRead ? "text-neutral-400" : "text-white";

    const friendNameEl = <span className={`font-bold ${nameColor}`}>{name}</span>;

    if (notification.type === 'achievement_unlocked') {
      const achName = notification.payload?.achievementName || 'a trophy';
      return (
        <p className={`text-sm ${eventColor} leading-snug`}>
          {friendNameEl} unlocked the <span className={`font-medium ${highlightColor}`}>{String(achName)}</span>
        </p>
      );
    }

    if (notification.type === 'workout_completed') {
      const workoutName = notification.payload?.workoutName || 'a workout';
      return (
        <p className={`text-sm ${eventColor} leading-snug`}>
          {friendNameEl} logged: <span className={`font-medium ${highlightColor}`}>{String(workoutName)}</span>
        </p>
      );
    }

    if (notification.type === 'friend_request') {
      return (
        <p className={`text-sm ${eventColor} leading-snug`}>
          {friendNameEl} sent you a friend request.
        </p>
      );
    }

    if (notification.type === 'friend_request_accepted') {
      return (
        <p className={`text-sm ${eventColor} leading-snug`}>
          {friendNameEl} is now your friend.
        </p>
      );
    }

    return (
      <p className={`text-sm ${eventColor} leading-snug`}>
        {friendNameEl} {notification.message.replace(name, '').trim()}
      </p>
    );
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      <header className="flex justify-between items-center px-4 py-3 border-b border-white/10 sticky top-0 z-50 bg-black/80 backdrop-blur-md">
        <h1 className="text-xl font-bold text-white tracking-tight">Alerts</h1>
        <div className="flex gap-2 items-center">
          <button
            className="btn btn-ghost btn-xs text-white hover:bg-white/10 font-semibold tracking-wide disabled:opacity-50 disabled:bg-transparent"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="m-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
        
        {notifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="mx-auto text-zinc-500 mb-3" />
            <p className="text-zinc-400">No alerts yet.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification) => {
              const isRead = Boolean(notification.readAt);
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 px-4 py-4 border-b border-white/5 items-center cursor-default",
                    !isRead ? 'bg-neutral-800' : 'bg-neutral-950/40 opacity-60'
                  )}
                >
                  <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 object-cover overflow-hidden">
                    {renderAlertIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {renderAlertContent(notification, isRead)}
                  </div>

                  <div className="shrink-0 ml-2">
                    <p className={cn("text-xs", !isRead ? "text-neutral-300" : "text-neutral-500")}>
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
