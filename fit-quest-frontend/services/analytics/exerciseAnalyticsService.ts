import {
  getExerciseFrequency,
  getExerciseHistory,
  getExerciseSessions,
  getExerciseVolumeSeries,
  type ExerciseAnalyticsSession,
} from '@/services/db/analyticsDbService';
import { computeEstimated1RM, computeExerciseWorkoutVolume, computeRepRangeBuckets, computeSetVolume } from './analyticsCalculators';
import { normalizeWorkoutSetToEntries } from './normalizers';
import { computeExercisePersonalBests } from './personalBestService';
import {
  ANALYTICS_FORMULA_VERSION,
  DEFAULT_ANALYTICS_OPTIONS,
  type AnalyticsComputationOptions,
  type AnalyticsSourceRef,
  type ExerciseAnalytics,
  type ExerciseRecentSessionSummary,
  type NormalizedSetEntry,
  type RepRangeBuckets,
} from './types';

type FlattenedEntry = {
  entry: NormalizedSetEntry;
  source: AnalyticsSourceRef;
};

const REP_RANGE_ORDER: Array<keyof RepRangeBuckets> = [
  'repRange_1_5',
  'repRange_6_8',
  'repRange_9_12',
  'repRange_13_20',
  'repRange_21_plus',
];

function toNow(nowIso?: string): Date {
  if (!nowIso) {
    return new Date();
  }

  const parsed = new Date(nowIso);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toNonNegativeDayDiff(fromIso: string, toDate: Date): number | null {
  const fromMs = new Date(fromIso).getTime();
  if (Number.isNaN(fromMs)) {
    return null;
  }

  const toMs = toDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((toMs - fromMs) / dayMs));
}

function buildRecentSessionSummaries(sessions: ExerciseAnalyticsSession[]): ExerciseRecentSessionSummary[] {
  return sessions.map((session) => {
    const normalizedSets = session.sets
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((set) => normalizeWorkoutSetToEntries(set));

    const volumeKg = computeExerciseWorkoutVolume({
      workoutId: session.workoutId,
      workoutDate: session.workoutDate,
      workoutExerciseId: session.workoutExerciseId,
      setCount: normalizedSets.length,
      sets: normalizedSets,
    });

    const entryCount = normalizedSets.reduce((count, set) => count + set.entries.length, 0);

    return {
      workoutId: session.workoutId,
      workoutDate: session.workoutDate,
      workoutExerciseId: session.workoutExerciseId,
      volumeKg,
      setCount: normalizedSets.length,
      entryCount,
    };
  });
}

function flattenSessionEntries(sessions: ExerciseAnalyticsSession[]): FlattenedEntry[] {
  const flattened: FlattenedEntry[] = [];

  for (const session of sessions) {
    const orderedSets = session.sets.slice().sort((left, right) => left.orderIndex - right.orderIndex);

    for (const set of orderedSets) {
      const normalized = normalizeWorkoutSetToEntries(set);
      for (const entry of normalized.entries) {
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

function selectMostCommonRepRange(buckets: RepRangeBuckets): keyof RepRangeBuckets | null {
  let bestKey: keyof RepRangeBuckets | null = null;
  let bestCount = 0;

  for (const key of REP_RANGE_ORDER) {
    const count = buckets[key];
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }

  return bestCount > 0 ? bestKey : null;
}

export async function getExerciseAnalytics(
  exerciseId: string,
  options: Partial<AnalyticsComputationOptions> & { recentSessionsLimit?: number } = {}
): Promise<ExerciseAnalytics> {
  const computationOptions: AnalyticsComputationOptions = {
    ...DEFAULT_ANALYTICS_OPTIONS,
    ...options,
  };

  const recentSessionsLimit = Number.isFinite(options.recentSessionsLimit)
    ? Math.max(1, Math.floor(options.recentSessionsLimit as number))
    : 8;

  const now = toNow(computationOptions.nowIso);

  const [history, recentSessionsRaw, volume7, volume30, volume90, frequency7, frequency30, frequency90] =
    await Promise.all([
      getExerciseHistory(exerciseId),
      getExerciseSessions(exerciseId, recentSessionsLimit),
      getExerciseVolumeSeries(exerciseId, 7, now.toISOString()),
      getExerciseVolumeSeries(exerciseId, 30, now.toISOString()),
      getExerciseVolumeSeries(exerciseId, 90, now.toISOString()),
      getExerciseFrequency(exerciseId, 7, now.toISOString()),
      getExerciseFrequency(exerciseId, 30, now.toISOString()),
      getExerciseFrequency(exerciseId, 90, now.toISOString()),
    ]);

  const normalizedSetList = history.flatMap((session) =>
    session.sets
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((set) => normalizeWorkoutSetToEntries(set))
  );

  const allEntries = normalizedSetList.flatMap((set) => set.entries);
  const recentSessions = buildRecentSessionSummaries(recentSessionsRaw);
  const repRangeDistribution = computeRepRangeBuckets(allEntries);

  const totalsVolumeKg = allEntries.reduce((total, entry) => total + computeSetVolume(entry), 0);
  const totalsReps = allEntries.reduce((total, entry) => total + (entry.reps ?? 0), 0);
  const totalsSets = history.reduce((total, session) => total + session.sets.length, 0);

  const lastPerformedDate = history.length > 0 ? history[0].workoutDate : null;
  const daysSinceLastPerformed =
    lastPerformedDate !== null ? toNonNegativeDayDiff(lastPerformedDate, now) : null;

  const recentSessionVolumesDescending = recentSessions
    .slice()
    .sort((left, right) => (left.workoutDate > right.workoutDate ? -1 : left.workoutDate < right.workoutDate ? 1 : 0))
    .map((session) => ({
      date: session.workoutDate.slice(0, 10),
      volumeKg: session.volumeKg,
    }));

  const movingAverageWindow = Math.max(1, computationOptions.movingAverageWindowSessions);
  const movingAverageSource = recentSessionVolumesDescending.slice(0, movingAverageWindow);
  const movingAverageVolumeKg =
    movingAverageSource.length > 0
      ? movingAverageSource.reduce((total, point) => total + point.volumeKg, 0) /
        movingAverageSource.length
      : 0;

  const personalBests = computeExercisePersonalBests(
    history.map((session) => ({
      workoutId: session.workoutId,
      workoutDate: session.workoutDate,
      workoutExerciseId: session.workoutExerciseId,
      sets: session.sets,
    })),
    {
      includeEstimated1RM: computationOptions.includeEstimated1RM,
    }
  );

  return {
    formulaVersion: ANALYTICS_FORMULA_VERSION,
    exerciseId,
    totals: {
      sessions: history.length,
      sets: totalsSets,
      reps: totalsReps,
      volumeKg: totalsVolumeKg,
    },
    personalBests,
    trends: {
      volumeLast7DaysKg: volume7.reduce((total, point) => total + point.volumeKg, 0),
      volumeLast30DaysKg: volume30.reduce((total, point) => total + point.volumeKg, 0),
      volumeLast90DaysKg: volume90.reduce((total, point) => total + point.volumeKg, 0),
      sessionsLast7Days: frequency7.totalSessions,
      sessionsLast30Days: frequency30.totalSessions,
      sessionsLast90Days: frequency90.totalSessions,
      movingAverageVolumeKg,
      recentSessionVolumesKg: recentSessionVolumesDescending,
    },
    context: {
      lastPerformedDate,
      daysSinceLastPerformed,
      mostCommonRepRange: selectMostCommonRepRange(repRangeDistribution),
    },
    repRangeDistribution,
    recentSessions,
  };
}
