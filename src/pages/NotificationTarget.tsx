import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { notificationService } from "../services/notificationService";
import { getWorkoutExercises } from "../utils/workoutSchema";
import { useNotificationIdentity } from "../context/notificationContext.shared";
/** Resolve an owned notification after sign-in; SQL rechecks sharing access. */
export const NotificationTarget = () => {
  const { id } = useParams();
  const userId = useNotificationIdentity();
  const target = useQuery({
    queryKey: ["notification-target", userId, id],
    queryFn: async () => {
      const data = await notificationService.target(id!);
      if (!data.unavailable)
        await notificationService.mutate("read", id).catch(() => {});
      return data;
    },
    enabled: Boolean(id),
    retry: false,
    gcTime: 0,
  });
  if (target.isPending)
    return (
      <div role="status" className="p-12 text-center">
        <Loader2 className="mx-auto animate-spin text-brand-orange" />
        <span className="sr-only">Opening notification</span>
      </div>
    );
  if (target.isError)
    return (
      <div role="alert" className="space-y-4 p-6 text-center">
        <h1 className="text-lg font-bold">Couldn't open this notification</h1>
        <p className="text-sm text-zinc-400">
          Check your connection and try again. Your notification is still saved.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button className="btn min-h-11" onClick={() => void target.refetch()}>
            Try again
          </button>
          <Link className="btn btn-ghost min-h-11" to="/alerts">
            Back to notifications
          </Link>
        </div>
      </div>
    );
  if (target.data?.unavailable)
    return (
      <div className="space-y-4 p-6 text-center">
        <Lock className="mx-auto text-zinc-500" />
        <h1 className="text-lg font-bold">
          This activity is no longer available
        </h1>
        <p className="text-sm text-zinc-400">
          It may have been deleted, or sharing access may have changed.
        </p>
        <Link className="btn min-h-11" to="/alerts">
          Back to notifications
        </Link>
      </div>
    );
  const data = target.data;
  if (
    data?.route &&
    /^\/(profile|workout|alerts|summary\/[0-9a-f-]+|friends\/[A-Za-z0-9_-]+)(\?[^#]*)?$/.test(
      data.route,
    )
  )
    return <Navigate to={data.route} replace />;
  const workout = data?.workout;
  if (!workout) return <Navigate to="/alerts" replace />;
  const defs = new Map((data.exercises || []).map((e) => [String(e.id), e]));
  return (
    <section className="mx-auto max-w-2xl space-y-4 pb-36 text-white">
      <header className="flex items-center gap-3">
        <Link
          aria-label="Back to notifications"
          to="/alerts"
          className="btn btn-ghost btn-square min-h-11 min-w-11"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">{String(workout.name)}</h1>
          <p className="text-xs text-zinc-500">Shared workout · read only</p>
        </div>
      </header>
      {getWorkoutExercises(workout.exercises).map((ex) => (
        <article
          key={ex.id}
          className="card border border-white/10 bg-white/[0.03] p-4"
        >
          <h2 className="font-bold">
            {String(defs.get(ex.exerciseId)?.name || "Exercise")}
          </h2>
          <div className="mt-2 space-y-2 text-sm text-zinc-400">
            {ex.sets
              .filter((s) => s.isCompleted)
              .map((s, i) => (
                <p key={s.id}>
                  {i + 1}.{" "}
                  {String(defs.get(ex.exerciseId)?.category).toLowerCase() ===
                  "cardio"
                    ? `${s.distance ?? "—"} mi · ${Math.floor((s.durationSeconds || 0) / 60)} min`
                    : `${s.weight ?? "—"} lb × ${s.reps ?? `${s.repsLeft ?? "—"}L / ${s.repsRight ?? "—"}R`} reps`}
                </p>
              ))}
          </div>
        </article>
      ))}
    </section>
  );
};
