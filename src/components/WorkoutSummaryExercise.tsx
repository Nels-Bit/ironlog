import type { Exercise, WorkoutExercise } from '../types';
import { getSummarySets } from '../utils/workoutSummary';
import { isCardioExercise } from '../utils/workoutMath';

export function WorkoutSummaryExercise({ exercise, definition }: {
  exercise: WorkoutExercise; definition?: Exercise;
}) {
  const sets = getSummarySets(exercise, definition);
  const cardio = isCardioExercise(definition);
  const name = definition?.name || 'Exercise';
  return (
    <details data-theme="dark" className="collapse collapse-arrow rounded-none bg-transparent">
      <summary className="collapse-title min-h-16 py-3 pl-4 pr-10 focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-[-2px]">
        <span className="flex items-center justify-between gap-3 sm:gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-base-content break-words">{name}</span>
            <span className="block text-xs text-base-content/60">{definition?.target || definition?.category || ''}</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-base-content/60 tabular-nums">
            {sets.length} set{sets.length !== 1 ? 's' : ''}
          </span>
        </span>
      </summary>
      <div className="collapse-content px-4 text-base-content">
        {sets.length === 0 ? <p className="text-sm text-base-content/60">No sets logged.</p> : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full tabular-nums">
              <caption className="sr-only">Logged sets for {name}</caption>
              <thead className="text-base-content/60">
                <tr>
                  <th scope="col" className="pl-0">Set</th>
                  <th scope="col">{cardio ? 'Distance' : 'Weight'}</th>
                  <th scope="col" className="pr-0 text-right">{cardio ? 'Time' : definition?.isUnilateral ? 'Reps (L / R)' : 'Reps'}</th>
                </tr>
              </thead>
              <tbody>
                {sets.map(set => (
                  <tr key={set.id}>
                    <th scope="row" className={set.child ? 'pl-3 font-medium' : 'pl-0 font-medium'}>
                      {set.child && <span aria-hidden="true" className="mr-1 text-base-content/50">↳</span>}{set.label}
                      {set.type !== 'Working' && <span className="block text-[10px] font-normal text-base-content/60">{set.type}</span>}
                      {!set.completed && <span className="block text-[10px] font-normal text-warning">Not completed</span>}
                    </th>
                    <td>{set.load}</td>
                    <td className="pr-0 text-right">{set.reps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
