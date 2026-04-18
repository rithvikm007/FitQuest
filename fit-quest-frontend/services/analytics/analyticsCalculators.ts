import type { RepRangeBuckets } from './types';
import { EPLEY_DIVISOR, type ExerciseInWorkoutForAnalytics, type NormalizedSetEntry } from './types';

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function computeSetVolume(entry: Pick<NormalizedSetEntry, 'weightKg' | 'reps'>): number {
  if (!isPositiveFinite(entry.weightKg) || !isPositiveFinite(entry.reps)) {
    return 0;
  }

  return roundTo(entry.weightKg * entry.reps, 6);
}

export function computeExerciseWorkoutVolume(exerciseInWorkout: ExerciseInWorkoutForAnalytics): number {
  const volume = exerciseInWorkout.sets.reduce((total, set) => {
    const setVolume = set.entries.reduce((setTotal, entry) => setTotal + computeSetVolume(entry), 0);
    return total + setVolume;
  }, 0);

  return roundTo(volume, 6);
}

export function computeEstimated1RM(weightKg?: number | null, reps?: number | null): number | null {
  if (!isPositiveFinite(weightKg) || !isPositiveFinite(reps)) {
    return null;
  }

  const estimated = weightKg * (1 + reps / EPLEY_DIVISOR);
  return roundTo(estimated, 6);
}

export function computeRepRangeBuckets(
  entries: Array<Pick<NormalizedSetEntry, 'reps'>>
): RepRangeBuckets {
  const buckets: RepRangeBuckets = {
    repRange_1_5: 0,
    repRange_6_8: 0,
    repRange_9_12: 0,
    repRange_13_20: 0,
    repRange_21_plus: 0,
  };

  for (const entry of entries) {
    if (!isPositiveFinite(entry.reps)) {
      continue;
    }

    const reps = entry.reps;

    if (reps <= 5) {
      buckets.repRange_1_5 += 1;
    } else if (reps <= 8) {
      buckets.repRange_6_8 += 1;
    } else if (reps <= 12) {
      buckets.repRange_9_12 += 1;
    } else if (reps <= 20) {
      buckets.repRange_13_20 += 1;
    } else {
      buckets.repRange_21_plus += 1;
    }
  }

  return buckets;
}
