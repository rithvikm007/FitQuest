import { describe, expect, it } from 'vitest';

import {
  computeEstimated1RM,
  computeExerciseWorkoutVolume,
  computeRepRangeBuckets,
  computeSetVolume,
} from '../analyticsCalculators';
import { normalizeWorkoutSetToEntries } from '../normalizers';
import type { WorkoutSet } from '@/types/models';
import type { ExerciseInWorkoutForAnalytics } from '../types';

function makeSet(partial: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: partial.id ?? 'set-1',
    workoutExerciseId: partial.workoutExerciseId ?? 'we-1',
    orderIndex: partial.orderIndex ?? 0,
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    reps: partial.reps,
    weight: partial.weight,
    weightUnit: partial.weightUnit,
    weightKg: partial.weightKg,
    duration: partial.duration,
    distance: partial.distance,
    notes: partial.notes,
    segments: partial.segments,
  };
}

describe('analyticsCalculators (E1)', () => {
  it('handles mixed-unit segmented sets via normalizer conversion', () => {
    const setA = normalizeWorkoutSetToEntries(
      makeSet({
        orderIndex: 0,
        segments: [
          { reps: 5, weight: 100, weightUnit: 'lb' },
          { reps: 10, weight: 50, weightUnit: 'kg' },
        ],
      })
    );

    const setB = normalizeWorkoutSetToEntries(
      makeSet({
        orderIndex: 1,
        reps: 8,
        weight: 60,
        weightUnit: 'kg',
      })
    );

    const exerciseInWorkout: ExerciseInWorkoutForAnalytics = {
      workoutId: 'w-1',
      workoutDate: '2026-01-05T00:00:00.000Z',
      workoutExerciseId: 'we-1',
      setCount: 2,
      sets: [setA, setB],
    };

    const volume = computeExerciseWorkoutVolume(exerciseInWorkout);
    // 100lb => 45.359237kg; total = 45.359237*5 + 50*10 + 60*8
    expect(volume).toBeCloseTo(1206.796185, 6);
  });

  it('returns zero volume when entries are duration/distance-only (no weight-reps)', () => {
    const set = normalizeWorkoutSetToEntries(
      makeSet({
        orderIndex: 0,
        segments: [
          { duration: 45 },
          { distance: 1000 },
        ],
      })
    );

    const exerciseInWorkout: ExerciseInWorkoutForAnalytics = {
      workoutId: 'w-2',
      workoutDate: '2026-01-06T00:00:00.000Z',
      workoutExerciseId: 'we-2',
      setCount: 1,
      sets: [set],
    };

    expect(computeExerciseWorkoutVolume(exerciseInWorkout)).toBe(0);
  });

  it('computeSetVolume rejects missing, zero, and negative values', () => {
    expect(computeSetVolume({ weightKg: 80, reps: 5 })).toBe(400);
    expect(computeSetVolume({ weightKg: undefined, reps: 5 })).toBe(0);
    expect(computeSetVolume({ weightKg: 80, reps: undefined })).toBe(0);
    expect(computeSetVolume({ weightKg: 0, reps: 5 })).toBe(0);
    expect(computeSetVolume({ weightKg: 80, reps: 0 })).toBe(0);
    expect(computeSetVolume({ weightKg: -80, reps: 5 })).toBe(0);
  });

  it('computeEstimated1RM handles edge inputs and 1-rep case', () => {
    expect(computeEstimated1RM(100, 1)).toBeCloseTo(103.333333, 6);
    expect(computeEstimated1RM(100, 5)).toBeCloseTo(116.666667, 6);
    expect(computeEstimated1RM(100, 0)).toBeNull();
    expect(computeEstimated1RM(undefined, 5)).toBeNull();
    expect(computeEstimated1RM(100, undefined)).toBeNull();
    expect(computeEstimated1RM(-100, 5)).toBeNull();
  });

  it('computeRepRangeBuckets ignores invalid reps and buckets valid reps', () => {
    const buckets = computeRepRangeBuckets([
      { reps: 1 },
      { reps: 5 },
      { reps: 6 },
      { reps: 8 },
      { reps: 9 },
      { reps: 12 },
      { reps: 13 },
      { reps: 20 },
      { reps: 21 },
      { reps: 30 },
      { reps: 0 },
      { reps: -5 },
      { reps: null },
      { reps: undefined },
    ]);

    expect(buckets).toEqual({
      repRange_1_5: 2,
      repRange_6_8: 2,
      repRange_9_12: 2,
      repRange_13_20: 2,
      repRange_21_plus: 2,
    });
  });
});
