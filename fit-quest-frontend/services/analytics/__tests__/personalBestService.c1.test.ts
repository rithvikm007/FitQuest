import { describe, expect, it } from 'vitest';
import {
  computeExercisePersonalBests,
  detectPersonalBestChanges,
  detectPersonalBestChangesForExercises,
} from '../personalBestService';

describe('computeExercisePersonalBests', () => {
  it('applies maxWeight tie-breakers: reps, then earlier date, then lower set/segment index', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-later',
          workoutDate: '2026-01-12T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [
            {
              orderIndex: 2,
              segments: [
                { reps: 5, weight: 100, weightUnit: 'kg' },
                { reps: 6, weight: 100, weightUnit: 'kg' },
              ],
            },
          ],
        },
        {
          workoutId: 'w-earlier',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-2',
          sets: [
            {
              orderIndex: 1,
              segments: [{ reps: 6, weight: 100, weightUnit: 'kg' }],
            },
          ],
        },
      ],
      { includeEstimated1RM: true }
    );

    expect(pbs.maxWeight?.valueKg).toBe(100);
    expect(pbs.maxWeight?.supportingReps).toBe(6);
    expect(pbs.maxWeight?.source.workoutId).toBe('w-earlier');
    expect(pbs.maxWeight?.source.setIndex).toBe(1);
    expect(pbs.maxWeight?.source.segmentIndex).toBe(0);
  });

  it('applies maxSetVolume tie-breakers: higher weight first, then earlier date', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-11T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [
            {
              orderIndex: 0,
              segments: [{ reps: 10, weight: 100, weightUnit: 'kg' }],
            },
          ],
        },
        {
          workoutId: 'w-2',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-2',
          sets: [
            {
              orderIndex: 0,
              segments: [{ reps: 20, weight: 50, weightUnit: 'kg' }],
            },
          ],
        },
      ],
      { includeEstimated1RM: true }
    );

    expect(pbs.maxSetVolume?.valueKgReps).toBe(1000);
    expect(pbs.maxSetVolume?.source.workoutId).toBe('w-1');
  });

  it('applies maxWorkoutVolume tie-breakers: earlier date then lexicographically smaller id', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-b',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [
            { orderIndex: 0, reps: 10, weight: 50, weightUnit: 'kg' },
            { orderIndex: 1, reps: 10, weight: 50, weightUnit: 'kg' },
          ],
        },
        {
          workoutId: 'w-a',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-2',
          sets: [
            { orderIndex: 0, reps: 20, weight: 50, weightUnit: 'kg' },
          ],
        },
      ],
      { includeEstimated1RM: true }
    );

    expect(pbs.maxWorkoutVolume?.valueKgReps).toBe(1000);
    expect(pbs.maxWorkoutVolume?.sourceWorkoutId).toBe('w-a');
  });

  it('tracks maxRepsAtWeight by rounded kg key with earliest source tie-break', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-2',
          workoutDate: '2026-01-11T00:00:00.000Z',
          workoutExerciseId: 'we-2',
          sets: [
            { orderIndex: 0, reps: 8, weightKg: 80.0002 },
          ],
        },
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [
            { orderIndex: 0, reps: 8, weightKg: 80.0004 },
          ],
        },
      ],
      { includeEstimated1RM: true }
    );

    const key = '80.000';
    expect(pbs.maxRepsAtWeight[key]).toBeDefined();
    expect(pbs.maxRepsAtWeight[key].reps).toBe(8);
    expect(pbs.maxRepsAtWeight[key].source.workoutId).toBe('w-1');
  });

  it('applies bestEstimated1RM tie-breakers and can be disabled', () => {
    const sessions = [
      {
        workoutId: 'w-2',
        workoutDate: '2026-01-11T00:00:00.000Z',
        workoutExerciseId: 'we-2',
        sets: [{ orderIndex: 0, reps: 5, weight: 100, weightUnit: 'kg' }],
      },
      {
        workoutId: 'w-1',
        workoutDate: '2026-01-10T00:00:00.000Z',
        workoutExerciseId: 'we-1',
        sets: [{ orderIndex: 0, reps: 6, weight: 93.75, weightUnit: 'kg' }],
      },
    ];

    const enabled = computeExercisePersonalBests(sessions, { includeEstimated1RM: true });
    expect(enabled.bestEstimated1RM?.valueKg).toBeCloseTo(116.666667, 6);
    expect(enabled.bestEstimated1RM?.source.workoutId).toBe('w-2');

    const disabled = computeExercisePersonalBests(sessions, { includeEstimated1RM: false });
    expect(disabled.bestEstimated1RM).toBeNull();
  });

  it('detects PB deltas only when metrics strictly improve', () => {
    const previous = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 10, weight: 60, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const next = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 10, weight: 60, weightUnit: 'kg' }],
        },
        {
          workoutId: 'w-2',
          workoutDate: '2026-01-11T00:00:00.000Z',
          workoutExerciseId: 'we-2',
          sets: [{ orderIndex: 0, reps: 12, weight: 65, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const deltas = detectPersonalBestChanges('exercise-1', previous, next);
    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.some((delta) => delta.pbType === 'maxWeight')).toBe(true);
    expect(deltas.some((delta) => delta.pbType === 'maxSetVolume')).toBe(true);
    expect(deltas.some((delta) => delta.pbType === 'maxWorkoutVolume')).toBe(true);
    expect(deltas.some((delta) => delta.pbType === 'bestEstimated1RM')).toBe(true);
  });

  it('does not emit deltas for equal PB values and includes weightKey for maxRepsAtWeight', () => {
    const previous = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 8, weight: 80, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const equal = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 8, weight: 80, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const equalDeltas = detectPersonalBestChanges('exercise-1', previous, equal);
    expect(equalDeltas).toHaveLength(0);

    const improvedRepsOnly = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 8, weight: 80, weightUnit: 'kg' }],
        },
        {
          workoutId: 'w-2',
          workoutDate: '2026-01-11T00:00:00.000Z',
          workoutExerciseId: 'we-2',
          sets: [{ orderIndex: 0, reps: 9, weight: 80, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const repsDeltas = detectPersonalBestChanges('exercise-1', previous, improvedRepsOnly);
    const repsDelta = repsDeltas.find((delta) => delta.pbType === 'maxRepsAtWeight');
    expect(repsDelta).toBeDefined();
    expect(repsDelta?.weightKey).toBe('80.000');
    expect(repsDelta?.oldValue).toBe(8);
    expect(repsDelta?.newValue).toBe(9);
  });

  it('aggregates deterministic deltas across exercises', () => {
    const single = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 10, weight: 50, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const improved = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 12, weight: 55, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const deltas = detectPersonalBestChangesForExercises([
      {
        exerciseId: 'b-exercise',
        previous: single,
        next: improved,
      },
      {
        exerciseId: 'a-exercise',
        previous: null,
        next: improved,
      },
    ]);

    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas[0].exerciseId).toBe('a-exercise');
  });
});
