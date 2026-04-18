import { computeEstimated1RM, computeExerciseWorkoutVolume, computeSetVolume } from './analyticsCalculators';
import { normalizeWorkoutSetToEntries } from './normalizers';
import type {
  AnalyticsSourceRef,
  ExerciseInWorkoutForAnalytics,
  ExercisePersonalBests,
  MaxRepsAtWeightRecord,
  NormalizedSetEntry,
} from './types';

export type PersonalBestType =
  | 'maxWeight'
  | 'maxSetVolume'
  | 'maxWorkoutVolume'
  | 'bestEstimated1RM'
  | 'maxRepsAtWeight';

export interface PersonalBestDelta {
  exerciseId: string;
  pbType: PersonalBestType;
  oldValue: number | null;
  newValue: number;
  weightKey?: string;
}

export interface PersonalBestDeltaCandidate {
  exerciseId: string;
  previous: ExercisePersonalBests | null;
  next: ExercisePersonalBests | null;
}

export interface PersonalBestComputationSession {
  workoutId: string;
  workoutDate: string; // ISO
  workoutExerciseId: string;
  sets: Array<{
    orderIndex: number;
    reps?: number;
    weight?: number;
    weightUnit?: 'kg' | 'lb';
    weightKg?: number;
    duration?: number;
    distance?: number;
    segments?: Array<{
      reps?: number;
      weight?: number;
      weightUnit?: 'kg' | 'lb';
      weightKg?: number;
      duration?: number;
      distance?: number;
    }>;
  }>;
}

type FlattenedEntry = {
  entry: NormalizedSetEntry;
  source: AnalyticsSourceRef;
};

type WeightedEntryCandidate = {
  weightKg: number;
  reps: number | null;
  source: AnalyticsSourceRef;
};

type SetVolumeCandidate = {
  valueKgReps: number;
  weightKg: number;
  source: AnalyticsSourceRef;
};

type EstimatedOneRepMaxCandidate = {
  valueKg: number;
  liftedWeightKg: number;
  reps: number;
  source: AnalyticsSourceRef;
};

function compareIsoAsc(left: string, right: string): number {
  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();

  if (!Number.isNaN(leftMs) && !Number.isNaN(rightMs)) {
    return leftMs - rightMs;
  }

  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizedSegmentIndex(segmentIndex: number | null): number {
  return segmentIndex ?? -1;
}

function compareSourceTieBreak(left: AnalyticsSourceRef, right: AnalyticsSourceRef): number {
  const byDate = compareIsoAsc(left.workoutDate, right.workoutDate);
  if (byDate !== 0) return byDate;

  if (left.setIndex !== right.setIndex) {
    return left.setIndex - right.setIndex;
  }

  return normalizedSegmentIndex(left.segmentIndex) - normalizedSegmentIndex(right.segmentIndex);
}

function flattenEntries(sessions: PersonalBestComputationSession[]): FlattenedEntry[] {
  const flattened: FlattenedEntry[] = [];

  for (const session of sessions) {
    const orderedSets = session.sets.slice().sort((left, right) => left.orderIndex - right.orderIndex);

    for (const set of orderedSets) {
      const normalizedSet = normalizeWorkoutSetToEntries({
        id: `${session.workoutExerciseId}:${set.orderIndex}`,
        workoutExerciseId: session.workoutExerciseId,
        orderIndex: set.orderIndex,
        createdAt: session.workoutDate,
        reps: set.reps,
        weight: set.weight,
        weightUnit: set.weightUnit,
        weightKg: set.weightKg,
        duration: set.duration,
        distance: set.distance,
        segments: set.segments,
      });

      for (const entry of normalizedSet.entries) {
        flattened.push({
          entry,
          source: {
            workoutId: session.workoutId,
            workoutDate: session.workoutDate,
            workoutExerciseId: session.workoutExerciseId,
            setIndex: set.orderIndex,
            segmentIndex: entry.sourceSegmentIndex,
          },
        });
      }
    }
  }

  return flattened;
}

function pickMaxWeight(
  entries: FlattenedEntry[]
): ExercisePersonalBests['maxWeight'] {
  let best: WeightedEntryCandidate | null = null;

  for (const { entry, source } of entries) {
    if (entry.weightKg === null || entry.weightKg <= 0) {
      continue;
    }

    const candidate: WeightedEntryCandidate = {
      weightKg: entry.weightKg,
      reps: entry.reps,
      source,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.weightKg > best.weightKg) {
      best = candidate;
      continue;
    }

    if (candidate.weightKg < best.weightKg) {
      continue;
    }

    const candidateReps = candidate.reps ?? -1;
    const bestReps = best.reps ?? -1;

    if (candidateReps > bestReps) {
      best = candidate;
      continue;
    }

    if (candidateReps < bestReps) {
      continue;
    }

    if (compareSourceTieBreak(candidate.source, best.source) < 0) {
      best = candidate;
    }
  }

  if (!best) return null;

  return {
    valueKg: best.weightKg,
    source: best.source,
    supportingReps: best.reps,
  };
}

function pickMaxSetVolume(
  entries: FlattenedEntry[]
): ExercisePersonalBests['maxSetVolume'] {
  let best: SetVolumeCandidate | null = null;

  for (const { entry, source } of entries) {
    if (entry.weightKg === null || entry.weightKg <= 0 || entry.reps === null || entry.reps <= 0) {
      continue;
    }

    const candidate: SetVolumeCandidate = {
      valueKgReps: computeSetVolume(entry),
      weightKg: entry.weightKg,
      source,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.valueKgReps > best.valueKgReps) {
      best = candidate;
      continue;
    }

    if (candidate.valueKgReps < best.valueKgReps) {
      continue;
    }

    if (candidate.weightKg > best.weightKg) {
      best = candidate;
      continue;
    }

    if (candidate.weightKg < best.weightKg) {
      continue;
    }

    if (compareSourceTieBreak(candidate.source, best.source) < 0) {
      best = candidate;
    }
  }

  if (!best) return null;

  return {
    valueKgReps: best.valueKgReps,
    source: best.source,
  };
}

function pickBestEstimatedOneRepMax(
  entries: FlattenedEntry[],
  includeEstimated1RM: boolean
): ExercisePersonalBests['bestEstimated1RM'] {
  if (!includeEstimated1RM) {
    return null;
  }

  let best: EstimatedOneRepMaxCandidate | null = null;

  for (const { entry, source } of entries) {
    if (entry.weightKg === null || entry.weightKg <= 0 || entry.reps === null || entry.reps <= 0) {
      continue;
    }

    const estimated = computeEstimated1RM(entry.weightKg, entry.reps);
    if (estimated === null) {
      continue;
    }

    const candidate: EstimatedOneRepMaxCandidate = {
      valueKg: estimated,
      liftedWeightKg: entry.weightKg,
      reps: entry.reps,
      source,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.valueKg > best.valueKg) {
      best = candidate;
      continue;
    }

    if (candidate.valueKg < best.valueKg) {
      continue;
    }

    if (candidate.liftedWeightKg > best.liftedWeightKg) {
      best = candidate;
      continue;
    }

    if (candidate.liftedWeightKg < best.liftedWeightKg) {
      continue;
    }

    if (compareSourceTieBreak(candidate.source, best.source) < 0) {
      best = candidate;
    }
  }

  if (!best) return null;

  return {
    valueKg: best.valueKg,
    source: best.source,
    reps: best.reps,
    liftedWeightKg: best.liftedWeightKg,
  };
}

function pickMaxRepsAtWeight(entries: FlattenedEntry[]): Record<string, MaxRepsAtWeightRecord> {
  const map: Record<string, MaxRepsAtWeightRecord> = {};

  for (const { entry, source } of entries) {
    if (entry.weightKg === null || entry.weightKg <= 0 || entry.reps === null || entry.reps <= 0) {
      continue;
    }

    const key = entry.weightKg.toFixed(3);
    const existing = map[key];

    if (!existing) {
      map[key] = {
        weightKg: entry.weightKg,
        reps: entry.reps,
        source,
      };
      continue;
    }

    if (entry.reps > existing.reps) {
      map[key] = {
        weightKg: entry.weightKg,
        reps: entry.reps,
        source,
      };
      continue;
    }

    if (entry.reps < existing.reps) {
      continue;
    }

    if (compareSourceTieBreak(source, existing.source) < 0) {
      map[key] = {
        weightKg: entry.weightKg,
        reps: entry.reps,
        source,
      };
    }
  }

  return map;
}

function pickMaxWorkoutVolume(
  sessions: PersonalBestComputationSession[]
): ExercisePersonalBests['maxWorkoutVolume'] {
  let best: ExercisePersonalBests['maxWorkoutVolume'] = null;

  for (const session of sessions) {
    const normalizedSets = session.sets
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((set) =>
        normalizeWorkoutSetToEntries({
          id: `${session.workoutExerciseId}:${set.orderIndex}`,
          workoutExerciseId: session.workoutExerciseId,
          orderIndex: set.orderIndex,
          createdAt: session.workoutDate,
          reps: set.reps,
          weight: set.weight,
          weightUnit: set.weightUnit,
          weightKg: set.weightKg,
          duration: set.duration,
          distance: set.distance,
          segments: set.segments,
        })
      );

    const volume = computeExerciseWorkoutVolume({
      workoutId: session.workoutId,
      workoutDate: session.workoutDate,
      workoutExerciseId: session.workoutExerciseId,
      setCount: normalizedSets.length,
      sets: normalizedSets,
    } as ExerciseInWorkoutForAnalytics);

    if (!best || volume > best.valueKgReps) {
      best = {
        valueKgReps: volume,
        sourceWorkoutId: session.workoutId,
        sourceWorkoutDate: session.workoutDate,
      };
      continue;
    }

    if (volume < best.valueKgReps) {
      continue;
    }

    const byDate = compareIsoAsc(session.workoutDate, best.sourceWorkoutDate);
    if (byDate < 0 || (byDate === 0 && session.workoutId < best.sourceWorkoutId)) {
      best = {
        valueKgReps: volume,
        sourceWorkoutId: session.workoutId,
        sourceWorkoutDate: session.workoutDate,
      };
    }
  }

  return best;
}

export function computeExercisePersonalBests(
  sessions: PersonalBestComputationSession[],
  options: { includeEstimated1RM: boolean }
): ExercisePersonalBests {
  const flattened = flattenEntries(sessions);

  return {
    maxWeight: pickMaxWeight(flattened),
    maxSetVolume: pickMaxSetVolume(flattened),
    maxWorkoutVolume: pickMaxWorkoutVolume(sessions),
    maxRepsAtWeight: pickMaxRepsAtWeight(flattened),
    bestEstimated1RM: pickBestEstimatedOneRepMax(flattened, options.includeEstimated1RM),
  };
}

function toPbNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function pushDeltaIfImproved(
  deltas: PersonalBestDelta[],
  exerciseId: string,
  pbType: PersonalBestType,
  oldValue: number | null,
  newValue: number | null,
  weightKey?: string
): void {
  if (newValue === null) {
    return;
  }

  if (oldValue !== null && newValue <= oldValue) {
    return;
  }

  deltas.push({
    exerciseId,
    pbType,
    oldValue,
    newValue,
    ...(weightKey ? { weightKey } : {}),
  });
}

export function detectPersonalBestChanges(
  exerciseId: string,
  previous: ExercisePersonalBests | null,
  next: ExercisePersonalBests | null
): PersonalBestDelta[] {
  if (!next) {
    return [];
  }

  const deltas: PersonalBestDelta[] = [];

  pushDeltaIfImproved(
    deltas,
    exerciseId,
    'maxWeight',
    toPbNumber(previous?.maxWeight?.valueKg),
    toPbNumber(next.maxWeight?.valueKg)
  );

  pushDeltaIfImproved(
    deltas,
    exerciseId,
    'maxSetVolume',
    toPbNumber(previous?.maxSetVolume?.valueKgReps),
    toPbNumber(next.maxSetVolume?.valueKgReps)
  );

  pushDeltaIfImproved(
    deltas,
    exerciseId,
    'maxWorkoutVolume',
    toPbNumber(previous?.maxWorkoutVolume?.valueKgReps),
    toPbNumber(next.maxWorkoutVolume?.valueKgReps)
  );

  pushDeltaIfImproved(
    deltas,
    exerciseId,
    'bestEstimated1RM',
    toPbNumber(previous?.bestEstimated1RM?.valueKg),
    toPbNumber(next.bestEstimated1RM?.valueKg)
  );

  const nextWeightKeys = Object.keys(next.maxRepsAtWeight).sort();
  for (const weightKey of nextWeightKeys) {
    const oldReps = toPbNumber(previous?.maxRepsAtWeight[weightKey]?.reps);
    const newReps = toPbNumber(next.maxRepsAtWeight[weightKey]?.reps);

    pushDeltaIfImproved(deltas, exerciseId, 'maxRepsAtWeight', oldReps, newReps, weightKey);
  }

  return deltas;
}

export function detectPersonalBestChangesForExercises(
  candidates: PersonalBestDeltaCandidate[]
): PersonalBestDelta[] {
  return candidates
    .slice()
    .sort((left, right) => (left.exerciseId < right.exerciseId ? -1 : left.exerciseId > right.exerciseId ? 1 : 0))
    .flatMap((candidate) =>
      detectPersonalBestChanges(candidate.exerciseId, candidate.previous, candidate.next)
    );
}
