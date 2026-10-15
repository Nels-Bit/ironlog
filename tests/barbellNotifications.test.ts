import { describe, expect, it } from 'vitest';
import { getBarbellLift, remapWorkoutExerciseIds, combineExerciseLogs } from '../src/utils/barbellLifts';
import { buildWorkoutNotifications } from '../src/utils/notificationEvents';
import { normalizePreferences, notificationCategories } from '../src/utils/notifications';
import { pushPresentation } from '../server/pushPresentation';
import type { WorkoutExercise } from '../src/types';
import { calculateTrophyCabinet } from '../src/utils/gamification';

describe('barbell-only friend PRs and removed personal alerts', () => {
  it.each(['Squat', 'Barbell Squat', '  BARBELL   SQUAT  '])('recognizes exact squat alias %s', name =>
    expect(getBarbellLift({name,category:'Free Weights'})).toBe('squat'));
  it.each(['Front Squat','Dumbbell Bench Press','Incline Bench Press','Romanian Deadlift','Sumo Deadlift','Leg Press'])('rejects variation %s', name =>
    expect(getBarbellLift({name,category:'Free Weights'})).toBeNull());
  it.each(['Machines','Cables','Smith Machine','Cardio','Bodyweight'])('rejects non-barbell equipment %s', category =>
    expect(getBarbellLift({name:'Squat',category})).toBeNull());
  const plan = (name = 'Barbell Squat', previous = 100, current = 200) => buildWorkoutNotifications('new', {
    exercises: [{id:'default',name:'Squat',category:'Free Weights'}, {id:'custom',name,category:'Free Weights'}],
    workouts: [
      {id:'old',name:'Leg Day',start_time:1,end_time:2,exercises:[{id:'old-block',exerciseId:'default',sets:[{id:'old-set',weight:previous,reps:5,type:'normal',isCompleted:true}]}]},
      {id:'new',name:'Leg Day',start_time:3,end_time:4,exercises:[{id:'new-block',exerciseId:'custom',sets:[{id:'new-set',weight:current,reps:5,type:'failure',isCompleted:true}]}]},
    ],
  });
  it('compares merged default/custom history as one lift, not a first-use PR', () => {
    expect(plan('Barbell Squat',250,200).some(n => n.type==='personal_record')).toBe(false);
    const records = plan().filter(n => n.type==='personal_record');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({category:'friend_pr',audience:'friends',body:'Barbell Squat · 200 lb × 5 reps'});
  });
  it('retains normal app PRs but does not plan alerts for other exercises', () =>
    expect(plan('Dumbbell Curl').some(n => n.type==='personal_record')).toBe(false));
  it('never emits the four self milestone types even when awards are earned', () => {
    const events=plan();
    expect(events.some(n => n.category==='friend_achievement' || n.award_body)).toBe(true);
    expect(events.every(n => n.audience==='friends')).toBe(true);
    expect(events.some(n => n.type==='streak_milestone')).toBe(false);
    expect(Object.keys(notificationCategories)).toHaveLength(5);
  });
  it('strips obsolete category preferences without reviving disabled friend toggles', () => {
    const p=normalizePreferences({push:{friend_pr:false,personal_pr:true} as never});
    expect(p.push.friend_pr).toBe(false);
    expect(p.push).not.toHaveProperty('personal_pr');
  });
});
describe('merge preserves logs and drop relationships', () => {
  it('barbell trophies do not inherit machine, dumbbell or variation loads', () => {
    const definitions = new Map([
      ['machine',{id:'machine',name:'Squat',category:'Machines'}],
      ['dumbbell',{id:'dumbbell',name:'Dumbbell Bench Press',category:'Free Weights'}],
      ['rdl',{id:'rdl',name:'Romanian Deadlift',category:'Free Weights'}],
    ]);
    const exercises = [...definitions.keys()].map(id => ({id,exerciseId:id,sets:[{id,type:'normal' as const,weight:500,reps:5,isCompleted:true}]}));
    const cabinet = calculateTrophyCabinet({exerciseDefs:definitions,history:[{id:'w',name:'Variants',startTime:1,endTime:2,volumeLoad:7500,exercises}],totalXP:0,prCount:0});
    const lifts=cabinet.filter(t=>['bench_press','squat','deadlift'].includes(t.category));
    expect(lifts.map(t=>t.categoryLabel)).toEqual(['Barbell Bench Press','Barbell Squat','Barbell Deadlift']);
    expect(lifts.every(t=>t.rank==='locked')).toBe(true);
  });
  it('keeps all blocks/sets and combines ghost history after identity remapping', () => {
    const entries: WorkoutExercise[]=[{id:'parent-block',exerciseId:'old',sets:[{id:'parent',type:'dropset',weight:100,reps:5,isCompleted:true},{id:'child',parentSetId:'parent',type:'dropset_child',weight:75,reps:5,isCompleted:true}]},{id:'custom-block',exerciseId:'custom',sets:[{id:'normal',type:'normal',weight:110,reps:5,isCompleted:true}]}];
    const mapped=remapWorkoutExerciseIds(entries,new Map([['old','custom']]));
    expect(mapped.map(e=>e.id)).toEqual(['parent-block','custom-block']);
    expect(mapped[0].sets).toBe(entries[0].sets);
    expect(combineExerciseLogs(mapped,'custom')?.sets.map(s=>s.id)).toEqual(['parent','child','normal']);
    expect(entries[0].exerciseId).toBe('old');
  });
});
describe('descriptive push presentation', () => {
  it.each([
    ['achievement_unlocked','Award','Nelson received a new award','Gold Barbell Squat Trophy'],
    ['personal_record','Milestone','Nelson hit a new PR','Barbell Bench Press · 225 lb × 5 reps'],
    ['workout_completed','Workout','Nelson finished a workout','Push Day · 3 exercises completed'],
    ['level_up','Milestone','Nelson reached a new level','Level 10'],
  ])('formats %s with actor/details', (type,title,heading,body) =>
    expect(pushPresentation({type,title:heading,body})).toEqual({title,body:heading+' · '+body}));
  it('friend request text is not redundantly prefixed', () =>
    expect(pushPresentation({type:'friend_request',title:'Friend request',body:'Nelson sent you a friend request.'})).toEqual({title:'Friend request',body:'Nelson sent you a friend request.'}));
});
