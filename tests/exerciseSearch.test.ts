import { describe, expect, it } from 'vitest';
import type { Exercise } from '../src/types';
import { filterExercises, getExerciseFilterOptions } from '../src/utils/exerciseSearch';

const exercises: Exercise[] = [
  { id: 'bench', name: 'Barbell Bench Press', category: 'Free Weights', target: 'Chest' },
  { id: 'fly', name: 'Cable Fly', category: 'Cables', target: 'Chest' },
  { id: 'row', name: 'Dumbbell Row', category: 'Free Weights', target: 'Back', isUnilateral: true },
  { id: 'run', name: 'Treadmill Run', category: 'Cardio', target: 'Cardio' },
  { id: 'bike', name: 'Bike', category: 'Machines', exerciseCategory: 'cardio', target: null },
  { id: 'custom', name: 'Custom Band Press', category: 'Resistance Bands', target: 'Shoulders', isCustom: true },
  { id: 'legacy', name: 'Old Fly', category: ' cables ', target: ' chest ' },
  { id: 'missing', name: 'Unclassified', category: 'Other', target: null },
];
const ids = (results: Exercise[]) => results.map(exercise => exercise.id);

describe('exercise library search and filters', () => {
  it('defaults to the full library without mutating its order or exercise data', () => {
    expect(filterExercises(exercises, '')).toEqual(exercises);
    expect(filterExercises(exercises, '')[0]).toBe(exercises[0]);
  });
  it('filters muscles and equipment independently with case and whitespace normalization', () => {
    expect(ids(filterExercises(exercises, '', ' CHEST '))).toEqual(['bench', 'fly', 'legacy']);
    expect(ids(filterExercises(exercises, '', '', 'free weights'))).toEqual(['bench', 'row']);
  });
  it('combines text, muscle and type using AND rather than OR', () => {
    expect(ids(filterExercises(exercises, ' BENCH ', 'chest', 'free weights'))).toEqual(['bench']);
    expect(filterExercises(exercises, 'row', 'chest', 'free weights')).toEqual([]);
  });
  it('also accepts muscle and type names in the original text search', () => {
    expect(ids(filterExercises(exercises, 'chest'))).toEqual(['bench', 'fly', 'legacy']);
    expect(ids(filterExercises(exercises, 'Resistance Bands'))).toEqual(['custom']);
  });
  it('finds cardio without requiring a target muscle or a legacy category match', () => {
    expect(ids(filterExercises(exercises, '', '', 'cardio'))).toEqual(['run', 'bike']);
    expect(filterExercises(exercises, '', 'chest', 'cardio')).toEqual([]);
  });
  it('derives stable complete menus with custom values, no duplicate casing or cardio muscle', () => {
    const options = getExerciseFilterOptions(exercises);
    expect(options.muscles.map(option => option.value)).toEqual(['back', 'chest', 'shoulders']);
    expect(options.types.map(option => option.value)).toEqual(['cables', 'cardio', 'free weights', 'other', 'resistance bands']);
    expect(options.muscles.find(option => option.value === 'chest')?.label).toBe('Chest');
    expect(getExerciseFilterOptions([])).toEqual({muscles: [], types: []});
  });
  it('restores results when filters clear, preserving the name search', () => {
    expect(filterExercises(exercises, 'fly', 'back', 'free weights')).toEqual([]);
    expect(ids(filterExercises(exercises, 'fly'))).toEqual(['fly', 'legacy']);
  });
});
