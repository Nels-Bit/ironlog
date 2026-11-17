import { expect, it } from 'vitest';
import type { WorkoutSession } from '../src/types';
import { enteredSetWeight, updateActiveStartingResistance } from '../src/utils/exerciseDetails';
import { getBestPRPerformance, getSetLoad } from '../src/utils/workoutMath';
import { getSummarySets } from '../src/utils/workoutSummary';
import { getWorkoutExercises } from '../src/utils/workoutSchema';
import { calculateWorkoutXP } from '../src/utils/xpEngine';

const def={id:'machine',name:'Machine Press',category:'Machines',startingResistance:100};
const current:WorkoutSession={id:'active',name:'Test',startTime:1,volumeLoad:0,exercises:[
  {id:'e',exerciseId:def.id,sets:[{id:'parent',type:'normal',weight:108,reps:10,startingResistance:100,isCompleted:true}]},
]};
it.each([[200,208],[20,28],[0,8],[100.5,108.5]])('recalculates unsaved sets at base %s while keeping 8 lb entered', (startingResistance,total)=>{
  const changed=updateActiveStartingResistance(current,{...def,startingResistance})!;
  const set=changed.exercises[0].sets[0];
  expect(enteredSetWeight(set)).toBe(8);
  expect(set).toMatchObject({weight:total,startingResistance,reps:10,isCompleted:true});
  expect(getBestPRPerformance([set],def).load).toBe(total);
  expect(getSetLoad(set,def)*set.reps!).toBe(total*10);
  expect(getSummarySets(changed.exercises[0],def)[0].load).toBe('8 lb');
  expect(current.exercises[0].sets[0].weight).toBe(108);
});
it('uses the corrected total for volume XP when the workout is finished',()=>{
  const changedDef={...def,startingResistance:200};
  const changed=updateActiveStartingResistance(current,changedDef)!;
  const set=changed.exercises[0].sets[0];
  const finished={...changed,endTime:100,volumeLoad:getSetLoad(set,changedDef)*set.reps!};
  expect(finished.volumeLoad).toBe(2080);
  expect(calculateWorkoutXP(finished,{seenExerciseIds:new Set([def.id]),bestWeights:new Map(),
    streakDays:0,exerciseDefs:new Map([[def.id,changedDef]]),userWeight:null}).volume).toBe(4);
  expect(getWorkoutExercises(JSON.stringify(finished.exercises))[0].sets[0]).toMatchObject({weight:208,startingResistance:200});
});
it('updates duplicate exercise instances and drop children without filling blank inputs or changing neighbors',()=>{
  const set=current.exercises[0].sets[0];
  const source:WorkoutSession={...current,exercises:[
    {...current.exercises[0],sets:[{...set,type:'dropset'},
      {...set,id:'child',type:'dropset_child',parentSetId:'parent',weight:105},
      {...set,id:'blank',weight:null,isCompleted:false}]},
    {...current.exercises[0],id:'duplicate'},
    {...current.exercises[0],id:'other',exerciseId:'other-machine'},
  ]};
  const changed=updateActiveStartingResistance(source,{...def,startingResistance:150})!;
  expect(changed.exercises[0].sets.map(set=>set.weight)).toEqual([158,155,null]);
  expect(changed.exercises[0].sets[1]).toMatchObject({type:'dropset_child',parentSetId:'parent',startingResistance:150});
  expect(changed.exercises[1].sets[0].weight).toBe(158);
  expect(changed.exercises[2]).toBe(source.exercises[2]);
});
it('leaves saved history, missing workouts and repeated unchanged metadata events intact',()=>{
  const saved={...current,endTime:100,volumeLoad:1080};
  expect(updateActiveStartingResistance(saved,{...def,startingResistance:200})).toBe(saved);
  expect(updateActiveStartingResistance(null,def)).toBeNull();
  expect(updateActiveStartingResistance(current,def)).toBe(current);
  const changed=updateActiveStartingResistance(current,{...def,startingResistance:150})!;
  expect(updateActiveStartingResistance(changed,{...def,startingResistance:150,notes:'Seat 2'})).toBe(changed);
});
