import { describe, expect, it } from "vitest";
import {
  defaultNotificationPreferences,
  localClock,
  normalizePreferences,
  reminderDue,
  safeNotificationRoute,
  validatePreferences,
} from "../src/utils/notifications";
import {
  buildWorkoutNotifications,
  type WorkoutEventSnapshot,
} from "../src/utils/notificationEvents";
import { createECDH, randomBytes } from "node:crypto";
import {
  pushFailureDisposition,
  safeSecretEqual,
  validatePushSubscription,
} from "../server/pushSecurity";
import webpush from "web-push";
const snapshot = (type = "normal", complete = true): WorkoutEventSnapshot => ({
  weight: 180,
  exercises: [{ id: "bench", name: "Bench Press", category: "Free Weights" }],
  workouts: [
    {
      id: "old",
      name: "Push",
      start_time: Date.UTC(2026, 0, 1),
      end_time: Date.UTC(2026, 0, 1) + 60000,
      exercises: [
        {
          id: "ex",
          exerciseId: "bench",
          sets: [
            {
              id: "s",
              type: "normal",
              weight: 185,
              reps: 8,
              isCompleted: true,
            },
          ],
        },
      ],
    },
    {
      id: "new",
      name: "Push",
      start_time: Date.UTC(2026, 0, 2),
      end_time: Date.UTC(2026, 0, 2) + 60000,
      exercises: [
        {
          id: "ex2",
          exerciseId: "bench",
          sets: [
            { id: "s2", type, weight: 190, reps: 6, isCompleted: complete },
          ],
        },
      ],
    },
  ],
});
describe("authoritative notification event planning", () => {
  it.each(["normal", "warmup", "failure", "dropset", "dropset_child"])(
    "reuses valid %s PR eligibility",
    (type) => {
      const events = buildWorkoutNotifications("new", snapshot(type));
      expect(events.find((e) => e.category === "friend_pr")?.body).toBe(
        "Barbell Bench Press · 190 lb × 6 reps",
      );
      expect(
        events.find((e) => e.category === "friend_workout")?.body,
      ).toContain("1 exercises");
    },
  );
  it("never emits for incomplete, cancelled, or rest-day workouts", () => {
    expect(buildWorkoutNotifications("new", snapshot("normal", false))).toEqual(
      [],
    );
    const s = snapshot();
    s.workouts[1].end_time = null;
    expect(buildWorkoutNotifications("new", s)).toEqual([]);
    s.workouts[1].end_time = Date.now();
    s.workouts[1].name = "Rest Day";
    expect(buildWorkoutNotifications("new", s)).toEqual([]);
  });
  it("stable keys make retry plans identical", () =>
    expect(buildWorkoutNotifications("new", snapshot())).toEqual(
      buildWorkoutNotifications("new", snapshot()),
    ));
  it("cardio earns existing XP but never a load PR", () => {
    const s = snapshot();
    s.exercises[0].category = "Cardio";
    expect(
      buildWorkoutNotifications("new", s).filter(
        (e) => e.type === "personal_record",
      ),
    ).toEqual([]);
  });
  it("does not invent a rep-only PR", () => {
    const s = snapshot();
    s.workouts[1].exercises = [
      {
        id: "e",
        exerciseId: "bench",
        sets: [
          { id: "s", type: "normal", weight: 185, reps: 15, isCompleted: true },
        ],
      },
    ];
    expect(
      buildWorkoutNotifications("new", s).some(
        (e) => e.type === "personal_record",
      ),
    ).toBe(false);
  });
  it("uses UI streak rules at event time and not the current worker date", () => {
    const s = snapshot();
    s.workouts = Array.from({ length: 3 }, (_, i) => ({
      ...s.workouts[1],
      id: i === 2 ? "new" : `before-${i}`,
      start_time: Date.UTC(2026, 0, i + 1),
      end_time: Date.UTC(2026, 0, i + 1) + 60000,
    }));
    expect(
      buildWorkoutNotifications("new", s).find(
        (e) => e.type === "streak_milestone",
      )?.title,
    ).toBeUndefined();
    // A session started yesterday does not manufacture today's UI streak.
    s.workouts[2].end_time = Date.UTC(2026, 0, 4);
    expect(
      buildWorkoutNotifications("new", s).some(
        (e) => e.type === "streak_milestone",
      ),
    ).toBe(false);
  });
});
describe("preferences, timezone and daylight savings", () => {
  it("defaults keep inbox enabled and external push disabled", () => {
    const p = defaultNotificationPreferences();
    expect(p.in_app.friend_pr).toBe(true);
    expect(p.in_app).not.toHaveProperty('personal_pr');
    expect(p.push_enabled).toBe(false);
  });
  it("partial legacy settings preserve other categories", () =>
    expect(
      normalizePreferences({ push_enabled: true }).push.friend_request,
    ).toBe(true));
  it("rejects invalid timezone and clock data", () => {
    expect(() =>
      validatePreferences({
        ...defaultNotificationPreferences(),
        timezone: "Invalid/Zone",
      }),
    ).toThrow();
    expect(() =>
      validatePreferences({
        ...defaultNotificationPreferences(),
        reminder_time: "25:00",
      }),
    ).toThrow();
  });
  it("uses local dates at UTC boundaries", () =>
    expect(
      localClock(new Date("2026-10-13T01:00:00Z"), "America/New_York").date,
    ).toBe("2026-10-12"));
  it("catches spring-forward skipped time without duplicate dates", () => {
    const p = {
      ...defaultNotificationPreferences("America/New_York"),
      reminder_days: [0],
      reminder_time: "02:30",
    };
    expect(reminderDue(p, new Date("2026-03-08T06:59:00Z"))).toBeNull();
    expect(reminderDue(p, new Date("2026-03-08T07:01:00Z"))).toBe("2026-03-08");
  });
  it("fall-back repeated hour uses the same idempotency day", () => {
    const p = {
      ...defaultNotificationPreferences("America/New_York"),
      reminder_days: [0],
      reminder_time: "01:15",
    };
    expect(reminderDue(p, new Date("2026-11-01T05:30:00Z"))).toBe(
      reminderDue(p, new Date("2026-11-01T06:30:00Z")),
    );
  });
  it("disabled reminders and unselected days are never due", () => {
    const p = defaultNotificationPreferences();
    p.in_app.workout_reminder = false;
    p.reminder_days = [2];
    expect(reminderDue(p, new Date("2026-10-13T20:00:00Z"))).toBeNull();
  });
  it("disables legacy app quiet hours and preserves either-channel opt-outs", () => {
    const p = defaultNotificationPreferences();
    p.quiet_enabled = true;
    p.in_app.friend_workout = false;
    p.push.friend_pr = false;
    const normalized = normalizePreferences(p);
    expect(normalized.quiet_enabled).toBe(false);
    expect(normalized.in_app).toEqual(normalized.push);
    expect(normalized.in_app.friend_workout).toBe(false);
    expect(normalized.in_app.friend_pr).toBe(false);
  });
});
describe("push subscription security", () => {
  const curve = createECDH("prime256v1");
  curve.generateKeys();
  const valid = {
    endpoint: "https://web.push.apple.com/test-device",
    keys: {
      p256dh: curve.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  it("accepts a valid encrypted browser subscription", () =>
    expect(validatePushSubscription(valid)).toEqual(valid));
  it("the real transport produces encrypted aes128gcm content and VAPID authorization without network calls", () => {
    const pair = webpush.generateVAPIDKeys();
    const request = webpush.generateRequestDetails(
      valid,
      "Private workout data",
      {
        vapidDetails: {
          subject: "mailto:test@example.invalid",
          publicKey: pair.publicKey,
          privateKey: pair.privateKey,
        },
      },
    );
    expect(request.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(request.headers.Authorization).toContain("vapid");
    expect(request.body?.toString()).not.toContain("Private workout data");
    expect(JSON.stringify(request.headers)).not.toContain(pair.privateKey);
  });
  it.each([
    "http://127.0.0.1/x",
    "https://localhost/x",
    "https://web.push.apple.com.evil.example/x",
    "https://user:password@web.push.apple.com/x",
    "https://web.push.apple.com:444/x",
  ])("rejects SSRF target %s", (endpoint) =>
    expect(() => validatePushSubscription({ ...valid, endpoint })).toThrow(),
  );
  it("rejects oversize and malformed keys", () => {
    expect(() =>
      validatePushSubscription({
        ...valid,
        endpoint: valid.endpoint + "a".repeat(2100),
      }),
    ).toThrow();
    expect(() =>
      validatePushSubscription({
        ...valid,
        keys: { auth: "bad", p256dh: "bad" },
      }),
    ).toThrow();
  });
  it("invalidates permanently expired endpoints; retries transient errors", () => {
    expect(pushFailureDisposition(410, 1)).toBe("invalidate");
    expect(pushFailureDisposition(404, 1)).toBe("invalidate");
    expect(pushFailureDisposition(503, 1)).toBe("retry");
    expect(pushFailureDisposition(429, 1)).toBe("retry");
    expect(pushFailureDisposition(undefined, 5)).toBe("failed");
  });
  it("rejects wrong and empty worker secrets", () => {
    expect(safeSecretEqual("wrong", "secret")).toBe(false);
    expect(safeSecretEqual("", "")).toBe(false);
    expect(safeSecretEqual("secret", "secret")).toBe(true);
  });
  it("rejects arbitrary external notification routes", () =>
    expect(safeNotificationRoute("https://evil.example/")).toBe("/alerts"));
});
