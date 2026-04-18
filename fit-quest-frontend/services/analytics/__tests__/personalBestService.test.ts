import { describe, expect, it } from 'vitest';

import { computeExercisePersonalBests } from '../personalBestService';

describe('personalBestService (E1)', () => {
  it('returns null/empty PBs for empty history', () => {
    const pbs = computeExercisePersonalBests([], { includeEstimated1RM: true });

    expect(pbs.maxWeight).toBeNull();
    expect(pbs.maxSetVolume).toBeNull();
    expect(pbs.maxWorkoutVolume).toBeNull();
    expect(pbs.bestEstimated1RM).toBeNull();
    expect(pbs.maxRepsAtWeight).toEqual({});
  });

  it('ignores entries with missing weight or zero reps for weight-based PBs', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [
            { orderIndex: 0, reps: 10 },
            { orderIndex: 1, weight: 80, weightUnit: 'kg', reps: 0 },
            { orderIndex: 2, duration: 45 },
          ],
        },
      ],
      { includeEstimated1RM: true }
    );

    expect(pbs.maxWeight?.valueKg).toBe(80);
    expect(pbs.maxWeight?.supportingReps).toBeNull();
    expect(pbs.maxSetVolume).toBeNull();
    expect(pbs.bestEstimated1RM).toBeNull();
    expect(pbs.maxRepsAtWeight).toEqual({});
    // Workout volume PB still exists with value 0 in current implementation.
    expect(pbs.maxWorkoutVolume?.valueKgReps).toBe(0);
  });

  it('supports mixed units and segmented sets for PB selection', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [
            {
              orderIndex: 0,
              segments: [
                { reps: 5, weight: 200, weightUnit: 'lb' },
                { reps: 10, weight: 70, weightUnit: 'kg' },
              ],
            },
          ],
        },
        {
          workoutId: 'w-2',
          workoutDate: '2026-01-11T00:00:00.000Z',
          workoutExerciseId: 'we-2',
          sets: [{ orderIndex: 0, reps: 8, weight: 85, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    expect(pbs.maxWeight?.valueKg).toBeCloseTo(90.718474, 6);
    expect(pbs.maxSetVolume?.valueKgReps).toBe(700);
    expect(pbs.maxWorkoutVolume?.valueKgReps).toBeCloseTo(1153.59237, 5);
    expect(pbs.bestEstimated1RM?.valueKg).toBeCloseTo(107.666667, 6);
  });

  it('chooses earliest source when values tie for reps-at-weight', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-later',
          workoutDate: '2026-01-12T00:00:00.000Z',
          workoutExerciseId: 'we-later',
          sets: [{ orderIndex: 2, reps: 10, weight: 80, weightUnit: 'kg' }],
        },
        {
          workoutId: 'w-earlier',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-earlier',
          sets: [{ orderIndex: 1, reps: 10, weight: 80, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: true }
    );

    const key = '80.000';
    expect(pbs.maxRepsAtWeight[key]).toBeDefined();
    expect(pbs.maxRepsAtWeight[key].source.workoutId).toBe('w-earlier');
    expect(pbs.maxRepsAtWeight[key].source.setIndex).toBe(1);
  });

  it('disables estimated 1RM PB when includeEstimated1RM is false', () => {
    const pbs = computeExercisePersonalBests(
      [
        {
          workoutId: 'w-1',
          workoutDate: '2026-01-10T00:00:00.000Z',
          workoutExerciseId: 'we-1',
          sets: [{ orderIndex: 0, reps: 8, weight: 80, weightUnit: 'kg' }],
        },
      ],
      { includeEstimated1RM: false }
    );

    expect(pbs.bestEstimated1RM).toBeNull();
    expect(pbs.maxWeight?.valueKg).toBe(80);
  });
});
