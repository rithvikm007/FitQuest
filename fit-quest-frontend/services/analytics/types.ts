import type { WeightUnit, WorkoutSet } from '../../types/models';

export const ANALYTICS_FORMULA_VERSION = '1.0.0';

export const KG_TO_LB = 2.2046226218;
export const LB_TO_KG = 0.45359237;
export const EPLEY_DIVISOR = 30;

export type AnalyticsTimeRangeDays = 7 | 30 | 90;

export interface AnalyticsSourceRef {
  workoutId: string;
  workoutDate: string; // ISO
  workoutExerciseId: string;
  setIndex: number; // 0-based set order in workout exercise
  segmentIndex: number | null; // 0-based segment order, null for top-level set
}

export interface NormalizedSetEntry {
  sourceSetId?: string;
  sourceSetOrderIndex: number;
  sourceSegmentIndex: number | null;
  reps: number | null;
  weightKg: number | null;
  weightOriginal: number | null;
  weightUnitOriginal: WeightUnit | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
}

export interface NormalizedWorkoutSet {
  source: WorkoutSet;
  // Set count must always remain one per original set, even when segmented.
  setCountContribution: 1;
  entries: NormalizedSetEntry[];
}

export interface ExerciseInWorkoutForAnalytics {
  workoutId: string;
  workoutDate: string; // ISO
  workoutExerciseId: string;
  setCount: number;
  sets: NormalizedWorkoutSet[];
}

export interface ExerciseLifetimeTotals {
  sessions: number;
  sets: number;
  reps: number;
  volumeKg: number;
}

export interface MaxWeightPB {
  valueKg: number;
  source: AnalyticsSourceRef;
  supportingReps: number | null;
}

export interface MaxSetVolumePB {
  valueKgReps: number;
  source: AnalyticsSourceRef;
}

export interface MaxWorkoutVolumePB {
  valueKgReps: number;
  sourceWorkoutId: string;
  sourceWorkoutDate: string; // ISO
}

export interface MaxRepsAtWeightRecord {
  weightKg: number;
  reps: number;
  source: AnalyticsSourceRef;
}

export interface EstimatedOneRepMaxPB {
  valueKg: number;
  source: AnalyticsSourceRef;
  reps: number;
  liftedWeightKg: number;
}

export interface ExercisePersonalBests {
  maxWeight: MaxWeightPB | null;
  maxSetVolume: MaxSetVolumePB | null;
  maxWorkoutVolume: MaxWorkoutVolumePB | null;
  maxRepsAtWeight: Record<string, MaxRepsAtWeightRecord>; // key: rounded kg string
  bestEstimated1RM: EstimatedOneRepMaxPB | null;
}

export interface VolumePoint {
  date: string; // YYYY-MM-DD
  volumeKg: number;
}

export interface ExerciseTrendSummary {
  volumeLast7DaysKg: number;
  volumeLast30DaysKg: number;
  volumeLast90DaysKg: number;
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  sessionsLast90Days: number;
  movingAverageVolumeKg: number; // default window: 3 sessions
  recentSessionVolumesKg: VolumePoint[]; // newest first
}

export interface RepRangeBuckets {
  repRange_1_5: number;
  repRange_6_8: number;
  repRange_9_12: number;
  repRange_13_20: number;
  repRange_21_plus: number;
}

export interface ExerciseContextMetrics {
  lastPerformedDate: string | null; // ISO
  daysSinceLastPerformed: number | null;
  mostCommonRepRange: keyof RepRangeBuckets | null;
}

export interface ExerciseRecentSessionSummary {
  workoutId: string;
  workoutDate: string; // ISO
  workoutExerciseId: string;
  volumeKg: number;
  setCount: number;
  entryCount: number;
}

export interface ExerciseAnalytics {
  formulaVersion: string;
  exerciseId: string;
  totals: ExerciseLifetimeTotals;
  personalBests: ExercisePersonalBests;
  trends: ExerciseTrendSummary;
  context: ExerciseContextMetrics;
  repRangeDistribution: RepRangeBuckets;
  recentSessions: ExerciseRecentSessionSummary[];
}

export interface AnalyticsComputationOptions {
  includeEstimated1RM: boolean;
  movingAverageWindowSessions: number;
  nowIso?: string;
}

export interface MetricHandlingRules {
  // If true and set has segments, analytics must use segments only for entry-level metrics.
  preferSegmentsOverTopLevel: boolean;
  // If no valid segment exists, top-level fields can be used as fallback entry.
  fallbackToTopLevelWhenSegmentsInvalid: boolean;
  // All weight-based metrics compute in kg regardless of user display preference.
  canonicalWeightUnit: 'kg';
  // A set contributes exactly 1 to set totals, never number of segments.
  oneSetCountsAsOne: true;
}

export const DEFAULT_ANALYTICS_OPTIONS: AnalyticsComputationOptions = {
  includeEstimated1RM: true,
  movingAverageWindowSessions: 3,
};

export const DEFAULT_METRIC_HANDLING_RULES: MetricHandlingRules = {
  preferSegmentsOverTopLevel: true,
  fallbackToTopLevelWhenSegmentsInvalid: true,
  canonicalWeightUnit: 'kg',
  oneSetCountsAsOne: true,
};
