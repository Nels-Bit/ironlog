/** Only already-authorized rows enter this formatter. The OS owns the source label. */
export function pushPresentation(n: {type: string; title?: string; body?: string}) {
  const title = n.type === "workout_completed" ? "Workout"
    : n.type === "achievement_unlocked" ? "Award"
      : ["personal_record", "level_up"].includes(n.type) ? "Milestone"
        : n.type.startsWith("friend_request") ? "Friend request"
          : n.type === "workout_reminder" ? "Workout reminder"
            : n.type === "test_push" ? "Test notification" : "Notification";
  const heading = (n.title || "").trim(), detail = (n.body || "").trim();
  const body = n.type === "test_push" ? "Your ironLog test notification is ready."
    : n.type.startsWith("friend_request") ? detail
      : [heading, detail].filter(Boolean).join(" · ");
  return { title, body: body.slice(0, 600) || "Open ironLog to see the details." };
}
