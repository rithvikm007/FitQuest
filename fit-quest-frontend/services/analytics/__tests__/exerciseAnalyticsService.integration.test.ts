import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/db/analyticsDbService', () => ({
  getExerciseHistory: vi.fn(),
  getExerciseSessions: vi.fn(),
  getExerciseVolumeSeries: vi.fn(),
  getExerciseFrequency: vi.fn(),
}));

import {
  getExerciseFrequency,
  getExerciseHistory,
  getExerciseSessions,
  getExerciseVolumeSeries,
  type ExerciseAnalyticsSession,
  type ExerciseFrequencyResult,
  type ExerciseVolumePoint,
} from '@/services/db/analyticsDbService';
import { computeSetVolume } from '../analyticsCalculators';
import { getExerciseAnalytics } from '../exerciseAnalyticsService';
import { normalizeWorkoutSetToEntries } from '../normalizers';
import { detectPersonalBestChanges } from '../personalBestService';

const getExerciseHistoryMock = vi.mocked(getExerciseHistory);
const getExerciseSessionsMock = vi.mocked(getExerciseSessions);
const getExerciseVolumeSeriesMock = vi.mocked(getExerciseVolumeSeries);
const getExerciseFrequencyMock = vi.mocked(getExerciseFrequency);

function makeSession(partial: Partial<ExerciseAnalyticsSession>): ExerciseAnalyticsSession {
  return {
    workoutId: partial.workoutId ?? 'w-1',
    workoutDate: partial.workoutDate ?? '2026-01-10T00:00:00.000Z',
    workoutExerciseId: partial.workoutExerciseId ?? 'we-1',
    workoutExerciseOrderIndex: partial.workoutExerciseOrderIndex ?? 0,
    exerciseId: partial.exerciseId ?? 'ex-1',
    exerciseName: partial.exerciseName ?? 'Bench Press',
    sets: partial.sets ?? [],
    workoutName: partial.workoutName,
    workoutNotes: partial.workoutNotes,
    workoutRemoteId: partial.workoutRemoteId,
  };
}

function toDayKey(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso.slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function computeSessionVolume(session: ExerciseAnalyticsSession): number {
  return session.sets
    .flatMap((set) => normalizeWorkoutSetToEntries(set).entries)
    .reduce((total, entry) => total + computeSetVolume(entry), 0);
}

function seedLocalDbFixture(
  sessions: ExerciseAnalyticsSession[],
  nowIso: string,
  recentLimit = 8
): void {
  const sortedDesc = sessions
    .slice()
    .sort((left, right) => (left.workoutDate > right.workoutDate ? -1 : left.workoutDate < right.workoutDate ? 1 : 0));

  getExerciseHistoryMock.mockResolvedValue(sortedDesc);
  getExerciseSessionsMock.mockImplementation(async (_exerciseId, limit) =>
    sortedDesc.slice(0, Math.max(1, Math.floor(limit ?? recentLimit)))
  );

  getExerciseVolumeSeriesMock.mockImplementation(
    async (_exerciseId, range): Promise<ExerciseVolumePoint[]> => {
      const now = new Date(nowIso);
      const cutoff = new Date(now);
      cutoff.setUTCDate(cutoff.getUTCDate() - (range - 1));
      cutoff.setUTCHours(0, 0, 0, 0);

      const byDay = new Map<string, number>();
      for (const session of sortedDesc) {
        const sessionDate = new Date(session.workoutDate);
        if (Number.isNaN(sessionDate.getTime()) || sessionDate.getTime() < cutoff.getTime()) {
          continue;
        }

        const day = toDayKey(session.workoutDate);
        byDay.set(day, (byDay.get(day) ?? 0) + computeSessionVolume(session));
      }

      return [...byDay.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([date, volumeKg]) => ({ date, volumeKg }));
    }
  );

  getExerciseFrequencyMock.mockImplementation(
    async (_exerciseId, range): Promise<ExerciseFrequencyResult> => {
      const now = new Date(nowIso);
      const cutoff = new Date(now);
      cutoff.setUTCDate(cutoff.getUTCDate() - (range - 1));
      cutoff.setUTCHours(0, 0, 0, 0);

      const byDay = new Map<string, number>();
      for (const session of sortedDesc) {
        const sessionDate = new Date(session.workoutDate);
        if (Number.isNaN(sessionDate.getTime()) || sessionDate.getTime() < cutoff.getTime()) {
          continue;
        }

        const day = toDayKey(session.workoutDate);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }

      const sessionsByDate = [...byDay.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([date, count]) => ({ date, sessions: count }));

      return {
        rangeDays: range,
        totalSessions: sessionsByDate.reduce((total, point) => total + point.sessions, 0),
        activeDays: sessionsByDate.length,
        sessionsByDate,
      };
    }
  );
}

describe('exerciseAnalyticsService integration (E2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds consolidated analytics output from seeded local fixture history', async () => {
    const fixtureSessions: ExerciseAnalyticsSession[] = [
      makeSession({
        workoutId: 'w-3',
        workoutDate: '2026-01-12T00:00:00.000Z',
        workoutExerciseId: 'we-3',
        sets: [
          {
            id: 's-31',
            workoutExerciseId: 'we-3',
            orderIndex: 0,
            createdAt: '2026-01-12T00:00:00.000Z',
            segments: [
              { reps: 8, weight: 80, weightUnit: 'kg' },
              { reps: 10, weight: 60, weightUnit: 'kg' },
            ],
          },
        ],
      }),
      makeSession({
        workoutId: 'w-2',
        workoutDate: '2026-01-10T00:00:00.000Z',
        workoutExerciseId: 'we-2',
        sets: [
          {
            id: 's-21',
            workoutExerciseId: 'we-2',
            orderIndex: 0,
            createdAt: '2026-01-10T00:00:00.000Z',
            reps: 12,
            weight: 50,
            weightUnit: 'kg',
          },
        ],
      }),
      makeSession({
        workoutId: 'w-1',
        workoutDate: '2026-01-04T00:00:00.000Z',
        workoutExerciseId: 'we-1',
        sets: [
          {
            id: 's-11',
            workoutExerciseId: 'we-1',
            orderIndex: 0,
            createdAt: '2026-01-04T00:00:00.000Z',
            reps: 10,
            weight: 40,
            weightUnit: 'kg',
          },
        ],
      }),
    ];

    seedLocalDbFixture(fixtureSessions, '2026-01-15T00:00:00.000Z');

    const analytics = await getExerciseAnalytics('ex-1', {
      nowIso: '2026-01-15T00:00:00.000Z',
      recentSessionsLimit: 8,
    });

    expect(analytics.exerciseId).toBe('ex-1');
    expect(analytics.totals.sessions).toBe(3);
    expect(analytics.totals.sets).toBe(3);
    expect(analytics.totals.reps).toBe(40);
    expect(analytics.totals.volumeKg).toBe(2240);

    expect(analytics.personalBests.maxWeight?.valueKg).toBe(80);
    expect(analytics.personalBests.maxSetVolume?.valueKgReps).toBe(640);
    expect(analytics.personalBests.maxWorkoutVolume?.valueKgReps).toBe(1240);

    expect(analytics.trends.sessionsLast30Days).toBe(3);
    expect(analytics.trends.volumeLast30DaysKg).toBe(2240);
    expect(analytics.trends.recentSessionVolumesKg).toHaveLength(3);

    expect(analytics.context.lastPerformedDate).toBe('2026-01-12T00:00:00.000Z');
    expect(analytics.context.daysSinceLastPerformed).toBe(3);
    expect(analytics.context.mostCommonRepRange).toBe('repRange_9_12');

    expect(analytics.repRangeDistribution).toEqual({
      repRange_1_5: 0,
      repRange_6_8: 1,
      repRange_9_12: 3,
      repRange_13_20: 0,
      repRange_21_plus: 0,
    });
  });

  it('detects PB deltas after simulated workout save appends a stronger session', async () => {
    const beforeSessions: ExerciseAnalyticsSession[] = [
      makeSession({
        workoutId: 'w-2',
        workoutDate: '2026-01-10T00:00:00.000Z',
        workoutExerciseId: 'we-2',
        sets: [
          {
            id: 's-21',
            workoutExerciseId: 'we-2',
            orderIndex: 0,
            createdAt: '2026-01-10T00:00:00.000Z',
            reps: 10,
            weight: 60,
            weightUnit: 'kg',
          },
        ],
      }),
      makeSession({
        workoutId: 'w-1',
        workoutDate: '2026-01-04T00:00:00.000Z',
        workoutExerciseId: 'we-1',
        sets: [
          {
            id: 's-11',
            workoutExerciseId: 'we-1',
            orderIndex: 0,
            createdAt: '2026-01-04T00:00:00.000Z',
            reps: 8,
            weight: 55,
            weightUnit: 'kg',
          },
        ],
      }),
    ];

    seedLocalDbFixture(beforeSessions, '2026-01-15T00:00:00.000Z');
    const before = await getExerciseAnalytics('ex-1', {
      nowIso: '2026-01-15T00:00:00.000Z',
      recentSessionsLimit: 8,
    });

    const afterSessions: ExerciseAnalyticsSession[] = [
      makeSession({
        workoutId: 'w-3',
        workoutDate: '2026-01-12T00:00:00.000Z',
        workoutExerciseId: 'we-3',
        sets: [
          {
            id: 's-31',
            workoutExerciseId: 'we-3',
            orderIndex: 0,
            createdAt: '2026-01-12T00:00:00.000Z',
            segments: [
              { reps: 8, weight: 85, weightUnit: 'kg' },
              { reps: 12, weight: 65, weightUnit: 'kg' },
            ],
          },
        ],
      }),
      ...beforeSessions,
    ];

    seedLocalDbFixture(afterSessions, '2026-01-15T00:00:00.000Z');
    const after = await getExerciseAnalytics('ex-1', {
      nowIso: '2026-01-15T00:00:00.000Z',
      recentSessionsLimit: 8,
    });

    const deltas = detectPersonalBestChanges('ex-1', before.personalBests, after.personalBests);

    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.some((delta) => delta.pbType === 'maxWeight')).toBe(true);
    expect(deltas.some((delta) => delta.pbType === 'maxSetVolume')).toBe(true);
    expect(deltas.some((delta) => delta.pbType === 'maxWorkoutVolume')).toBe(true);
    expect(deltas.some((delta) => delta.pbType === 'bestEstimated1RM')).toBe(true);
  });
});
