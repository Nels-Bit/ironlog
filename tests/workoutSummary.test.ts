import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Exercise, ExerciseSet, WorkoutExercise } from '../src/types';
import { getSummarySets } from '../src/utils/workoutSummary';
import { WorkoutSummaryExercise } from '../src/components/WorkoutSummaryExercise';
import { getWorkoutExercises } from '../src/utils/workoutSchema';

const blank: ExerciseSet = { id: 'blank', type: 'normal', weight: null, reps: null, isCompleted: false };
const bench: Exercise = { id: 'bench', name: 'Barbell Bench Press', category: 'Free Weights', target: 'Chest' };
const exercise = (...sets: ExerciseSet[]): WorkoutExercise => ({ id: 'instance', exerciseId: 'bench', sets });

describe('saved workout set details', () => {
  it('preserves decimal weights and reps without changing saved data', () => {
    const saved = exercise({ ...blank, weight: 182.5, reps: 7.5, isCompleted: true });
    const before = JSON.stringify(saved);
    expect(getSummarySets(saved, bench)[0]).toMatchObject({ load: '182.5 lb', reps: '7.5', completed: true });
    expect(JSON.stringify(saved)).toBe(before);
  });
  it('excludes unused ghosts but retains partial data and original set numbers', () => {
    const rows = getSummarySets(exercise({ ...blank, previousBest: 200 }, { ...blank, id: 'partial', reps: 8 }), bench);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: 'Set 2', load: '— lb', reps: '8', completed: false });
  });
  it('labels warmups, drop parents/children and failure sets', () => {
    const types: ExerciseSet['type'][] = ['warmup', 'dropset', 'dropset_child', 'failure'];
    const rows = getSummarySets(exercise(...types.map((type, i) => ({ ...blank, id: `${i}`, type, isCompleted: true }))), bench);
    expect(rows.map(row => row.type)).toEqual(['Warm-up', 'Drop set', 'Drop', 'Failure']);
    expect(rows.map(row => row.child)).toEqual([false, false, true, false]);
  });
  it('shows unilateral reps independently, including missing sides', () => {
    const row = getSummarySets(exercise({ ...blank, repsLeft: 8.5 }), { ...bench, isUnilateral: true })[0];
    expect(row.reps).toBe('8.5 / —');
  });
  it('distinguishes bodyweight and assistance from ordinary pounds', () => {
    const saved = exercise({ ...blank, weight: 12.5, reps: 9 });
    expect(getSummarySets(saved, { ...bench, category: 'Bodyweight' })[0].load).toBe('BW + 12.5 lb');
    expect(getSummarySets(saved, { ...bench, category: 'Assisted' })[0].load).toBe('12.5 lb assist');
    expect(getSummarySets(exercise({ ...blank, weight: 0 }), { ...bench, category: 'Bodyweight' })[0].load).toBe('BW');
  });
  it('shows cardio distance and exact time instead of weight and reps', () => {
    const row = getSummarySets(exercise({ ...blank, distance: 3.25, durationSeconds: 1815 }), { ...bench, exerciseCategory: 'cardio' })[0];
    expect(row).toMatchObject({ load: '3.25 mi', reps: '30:15' });
  });
  it('does not invent missing measurements or display invalid legacy numbers', () => {
    const saved = exercise({ ...blank, weight: NaN, reps: Infinity, isCompleted: true });
    expect(getSummarySets(saved)[0]).toMatchObject({ load: '— lb', reps: '—' });
    expect(getSummarySets(saved, { ...bench, category: 'Cardio' })[0]).toMatchObject({ load: '— mi', reps: '—' });
  });
  it('retains missing saved inputs as null and does not turn ghosts into logged zero sets', () => {
    const [restored] = getWorkoutExercises(JSON.stringify([exercise(blank,
      { ...blank, id: 'bodyweight', weight: 0, reps: 8, isCompleted: true },
      { ...blank, id: 'decimal', weight: 182.5, reps: 7.5, isCompleted: true },
    )]));
    expect(restored.sets[0]).toMatchObject({ weight: null, reps: null });
    expect(getSummarySets(restored, bench).map(row => row.label)).toEqual(['Set 2', 'Set 3']);
    expect(getSummarySets(restored, bench)[1]).toMatchObject({ load: '182.5 lb', reps: '7.5' });
  });
});

describe('expandable summary exercise', () => {
  it('uses a native keyboard-operable disclosure with a labeled set table', () => {
    const html = renderToStaticMarkup(createElement(WorkoutSummaryExercise, {
      exercise: exercise({ ...blank, weight: 182.5, reps: 7.5, isCompleted: true }), definition: bench,
    }));
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('Logged sets for Barbell Bench Press');
    expect(html).toContain('182.5 lb');
    expect(html).toContain('7.5');
    expect(html).not.toContain('Not completed');
  });
  it('clearly labels unfinished entries and empty exercises', () => {
    const partial = renderToStaticMarkup(createElement(WorkoutSummaryExercise, { exercise: exercise({ ...blank, reps: 1 }) }));
    expect(partial).toContain('Not completed');
    const empty = renderToStaticMarkup(createElement(WorkoutSummaryExercise, { exercise: exercise(blank), definition: bench }));
    expect(empty).toContain('No sets logged.');
    expect(empty).not.toContain('<table');
  });
  it('uses cardio and unilateral column headings', () => {
    const saved = exercise({ ...blank, isCompleted: true });
    const render = (definition: Exercise) => renderToStaticMarkup(createElement(WorkoutSummaryExercise, { exercise: saved, definition }));
    expect(render({ ...bench, category: 'Cardio' })).toContain('Distance');
    expect(render({ ...bench, category: 'Cardio' })).toContain('Time');
    expect(render({ ...bench, isUnilateral: true })).toContain('Reps (L / R)');
  });
});
