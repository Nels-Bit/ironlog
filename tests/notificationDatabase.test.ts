import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import {
  databaseWorkerClient,
  notificationDatabase,
  userA,
  userB,
  userC,
} from "./helpers/notificationDatabase";
import {
  processNotificationEvents,
  deliverPushJobs,
} from "../server/notificationWorker";
const exerciseId = "44444444-4444-4444-8444-444444444444",
  workoutId = "55555555-5555-4555-8555-555555555555";
const install1 = "66666666-6666-4666-8666-666666666666",
  install2 = "77777777-7777-4777-8777-777777777777";
let db: PGlite;
const curve = createECDH("prime256v1");
curve.generateKeys();
const key = curve.getPublicKey().toString("base64url"),
  auth = randomBytes(16).toString("base64url");
const sets = (weight: number) =>
  JSON.stringify([
    {
      id: "ex",
      exerciseId,
      sets: [{ id: "s", type: "failure", weight, reps: 8, isCompleted: true }],
    },
  ]);
const count = async (table: string, where = "true") =>
  (
    await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${table} WHERE ${where}`,
    )
  ).rows[0].count;
const complete = () =>
  db.query(
    `INSERT INTO workouts(id,user_id,name,start_time,end_time,volume_load,exercises,notification_source) VALUES($1,$2,'Push Day',$3,$4,1600,$5,'live')`,
    [workoutId, userA, Date.now() - 1000, Date.now(), sets(200)],
  );
const claim = async () =>
  (
    await db.query<{ id: string; lease_id: string }>(
      `SELECT * FROM claim_notification_events(NULL)`,
    )
  ).rows;
const asUser = async (id: string) => {
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec("SET ROLE authenticated");
};
it("upgrades the deployed legacy schema without losing history or leaving truncate privileges", async () => {
  const legacy = await notificationDatabase(true);
  try {
    const { rows } = await legacy.query<{
      message: string;
      event_key: string;
      category: string;
      title: string;
    }>('SELECT message,event_key,category,title FROM notifications');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      message: 'Existing saved request', category: 'friend_request', title: 'Friend request',
    });
    expect(rows[0].event_key).toMatch(/^legacy:/);
    expect((await legacy.query('SELECT * FROM notification_events')).rows).toHaveLength(0);
    expect((await legacy.query('SELECT * FROM push_delivery_jobs')).rows).toHaveLength(0);
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['notifications', 'friendships', 'notification_preferences', 'push_subscriptions', 'notification_events', 'push_delivery_jobs']) {
        const { rows: privileges } = await legacy.query<{allowed: boolean}>(
          'SELECT has_table_privilege($1,$2,\'TRUNCATE\') AS allowed', [role,table]);
        expect(privileges[0].allowed).toBe(false);
      }
    }
  } finally { await legacy.close(); }
}, 30000);
beforeAll(async () => {
  db = await notificationDatabase();
  const vapid = webpush.generateVAPIDKeys();
  vi.stubEnv("VAPID_PUBLIC_KEY", vapid.publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.invalid");
}, 30000);
afterAll(async () => {
  await db?.close();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE auth.users CASCADE;`);
  await db.query(
    `INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,'{"weight":180}'),($2,'{}'),($3,'{}')`,
    [userA, userB, userC],
  );
  await db.query(
    `INSERT INTO user_profiles(user_id,user_code,display_name,is_public) VALUES($1,'a','Alice',true),($2,'b','Bob',true),($3,'c','Casey',true)`,
    [userA, userB, userC],
  );
  await db.query(
    `INSERT INTO friendships(requester_id,addressee_id,status) VALUES($1,$2,'accepted')`,
    [userA, userB],
  );
  await db.query(
    `INSERT INTO exercises(id,name,category,is_unilateral) VALUES($1,'Bench Press','Free Weights',false)`,
    [exerciseId],
  );
  await db.query(
    `INSERT INTO workouts(user_id,name,start_time,end_time,volume_load,exercises) VALUES($1,'Old Push',$2,$3,1480,$4)`,
    [
      userA,
      Date.now() - 7 * 86400000,
      Date.now() - 7 * 86400000 + 60000,
      sets(185),
    ],
  );
  await db.query(`SELECT register_push_install($1,$2,$3,$4,$5,true)`, [
    userB,
    install1,
    "https://web.push.apple.com/device1",
    key,
    auth,
  ]);
  await db.query(`SELECT register_push_install($1,$2,$3,$4,$5,true)`, [
    userB,
    install2,
    "https://web.push.apple.com/device2",
    key,
    auth,
  ]);
  await db.query(
    `UPDATE notification_preferences SET push=jsonb_set(jsonb_set(push,'{friend_pr}','false'),'{friend_achievement}','false'),in_app=jsonb_set(in_app,'{friend_achievement}','false') WHERE user_id=$1`,
    [userB],
  );
});
describe("actual Postgres migration, authorization and durable fan-out", () => {
  it("generates only a finalized live workout event; imports and edits do not emit", async () => {
    expect(await count("notification_events")).toBe(0);
    await complete();
    expect(await count("notification_events")).toBe(1);
    await db.query(`UPDATE workouts SET exercises=$1,end_time=$2 WHERE id=$3`, [
      sets(250),
      Date.now(),
      workoutId,
    ]);
    expect(await count("notification_events")).toBe(1);
    const event = (
      await db.query<{
        snapshot: { workouts: { id: string; exercises: unknown }[] };
      }>("SELECT snapshot FROM notification_events")
    ).rows[0];
    expect(JSON.stringify(event.snapshot)).toContain("200");
    expect(JSON.stringify(event.snapshot)).not.toContain("250");
  });
  it("pending workouts and cancellation do not emit completion events", async () => {
    await db.query(
      `INSERT INTO workouts(user_id,name,start_time,end_time,exercises,notification_source) VALUES($1,'Pending',$2,NULL,$3,'live')`,
      [userA, Date.now(), sets(200)],
    );
    expect(await count("notification_events")).toBe(0);
    await db.exec(`DELETE FROM workouts WHERE name='Pending'`);
    expect(await count("notification_events")).toBe(0);
  });
  it("one finalized workout reaches only active eligible friends and both devices", async () => {
    await complete();
    const client = databaseWorkerClient(db);
    await processNotificationEvents(client);
    expect(
      await count(
        "notifications",
        `recipient_id='${userB}' AND category='friend_workout'`,
      ),
    ).toBe(1);
    expect(await count("notifications", `recipient_id='${userC}'`)).toBe(0);
    expect(await count("push_delivery_jobs")).toBe(2);
    const send = vi
      .fn()
      .mockResolvedValue({ statusCode: 201, headers: {}, body: "" });
    const result = await deliverPushJobs(client, null, send);
    expect(result.accepted).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({title:'Workout',body:expect.stringContaining('Alice')});
    expect(send.mock.calls[0][1]).not.toContain("200 lb");
    await deliverPushJobs(client, null, send);
    await processNotificationEvents(client);
    expect(send).toHaveBeenCalledTimes(2);
    expect(await count("notifications", `category='friend_workout'`)).toBe(1);
  });
  it("claim leases prevent another worker from taking the same event", async () => {
    await complete();
    expect(await claim()).toHaveLength(1);
    expect(await claim()).toHaveLength(0);
  });
  it("event and delivery leases recover after worker crashes", async () => {
    await complete();
    await claim();
    await db.exec(
      `UPDATE notification_events SET lease_until=now()-interval '1 second'`,
    );
    expect(await claim()).toHaveLength(1);
  });
  it("transactional emit rollback preserves unprocessed events", async () => {
    await complete();
    const [e] = await claim();
    await expect(
      db.query(`SELECT emit_notification_event($1,$2,$3)`, [
        e.id,
        e.lease_id,
        JSON.stringify([{ category: "invalid", title: "bad", body: "bad" }]),
      ]),
    ).rejects.toThrow();
    expect(await count("notifications")).toBe(0);
    expect(await count("notification_events", "processed_at IS NULL")).toBe(1);
  });
  it("sender privacy and recipient category settings prohibit social creation", async () => {
    await db.query(
      `UPDATE user_profiles SET is_public=false WHERE user_id=$1`,
      [userA],
    );
    await complete();
    await processNotificationEvents(databaseWorkerClient(db));
    expect(await count("notifications", `recipient_id='${userB}'`)).toBe(0);
    expect(
      await count(
        "notifications",
        `recipient_id='${userA}' AND category='personal_pr'`,
      ),
    ).toBe(0);
  });
  it("disabled friend categories do not create notification rows", async () => {
    await db.query(
      `UPDATE notification_preferences SET in_app=jsonb_set(jsonb_set(in_app,'{friend_workout}','false'),'{friend_pr}','false'),push=jsonb_set(push,'{friend_workout}','false') WHERE user_id=$1`,
      [userB],
    );
    await complete();
    await processNotificationEvents(databaseWorkerClient(db));
    expect(await count("notifications", `recipient_id='${userB}'`)).toBe(0);
  });
  it("disabling push preserves persisted inbox history", async () => {
    await db.query(
      `UPDATE notification_preferences SET push_enabled=false WHERE user_id=$1`,
      [userB],
    );
    await complete();
    await processNotificationEvents(databaseWorkerClient(db));
    expect(
      await count("notifications", `recipient_id='${userB}'`),
    ).toBeGreaterThan(0);
    expect(await count("push_delivery_jobs")).toBe(0);
  });
  it("legacy single-channel opt-outs disable both channels", async () => {
    await db.query(
      `UPDATE notification_preferences SET in_app=jsonb_set(in_app,'{friend_workout}','false') WHERE user_id=$1`,
      [userB],
    );
    await complete();
    const client = databaseWorkerClient(db);
    await processNotificationEvents(client);
    expect(
      await count(
        "notifications",
        `recipient_id='${userB}' AND category='friend_workout'`,
      ),
    ).toBe(0);
    const send = vi
      .fn()
      .mockResolvedValue({ statusCode: 201, headers: {}, body: "" });
    expect((await deliverPushJobs(client, null, send)).accepted).toBe(0);
  });
  it("repeat registration keeps one endpoint; new installs do not overwrite old ones", async () => {
    await db.query(`SELECT register_push_install($1,$2,$3,$4,$5,false)`, [
      userB,
      install1,
      "https://web.push.apple.com/device1",
      key,
      auth,
    ]);
    expect(await count("push_subscriptions", "invalidated_at IS NULL")).toBe(2);
    await db.query(
      `UPDATE notification_preferences SET push_enabled=false WHERE user_id=$1`,
      [userB],
    );
    await db.query(`SELECT register_push_install($1,$2,$3,$4,$5,false)`, [
      userB,
      install1,
      "https://web.push.apple.com/device1",
      key,
      auth,
    ]);
    expect(
      (
        await db.query<{ push_enabled: boolean }>(
          "SELECT push_enabled FROM notification_preferences",
        )
      ).rows[0].push_enabled,
    ).toBe(false);
  });
  it("another user cannot hijack an endpoint", async () => {
    await expect(
      db.query(`SELECT register_push_install($1,$2,$3,$4,$5,true)`, [
        userC,
        install1,
        "https://web.push.apple.com/device1",
        key,
        auth,
      ]),
    ).rejects.toThrow();
    expect(
      await count(
        "push_subscriptions",
        `user_id='${userB}' AND invalidated_at IS NULL`,
      ),
    ).toBe(2);
  });
  it("logout/revocation only removes one install", async () => {
    await db.query("SELECT revoke_push_install($1,$2)", [userB, install1]);
    expect(await count("push_subscriptions", "invalidated_at IS NULL")).toBe(1);
  });
  it("a revoked endpoint can safely change accounts, while old-account jobs cannot follow it", async () => {
    await complete();
    const client = databaseWorkerClient(db);
    await processNotificationEvents(client);
    await db.query("SELECT revoke_push_install($1,$2)", [userB, install1]);
    await db.query("SELECT register_push_install($1,$2,$3,$4,$5,true)", [
      userC,
      install1,
      "https://web.push.apple.com/device1",
      key,
      auth,
    ]);
    const send = vi
      .fn()
      .mockResolvedValue({ statusCode: 201, headers: {}, body: "" });
    const result = await deliverPushJobs(client, null, send);
    expect(result.skipped).toBe(1);
    expect(result.accepted).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("read/unread/delete states are authoritative across devices, owner-only", async () => {
    await complete();
    await processNotificationEvents(databaseWorkerClient(db));
    const initialCount = await count("notifications", `recipient_id='${userB}'`);
    const row = (
      await db.query<{ id: string }>(
        `SELECT id FROM notifications WHERE recipient_id=$1 LIMIT 1`,
        [userB],
      )
    ).rows[0];
    await asUser(userB);
    await db.query("SELECT notification_state($1,$2)", [row.id, "read"]);
    expect(await count("notifications", "read_at IS NOT NULL")).toBe(1);
    await db.query("SELECT notification_state($1,$2)", [row.id, "unread"]);
    expect(await count("notifications", "read_at IS NOT NULL")).toBe(0);
    await db.query("SELECT notification_state($1,$2)", [row.id, "delete"]);
    expect(await count("notifications", "deleted_at IS NULL")).toBe(initialCount - 1);
    await asUser(userC);
    expect(await count("notifications")).toBe(0);
    await db.query("SELECT notification_state($1,$2)", [row.id, "unread"]);
    await db.exec("RESET ROLE");
    expect(
      await count("notifications", `id='${row.id}' AND deleted_at IS NOT NULL`),
    ).toBe(1);
  });
  it("clients cannot forge notification content or inspect credentials/private event queues", async () => {
    await asUser(userB);
    await expect(
      db.exec(
        `INSERT INTO notifications(recipient_id,type,event_key,message) VALUES('${userC}','personal_record','fake','fake')`,
      ),
    ).rejects.toThrow();
    await expect(db.exec("SELECT * FROM push_subscriptions")).rejects.toThrow();
    await expect(
      db.exec("SELECT * FROM notification_events"),
    ).rejects.toThrow();
    await expect(
      db.exec("SELECT * FROM claim_notification_events(NULL)"),
    ).rejects.toThrow();
    await expect(
      db.exec(`UPDATE notifications SET message='forged'`),
    ).rejects.toThrow();
  });
  it("settings are owner-only and validated in Postgres", async () => {
    await asUser(userB);
    await expect(
      db.exec(`UPDATE notification_preferences SET timezone='Invalid/Zone'`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `INSERT INTO notification_preferences(user_id) VALUES('${userC}')`,
      ),
    ).rejects.toThrow();
  });
  it("friendship identity fields cannot be rewritten by a recipient", async () => {
    await asUser(userB);
    await expect(
      db.exec(`UPDATE friendships SET requester_id='${userC}'`),
    ).rejects.toThrow();
  });
  it("friend-request creation enforces public-profile consent in the database", async () => {
    await db.query(
      `UPDATE user_profiles SET is_public=false WHERE user_id=$1`,
      [userB],
    );
    await asUser(userC);
    await expect(
      db.query(
        `INSERT INTO friendships(requester_id,addressee_id) VALUES($1,$2)`,
        [userC, userB],
      ),
    ).rejects.toThrow();
    await db.exec("RESET ROLE");
    await db.query(`UPDATE user_profiles SET is_public=true WHERE user_id=$1`, [
      userB,
    ]);
    await asUser(userC);
    await db.query(
      `INSERT INTO friendships(requester_id,addressee_id) VALUES($1,$2)`,
      [userC, userB],
    );
    await db.exec("RESET ROLE");
    expect(await count("notification_events", `kind='friend_request'`)).toBe(1);
  });
  it("revalidates sharing and removed friends before delivery and target access", async () => {
    await complete();
    const client = databaseWorkerClient(db);
    await processNotificationEvents(client);
    const note = (
      await db.query<{ id: string }>(
        `SELECT id FROM notifications WHERE recipient_id=$1 AND category='friend_workout'`,
        [userB],
      )
    ).rows[0];
    await asUser(userB);
    expect(
      (
        await db.query<{ notification_target: { workout: unknown } }>(
          "SELECT notification_target($1)",
          [note.id],
        )
      ).rows[0].notification_target.workout,
    ).toBeTruthy();
    await db.exec("DELETE FROM friendships");
    expect(
      (
        await db.query<{ notification_target: { unavailable: boolean } }>(
          "SELECT notification_target($1)",
          [note.id],
        )
      ).rows[0].notification_target.unavailable,
    ).toBe(true);
    await db.exec("RESET ROLE");
    const send = vi.fn();
    expect((await deliverPushJobs(client, null, send)).skipped).toBe(2);
    expect(send).not.toHaveBeenCalled();
  });
  it("expired endpoints are invalidated while a second device still receives its job", async () => {
    await complete();
    const client = databaseWorkerClient(db);
    await processNotificationEvents(client);
    const send = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValue({ statusCode: 201, headers: {}, body: "" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deliverPushJobs(client, null, send);
    log.mockRestore();
    expect(result.invalidated).toBe(1);
    expect(result.accepted).toBe(1);
  });
  it("old quiet-hour settings cannot defer delivery; phone DND handles silence", async () => {
    await complete();
    const client = databaseWorkerClient(db);
    await processNotificationEvents(client);
    const hour = new Date().getUTCHours();
    const start = String(hour).padStart(2, "0") + ":00",
      end = String((hour + 1) % 24).padStart(2, "0") + ":00";
    await db.query(
      "UPDATE notification_preferences SET quiet_enabled=true,quiet_start=$1,quiet_end=$2 WHERE user_id=$3",
      [start, end, userB],
    );
    const send = vi.fn().mockResolvedValue({statusCode:201,headers:{},body:''});
    await deliverPushJobs(client, null, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      await count("push_delivery_jobs", `state='pending' AND attempts=0`),
    ).toBe(0);
  });
  it("friend requests and acceptance transitions are generated once on the server", async () => {
    const request = (
      await db.query<{ id: string }>(
        `INSERT INTO friendships(requester_id,addressee_id) VALUES($1,$2) RETURNING id`,
        [userC, userB],
      )
    ).rows[0];
    await processNotificationEvents(databaseWorkerClient(db));
    expect(await count("notifications", `type='friend_request'`)).toBe(1);
    await db.query(`UPDATE friendships SET status='accepted' WHERE id=$1`, [
      request.id,
    ]);
    await processNotificationEvents(databaseWorkerClient(db));
    expect(await count("notifications", `type='friend_request_accepted'`)).toBe(
      1,
    );
    await db.query(`UPDATE friendships SET status='accepted' WHERE id=$1`, [
      request.id,
    ]);
    expect(await count("notification_events")).toBe(2);
  });
  it("reminder scheduling is disabled-aware, daily-idempotent, and suppressed after a workout", async () => {
    await db.query(
      `UPDATE notification_preferences SET reminder_days=ARRAY[extract(dow FROM now())::int],reminder_time='00:00' WHERE user_id=$1`,
      [userB],
    );
    const day = (
      await db.query<{ day: string }>(
        `SELECT to_char(now(),'YYYY-MM-DD') AS day`,
      )
    ).rows[0].day;
    expect(
      (
        await db.query<{ create_workout_reminder: boolean }>(
          "SELECT create_workout_reminder($1,$2)",
          [userB, day],
        )
      ).rows[0].create_workout_reminder,
    ).toBe(true);
    expect(
      (
        await db.query<{ create_workout_reminder: boolean }>(
          "SELECT create_workout_reminder($1,$2)",
          [userB, day],
        )
      ).rows[0].create_workout_reminder,
    ).toBe(false);
    await db.exec(`DELETE FROM notifications WHERE type='workout_reminder'`);
    await db.query(
      `INSERT INTO workouts(user_id,name,start_time,end_time,exercises) VALUES($1,'Done',$2,$2,$3)`,
      [userB, Date.now(), sets(100)],
    );
    expect(
      (
        await db.query<{ create_workout_reminder: boolean }>(
          "SELECT create_workout_reminder($1,$2)",
          [userB, day],
        )
      ).rows[0].create_workout_reminder,
    ).toBe(false);
  });
  it("sensitive action rate limits are durable", async () => {
    expect(
      (
        await db.query<{ consume_notification_rate: boolean }>(
          `SELECT consume_notification_rate($1,'test',1)`,
          [userB],
        )
      ).rows[0].consume_notification_rate,
    ).toBe(true);
    expect(
      (
        await db.query<{ consume_notification_rate: boolean }>(
          `SELECT consume_notification_rate($1,'test',1)`,
          [userB],
        )
      ).rows[0].consume_notification_rate,
    ).toBe(false);
  });
  it("actual Postgres timezone scheduling handles skipped and repeated DST clock times", async () => {
    await db.query(
      `UPDATE notification_preferences SET timezone='America/New_York',reminder_days=ARRAY[0],reminder_time='02:30' WHERE user_id=$1`,
      [userB],
    );
    const due = async (date: string, at: string) =>
      (
        await db.query<{ create_workout_reminder: boolean }>(
          "SELECT create_workout_reminder($1,$2,$3)",
          [userB, date, at],
        )
      ).rows[0].create_workout_reminder;
    expect(await due("2026-03-08", "2026-03-08T06:59:00Z")).toBe(false);
    expect(await due("2026-03-08", "2026-03-08T07:01:00Z")).toBe(true);
    await db.query(
      `UPDATE notification_preferences SET reminder_time='01:15' WHERE user_id=$1`,
      [userB],
    );
    expect(await due("2026-11-01", "2026-11-01T05:30:00Z")).toBe(true);
    expect(await due("2026-11-01", "2026-11-01T06:30:00Z")).toBe(false);
    expect(await count("notifications", `type='workout_reminder'`)).toBe(2);
  });
  it("bulk scheduler creates a due local day only once", async () => {
    await db.query(
      `UPDATE notification_preferences SET reminder_days=ARRAY[extract(dow FROM now())::int],reminder_time='00:00' WHERE user_id=$1`,
      [userB],
    );
    expect(
      (
        await db.query<{ schedule_workout_reminders: number }>(
          "SELECT schedule_workout_reminders()",
        )
      ).rows[0].schedule_workout_reminders,
    ).toBe(1);
    expect(
      (
        await db.query<{ schedule_workout_reminders: number }>(
          "SELECT schedule_workout_reminders()",
        )
      ).rows[0].schedule_workout_reminders,
    ).toBe(0);
  });
  it("a deferred reminder is skipped if the user completes a workout before delivery", async () => {
    await db.query(
      `UPDATE notification_preferences SET reminder_days=ARRAY[extract(dow FROM now())::int],reminder_time='00:00' WHERE user_id=$1`,
      [userB],
    );
    await db.exec("SELECT schedule_workout_reminders()");
    await db.query(
      `INSERT INTO workouts(user_id,name,start_time,end_time,exercises) VALUES($1,'Done',$2,$2,$3)`,
      [userB, Date.now(), sets(100)],
    );
    const send = vi.fn();
    expect(
      (await deliverPushJobs(databaseWorkerClient(db), null, send)).skipped,
    ).toBe(2);
    expect(send).not.toHaveBeenCalled();
    expect(await count("push_delivery_jobs", "attempted_at IS NULL")).toBe(2);
  });
  it("maintenance removes expired device credentials but preserves other active installs", async () => {
    await db.query(
      `UPDATE push_subscriptions SET invalidated_at=now()-interval '31 days' WHERE install_id=$1`,
      [install1],
    );
    await db.exec("SELECT cleanup_notification_delivery()");
    expect(await count("push_subscriptions")).toBe(1);
  });
});
