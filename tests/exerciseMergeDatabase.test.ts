import { beforeAll, afterAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { notificationDatabase, userA, userB } from './helpers/notificationDatabase';
let db: PGlite;
const shared='44444444-4444-4444-8444-444444444444', custom='55555555-5555-4555-8555-555555555555', machine='66666666-6666-4666-8666-666666666666';
const block={id:'block',exerciseId:shared,extra:'retained',sets:[{id:'parent',type:'dropset',weight:185,reps:5,isCompleted:true},{id:'child',type:'dropset_child',parentSetId:'parent',weight:135,reps:8,isCompleted:true}]};
beforeAll(async()=>{
  db=await notificationDatabase(false,false);
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[userA,userB]);
  await db.query("INSERT INTO exercises(id,user_id,name,category,target_muscle) VALUES($1,NULL,'Squat','Free Weights','Quads'),($2,$4,'Barbell Squat','Free Weights','Quads'),($3,$4,'Squat ','Machines','Quads')",[shared,custom,machine,userA]);
  await db.query('INSERT INTO workouts(user_id,name,start_time,end_time,volume_load,exercises) VALUES($1,\'array\',1,2,900,$3),($1,\'legacy\',3,4,900,$4),($1,\'string\',5,6,900,$5),($2,\'other-owner\',7,8,900,$3)',[userA,userB,JSON.stringify([block,{...block,id:'duplicate',exerciseId:custom}]),JSON.stringify([{...block,exerciseId:undefined,exercise_id:shared}]),JSON.stringify(JSON.stringify([block]))]);
  await db.query("INSERT INTO notification_preferences(user_id,push_enabled,in_app) VALUES($1,true,'{\"personal_pr\":true,\"friend_workout\":false}')",[userA]);
  await db.query("INSERT INTO notifications(recipient_id,type,category,event_key,title,body,message) VALUES($1,'personal_record','personal_pr','old-pr','Old PR','Old PR','Old PR'),($1,'test_push','personal_achievement','old-test','Test','Test','Test')",[userA]);
  await db.exec('BEGIN;'+await readFile(new URL('../supabase/migrations/20261014005851_refine_notifications_and_barbell_exercises.sql',import.meta.url),'utf8')+'COMMIT;');
},30000);
afterAll(async()=>{await db?.close();});
it('preserves every definition, workload field, set and drop link in every legacy shape',async()=>{
  const rows=(await db.query<{name:string;exercises:unknown;volume_load:string}>('SELECT name,exercises,volume_load FROM workouts ORDER BY start_time')).rows;
  expect(rows).toHaveLength(4);
  for(const row of rows){
    const entries=(typeof row.exercises==='string'?JSON.parse(row.exercises):row.exercises) as typeof block[];
    expect(entries[0].sets).toEqual(block.sets);
    expect(entries[0].extra).toBe('retained');
    expect(Number(row.volume_load)).toBe(900);
    const target=row.name==='other-owner'?shared:custom;
    expect((entries[0] as unknown as Record<string,unknown>)[row.name==='legacy'?'exercise_id':'exerciseId']).toBe(target);
  }
  expect((await db.query('SELECT * FROM exercises')).rows).toHaveLength(3);
  expect((await db.query<{name:string}>('SELECT name FROM exercises WHERE id=$1',[shared])).rows[0].name).toBe('Barbell Squat');
  expect((await db.query<{name:string}>('SELECT name FROM exercises WHERE id=$1',[machine])).rows[0].name).toBe('Squat ');
  expect((await db.query('SELECT * FROM notification_events')).rows).toHaveLength(0);
});
it('keeps private rollback copies and original identities intact',async()=>{
  expect((await db.query('SELECT * FROM ironlog_barbell_backup_20261013.workouts')).rows).toHaveLength(4);
  expect((await db.query('SELECT * FROM ironlog_barbell_backup_20261013.exercises')).rows).toHaveLength(3);
});
it('old/offline clients saving an old id are redirected without losing sets',async()=>{
  const row=(await db.query<{exercises:typeof block[]}>('INSERT INTO workouts(user_id,name,start_time,exercises) VALUES($1,\'offline\',9,$2) RETURNING exercises',[userA,JSON.stringify([block])])).rows[0];
  expect(row.exercises[0].exerciseId).toBe(custom);
  expect(row.exercises[0].sets).toEqual(block.sets);
});
it('disables removed categories even when an old client attempts to enable them',async()=>{
  await db.query("UPDATE notification_preferences SET push=push||'{\"personal_pr\":true}'::jsonb WHERE user_id=$1",[userA]);
  expect((await db.query<{allowed:boolean}>("SELECT notification_category_enabled($1,'personal_pr',true) AS allowed",[userA])).rows[0].allowed).toBe(false);
  const notes=(await db.query<{type:string;category:string;in_app_visible:boolean}>('SELECT type,category,in_app_visible FROM notifications')).rows;
  expect(notes.find(n=>n.type==='personal_record')?.in_app_visible).toBe(false);
  expect(notes.find(n=>n.type==='test_push')).toMatchObject({category:'test_push',in_app_visible:true});
});
it('alias mappings are owner-only and cannot be forged by a client',async()=>{
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[userB]);
  await db.exec('SET ROLE authenticated');
  expect((await db.query('SELECT * FROM exercise_id_aliases')).rows).toHaveLength(0);
  await expect(db.query('INSERT INTO exercise_id_aliases VALUES($1,$2,$3)',[userB,shared,custom])).rejects.toThrow();
  await expect(db.query('SELECT * FROM ironlog_barbell_backup_20261013.workouts')).rejects.toThrow();
  await db.exec('RESET ROLE');
});
