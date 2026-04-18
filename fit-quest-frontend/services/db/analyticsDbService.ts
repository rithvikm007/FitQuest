import { getDatabase, initDatabase } from '@/database/index';
import type { SetSegment, WeightUnit, WorkoutSet } from '@/types/models';
import { computeSetVolume } from '@/services/analytics/analyticsCalculators';
import { normalizeWorkoutSetToEntries } from '@/services/analytics/normalizers';

export type AnalyticsRangeDays = 7 | 30 | 90;

type JoinedAnalyticsRow = {
  workoutId: string;
  workoutRemoteId: string | null;
  workoutDate: string;
  workoutName: string | null;
  workoutNotes: string | null;
  workoutExerciseId: string;
  workoutExerciseOrderIndex: number;
  exerciseId: string;
  exerciseName: string;
  setId: string | null;
  setOrderIndex: number | null;
  reps: number | null;
  weight: number | null;
  weightUnit: WeightUnit | null;
  weightKg: number | null;
  duration: number | null;
  distance: number | null;
  setNotes: string | null;
  segmentsJson: string | null;
  setCreatedAt: string | null;
};

export interface ExerciseAnalyticsSession {
  workoutId: string;
  workoutRemoteId?: string;
  workoutDate: string;
  workoutName?: string;
  workoutNotes?: string;
  workoutExerciseId: string;
  workoutExerciseOrderIndex: number;
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface ExerciseVolumePoint {
  date: string; // YYYY-MM-DD
  volumeKg: number;
}

export interface ExerciseFrequencyPoint {
  date: string; // YYYY-MM-DD
  sessions: number;
}

export interface ExerciseFrequencyResult {
  rangeDays: AnalyticsRangeDays;
  totalSessions: number;
  activeDays: number;
  sessionsByDate: ExerciseFrequencyPoint[];
}

async function requireDatabase() {
  await initDatabase();
  const db = getDatabase();

  if (!db) {
    throw new Error('Local database is not available on this platform.');
  }

  return db;
}

function parseSetSegments(value: string | null): SetSegment[] | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    return parsed as SetSegment[];
  } catch {
    return undefined;
  }
}

function mapJoinedRowToSet(row: JoinedAnalyticsRow): WorkoutSet | null {
  if (!row.setId || row.setOrderIndex === null || !row.setCreatedAt) {
    return null;
  }

  return {
    id: row.setId,
    workoutExerciseId: row.workoutExerciseId,
    reps: row.reps ?? undefined,
    weight: row.weight ?? undefined,
    weightUnit: row.weightUnit ?? undefined,
    weightKg: row.weightKg ?? undefined,
    duration: row.duration ?? undefined,
    distance: row.distance ?? undefined,
    notes: row.setNotes ?? undefined,
    segments: parseSetSegments(row.segmentsJson),
    orderIndex: row.setOrderIndex,
    createdAt: row.setCreatedAt,
  };
}

function toDayKey(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate.slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function getCutoffIso(rangeDays: AnalyticsRangeDays, nowIso?: string): string {
  const now = nowIso ? new Date(nowIso) : new Date();
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;
  const cutoff = new Date(safeNow);
  cutoff.setUTCDate(cutoff.getUTCDate() - (rangeDays - 1));
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff.toISOString();
}

function isOnOrAfterCutoff(isoDate: string, cutoffIso: string): boolean {
  const dateMs = new Date(isoDate).getTime();
  const cutoffMs = new Date(cutoffIso).getTime();

  if (!Number.isNaN(dateMs) && !Number.isNaN(cutoffMs)) {
    return dateMs >= cutoffMs;
  }

  return isoDate >= cutoffIso;
}

async function getJoinedRowsForExercise(exerciseId: string): Promise<JoinedAnalyticsRow[]> {
  const db = await requireDatabase();

  return db.getAllAsync<JoinedAnalyticsRow>(
    `
      SELECT
        w.id AS workoutId,
        w.remoteId AS workoutRemoteId,
        w.date AS workoutDate,
        w.name AS workoutName,
        w.notes AS workoutNotes,
        we.id AS workoutExerciseId,
        we.orderIndex AS workoutExerciseOrderIndex,
        e.id AS exerciseId,
        e.name AS exerciseName,
        ws.id AS setId,
        ws.orderIndex AS setOrderIndex,
        ws.reps AS reps,
        ws.weight AS weight,
        ws.weightUnit AS weightUnit,
        ws.weightKg AS weightKg,
        ws.duration AS duration,
        ws.distance AS distance,
        ws.notes AS setNotes,
        ws.segmentsJson AS segmentsJson,
        ws.createdAt AS setCreatedAt
      FROM workout_exercises we
      INNER JOIN workouts w ON w.id = we.workoutId
      INNER JOIN exercises e ON e.id = we.exerciseId
      LEFT JOIN workout_sets ws ON ws.workoutExerciseId = we.id
      WHERE we.exerciseId = ?
        AND w.isDeleted = 0
        AND e.isDeleted = 0
      ORDER BY w.date DESC, we.orderIndex ASC, ws.orderIndex ASC;
    `,
    [exerciseId]
  );
}

function groupRowsIntoSessions(rows: JoinedAnalyticsRow[]): ExerciseAnalyticsSession[] {
  const sessionMap = new Map<string, ExerciseAnalyticsSession>();

  for (const row of rows) {
    const sessionKey = `${row.workoutId}:${row.workoutExerciseId}`;
    const existing = sessionMap.get(sessionKey);

    if (!existing) {
      sessionMap.set(sessionKey, {
        workoutId: row.workoutId,
        workoutRemoteId: row.workoutRemoteId ?? undefined,
        workoutDate: row.workoutDate,
        workoutName: row.workoutName ?? undefined,
        workoutNotes: row.workoutNotes ?? undefined,
        workoutExerciseId: row.workoutExerciseId,
        workoutExerciseOrderIndex: row.workoutExerciseOrderIndex,
        exerciseId: row.exerciseId,
        exerciseName: row.exerciseName,
        sets: [],
      });
    }

    const mappedSet = mapJoinedRowToSet(row);
    if (mappedSet) {
      const session = sessionMap.get(sessionKey);
      if (session) {
        session.sets.push(mappedSet);
      }
    }
  }

  return [...sessionMap.values()].map((session) => ({
    ...session,
    sets: session.sets.slice().sort((a, b) => a.orderIndex - b.orderIndex),
  }));
}

export async function getExerciseHistory(exerciseId: string): Promise<ExerciseAnalyticsSession[]> {
  try {
    const rows = await getJoinedRowsForExercise(exerciseId);
    return groupRowsIntoSessions(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get exercise history: ${message}`);
  }
}

export async function getExerciseSessions(
  exerciseId: string,
  limit: number
): Promise<ExerciseAnalyticsSession[]> {
  try {
    if (!Number.isFinite(limit) || limit <= 0) {
      return [];
    }

    const history = await getExerciseHistory(exerciseId);
    return history.slice(0, Math.floor(limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get exercise sessions: ${message}`);
  }
}

export async function getExerciseVolumeSeries(
  exerciseId: string,
  range: AnalyticsRangeDays,
  nowIso?: string
): Promise<ExerciseVolumePoint[]> {
  try {
    const cutoffIso = getCutoffIso(range, nowIso);
    const sessions = await getExerciseHistory(exerciseId);

    const volumeByDay = new Map<string, number>();

    for (const session of sessions) {
      if (!isOnOrAfterCutoff(session.workoutDate, cutoffIso)) {
        continue;
      }

      const dayKey = toDayKey(session.workoutDate);
      const sessionVolume = session.sets
        .flatMap((set) => normalizeWorkoutSetToEntries(set).entries)
        .reduce((total, entry) => total + computeSetVolume(entry), 0);

      volumeByDay.set(dayKey, (volumeByDay.get(dayKey) ?? 0) + sessionVolume);
    }

    return [...volumeByDay.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([date, volumeKg]) => ({
        date,
        volumeKg,
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get exercise volume series: ${message}`);
  }
}

export async function getExerciseFrequency(
  exerciseId: string,
  range: AnalyticsRangeDays,
  nowIso?: string
): Promise<ExerciseFrequencyResult> {
  try {
    const cutoffIso = getCutoffIso(range, nowIso);
    const sessions = await getExerciseHistory(exerciseId);

    const sessionsByDay = new Map<string, number>();

    for (const session of sessions) {
      if (!isOnOrAfterCutoff(session.workoutDate, cutoffIso)) {
        continue;
      }

      const dayKey = toDayKey(session.workoutDate);
      sessionsByDay.set(dayKey, (sessionsByDay.get(dayKey) ?? 0) + 1);
    }

    const sessionsByDate = [...sessionsByDay.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([date, sessionsCount]) => ({
        date,
        sessions: sessionsCount,
      }));

    return {
      rangeDays: range,
      totalSessions: sessionsByDate.reduce((total, point) => total + point.sessions, 0),
      activeDays: sessionsByDate.length,
      sessionsByDate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get exercise frequency: ${message}`);
  }
}
