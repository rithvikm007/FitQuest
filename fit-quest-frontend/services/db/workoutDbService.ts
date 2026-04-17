import { getDatabase, initDatabase } from '@/database/index';
import type { Exercise, SetSegment, SyncStatus, Workout, WorkoutExercise, WorkoutSet } from '@/types/models';

// ============================================================================
// Row Types (SQLite → TypeScript)
// ============================================================================

type WorkoutRow = {
  id: string;
  remoteId: string | null;
  userId: string;
  date: string;
  name: string | null;
  notes: string | null;
  sourcePlanId: string | null;
  sourcePlanRemoteId: string | null;
  isDeleted: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

type WorkoutExerciseRow = {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
  createdAt: string;
};

type WorkoutSetRow = {
  id: string;
  workoutExerciseId: string;
  reps: number | null;
  weight: number | null;
  weightUnit: 'kg' | 'lb' | null;
  weightKg: number | null;
  duration: number | null;
  distance: number | null;
  notes: string | null;
  segmentsJson: string | null;
  orderIndex: number;
  createdAt: string;
};

type ExerciseRow = {
  id: string;
  remoteId: string | null;
  name: string;
  description: string | null;
  category: Exercise['category'];
  primaryMuscle: Exercise['primaryMuscle'];
  otherMuscles: string | null;
  type: Exercise['type'];
  equipment: Exercise['equipment'];
  instructions: string;
  videoUrl: string | null;
  isCustom: number;
  userId: string | null;
  isDeleted: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Exported Composite Type
// ============================================================================

export type FullWorkout = Workout & {
  exercises: Array<WorkoutExercise & { sets: WorkoutSet[]; exercise: Exercise }>;
};

// ============================================================================
// Helpers
// ============================================================================

function generateUuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function requireDatabase() {
  await initDatabase();
  const db = getDatabase();

  if (!db) {
    throw new Error('Local database is not available on this platform.');
  }

  return db;
}

function mapWorkoutRow(row: WorkoutRow): Workout {
  return {
    id: row.id,
    remoteId: row.remoteId ?? undefined,
    userId: row.userId,
    date: row.date,
    name: row.name ?? undefined,
    notes: row.notes ?? undefined,
    sourcePlanId: row.sourcePlanId ?? undefined,
    sourcePlanRemoteId: row.sourcePlanRemoteId ?? undefined,
    isDeleted: row.isDeleted === 1,
    syncStatus: row.syncStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapWorkoutExerciseRow(row: WorkoutExerciseRow): WorkoutExercise {
  return {
    id: row.id,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
  };
}

function mapWorkoutSetRow(row: WorkoutSetRow): WorkoutSet {
  return {
    id: row.id,
    workoutExerciseId: row.workoutExerciseId,
    reps: row.reps ?? undefined,
    weight: row.weight ?? undefined,
    weightUnit: row.weightUnit ?? undefined,
    weightKg: row.weightKg ?? undefined,
    duration: row.duration ?? undefined,
    distance: row.distance ?? undefined,
    notes: row.notes ?? undefined,
    segments: parseSetSegments(row.segmentsJson),
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
  };
}

function parseJsonArray(value: string | null, fieldName: string): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    return parsed.map(String);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON in ${fieldName}: ${msg}`);
  }
}

function parseSetSegments(value: string | null): SetSegment[] | undefined {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return undefined;
    return parsed as SetSegment[];
  } catch {
    return undefined;
  }
}

function serializeSetSegments(segments: SetSegment[] | undefined): string | null {
  if (!segments || segments.length === 0) {
    return null;
  }

  return JSON.stringify(segments);
}

function mapExerciseRow(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    remoteId: row.remoteId ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    primaryMuscle: row.primaryMuscle,
    otherMuscles: parseJsonArray(row.otherMuscles, 'otherMuscles') as Exercise['otherMuscles'],
    type: row.type,
    equipment: row.equipment,
    instructions: parseJsonArray(row.instructions, 'instructions'),
    videoUrl: row.videoUrl ?? undefined,
    isCustom: row.isCustom === 1,
    userId: row.userId ?? undefined,
    isDeleted: row.isDeleted === 1,
    syncStatus: row.syncStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findWorkoutByRemoteId(remoteId: string): Promise<Workout | null> {
  const db = await requireDatabase();
  const rows = await db.getAllAsync<WorkoutRow>(
    `SELECT * FROM workouts WHERE remoteId = ? LIMIT 1;`,
    [remoteId]
  );

  if (rows.length === 0) return null;
  return mapWorkoutRow(rows[0]);
}

// ============================================================================
// Exported Service Functions
// ============================================================================

/**
 * Save a workout with all nested exercises and sets in a single transaction.
 * Reconciles by remoteId first so downloaded server records don't create duplicates.
 * Returns the resolved local id.
 */
export async function saveWorkout(
  workout: Workout,
  exercises: WorkoutExercise[],
  sets: WorkoutSet[]
): Promise<string> {
  try {
    const db = await requireDatabase();
    const now = new Date().toISOString();

    const existingByRemoteId = workout.remoteId
      ? await findWorkoutByRemoteId(workout.remoteId)
      : null;

    const resolvedId = existingByRemoteId?.id ?? workout.id ?? generateUuid();
    const createdAt = existingByRemoteId?.createdAt ?? workout.createdAt ?? now;

    await db.withTransactionAsync(async () => {
      // Upsert workout row
      await db.runAsync(
        `
          INSERT INTO workouts (
            id, remoteId, userId, date, name, notes,
            sourcePlanId, sourcePlanRemoteId, isDeleted, syncStatus, createdAt, updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            remoteId          = excluded.remoteId,
            userId            = excluded.userId,
            date              = excluded.date,
            name              = excluded.name,
            notes             = excluded.notes,
            sourcePlanId      = excluded.sourcePlanId,
            sourcePlanRemoteId = excluded.sourcePlanRemoteId,
            isDeleted         = excluded.isDeleted,
            syncStatus        = excluded.syncStatus,
            createdAt         = excluded.createdAt,
            updatedAt         = excluded.updatedAt;
        `,
        [
          resolvedId,
          workout.remoteId ?? existingByRemoteId?.remoteId ?? null,
          workout.userId,
          workout.date,
          workout.name ?? null,
          workout.notes ?? null,
          workout.sourcePlanId ?? null,
          workout.sourcePlanRemoteId ?? null,
          workout.isDeleted ? 1 : 0,
          'pending',
          createdAt,
          now,
        ]
      );

      // Remove existing nested rows so we can fully replace them
      const existingWeRows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM workout_exercises WHERE workoutId = ?;`,
        [resolvedId]
      );

      for (const { id: weId } of existingWeRows) {
        await db.runAsync(
          `DELETE FROM workout_sets WHERE workoutExerciseId = ?;`,
          [weId]
        );
      }

      await db.runAsync(
        `DELETE FROM workout_exercises WHERE workoutId = ?;`,
        [resolvedId]
      );

      // Insert new workout_exercises
      for (const we of exercises) {
        await db.runAsync(
          `
            INSERT INTO workout_exercises (id, workoutId, exerciseId, orderIndex, createdAt)
            VALUES (?, ?, ?, ?, ?);
          `,
          [we.id ?? generateUuid(), resolvedId, we.exerciseId, we.orderIndex, we.createdAt ?? now]
        );
      }

      // Insert new workout_sets
      for (const s of sets) {
        await db.runAsync(
          `
            INSERT INTO workout_sets (
              id, workoutExerciseId, reps, weight, weightUnit, weightKg, duration, distance, notes, segmentsJson, orderIndex, createdAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `,
          [
            s.id ?? generateUuid(),
            s.workoutExerciseId,
            s.reps ?? null,
            s.weight ?? null,
            s.weightUnit ?? null,
            s.weightKg ?? null,
            s.duration ?? null,
            s.distance ?? null,
            s.notes ?? null,
            serializeSetSegments(s.segments),
            s.orderIndex,
            s.createdAt ?? now,
          ]
        );
      }
    });

    return resolvedId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save workout: ${message}`);
  }
}

/**
 * Retrieve a paginated list of workouts sorted by date descending.
 * Page is 1-indexed.
 */
export async function getWorkouts(page: number, limit: number): Promise<Workout[]> {
  try {
    const db = await requireDatabase();
    const offset = (page - 1) * limit;

    const rows = await db.getAllAsync<WorkoutRow>(
      `
        SELECT *
        FROM workouts
        WHERE isDeleted = 0
        ORDER BY date DESC
        LIMIT ? OFFSET ?;
      `,
      [limit, offset]
    );

    return rows.map(mapWorkoutRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get workouts: ${message}`);
  }
}

/**
 * Retrieve a single workout with fully nested exercises and sets.
 * Accepts either a local id or a remoteId.
 */
export async function getWorkoutById(id: string): Promise<FullWorkout | null> {
  try {
    const db = await requireDatabase();

    const workoutRows = await db.getAllAsync<WorkoutRow>(
      `SELECT * FROM workouts WHERE (id = ? OR remoteId = ?) AND isDeleted = 0 LIMIT 1;`,
      [id, id]
    );

    if (workoutRows.length === 0) return null;

    const workout = mapWorkoutRow(workoutRows[0]);

    const weRows = await db.getAllAsync<WorkoutExerciseRow>(
      `SELECT * FROM workout_exercises WHERE workoutId = ? ORDER BY orderIndex ASC;`,
      [workout.id]
    );

    if (weRows.length === 0) {
      return { ...workout, exercises: [] };
    }

    // Fetch all sets for these workout_exercises in one query
    const weIds = weRows.map((we) => we.id);
    const wePlaceholders = weIds.map(() => '?').join(', ');
    const allSetRows = await db.getAllAsync<WorkoutSetRow>(
      `
        SELECT *
        FROM workout_sets
        WHERE workoutExerciseId IN (${wePlaceholders})
        ORDER BY workoutExerciseId, orderIndex ASC;
      `,
      weIds
    );

    // Fetch all exercises referenced by this workout in one query
    const uniqueExerciseIds = [...new Set(weRows.map((we) => we.exerciseId))];
    const exPlaceholders = uniqueExerciseIds.map(() => '?').join(', ');
    const exerciseRows = await db.getAllAsync<ExerciseRow>(
      `SELECT * FROM exercises WHERE id IN (${exPlaceholders});`,
      uniqueExerciseIds
    );

    const exerciseMap = new Map<string, Exercise>(
      exerciseRows.map((row) => [row.id, mapExerciseRow(row)])
    );

    // Group sets by workout_exercise id
    const setsByWeId = new Map<string, WorkoutSet[]>();
    for (const setRow of allSetRows) {
      const existing = setsByWeId.get(setRow.workoutExerciseId) ?? [];
      existing.push(mapWorkoutSetRow(setRow));
      setsByWeId.set(setRow.workoutExerciseId, existing);
    }

    const nestedExercises = weRows.map((weRow) => ({
      ...mapWorkoutExerciseRow(weRow),
      sets: setsByWeId.get(weRow.id) ?? [],
      exercise: exerciseMap.get(weRow.exerciseId) as Exercise,
    }));

    return { ...workout, exercises: nestedExercises };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get workout by id: ${message}`);
  }
}

/**
 * Update top-level workout fields. Pass exercises + sets together to fully
 * replace the nested rows in a transaction.
 */
export async function updateWorkout(
  id: string,
  workout: Partial<Workout>,
  exercises?: WorkoutExercise[],
  sets?: WorkoutSet[]
): Promise<void> {
  try {
    const db = await requireDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      const setClauses: string[] = ['syncStatus = ?', 'updatedAt = ?'];
      const params: Array<string | number | null> = ['pending', now];

      if (workout.remoteId !== undefined) {
        setClauses.push('remoteId = ?');
        params.push(workout.remoteId);
      }
      if (workout.userId !== undefined) {
        setClauses.push('userId = ?');
        params.push(workout.userId);
      }
      if (workout.date !== undefined) {
        setClauses.push('date = ?');
        params.push(workout.date);
      }
      if ('name' in workout) {
        setClauses.push('name = ?');
        params.push(workout.name ?? null);
      }
      if ('notes' in workout) {
        setClauses.push('notes = ?');
        params.push(workout.notes ?? null);
      }
      if ('sourcePlanId' in workout) {
        setClauses.push('sourcePlanId = ?');
        params.push(workout.sourcePlanId ?? null);
      }
      if ('sourcePlanRemoteId' in workout) {
        setClauses.push('sourcePlanRemoteId = ?');
        params.push(workout.sourcePlanRemoteId ?? null);
      }

      await db.runAsync(
        `UPDATE workouts SET ${setClauses.join(', ')} WHERE id = ? OR remoteId = ?;`,
        [...params, id, id]
      );

      if (exercises !== undefined && sets !== undefined) {
        // Resolve the actual local id in case caller passed a remoteId
        const resolvedRows = await db.getAllAsync<{ id: string }>(
          `SELECT id FROM workouts WHERE id = ? OR remoteId = ? LIMIT 1;`,
          [id, id]
        );
        const resolvedId = resolvedRows.length > 0 ? resolvedRows[0].id : id;

        // Replace nested rows
        const existingWeRows = await db.getAllAsync<{ id: string }>(
          `SELECT id FROM workout_exercises WHERE workoutId = ?;`,
          [resolvedId]
        );

        for (const { id: weId } of existingWeRows) {
          await db.runAsync(
            `DELETE FROM workout_sets WHERE workoutExerciseId = ?;`,
            [weId]
          );
        }

        await db.runAsync(
          `DELETE FROM workout_exercises WHERE workoutId = ?;`,
          [resolvedId]
        );

        for (const we of exercises) {
          await db.runAsync(
            `
              INSERT INTO workout_exercises (id, workoutId, exerciseId, orderIndex, createdAt)
              VALUES (?, ?, ?, ?, ?);
            `,
            [we.id ?? generateUuid(), resolvedId, we.exerciseId, we.orderIndex, we.createdAt ?? now]
          );
        }

        for (const s of sets) {
          await db.runAsync(
            `
              INSERT INTO workout_sets (
                  id, workoutExerciseId, reps, weight, weightUnit, weightKg, duration, distance, notes, segmentsJson, orderIndex, createdAt
              )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `,
            [
              s.id ?? generateUuid(),
              s.workoutExerciseId,
              s.reps ?? null,
              s.weight ?? null,
              s.weightUnit ?? null,
              s.weightKg ?? null,
              s.duration ?? null,
              s.distance ?? null,
              s.notes ?? null,
              serializeSetSegments(s.segments),
              s.orderIndex,
              s.createdAt ?? now,
            ]
          );
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update workout: ${message}`);
  }
}

/**
 * Soft-delete a workout. Nested exercise/set rows remain in the database but
 * are unreachable since all queries filter workouts by isDeleted = 0.
 */
export async function deleteWorkout(id: string): Promise<void> {
  try {
    const db = await requireDatabase();
    await db.runAsync(
      `
        UPDATE workouts
        SET isDeleted = 1, syncStatus = 'pending', updatedAt = ?
        WHERE id = ? OR remoteId = ?;
      `,
      [new Date().toISOString(), id, id]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to delete workout: ${message}`);
  }
}

/**
 * Search workouts by name (case-insensitive LIKE). Falls back to paginated
 * list when query is empty.
 */
export async function searchWorkouts(query: string): Promise<Workout[]> {
  try {
    const db = await requireDatabase();
    const sanitized = query.trim();

    if (!sanitized) {
      return getWorkouts(1, 50);
    }

    const pattern = `%${sanitized}%`;
    const rows = await db.getAllAsync<WorkoutRow>(
      `
        SELECT *
        FROM workouts
        WHERE isDeleted = 0
          AND COALESCE(name, '') LIKE ? COLLATE NOCASE
        ORDER BY date DESC;
      `,
      [pattern]
    );

    return rows.map(mapWorkoutRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to search workouts: ${message}`);
  }
}
