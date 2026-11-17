import { describe, expect, it } from 'vitest';
import type { ExerciseSet } from '../src/types';
import { changeWorkoutSetType, enteredSetWeight, ghostEnteredWeight, removeWorkoutSet, startingResistanceFor, totalSetWeight, validateExerciseSettings } from '../src/utils/exerciseDetails';
import { getWorkoutExercises } from '../src/utils/workoutSchema';
import { getSetLoad, shouldCountSetForVolume } from '../src/utils/workoutMath';
import { getSummarySets } from '../src/utils/workoutSummary';
import { getExerciseProgress } from '../src/utils/exerciseLogging';
import { calculateWorkoutXP } from '../src/utils/xpEngine';
const normal: ExerciseSet = {id:'parent',type:'normal',weight:50,reps:8,isCompleted:true};
const parent: ExerciseSet = {...normal,type:'dropset'};
const child: ExerciseSet = {...normal,id:'child',type:'dropset_child',parentSetId:'parent',weight:35};
describe('starting resistance snapshots',()=>{
  it('adds starting resistance once, preserving decimals and the entered amount',()=>{
    const set={...normal,startingResistance:20.5};
    set.weight=totalSetWeight(set,50.25)!;
    expect(set.weight).toBe(70.75); expect(enteredSetWeight(set)).toBe(50.25);
    expect(getSetLoad(set)).toBe(70.75); expect(shouldCountSetForVolume(set)).toBe(true);
    expect(getSetLoad(set)*set.reps!).toBe(566);
    expect(totalSetWeight(set,enteredSetWeight(set))).toBe(70.75);
  });
  it('keeps blank input blank, but treats explicit zero as the starting resistance',()=>{
    const set={...normal,startingResistance:20};
    expect(totalSetWeight(set,null)).toBeNull(); expect(totalSetWeight(set,0)).toBe(20);
    expect(enteredSetWeight({...set,weight:null})).toBeNull();
  });
  it('keeps old loads unchanged even after the exercise default changes',()=>{
    expect(enteredSetWeight(normal)).toBe(50); expect(getSetLoad(normal)).toBe(50);
    expect(startingResistanceFor({id:'x',name:'Machine',category:'Machines',startingResistance:40})).toBe(40);
    expect(getSetLoad({...normal,startingResistance:20,weight:70})).toBe(70);
    expect(startingResistanceFor({id:'x',name:'Run',category:'Cardio',startingResistance:40})).toBe(0);
  });
  it('copies the previously entered plates into hints, not another copy of the base',()=>{
    const fresh={...normal,startingResistance:30};
    expect(ghostEnteredWeight(fresh,{...normal,startingResistance:20,weight:70})).toBe(50);
    expect(totalSetWeight(fresh,ghostEnteredWeight(fresh,{...normal,startingResistance:20,weight:70}))).toBe(80);
    expect(ghostEnteredWeight(fresh,normal)).toBe(20);
    expect(totalSetWeight(fresh,ghostEnteredWeight(fresh,normal))).toBe(50);
    expect(ghostEnteredWeight(fresh,{...normal,startingResistance:0})).toBe(50);
  });
  it('round trips the snapshot and displays entered weight in saved summaries',()=>{
    const [exercise]=getWorkoutExercises(JSON.stringify([{id:'e',exerciseId:'machine',sets:[{...normal,weight:70,startingResistance:20}]}]));
    expect(exercise.sets[0].startingResistance).toBe(20);
    expect(enteredSetWeight(exercise.sets[0])).toBe(50);
    expect(getSummarySets(exercise)[0].load).toBe('50 lb');
  });
  it('shows 10 lb in exercise summaries while XP and volume count the 100 lb base plus 10',()=>{
    const def={id:'machine',name:'Machine Press',category:'Machines',startingResistance:100};
    const set={...normal,weight:110,startingResistance:100,reps:10};
    const exercise={id:'e',exerciseId:def.id,sets:[set]};
    const volume=getSetLoad(set,def)*set.reps;
    expect(volume).toBe(1100);
    expect(getSummarySets(exercise,def)[0].load).toBe('10 lb');
    expect(getExerciseProgress(exercise,def).summary).toBe('10 lb × 10');
    const xp=calculateWorkoutXP({id:'w',name:'Machine',startTime:1,volumeLoad:volume,exercises:[exercise]},
      {seenExerciseIds:new Set([def.id]),bestWeights:new Map(),streakDays:0,exerciseDefs:new Map([[def.id,def]]),userWeight:null});
    expect(xp.volume).toBe(2);
    expect(set.weight).toBe(110);
  });
  it('does not expose floating point subtraction noise in displayed weights',()=>{
    expect(enteredSetWeight({...normal,weight:110.1,startingResistance:100})).toBe(10.1);
  });
  it.each([-1,10000.1,NaN,Infinity])('rejects invalid resistance %s',startingResistance=>
    expect(()=>validateExerciseSettings({startingResistance})).toThrow('Starting resistance'));
  it('enforces the notes limit without losing line breaks or interpreting markup',()=>{
    expect(()=>validateExerciseSettings({notes:'x'.repeat(500),startingResistance:0})).not.toThrow();
    expect(()=>validateExerciseSettings({notes:'x'.repeat(501)})).toThrow('500');
    expect(()=>validateExerciseSettings({notes:'Seat 3\n<script>not executable</script>'})).not.toThrow();
  });
});
describe('drop-set deletion and type repair',()=>{
  it('turns the parent normal after deleting its final child and preserves all values',()=>{
    const source=[parent,child,{...normal,id:'other'}];
    const result=removeWorkoutSet(source,1);
    expect(result[0]).toMatchObject({...normal,type:'normal'});
    expect(result[1]).toBe(source[2]); expect(source[0].type).toBe('dropset');
  });
  it('keeps the parent a drop set while at least one child remains',()=>{
    const result=removeWorkoutSet([parent,child,{...child,id:'second-child'}],1);
    expect(result[0].type).toBe('dropset'); expect(result[1].id).toBe('second-child');
    expect(removeWorkoutSet(result,1)[0].type).toBe('normal');
  });
  it('removes all children with their parent without touching unrelated drop families',()=>{
    const second={...parent,id:'second'};
    const result=removeWorkoutSet([parent,child,{...child,id:'child2'},second,{...child,id:'second-child',parentSetId:'second'}],0);
    expect(result.map(set=>set.id)).toEqual(['second','second-child']);
    expect(result[0].type).toBe('dropset');
  });
  it('creates the parent and child atomically and carries the resistance snapshot',()=>{
    const original={...normal,startingResistance:20};
    const result=changeWorkoutSetType([original],0,'dropset','new-child');
    expect(result[0].type).toBe('dropset');
    expect(result[1]).toMatchObject({id:'new-child',type:'dropset_child',parentSetId:'parent',startingResistance:20,weight:null});
    expect(original.type).toBe('normal');
    expect(changeWorkoutSetType(result,0,'warmup','unused')).toEqual([{...original,type:'warmup',parentSetId:undefined}]);
  });
  it('detaching the last child also repairs the parent and ignores invalid indexes',()=>{
    const source=[parent,child];
    const result=changeWorkoutSetType(source,1,'normal','unused');
    expect(result.map(set=>set.type)).toEqual(['normal','normal']);
    expect(result[1].parentSetId).toBeUndefined();
    expect(removeWorkoutSet(source,9)).toBe(source);
    expect(changeWorkoutSetType(source,9,'warmup','unused')).toBe(source);
  });
});
