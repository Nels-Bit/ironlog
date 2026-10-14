import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
export const userA = "11111111-1111-4111-8111-111111111111",
  userB = "22222222-2222-4222-8222-222222222222",
  userC = "33333333-3333-4333-8333-333333333333";
export async function notificationDatabase(legacy = false, refinement = true) {
  const db = new PGlite();
  // All test reminders use UTC unless a test explicitly selects another zone.
  await db.exec("SET TIME ZONE 'UTC'");
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
    CREATE TABLE public.workouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users,name text,start_time bigint,end_time bigint,volume_load numeric,exercises jsonb);
    CREATE TABLE public.exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users,name text,category text,target_muscle text,is_unilateral boolean);
    GRANT ALL ON public.workouts,public.exercises TO service_role;`);
  if (legacy) {
    // Production predates migration tracking and allowed only request messages.
    await db.exec(`CREATE TABLE public.notifications(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid NOT NULL REFERENCES auth.users,
      actor_id uuid REFERENCES auth.users,type text NOT NULL CHECK(type IN ('friend_request','friend_request_accepted')),
      message text NOT NULL,payload jsonb NOT NULL DEFAULT '{}',read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO auth.users(id) VALUES('${userA}'),('${userB}');
      INSERT INTO public.notifications(recipient_id,actor_id,type,message)
      VALUES('${userB}','${userA}','friend_request','Existing saved request');`);
  }
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20260914_social_notifications.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  // Match Supabase's legacy broad default grants, including RLS-bypassing TRUNCATE.
  await db.exec('GRANT ALL ON public.notifications,public.friendships TO anon,authenticated');
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261013_notification_center_push.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  if (refinement) await db.exec('BEGIN;'+await readFile(new URL('../../supabase/migrations/20261014005851_refine_notifications_and_barbell_exercises.sql',import.meta.url),'utf8')+'COMMIT;');
  return db;
}
/** Parameterized SQL adapter for exercising the actual worker against Postgres.
 * Only transport is replaced; migration functions/RLS/constraints execute for real. */
export function databaseWorkerClient(db: PGlite) {
  class Query {
    table: string;
    conditions: { key: string; value: unknown }[] = [];
    updates: Record<string, unknown> | null = null;
    columns = "*";
    one = false;
    constructor(table: string) {
      this.table = table;
    }
    select(columns = "*") {
      this.columns = columns;
      return this;
    }
    eq(key: string, value: unknown) {
      this.conditions.push({ key, value });
      return this;
    }
    update(values: Record<string, unknown>) {
      this.updates = values;
      return this;
    }
    maybeSingle() {
      this.one = true;
      return this;
    }
    async execute() {
      const parameters: unknown[] = [];
      const where =
        this.conditions
          .map((c) => {
            parameters.push(c.value);
            return `"${c.key}"=$${parameters.length}`;
          })
          .join(" AND ") || "true";
      try {
        let sql = `SELECT ${this.columns} FROM "${this.table}" WHERE ${where}`;
        if (this.updates) {
          const sets = Object.entries(this.updates)
            .map(([key, value]) => {
              parameters.push(value);
              return `"${key}"=$${parameters.length}`;
            })
            .join(",");
          sql = `UPDATE "${this.table}" SET ${sets} WHERE ${where} RETURNING *`;
        }
        const result = await db.query(sql, parameters);
        return {
          data: this.one ? result.rows[0] || null : result.rows,
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    }
    then<TResult1 = unknown, TResult2 = never>(
      resolve?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return this.execute().then(resolve, reject);
    }
  }
  return {
    from: (table: string) => new Query(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      try {
        const values = Object.values(args).map((v) =>
          v && typeof v === "object" ? JSON.stringify(v) : v,
        );
        const named = Object.keys(args)
          .map((key, i) => `${key} => $${i + 1}`)
          .join(",");
        const result = await db.query(
          `SELECT * FROM ${name}(${named})`,
          values,
        );
        return {
          data: name.startsWith("claim_")
            ? result.rows
            : (result.rows[0] as Record<string, unknown>)?.[name],
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
  } as unknown as SupabaseClient;
}
