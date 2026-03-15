import { getDatabase, initDatabase } from '@/database/index';
import type { Exercise, ExerciseCategory } from '@/types/models';

type ExerciseFilters = {
  category?: string;
  isCustom?: boolean;
};

type ExerciseRow = {
  id: string;
  remoteId: string | null;
  name: string;
  description: string | null;
  category: ExerciseCategory;
  primaryMuscle: Exercise['primaryMuscle'];
  otherMuscles: string | null;
  type: Exercise['type'];
  equipment: Exercise['equipment'];
  instructions: string;
  videoUrl: string | null;
  isCustom: number;
  userId: string | null;
  isDeleted: number;
  syncStatus: Exercise['syncStatus'];
  createdAt: string;
  updatedAt: string;
};

function generateUuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = char === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
}

function parseJsonArray(value: string | null, fieldName: string): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    if (!Array.isArray(parsedValue)) {
      throw new Error('Value is not an array.');
    }

    return parsedValue.map((entry) => String(entry));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${fieldName}: ${message}`);
  }
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

async function requireDatabase() {
  await initDatabase();
  const db = getDatabase();

  if (!db) {
    throw new Error('Local database is not available on this platform.');
  }

  return db;
}

async function findExerciseByRemoteId(remoteId: string): Promise<Exercise | null> {
  const db = await requireDatabase();
  const rows = await db.getAllAsync<ExerciseRow>(
    `
      SELECT *
      FROM exercises
      WHERE remoteId = ?
      LIMIT 1;
    `,
    [remoteId]
  );

  if (rows.length === 0) {
    return null;
  }

  return mapExerciseRow(rows[0]);
}

export async function saveExercise(exercise: Exercise): Promise<string> {
  try {
    const db = await requireDatabase();
    const now = new Date().toISOString();
    const existingByRemoteId = exercise.remoteId
      ? await findExerciseByRemoteId(exercise.remoteId)
      : null;

    const resolvedId = existingByRemoteId?.id ?? exercise.id ?? generateUuid();
    const createdAt = existingByRemoteId?.createdAt ?? exercise.createdAt ?? now;

    await db.runAsync(
      `
        INSERT INTO exercises (
          id,
          remoteId,
          name,
          description,
          category,
          primaryMuscle,
          otherMuscles,
          type,
          equipment,
          instructions,
          videoUrl,
          isCustom,
          userId,
          isDeleted,
          syncStatus,
          createdAt,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          remoteId = excluded.remoteId,
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          primaryMuscle = excluded.primaryMuscle,
          otherMuscles = excluded.otherMuscles,
          type = excluded.type,
          equipment = excluded.equipment,
          instructions = excluded.instructions,
          videoUrl = excluded.videoUrl,
          isCustom = excluded.isCustom,
          userId = excluded.userId,
          isDeleted = excluded.isDeleted,
          syncStatus = excluded.syncStatus,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt;
      `,
      [
        resolvedId,
        exercise.remoteId ?? existingByRemoteId?.remoteId ?? null,
        exercise.name,
        exercise.description ?? null,
        exercise.category,
        exercise.primaryMuscle,
        JSON.stringify(exercise.otherMuscles ?? []),
        exercise.type,
        exercise.equipment,
        JSON.stringify(exercise.instructions ?? []),
        exercise.videoUrl ?? null,
        exercise.isCustom ? 1 : 0,
        exercise.userId ?? null,
        exercise.isDeleted ? 1 : 0,
        'pending',
        createdAt,
        now,
      ]
    );

    return resolvedId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save exercise: ${message}`);
  }
}

export async function getExercises(filters?: ExerciseFilters): Promise<Exercise[]> {
  try {
    const db = await requireDatabase();
    const queryConditions: string[] = ['isDeleted = 0'];
    const queryParams: Array<string | number> = [];

    if (filters?.category) {
      queryConditions.push('category = ?');
      queryParams.push(filters.category);
    }

    if (typeof filters?.isCustom === 'boolean') {
      queryConditions.push('isCustom = ?');
      queryParams.push(filters.isCustom ? 1 : 0);
    }

    const rows = await db.getAllAsync<ExerciseRow>(
      `
        SELECT *
        FROM exercises
        WHERE ${queryConditions.join(' AND ')}
        ORDER BY updatedAt DESC, createdAt DESC;
      `,
      queryParams
    );

    return rows.map(mapExerciseRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get exercises: ${message}`);
  }
}

export async function getExerciseById(id: string, includeDeleted = false): Promise<Exercise | null> {
  try {
    const db = await requireDatabase();
    const deletedClause = includeDeleted ? '' : 'AND isDeleted = 0';
    const rows = await db.getAllAsync<ExerciseRow>(
      `
        SELECT *
        FROM exercises
        WHERE (id = ? OR remoteId = ?)
        ${deletedClause}
        LIMIT 1;
      `,
      [id, id]
    );

    if (rows.length === 0) {
      return null;
    }

    return mapExerciseRow(rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get exercise by id: ${message}`);
  }
}

export async function deleteExercise(id: string): Promise<void> {
  try {
    const db = await requireDatabase();
    await db.runAsync(
      `
        UPDATE exercises
        SET isDeleted = 1,
            syncStatus = 'pending',
            updatedAt = ?
        WHERE id = ? OR remoteId = ?;
      `,
      [new Date().toISOString(), id, id]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to delete exercise: ${message}`);
  }
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  try {
    const db = await requireDatabase();
    const sanitizedQuery = query.trim();

    if (!sanitizedQuery) {
      return getExercises();
    }

    const likePattern = `%${sanitizedQuery}%`;
    const rows = await db.getAllAsync<ExerciseRow>(
      `
        SELECT *
        FROM exercises
        WHERE isDeleted = 0
          AND (
            name LIKE ? COLLATE NOCASE
            OR COALESCE(description, '') LIKE ? COLLATE NOCASE
          )
        ORDER BY updatedAt DESC, createdAt DESC;
      `,
      [likePattern, likePattern]
    );

    return rows.map(mapExerciseRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to search exercises: ${message}`);
  }
}
