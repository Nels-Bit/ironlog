import { beforeAll, afterAll, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { notificationDatabase, userA, userB } from './helpers/notificationDatabase';
let db: PGlite;
beforeAll(async () => {
  db = await notificationDatabase(false, true, false);
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[userA,userB]);
  await db.query("INSERT INTO user_profiles(user_id,user_code,display_name,is_public) VALUES($1,'a','Alice',false),($2,'b','Bob',true)",[userA,userB]);
  await db.query("INSERT INTO notification_preferences(user_id,in_app,push,quiet_enabled,share_activity,reminder_days,timezone) VALUES($1,'{\"friend_pr\":false}','{\"friend_workout\":false}',true,false,ARRAY[1,3],'America/New_York')",[userA]);
  await db.exec('BEGIN;'+await readFile(new URL('../supabase/migrations/20261014020956_simplify_notification_preferences.sql',import.meta.url),'utf8')+'COMMIT;');
},30000);
afterAll(async()=>{await db?.close();});
const asUser = async(id:string) => {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('SET ROLE authenticated');
};
it('backs up preferences and preserves opt-outs while joining channels',async()=>{
  const p=(await db.query<{in_app:Record<string,boolean>;push:Record<string,boolean>;quiet_enabled:boolean;share_activity:boolean;reminder_days:number[];timezone:string}>('SELECT * FROM notification_preferences WHERE user_id=$1',[userA])).rows[0];
  expect(p.in_app).toEqual(p.push);
  expect(p.push.friend_pr).toBe(false); expect(p.push.friend_workout).toBe(false);
  expect(p.quiet_enabled).toBe(false); expect(p.share_activity).toBe(false);
  expect(p.reminder_days).toEqual([1,3]); expect(p.timezone).toBe('America/New_York');
  expect((await db.query<{quiet_enabled:boolean}>('SELECT quiet_enabled FROM ironlog_notification_settings_backup_20261013.preferences')).rows[0].quiet_enabled).toBe(true);
});
it('old clients cannot reintroduce independent toggles or quiet hours',async()=>{
  await asUser(userA);
  await db.query("UPDATE notification_preferences SET in_app='{\"friend_pr\":true}',push='{\"friend_pr\":false}',quiet_enabled=true WHERE user_id=$1",[userA]);
  const p=(await db.query<{in_app:Record<string,boolean>;push:Record<string,boolean>;quiet_enabled:boolean}>('SELECT in_app,push,quiet_enabled FROM notification_preferences')).rows[0];
  expect(p.in_app).toEqual(p.push); expect(p.in_app.friend_pr).toBe(false); expect(p.quiet_enabled).toBe(false);
});
it('privacy and sharing save together for the owner without affecting another account',async()=>{
  await asUser(userA); await db.exec('SELECT save_social_privacy(true,false)');
  await db.exec('RESET ROLE');
  const rows=(await db.query<{user_id:string;is_public:boolean}>('SELECT user_id,is_public FROM user_profiles ORDER BY user_id')).rows;
  expect(rows).toEqual([{user_id:userA,is_public:true},{user_id:userB,is_public:true}]);
  expect((await db.query<{share_activity:boolean}>('SELECT share_activity FROM notification_preferences WHERE user_id=$1',[userA])).rows[0].share_activity).toBe(false);
  await asUser(userA); await db.exec('SELECT save_social_privacy(false,true)');
  await db.exec('RESET ROLE');
  expect((await db.query<{notification_social_allowed:boolean}>('SELECT notification_social_allowed($1,$2)',[userA,userB])).rows[0].notification_social_allowed).toBe(false);
});
it('rolls back profile privacy if the consent write fails',async()=>{
  await db.exec('RESET ROLE; REVOKE INSERT ON notification_preferences FROM authenticated');
  await asUser(userA);
  await expect(db.exec('SELECT save_social_privacy(true,true)')).rejects.toThrow();
  await db.exec('RESET ROLE; GRANT INSERT ON notification_preferences TO authenticated');
  expect((await db.query<{is_public:boolean}>('SELECT is_public FROM user_profiles WHERE user_id=$1',[userA])).rows[0].is_public).toBe(false);
});
it('keeps the RPC invoker-only and snapshots inaccessible to clients',async()=>{
  await db.exec('RESET ROLE');
  expect((await db.query<{prosecdef:boolean}>("SELECT prosecdef FROM pg_proc WHERE oid='public.save_social_privacy(boolean,boolean)'::regprocedure")).rows[0].prosecdef).toBe(false);
  expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege('anon','public.save_social_privacy(boolean,boolean)','EXECUTE') AS allowed")).rows[0].allowed).toBe(false);
  await asUser(userA);
  await expect(db.exec('SELECT * FROM ironlog_notification_settings_backup_20261013.preferences')).rejects.toThrow();
  await expect(db.exec('SELECT save_social_privacy(NULL,true)')).rejects.toThrow();
});
