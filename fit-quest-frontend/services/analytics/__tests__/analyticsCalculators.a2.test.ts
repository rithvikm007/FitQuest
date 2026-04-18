import { describe, expect, it } from 'vitest';
import { computeEstimated1RM, computeExerciseWorkoutVolume, computeRepRangeBuckets, computeSetVolume } from '../analyticsCalculators';
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

describe('normalizers', () => {
  it('uses segments when present and valid', () => {
    const set = makeSet({
      reps: 10,
      weight: 60,
      weightUnit: 'kg',
      segments: [
        { reps: 8, weight: 80, weightUnit: 'kg' },
        { reps: 10, weight: 60, weightUnit: 'kg' },
      ],
    });

    const normalized = normalizeWorkoutSetToEntries(set);

    expect(normalized.setCountContribution).toBe(1);
    expect(normalized.entries).toHaveLength(2);
    expect(normalized.entries[0].reps).toBe(8);
    expect(normalized.entries[0].weightKg).toBe(80);
  });

  it('falls back to top-level entry when segments exist but are invalid', () => {
    const set = makeSet({
      reps: 12,
      weight: 50,
      weightUnit: 'kg',
      segments: [{ reps: 0, weight: 0, weightUnit: 'kg' }],
    });

    const normalized = normalizeWorkoutSetToEntries(set);

    expect(normalized.entries).toHaveLength(1);
    expect(normalized.entries[0].reps).toBe(12);
    expect(normalized.entries[0].weightKg).toBe(50);
  });

  it('converts lb to kg when weightKg is not present', () => {
    const set = makeSet({
      segments: [{ reps: 5, weight: 100, weightUnit: 'lb' }],
    });

    const normalized = normalizeWorkoutSetToEntries(set);

    expect(normalized.entries).toHaveLength(1);
    expect(normalized.entries[0].weightKg).toBeCloseTo(45.359237, 6);
  });
});

describe('analyticsCalculators', () => {
  it('computes set volume only when weight and reps are valid', () => {
    expect(computeSetVolume({ weightKg: 80, reps: 5 })).toBe(400);
    expect(computeSetVolume({ weightKg: null, reps: 5 })).toBe(0);
    expect(computeSetVolume({ weightKg: 80, reps: 0 })).toBe(0);
  });

  it('computes workout volume from normalized segmented entries', () => {
    const setA = normalizeWorkoutSetToEntries(
      makeSet({
        orderIndex: 0,
        segments: [
          { reps: 8, weight: 80, weightUnit: 'kg' },
          { reps: 10, weight: 60, weightUnit: 'kg' },
        ],
      })
    );
    const setB = normalizeWorkoutSetToEntries(
      makeSet({
        orderIndex: 1,
        reps: 12,
        weight: 50,
        weightUnit: 'kg',
      })
    );

    const exerciseInWorkout: ExerciseInWorkoutForAnalytics = {
      workoutId: 'w-1',
      workoutDate: '2026-01-10T00:00:00.000Z',
      workoutExerciseId: 'we-1',
      setCount: 2,
      sets: [setA, setB],
    };

    expect(computeExerciseWorkoutVolume(exerciseInWorkout)).toBe(1840);
  });

  it('computes Epley estimated 1RM and handles invalid values', () => {
    expect(computeEstimated1RM(100, 5)).toBeCloseTo(116.666667, 6);
    expect(computeEstimated1RM(undefined, 5)).toBeNull();
    expect(computeEstimated1RM(100, 0)).toBeNull();
  });

  it('buckets reps into expected ranges', () => {
    const buckets = computeRepRangeBuckets([
      { reps: 3 },
      { reps: 6 },
      { reps: 10 },
      { reps: 15 },
      { reps: 25 },
      { reps: null },
      { reps: 0 },
    ]);

    expect(buckets).toEqual({
      repRange_1_5: 1,
      repRange_6_8: 1,
      repRange_9_12: 1,
      repRange_13_20: 1,
      repRange_21_plus: 1,
    });
  });
});
