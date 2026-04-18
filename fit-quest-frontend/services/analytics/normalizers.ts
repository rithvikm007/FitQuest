import type { SetSegment, WorkoutSet } from '@/types/models';
import {
  DEFAULT_METRIC_HANDLING_RULES,
  LB_TO_KG,
  type MetricHandlingRules,
  type NormalizedSetEntry,
  type NormalizedWorkoutSet,
} from './types';

function toPositiveFinite(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeWeightToKg(
  weightKg: unknown,
  weight: unknown,
  weightUnit: unknown
): { weightKg: number | null; weightOriginal: number | null; weightUnitOriginal: 'kg' | 'lb' | null } {
  const normalizedWeightKg = toPositiveFinite(weightKg);
  if (normalizedWeightKg !== null) {
    return {
      weightKg: normalizedWeightKg,
      weightOriginal: toPositiveFinite(weight),
      weightUnitOriginal: weightUnit === 'kg' || weightUnit === 'lb' ? weightUnit : null,
    };
  }

  const originalWeight = toPositiveFinite(weight);
  const originalUnit = weightUnit === 'kg' || weightUnit === 'lb' ? weightUnit : null;

  if (originalWeight !== null && originalUnit === 'kg') {
    return {
      weightKg: originalWeight,
      weightOriginal: originalWeight,
      weightUnitOriginal: 'kg',
    };
  }

  if (originalWeight !== null && originalUnit === 'lb') {
    return {
      weightKg: originalWeight * LB_TO_KG,
      weightOriginal: originalWeight,
      weightUnitOriginal: 'lb',
    };
  }

  return {
    weightKg: null,
    weightOriginal: null,
    weightUnitOriginal: null,
  };
}

function hasUsableMetric(entry: NormalizedSetEntry): boolean {
  return (
    entry.reps !== null ||
    entry.weightKg !== null ||
    entry.durationSeconds !== null ||
    entry.distanceMeters !== null
  );
}

function normalizeSegmentToEntry(
  segment: SetSegment,
  setOrderIndex: number,
  segmentIndex: number
): NormalizedSetEntry {
  const normalizedWeight = normalizeWeightToKg(segment.weightKg, segment.weight, segment.weightUnit);

  return {
    sourceSetOrderIndex: setOrderIndex,
    sourceSegmentIndex: segmentIndex,
    reps: toPositiveFinite(segment.reps),
    weightKg: normalizedWeight.weightKg,
    weightOriginal: normalizedWeight.weightOriginal,
    weightUnitOriginal: normalizedWeight.weightUnitOriginal,
    durationSeconds: toPositiveFinite(segment.duration),
    distanceMeters: toPositiveFinite(segment.distance),
  };
}

function normalizeTopLevelSetToEntry(set: WorkoutSet): NormalizedSetEntry {
  const normalizedWeight = normalizeWeightToKg(set.weightKg, set.weight, set.weightUnit);

  return {
    sourceSetId: set.id,
    sourceSetOrderIndex: set.orderIndex,
    sourceSegmentIndex: null,
    reps: toPositiveFinite(set.reps),
    weightKg: normalizedWeight.weightKg,
    weightOriginal: normalizedWeight.weightOriginal,
    weightUnitOriginal: normalizedWeight.weightUnitOriginal,
    durationSeconds: toPositiveFinite(set.duration),
    distanceMeters: toPositiveFinite(set.distance),
  };
}

export function normalizeWorkoutSetToEntries(
  set: WorkoutSet,
  handlingRules: MetricHandlingRules = DEFAULT_METRIC_HANDLING_RULES
): NormalizedWorkoutSet {
  const topLevelEntry = normalizeTopLevelSetToEntry(set);
  const segments = Array.isArray(set.segments) ? set.segments : [];

  const normalizedSegmentEntries = segments
    .map((segment, index) => normalizeSegmentToEntry(segment, set.orderIndex, index))
    .filter(hasUsableMetric);

  const entries: NormalizedSetEntry[] = (() => {
    if (handlingRules.preferSegmentsOverTopLevel && normalizedSegmentEntries.length > 0) {
      return normalizedSegmentEntries;
    }

    if (
      handlingRules.preferSegmentsOverTopLevel &&
      normalizedSegmentEntries.length === 0 &&
      segments.length > 0
    ) {
      return handlingRules.fallbackToTopLevelWhenSegmentsInvalid && hasUsableMetric(topLevelEntry)
        ? [topLevelEntry]
        : [];
    }

    return hasUsableMetric(topLevelEntry) ? [topLevelEntry] : [];
  })();

  return {
    source: set,
    setCountContribution: 1,
    entries,
  };
}

export function normalizeWorkoutSetsToEntryList(
  sets: WorkoutSet[],
  handlingRules: MetricHandlingRules = DEFAULT_METRIC_HANDLING_RULES
): NormalizedSetEntry[] {
  return sets
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .flatMap((set) => normalizeWorkoutSetToEntries(set, handlingRules).entries);
}

export function kgToLb(weightKg: number): number {
  return weightKg * (1 / LB_TO_KG);
}
