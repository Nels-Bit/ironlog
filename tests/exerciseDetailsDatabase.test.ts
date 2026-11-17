import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const shared='44444444-4444-4444-8444-444444444444',own='55555555-5555-4555-8555-555555555555',other='66666666-6666-4666-8666-666666666666';
let db:PGlite;
const actor=async(user=a)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET ROLE authenticated');};
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
    CREATE TABLE public.exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users,name text,category text,target_muscle text,is_unilateral boolean);
    CREATE TABLE public.workouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users,exercises jsonb,volume_load numeric);
    ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY read_own_workouts ON workouts FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
    INSERT INTO auth.users VALUES('${a}'),('${b}');
    INSERT INTO exercises VALUES('${shared}',NULL,'Shared machine','Machines','Chest',false),('${own}','${a}','My machine','Machines','Chest',false),('${other}','${b}','Other machine','Machines','Chest',false);
    INSERT INTO workouts(user_id,exercises,volume_load) VALUES('${a}','[{"exerciseId":"${own}","sets":[{"weight":50,"reps":8}]}]',400);`);
  const backup=await readFile(new URL('../supabase/migrations/20261117010016_exercise_release_backup.sql',import.meta.url),'utf8');
  await db.exec('BEGIN;'+backup+'COMMIT;');
  const sql=await readFile(new URL('../supabase/migrations/20261116183412_exercise_preferences_and_editing.sql',import.meta.url),'utf8');
  await db.exec('BEGIN;'+sql+'COMMIT;');
},30000);
beforeEach(async()=>{await db.exec('RESET ROLE;DELETE FROM exercise_settings;');await actor();});
afterAll(async()=>{await db?.close();});
const settings=async(id=shared,resistance:number|null=20,notes:string|null='Seat 3')=>
  (await db.query<{value:{starting_resistance:number;notes:string}}>('SELECT save_exercise_settings($1,$2,$3) AS value',[id,resistance,notes])).rows[0].value;
const edit=async(id:string|null=own,name='Renamed',category='Machines',notes='My notes')=>
  db.query('SELECT save_custom_exercise($1,$2,$3,$4,$5,$6,$7) AS value',[id,name,category,'Chest',false,20,notes]);
it('keeps original definitions, history and total loads intact when installing',async()=>{
  const row=(await db.query<{volume_load:string;exercises:unknown}>('SELECT * FROM workouts')).rows[0];
  expect(Number(row.volume_load)).toBe(400);
  expect(row.exercises).toEqual([{exerciseId:own,sets:[{weight:50,reps:8}]}]);
  expect((await db.query('SELECT * FROM exercise_settings')).rows).toHaveLength(0);
});
it('persists personal settings, allows removing notes, and preserves resistance on note-only saves',async()=>{
  expect(await settings()).toMatchObject({starting_resistance:20,notes:'Seat 3'});
  expect(await settings(shared,null,'')).toMatchObject({starting_resistance:20,notes:''});
  expect(await settings(shared,30,null)).toMatchObject({starting_resistance:30,notes:''});
});
it('isolates two users and rejects owner reassignment and unauthorized exercise settings',async()=>{
  await settings(); await actor(b);
  expect((await db.query('SELECT * FROM exercise_settings')).rows).toEqual([]);
  expect((await db.query('UPDATE exercise_settings SET notes=\'stolen\' WHERE user_id=$1 RETURNING *',[a])).rows).toEqual([]);
  await expect(settings(own)).rejects.toThrow('not available');
  await settings(shared,10,'Other seat'); await actor(a);
  expect((await db.query('SELECT notes FROM exercise_settings')).rows).toEqual([{notes:'Seat 3'}]);
  await expect(db.query('UPDATE exercise_settings SET user_id=$1',[b])).rejects.toThrow();
});
it('edits an owned definition in place but rejects shared and other-user definitions',async()=>{
  await edit(); expect((await db.query('SELECT name FROM exercises WHERE id=$1',[own])).rows).toEqual([{name:'Renamed'}]);
  await expect(edit(shared)).rejects.toThrow('Only exercises'); await expect(edit(other)).rejects.toThrow('Only exercises');
  expect((await db.query('SELECT volume_load FROM workouts')).rows[0]).toMatchObject({volume_load:'400'});
});
it('protects tracking fields on historical exercises and rolls back failed multi-part saves',async()=>{
  await expect(edit(own,'Will not save','Bodyweight')).rejects.toThrow('workout history');
  const before=(await db.query('SELECT name FROM exercises WHERE id=$1',[own])).rows[0];
  await expect(edit(own,'Also will not save','Machines','x'.repeat(501))).rejects.toThrow();
  expect((await db.query('SELECT name FROM exercises WHERE id=$1',[own])).rows[0]).toEqual(before);
  const count=(await db.query('SELECT id FROM exercises')).rows.length;
  await expect(edit(null,'Invalid new exercise','Machines','x'.repeat(501))).rejects.toThrow();
  expect((await db.query('SELECT id FROM exercises')).rows).toHaveLength(count);
});
it('enforces limits, allows custom creation, denies anonymous calls and RLS-bypassing truncate',async()=>{
  expect((await settings(shared,0,'x'.repeat(500))).notes).toHaveLength(500);
  await expect(settings(shared,-1)).rejects.toThrow(); await expect(settings(shared,10001)).rejects.toThrow();
  await expect(db.query("SELECT save_exercise_settings($1,'NaN','')",[shared])).rejects.toThrow();
  const created=(await edit(null,'New exercise')).rows[0] as {value:{id:string;user_id:string}};
  expect(created.value.user_id).toBe(a);expect(created.value.id).toBeTruthy();
  await expect(db.exec('TRUNCATE exercise_settings')).rejects.toThrow();
  expect((await db.query<{allowed:boolean}>("SELECT has_table_privilege('authenticated','exercise_settings','TRUNCATE') AS allowed")).rows[0].allowed).toBe(false);
  expect((await db.query<{prosecdef:boolean}>("SELECT prosecdef FROM pg_proc WHERE proname IN ('save_exercise_settings','save_custom_exercise')")).rows.every(row=>!row.prosecdef)).toBe(true);
  await db.exec('RESET ROLE;SET ROLE anon');
  await expect(db.query('SELECT save_exercise_settings($1,0,\'\')',[shared])).rejects.toThrow('permission denied');
  await expect(db.query('SELECT * FROM exercise_settings')).rejects.toThrow('permission denied');
});
