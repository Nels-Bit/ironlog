import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  Dumbbell,
  Loader2,
  MoreHorizontal,
  Settings,
  Trash2,
  Trophy,
  UserPlus,
} from "lucide-react";
import {
  notificationService,
  type InboxCursor,
} from "../services/notificationService";
import {
  relativeNotificationTime,
  type NotificationFilter,
} from "../utils/notifications";
import {
  useUnreadNotifications,
  useNotificationIdentity,
  useNotificationReadReceipts,
} from "../context/notificationContext.shared";
import { cn } from "../lib/utils";
const filters: NotificationFilter[] = ["all", "unread", "friends", "personal"];
const emptyText: Record<NotificationFilter, string> = {
  all: "You’re all caught up.",
  unread: "No unread notifications.",
  friends: "No friend activity yet.",
  personal: "No reminders or test notifications yet.",
};
export const Alerts = () => {
  const navigate = useNavigate(),
    client = useQueryClient(),
    clearDialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<NotificationFilter>("all"),
    [error, setError] = useState("");
  const unread = useUnreadNotifications();
  const userId = useNotificationIdentity();
  const {readAll, retryRead, observe, keepUnread, readFeedback} = useNotificationReadReceipts();
  const inbox = useInfiniteQuery({
    queryKey: ["notification-inbox", userId, filter],
    queryFn: ({ pageParam }) => notificationService.page(filter, pageParam),
    initialPageParam: undefined as InboxCursor | undefined,
    getNextPageParam: (page) => page.next,
    staleTime: 30_000,
    retry: 1,
    gcTime: 0,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationFn: ({
      action,
      id,
    }: {
      action: "read" | "unread" | "delete" | "clear";
      id?: string;
    }) => notificationService.mutate(action, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["notification-inbox"] });
      void client.invalidateQueries({ queryKey: ["notification-count"] });
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const items = inbox.data?.pages.flatMap((p) => p.items) || [];
  useEffect(() => {
    observe(inbox.data?.pages.flatMap(page => page.items) || []);
  }, [inbox.data, observe]);
  const open = (id: string) => navigate("/notifications/open/" + id);
  return (
    <section className="min-h-screen pb-36 text-white">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-white/10 bg-iron-950/95 px-3 py-3 backdrop-blur-md">
        <button
          aria-label="Back"
          onClick={() =>
            window.history.state?.idx > 0 ? navigate(-1) : navigate("/profile")
          }
          className="btn btn-ghost btn-square min-h-11 min-w-11"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-xs text-zinc-400">
            {unread ? unread + " unread" : "Your workouts and your people"}
          </p>
        </div>
        <button
          aria-label="Mark all as read"
          title="Mark all as read"
          aria-busy={readFeedback.markingAll}
          disabled={!unread || mutation.isPending || readFeedback.busy}
          onClick={() => { setError(''); void readAll(); }}
          className="btn btn-ghost min-h-11 gap-1.5 px-2 text-brand-orange"
        >
          {readFeedback.markingAll ? <span aria-hidden="true" className="loading loading-spinner loading-xs" /> : <CheckCheck size={20} />}
          <span className="text-xs">{readFeedback.markingAll ? 'Saving…' : !unread ? 'All read' : 'Read all'}</span>
        </button>
        <Link
          aria-label="Notification settings"
          to="/settings/notifications"
          className="btn btn-ghost btn-square min-h-11 min-w-11"
        >
          <Settings size={21} />
        </Link>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {(readFeedback.markingAll || (!readFeedback.error && !unread && readFeedback.message)) && <div
          role="status" className="alert border-white/10 bg-white/5 py-3 text-sm text-zinc-300">
          {readFeedback.markingAll ? 'Marking all as read…' : readFeedback.message}
        </div>}
        <div
          className="grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1"
          aria-label="Notification filters"
        >
          {filters.map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "btn btn-ghost min-h-11 px-1 text-sm capitalize",
                filter === f &&
                  "bg-brand-orange text-white hover:bg-brand-orange",
              )}
            >
              {f === "personal" ? "Reminders" : f}
            </button>
          ))}
        </div>
        {(error || inbox.isError || readFeedback.error) && (
          <div
            role="alert"
            className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error"
          >
            {error || (readFeedback.error ? readFeedback.message : "Could not load notifications. You may be offline.")}
            <button
              onClick={() => {
                setError("");
                if (readFeedback.error) void retryRead();
                else void inbox.refetch();
              }}
              className="btn btn-ghost min-h-11 ml-2"
            >
              Retry
            </button>
          </div>
        )}
        {inbox.isPending ? (
          <div className="flex justify-center p-12" role="status">
            <Loader2 className="animate-spin text-brand-orange" />
            <span className="sr-only">Loading notifications</span>
          </div>
        ) : !items.length ? (
          <div className="py-14 text-center">
            <BellOff size={32} className="mx-auto mb-4 text-zinc-500" />
            <p className="font-semibold">{emptyText[filter]}</p>
            <p className="mt-2 text-sm text-zinc-500">
              Your notification history stays synced across devices.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const Icon =
                n.category === "friend_request"
                  ? UserPlus
                  : n.category?.includes("pr") ||
                      n.category?.includes("achievement")
                    ? Trophy
                    : n.category === "friend_workout"
                      ? Dumbbell
                      : Bell;
              return (
                <article
                  key={n.id}
                  className={cn(
                    "card flex-row items-start rounded-2xl border",
                    n.readAt
                      ? "border-white/5 bg-white/[0.025]"
                      : "border-brand-orange/25 bg-brand-orange/[0.06]",
                  )}
                >
                  <button
                    onClick={() => open(n.id)}
                    className="flex min-w-0 flex-1 gap-3 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-brand-orange"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="break-words text-sm font-bold">
                          {n.title || n.message}
                        </span>
                        {!n.readAt && (
                          <span
                            aria-label="Unread"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange"
                          />
                        )}
                      </span>
                      <span className="mt-1 block break-words text-sm leading-relaxed text-zinc-400">
                        {n.body || n.message}
                      </span>
                      <time
                        dateTime={new Date(n.createdAt).toISOString()}
                        className="mt-2 block text-xs text-zinc-500"
                      >
                        {relativeNotificationTime(n.createdAt)}
                      </time>
                    </span>
                  </button>
                  <details className="dropdown dropdown-end mr-1 mt-2">
                    <summary
                      aria-label={"Actions for " + (n.title || "notification")}
                      className="btn btn-ghost btn-square min-h-11 min-w-11 list-none text-zinc-400"
                    >
                      <MoreHorizontal size={20} />
                    </summary>
                    <ul className="menu dropdown-content z-30 w-48 rounded-xl border border-white/10 bg-iron-950 p-2 shadow-xl">
                      <li>
                        <button
                          disabled={mutation.isPending || readFeedback.busy}
                          className="min-h-11"
                          onClick={(event) => {
                            event.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                            if (n.readAt) keepUnread(n.id);
                            mutation.mutate({
                              action: n.readAt ? "unread" : "read",
                              id: n.id,
                            });
                          }}
                        >
                          Mark {n.readAt ? "unread" : "read"}
                        </button>
                      </li>
                      <li>
                        <button
                          disabled={mutation.isPending || readFeedback.busy}
                          className="min-h-11 text-error"
                          onClick={(event) => {
                            event.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                            mutation.mutate({ action: "delete", id: n.id });
                          }}
                        >
                          <Trash2 size={16} />
                          Delete notification
                        </button>
                      </li>
                    </ul>
                  </details>
                </article>
              );
            })}
          </div>
        )}
        {inbox.hasNextPage && (
          <button
            disabled={inbox.isFetchingNextPage}
            onClick={() => void inbox.fetchNextPage()}
            className="btn btn-ghost min-h-11 w-full"
          >
            {inbox.isFetchingNextPage ? "Loading…" : "Load older notifications"}
          </button>
        )}
        {items.length > 0 && (
          <button
            onClick={() => clearDialog.current?.showModal()}
            className="btn btn-ghost min-h-11 w-full text-zinc-500"
          >
            <Trash2 size={16} />
            Clear notification history
          </button>
        )}
      </div>
      <dialog
        ref={clearDialog}
        className="modal"
        aria-labelledby="clear-notifications-title"
      >
        <div className="modal-box max-w-sm border border-white/10 bg-iron-950">
          <h2 id="clear-notifications-title" className="text-lg font-bold">
            Clear notification history?
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            This hides your notifications on all devices. Your workouts and
            milestones are not affected.
          </p>
          <form method="dialog" className="modal-action">
            <button className="btn btn-ghost min-h-11" autoFocus>
              Keep history
            </button>
            <button
              className="btn btn-error min-h-11"
              onClick={() => mutation.mutate({ action: "clear" })}
            >
              Clear history
            </button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>Close</button>
        </form>
      </dialog>
    </section>
  );
};
