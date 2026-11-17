import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBestPRPerformance } from '../src/utils/workoutMath';
import { formatPRPerformance, getDisplayedPRPerformance } from '../src/utils/exerciseLogging';
import { workoutService } from '../src/services/workoutService';
import type { Exercise, ExerciseSet } from '../src/types';

const query = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn()
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'test-user', user_metadata: { weight: 180 } } } }) },
  from: () => query
} }));
vi.mock('../src/services/exerciseService', () => ({ exerciseService: {
  getAliases: async () => new Map<string,string>(),
  getAllExercises: async () => [
    { id: 'bench', name: 'Bench', category: 'Free Weights' },
    { id: 'run', name: 'Run', category: 'Cardio', exerciseCategory: 'cardio' }
  ]
} }));

const bench: Exercise = { id: 'bench', name: 'Bench', category: 'Free Weights' };
const set = (weight: number, reps: number, changes: Partial<ExerciseSet> = {}): ExerciseSet => ({
  id: `${weight}-${reps}`, weight, reps, type: 'normal', isCompleted: true, ...changes
});

describe('PR set details preserve the weight record definition', () => {
  it.each(['normal', 'warmup', 'failure', 'dropset', 'dropset_child'] as const)('keeps matching reps for a completed %s record', type => {
    expect(getBestPRPerformance([set(185, 8, { type })], bench)).toMatchObject({ load: 185, set: { reps: 8, type } });
  });
  it('selects highest load, not the lighter set with the most reps', () => {
    const best = getBestPRPerformance([set(185, 8), set(175, 20), set(250, 1, { isCompleted: false }), set(300, 0)], bench);
    expect(formatPRPerformance(best, bench)).toBe('185 lb × 8 reps');
  });
  it('uses the most completed reps for a tied load without changing PR weight', () => {
    const best = getBestPRPerformance([set(185, 8), set(185, 10), set(185, 12, { isCompleted: false })], bench);
    expect(best.load).toBe(185);
    expect(best.set?.reps).toBe(10);
  });
  it('does not replace historical record reps with a weaker active session', () => {
    const historical = { load: 185, set: set(185, 8) };
    const current = getBestPRPerformance([set(175, 12)], bench);
    expect(getDisplayedPRPerformance(historical, current, bench)).toBe(historical);
  });
  it('shows a genuine new record and handles empty records and singular reps', () => {
    const current = { load: 190, set: set(190, 1, { type: 'failure' }) };
    expect(formatPRPerformance(getDisplayedPRPerformance({ load: 185, set: set(185, 8) }, current, bench), bench)).toBe('190 lb × 1 rep');
    expect(formatPRPerformance({ load: 0, set: null }, bench)).toBe('No PR yet');
  });
  it('retains left/right rep details and excludes cardio from weight PRs', () => {
    const unilateral = { ...bench, isUnilateral: true };
    expect(formatPRPerformance(getBestPRPerformance([set(70, 0, { repsLeft: 8, repsRight: 9 })], unilateral), unilateral)).toBe('70 lb × 8L / 9R reps');
    expect(getBestPRPerformance([set(999, 99)], { ...bench, category: 'Cardio' })).toEqual({ load: 0, set: null });
  });
});

describe('historical PR data lookup', () => {
  beforeEach(() => vi.clearAllMocks());
  it('gets reps from an older highest-load session, independent of latest ghost targets', async () => {
    query.order.mockResolvedValue({ data: [
      { exercises: [{ exerciseId: 'bench', sets: [set(175, 10)] }] },
      { exercises: [{ exerciseId: 'bench', sets: [set(185, 8)] }] }
    ], error: null });
    expect(await workoutService.getPersonalRecordPerformance('bench')).toMatchObject({ load: 185, set: { weight: 185, reps: 8 } });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'test-user');
    expect(await workoutService.getPersonalRecord('bench')).toBe(185);
  });
  it('checks duplicate exercise blocks and normalizes legacy set keys', async () => {
    query.order.mockResolvedValue({ data: [{ exercises: [
      { exerciseId: 'bench', sets: [set(175, 10)] },
      { exercise_id: 'bench', exerciseSets: [{ weight: 205, reps: 3, set_type: 'failure', completed: true }] }
    ] }], error: null });
    expect(await workoutService.getPersonalRecordPerformance('bench')).toMatchObject({ load: 205, set: { reps: 3, type: 'failure' } });
  });
  it('rejects unavailable history so PR readiness is not based on a false zero', async () => {
    query.order.mockResolvedValue({ data: null, error: new Error('History unavailable') });
    await expect(workoutService.getPersonalRecordPerformance('bench')).rejects.toThrow('History unavailable');
  });
});
