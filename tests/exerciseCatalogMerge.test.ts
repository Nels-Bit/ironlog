import { expect, it, vi } from 'vitest';
import { createIronLogSeed } from '../src/lib/demo-seed';
import { createDemoProvider } from '../src/lib/demo-transport';
it('uses the existing custom lift in catalog, creation, ghost sets and PR lookup without production traffic',async()=>{
  const seed=createIronLogSeed();
  seed.tables.exercises.push({id:'own-squat',name:'Barbell Squat',user_id:'demo-alex',category:'Free Weights',target_muscle:'Quads'});
  seed.tables.exercise_id_aliases=[{user_id:'demo-alex',old_exercise_id:'demo-squat',exercise_id:'own-squat'}];
  const sets=[{id:'parent',type:'dropset',weight:250,reps:5,isCompleted:true},{id:'child',type:'dropset_child',parentSetId:'parent',weight:200,reps:8,isCompleted:true}];
  seed.tables.workouts=[{id:'w',user_id:'demo-alex',name:'Legs',start_time:100,end_time:200,volume_load:2850,exercises:[{id:'b1',exerciseId:'own-squat',sets},{id:'b2',exerciseId:'own-squat',sets:[{id:'extra',type:'normal',weight:275,reps:3,isCompleted:true}]}]}];
  const provider=createDemoProvider(seed);
  vi.doMock('../src/lib/supabase',()=>({supabase:provider.client}));
  const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Production forbidden'));
  try{
    const {exerciseService}=await import('../src/services/exerciseService');
    const {workoutService}=await import('../src/services/workoutService');
    const list=await exerciseService.getAllExercises();
    expect(list.some(e=>e.id==='demo-squat')).toBe(false);
    expect(list.find(e=>e.id==='own-squat')?.isCustom).toBe(true);
    expect((await exerciseService.createExercise({name:'Squat',category:'Free Weights'})).id).toBe('own-squat');
    expect(provider.snapshot().tables.exercises).toHaveLength(seed.tables.exercises.length);
    expect((await workoutService.getLastLog('demo-squat'))?.sets.map(s=>s.id)).toEqual(['parent','child','extra']);
    expect(await workoutService.getPersonalRecord('demo-squat')).toBe(275);
    expect(network).not.toHaveBeenCalled();
  }finally{network.mockRestore();vi.doUnmock('../src/lib/supabase');}
});
