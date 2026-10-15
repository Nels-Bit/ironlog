import { it, expect } from 'vitest';
import { isValidNumberInputDraft, parseNumberInputValue } from '../src/utils/numberInput';
import { getWorkoutExercises } from '../src/utils/workoutSchema';
import { getExerciseProgress } from '../src/utils/exerciseLogging';
import { getTotalReps, getSetLoad } from '../src/utils/workoutMath';
it.each(['','.', '0.', '.5','2.5','145.75','0','10.'])('permits decimal typing draft %s',value=>expect(isValidNumberInputDraft(value)).toBe(true));
it.each(['1e3','1E3','-1','+2','Infinity','NaN','2..5','1/2','1,5'])('rejects invalid/pasted numeric draft %s',value=>expect(isValidNumberInputDraft(value)).toBe(false));
it('round-trips fractional weight, reps and unilateral reps without truncation',()=>{
  const data=[{id:'e',exerciseId:'lift',sets:[{id:'s',type:'normal',weight:parseNumberInputValue('145.75'),reps:parseNumberInputValue('5.5'),repsLeft:2.5,repsRight:3.25,isCompleted:true}]}];
  const [exercise]=getWorkoutExercises(JSON.stringify(data)),set=exercise.sets[0];
  expect(getSetLoad(set)).toBe(145.75);expect(getTotalReps(set)).toBe(5.5);
  expect(getTotalReps(set,{id:'lift',name:'Unilateral',category:'Free Weights',isUnilateral:true})).toBe(5.75);
  expect(getExerciseProgress(exercise).summary).toContain('145.75 lb × 5.5');
  expect(parseNumberInputValue('.')).toBeNull();expect(parseNumberInputValue('')).toBeNull();expect(parseNumberInputValue('1e3')).toBeNull();expect(parseNumberInputValue('Infinity')).toBeNull();
});
