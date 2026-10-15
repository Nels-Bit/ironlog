import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { databaseWorkerClient, notificationDatabase, userA, userB } from './helpers/notificationDatabase';
import { buildWorkoutNotifications } from '../src/utils/notificationEvents';
import { processNotificationEvents, deliverPushJobs } from '../server/notificationWorker';

const exerciseId='44444444-4444-4444-8444-444444444444',workoutId='55555555-5555-4555-8555-555555555555';
const entries=(weight:number,reps=5.5)=>[{id:'block',exerciseId,sets:[{id:'set',type:'failure',weight,reps,isCompleted:true}]}];
const snapshot=(weight=225.5)=>({exercises:[{id:exerciseId,name:'Barbell Bench Press',category:'Free Weights'}],workouts:[
  {id:'before',name:'Previous',start_time:1000,end_time:2000,volume_load:740,exercises:entries(185,4)},
  {id:workoutId,name:'Today',start_time:3000,end_time:4000,volume_load:1240.25,exercises:entries(weight)},
]});
it('combines only the matching lift trophy and keeps unrelated awards separate',()=>{
  const plan=buildWorkoutNotifications(workoutId,snapshot());
  const record=plan.find(n=>n.category==='friend_pr');
  expect(record?.body).toBe('Barbell Bench Press · 225.5 lb × 5.5 reps');
  expect(record?.award_body).toContain('Barbell Bench Press Trophy');
  expect(plan.filter(n=>n.event_key.startsWith(`trophy:${workoutId}:bench_press:`))).toHaveLength(0);
  expect(plan.some(n=>n.event_key.startsWith(`trophy:${workoutId}:volume:`))).toBe(true);
  expect(buildWorkoutNotifications(workoutId,snapshot(190)).find(n=>n.category==='friend_pr')?.award_body).toBeUndefined();
  expect(buildWorkoutNotifications(workoutId,snapshot())).toEqual(plan);
});
it('keeps separate combined alerts when two different lifts earn records and trophies',()=>{
  const input=snapshot();
  const squatId='88888888-8888-4888-8888-888888888888';
  input.exercises.push({id:squatId,name:'Barbell Squat',category:'Free Weights'});
  input.workouts[0].exercises.push({...entries(185,4)[0],id:'old-squat',exerciseId:squatId});
  input.workouts[1].exercises.push({...entries(225.5)[0],id:'new-squat',exerciseId:squatId});
  const records=buildWorkoutNotifications(workoutId,input).filter(n=>n.category==='friend_pr');
  expect(records).toHaveLength(2);
  for (const record of records) {
    const lift=record.body.split(' · ')[0];
    expect(record.award_body).toContain(`${lift} Trophy`);
    expect(record.award_body).not.toContain(lift==='Barbell Squat'?'Bench Press':'Squat');
  }
});
let db:PGlite;
beforeAll(async()=>{
  db=await notificationDatabase();
  const vapid=webpush.generateVAPIDKeys();
  vi.stubEnv('VAPID_PUBLIC_KEY',vapid.publicKey);vi.stubEnv('VAPID_PRIVATE_KEY',vapid.privateKey);vi.stubEnv('VAPID_SUBJECT','mailto:test@example.invalid');
},30000);
afterAll(async()=>{await db?.close();vi.unstubAllEnvs();});
beforeEach(async()=>{
  await db.exec('RESET ROLE; TRUNCATE auth.users CASCADE');
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[userA,userB]);
  await db.query("INSERT INTO user_profiles(user_id,user_code,display_name,is_public) VALUES($1,'a','Nelson',true),($2,'b','Bob',true)",[userA,userB]);
  await db.query("INSERT INTO friendships(requester_id,addressee_id,status) VALUES($1,$2,'accepted')",[userA,userB]);
  await db.query("INSERT INTO exercises(id,name,category,is_unilateral) VALUES($1,'Barbell Bench Press','Free Weights',false)",[exerciseId]);
  const curve=createECDH('prime256v1');curve.generateKeys();
  await db.query('SELECT register_push_install($1,$2,$3,$4,$5,true)',[userB,'66666666-6666-4666-8666-666666666666','https://web.push.apple.com/fake-device',curve.getPublicKey().toString('base64url'),randomBytes(16).toString('base64url')]);
  await db.query("INSERT INTO workouts(user_id,name,start_time,end_time,volume_load,exercises) VALUES($1,'Previous',1000,2000,740,$2)",[userA,JSON.stringify(entries(185,4))]);
});
const complete=async()=>{
  await db.query("INSERT INTO workouts(id,user_id,name,start_time,end_time,volume_load,exercises,notification_source) VALUES($1,$2,'Today',$3,$4,1240.25,$5,'live')",[workoutId,userA,Date.now()-1000,Date.now(),JSON.stringify(entries(225.5))]);
  expect(await processNotificationEvents(databaseWorkerClient(db))).toBeGreaterThan(0);
};
const row=async()=> (await db.query<{id:string;category:string;title:string;body:string;payload:Record<string,unknown>}>('SELECT * FROM notifications WHERE recipient_id=$1 AND event_key=$2',[userB,`pr:${workoutId}:bench_press`])).rows[0];
const send=()=>vi.fn().mockResolvedValue({statusCode:201,headers:{},body:''});
it('persists one combined inbox row and one push attempt per device, with retry deduplication',async()=>{
  await complete();const n=await row();
  expect(n.title).toBe('Nelson hit a new PR and received a new award');
  expect(n.body).toContain('225.5 lb × 5.5 reps');expect(n.body).toContain('Barbell Bench Press Trophy');
  expect((await db.query("SELECT id FROM notifications WHERE event_key LIKE $1",[`trophy:${workoutId}:bench_press:%`])).rows).toHaveLength(0);
  const transport=send();await deliverPushJobs(databaseWorkerClient(db),null,transport);await deliverPushJobs(databaseWorkerClient(db),null,transport);await processNotificationEvents(databaseWorkerClient(db));
  const payloads=transport.mock.calls.map(args=>JSON.parse(args[1])).filter(p=>p.notificationId===n.id);
  expect(payloads).toHaveLength(1);expect(payloads[0]).toMatchObject({title:'Milestone',body:expect.stringContaining('PR and received a new award')});
});
it.each([['friend_pr','friend_achievement'],['friend_achievement','friend_pr']])('respects %s opt-outs when creating the combined event',async(disabled,category)=>{
  await db.query('UPDATE notification_preferences SET in_app=jsonb_set(in_app,ARRAY[$1],\'false\'),push=jsonb_set(push,ARRAY[$1],\'false\') WHERE user_id=$2',[disabled,userB]);
  await complete();const n=await row();
  expect(n.category).toBe(category);expect(n.payload).not.toHaveProperty('awardBody');
  expect(n.title.includes('PR')).toBe(disabled!=='friend_pr');
  expect(n.title.includes('award')).toBe(disabled!=='friend_achievement');
});
it('rechecks changed switches before sending without dropping the still-enabled award',async()=>{
  await complete();const n=await row();
  await db.query("UPDATE notification_preferences SET in_app=jsonb_set(in_app,'{friend_pr}','false'),push=jsonb_set(push,'{friend_pr}','false') WHERE user_id=$1",[userB]);
  const transport=send();await deliverPushJobs(databaseWorkerClient(db),null,transport);
  const payload=transport.mock.calls.map(args=>JSON.parse(args[1])).find(p=>p.notificationId===n.id);
  expect(payload.title).toBe('Award');expect(payload.body).toContain('Nelson received a new award');expect(payload.body).not.toContain('PR');expect(payload.body).not.toContain('225.5');
});
it('does not send the combined alert after both categories are disabled',async()=>{
  await complete();const n=await row();
  await db.query("UPDATE notification_preferences SET in_app=jsonb_set(jsonb_set(in_app,'{friend_pr}','false'),'{friend_achievement}','false'),push=jsonb_set(jsonb_set(push,'{friend_pr}','false'),'{friend_achievement}','false') WHERE user_id=$1",[userB]);
  const transport=send();await deliverPushJobs(databaseWorkerClient(db),null,transport);
  expect(transport.mock.calls.map(args=>JSON.parse(args[1])).some(p=>p.notificationId===n.id)).toBe(false);
});
it('the database rejects attaching an unrelated lift trophy to a record',async()=>{
  await db.query("INSERT INTO workouts(id,user_id,name,start_time,end_time,volume_load,exercises,notification_source) VALUES($1,$2,'Today',$3,$4,1240.25,$5,'live')",[workoutId,userA,Date.now()-1000,Date.now(),JSON.stringify(entries(225.5))]);
  const claim=(await db.query<{id:string;lease_id:string}>('SELECT * FROM claim_notification_events(NULL)')).rows[0];
  const record=buildWorkoutNotifications(workoutId,snapshot()).find(n=>n.category==='friend_pr')!;
  await expect(db.query('SELECT emit_notification_event($1,$2,$3)',[claim.id,claim.lease_id,JSON.stringify([{...record,award_body:'Gold Barbell Squat Trophy'}])])).rejects.toThrow('Invalid matching trophy');
  expect((await db.query('SELECT id FROM notifications')).rows).toHaveLength(0);
});
