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
} from '@/services/db/analyticsDbService';
import { getExerciseAnalytics } from '../exerciseAnalyticsService';
import type { ExerciseAnalyticsSession } from '@/services/db/analyticsDbService';

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

describe('getExerciseAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns consolidated analytics from B1 query outputs and A2 calculators', async () => {
    const sessionA = makeSession({
      workoutId: 'w-2',
      workoutDate: '2026-01-12T00:00:00.000Z',
      workoutExerciseId: 'we-2',
      sets: [
        {
          id: 's-1',
          workoutExerciseId: 'we-2',
          orderIndex: 0,
          createdAt: '2026-01-12T00:00:00.000Z',
          segments: [
            { reps: 8, weight: 80, weightUnit: 'kg' },
            { reps: 10, weight: 60, weightUnit: 'kg' },
          ],
        },
      ],
    });

    const sessionB = makeSession({
      workoutId: 'w-1',
      workoutDate: '2026-01-10T00:00:00.000Z',
      workoutExerciseId: 'we-1',
      sets: [
        {
          id: 's-2',
          workoutExerciseId: 'we-1',
          orderIndex: 0,
          createdAt: '2026-01-10T00:00:00.000Z',
          reps: 12,
          weight: 50,
          weightUnit: 'kg',
        },
      ],
    });

    getExerciseHistoryMock.mockResolvedValue([sessionA, sessionB]);
    getExerciseSessionsMock.mockResolvedValue([sessionA, sessionB]);
    getExerciseVolumeSeriesMock
      .mockResolvedValueOnce([{ date: '2026-01-12', volumeKg: 1240 }])
      .mockResolvedValueOnce([
        { date: '2026-01-10', volumeKg: 600 },
        { date: '2026-01-12', volumeKg: 1240 },
      ])
      .mockResolvedValueOnce([
        { date: '2026-01-10', volumeKg: 600 },
        { date: '2026-01-12', volumeKg: 1240 },
      ]);

    getExerciseFrequencyMock
      .mockResolvedValueOnce({
        rangeDays: 7,
        totalSessions: 1,
        activeDays: 1,
        sessionsByDate: [{ date: '2026-01-12', sessions: 1 }],
      })
      .mockResolvedValueOnce({
        rangeDays: 30,
        totalSessions: 2,
        activeDays: 2,
        sessionsByDate: [
          { date: '2026-01-10', sessions: 1 },
          { date: '2026-01-12', sessions: 1 },
        ],
      })
      .mockResolvedValueOnce({
        rangeDays: 90,
        totalSessions: 2,
        activeDays: 2,
        sessionsByDate: [
          { date: '2026-01-10', sessions: 1 },
          { date: '2026-01-12', sessions: 1 },
        ],
      });

    const analytics = await getExerciseAnalytics('ex-1', {
      nowIso: '2026-01-15T00:00:00.000Z',
      recentSessionsLimit: 8,
    });

    expect(analytics.exerciseId).toBe('ex-1');
    expect(analytics.totals).toEqual({
      sessions: 2,
      sets: 2,
      reps: 30,
      volumeKg: 1840,
    });
    expect(analytics.trends.volumeLast30DaysKg).toBe(1840);
    expect(analytics.trends.sessionsLast30Days).toBe(2);
    expect(analytics.repRangeDistribution).toEqual({
      repRange_1_5: 0,
      repRange_6_8: 1,
      repRange_9_12: 2,
      repRange_13_20: 0,
      repRange_21_plus: 0,
    });
    expect(analytics.context.lastPerformedDate).toBe('2026-01-12T00:00:00.000Z');
    expect(analytics.context.daysSinceLastPerformed).toBe(3);
    expect(analytics.recentSessions).toHaveLength(2);
    expect(analytics.personalBests.maxWorkoutVolume?.valueKgReps).toBe(1240);
    expect(analytics.personalBests.maxWeight?.valueKg).toBe(80);
  });

  it('returns stable empty defaults when no history exists', async () => {
    getExerciseHistoryMock.mockResolvedValue([]);
    getExerciseSessionsMock.mockResolvedValue([]);
    getExerciseVolumeSeriesMock.mockResolvedValue([]);
    getExerciseFrequencyMock.mockResolvedValue({
      rangeDays: 30,
      totalSessions: 0,
      activeDays: 0,
      sessionsByDate: [],
    });

    const analytics = await getExerciseAnalytics('ex-empty', {
      nowIso: '2026-01-15T00:00:00.000Z',
    });

    expect(analytics.exerciseId).toBe('ex-empty');
    expect(analytics.totals.sessions).toBe(0);
    expect(analytics.totals.sets).toBe(0);
    expect(analytics.totals.reps).toBe(0);
    expect(analytics.totals.volumeKg).toBe(0);
    expect(analytics.context.lastPerformedDate).toBeNull();
    expect(analytics.context.daysSinceLastPerformed).toBeNull();
    expect(analytics.context.mostCommonRepRange).toBeNull();
    expect(analytics.recentSessions).toEqual([]);
  });
});
