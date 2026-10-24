import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Check, Loader2, Smartphone } from "lucide-react";
import { notificationService } from "../services/notificationService";
import { devicePushSupport, pushService } from "../services/pushService";
import { isDemoSession } from "../lib/demo-session";
import {
  notificationCategories,
  deviceTimezone,
  type NotificationCategory,
  type NotificationPreferences,
} from "../utils/notifications";
import { useNotificationIdentity } from "../context/notificationContext.shared";
export const NotificationSettings = () => {
  const userId = useNotificationIdentity();
  const query = useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: notificationService.preferences,
    gcTime: 0,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
  const client = useQueryClient();
  const support = devicePushSupport();
  const device = useQuery({
    queryKey: ["device-push-status", userId],
    queryFn: pushService.current,
    retry: false,
    gcTime: 0,
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const action = async (kind: "enable" | "disable" | "test") => {
    setBusy(true);
    setMessage("");
    try {
      if (kind === "enable") {
        await pushService.enable();
        setMessage("This device is subscribed. Account push is enabled.");
      }
      if (kind === "disable") {
        await pushService.disableDevice();
        setMessage(
          "Push disabled on this device. Other devices are unchanged.",
        );
      }
      if (kind === "test") {
        const result = await notificationService.api({ action: "test" });
        setMessage(
          result.accepted
            ? `Push service accepted ${result.accepted} delivery attempt(s). Check your phone; display is not guaranteed.`
            : "Test saved. No push was accepted yet; check device subscriptions and account push settings.",
        );
      }
      await client.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
      await device.refetch();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "This action could not complete.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto max-w-2xl p-4 pb-36 text-white">
      <header className="flex items-center gap-3">
        <Link
          to="/alerts"
          aria-label="Back to notifications"
          className="btn btn-ghost btn-square min-h-11 min-w-11"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <p className="text-xs text-brand-orange">Settings</p>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
      </header>
      <div className="card mt-5 border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2">
          <Smartphone size={20} className="text-brand-orange" />
          <h2 className="font-bold">This device</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Permission: {support.permission}.{" "}
          {device.data ? "Subscribed to push." : "Not subscribed."}
        </p>
        {isDemoSession() ? (
          <p className="mt-2 text-sm text-zinc-400">
            Real push is disabled in Demo Mode.
          </p>
        ) : support.ios && !support.installed ? (
          <p className="mt-2 text-sm text-zinc-400">
            In Safari, tap Share → Add to Home Screen. Open ironLog from that
            icon, then return here to enable notifications. Supported iOS/iPadOS
            Home Screen apps require 16.4 or newer.
          </p>
        ) : !support.supported ? (
          <p className="mt-2 text-sm text-zinc-400">
            Push needs a supported browser, HTTPS and an active service worker.
          </p>
        ) : support.permission === "denied" ? (
          <p className="mt-2 text-sm text-zinc-400">
            Notifications are blocked. Enable them in your iPhone’s notification
            settings (or your browser’s site settings). An app switch cannot
            override system permission.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={
              busy ||
              isDemoSession() ||
              !support.supported ||
              support.permission === "denied" ||
              (support.ios && !support.installed)
            }
            onClick={() => void action("enable")}
            className="btn min-h-11 border-0 bg-brand-orange text-white"
          >
            <Bell size={17} />
            {device.data
              ? "Refresh device subscription"
              : "Enable notifications"}
          </button>
          {device.data && (
            <button
              disabled={busy}
              onClick={() => void action("disable")}
              className="btn btn-ghost min-h-11"
            >
              Disable this device
            </button>
          )}
          <button
            disabled={
              busy ||
              isDemoSession() ||
              !device.data ||
              !query.data?.push_enabled
            }
            onClick={() => void action("test")}
            className="btn btn-ghost min-h-11"
          >
            Send test push
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          System permission and this device subscription are separate from your
          account preferences. No automatic permission prompts.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-white/10 p-3 text-sm text-zinc-300"
        >
          {message}
        </p>
      )}
      {query.isPending ? (
        <Loader2 className="mx-auto mt-8 animate-spin text-brand-orange" />
      ) : query.isError ? (
        <p role="alert" className="mt-4 text-error">
          {query.error.message}
          <button
            onClick={() => void query.refetch()}
            className="btn btn-ghost min-h-11"
          >
            Retry
          </button>
        </p>
      ) : (
        <PreferencesForm
          key={JSON.stringify(query.data)}
          initial={query.data}
          onSaved={() => {
            setMessage("Settings saved on your account.");
            void query.refetch();
          }}
        />
      )}
    </section>
  );
};
const PreferencesForm = ({
  initial,
  onSaved,
}: {
  initial: NotificationPreferences;
  onSaved: () => void;
}) => {
  const [p, setP] = useState(initial),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const set = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => setP((current) => ({ ...current, [key]: value }));
  const categories = Object.entries(notificationCategories) as [
    NotificationCategory,
    string,
  ][];
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await notificationService.savePreferences(p);
      setMessage("Settings saved on your account.");
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
        <span>
          <span className="block font-bold">Account push notifications</span>
          <span className="text-xs text-zinc-500">
            Turning this off keeps in-app history.
          </span>
        </span>
        <input
          aria-label="Account push notifications"
          type="checkbox"
          className="toggle border-brand-orange bg-brand-orange"
          checked={p.push_enabled}
          onChange={(e) => set("push_enabled", e.target.checked)}
        />
      </label>
      <div className="card border border-white/10 p-4">
        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>Categories</span>
          <span>Enabled</span>
        </div>
        {categories.map(([key, label]) => (
          <div
            key={key}
            className="flex min-h-14 items-center justify-between gap-3 border-b border-white/5 last:border-0"
          >
            <span className="text-sm">{label}</span>
              <label className="flex min-h-11 min-w-11 items-center justify-center">
                <input
                  aria-label={label}
                  type="checkbox"
                  className="toggle toggle-sm border-brand-orange bg-brand-orange"
                  checked={p.in_app[key] && p.push[key]}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setP(current => ({ ...current,
                      in_app: { ...current.in_app, [key]: enabled },
                      push: { ...current.push, [key]: enabled },
                    }));
                  }}
                />
              </label>
          </div>
        ))}
        <p className="mt-3 text-xs text-zinc-500">
          Personal PR, level, trophy and streak alerts are not sent. Friend PR
          alerts cover only Barbell Squat, Barbell Deadlift and Barbell Bench Press.
          Push previews show the sender and event details on your lock screen.
          Each switch controls both in-app and push alerts. Phone delivery also
          requires account push, system permission and a device subscription.
          Changes affect future events, not old history.
        </p>
      </div>
      <div className="card space-y-3 border border-white/10 p-4">
        <h2 className="font-bold">Workout reminders</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          Reminder time
          <input
            aria-label="Reminder time"
            type="time"
            value={p.reminder_time}
            onChange={(e) => set("reminder_time", e.target.value)}
            className="input min-h-11 w-36 bg-white/5"
          />
        </label>
        <div className="grid grid-cols-7 gap-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, i) => (
            <button
              key={day}
              type="button"
              aria-label={`Reminder ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]}`}
              aria-pressed={p.reminder_days.includes(i)}
              onClick={() =>
                set(
                  "reminder_days",
                  p.reminder_days.includes(i)
                    ? p.reminder_days.filter((d) => d !== i)
                    : [...p.reminder_days, i].sort(),
                )
              }
              className={`btn btn-ghost min-h-11 px-0 text-xs ${p.reminder_days.includes(i) ? "bg-brand-orange text-white" : ""}`}
            >
              {day}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Uses this device’s timezone automatically ({deviceTimezone()}).
          The most recently active device sets reminder times across your account.
          Daylight-saving changes are automatic. Reminders are skipped after a
          completed workout that local day.
        </p>
      </div>
      <p className="text-xs text-zinc-500">
        Use your phone’s Do Not Disturb or Focus settings to silence notifications.
        Manage milestone sharing in <Link to="/profile" className="underline text-brand-orange">Profile → Edit Profile → Profile Privacy</Link>.
      </p>
      {message && (
        <p role="status" className="text-sm text-zinc-300">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="btn min-h-11 w-full border-0 bg-brand-orange text-white"
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Check size={18} />
        )}
        Save notification settings
      </button>
    </form>
  );
};
