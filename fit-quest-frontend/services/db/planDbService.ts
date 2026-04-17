import { getDatabase, initDatabase } from '@/database/index';
import type { Exercise, Plan, PlanExercise, PlanSet, SetSegment, SyncStatus } from '@/types/models';

// ============================================================================
// Row Types (SQLite -> TypeScript)
// ============================================================================

type PlanRow = {
  id: string;
  remoteId: string | null;
  userId: string;
  name: string;
  plannedDate: string | null;
  isDeleted: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

type PlanExerciseRow = {
  id: string;
  planId: string;
  exerciseId: string;
  orderIndex: number;
  createdAt: string;
};

type PlanSetRow = {
  id: string;
  planExerciseId: string;
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

export type FullPlan = Plan & {
  exercises: Array<PlanExercise & { sets: PlanSet[]; exercise: Exercise }>;
};

// ============================================================================
// Helpers
// ============================================================================

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

async function requireDatabase() {
  await initDatabase();
  const db = getDatabase();

  if (!db) {
    throw new Error('Local database is not available on this platform.');
  }

  return db;
}

function parseJsonArray(value: string | null, fieldName: string): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('Not an array.');
    }

    return parsed.map(String);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${fieldName}: ${message}`);
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

function mapPlanRow(row: PlanRow): Plan {
  return {
    id: row.id,
    remoteId: row.remoteId ?? undefined,
    userId: row.userId,
    name: row.name,
    plannedDate: row.plannedDate ?? undefined,
    isDeleted: row.isDeleted === 1,
    syncStatus: row.syncStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPlanExerciseRow(row: PlanExerciseRow): PlanExercise {
  return {
    id: row.id,
    planId: row.planId,
    exerciseId: row.exerciseId,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
  };
}

function mapPlanSetRow(row: PlanSetRow): PlanSet {
  return {
    id: row.id,
    planExerciseId: row.planExerciseId,
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

async function findPlanByRemoteId(remoteId: string): Promise<Plan | null> {
  const db = await requireDatabase();
  const rows = await db.getAllAsync<PlanRow>(
    `SELECT * FROM plans WHERE remoteId = ? LIMIT 1;`,
    [remoteId]
  );

  if (rows.length === 0) {
    return null;
  }

  return mapPlanRow(rows[0]);
}

// ============================================================================
// Exported Service Functions
// ============================================================================

/**
 * Save a plan and replace all nested plan_exercises / plan_sets in one
 * transaction. Reconciles by remoteId first.
 */
export async function savePlan(
  plan: Plan,
  exercises: PlanExercise[],
  sets: PlanSet[]
): Promise<string> {
  try {
    const db = await requireDatabase();
    const now = new Date().toISOString();

    const existingByRemoteId = plan.remoteId
      ? await findPlanByRemoteId(plan.remoteId)
      : null;

    const resolvedId = existingByRemoteId?.id ?? plan.id ?? generateUuid();
    const createdAt = existingByRemoteId?.createdAt ?? plan.createdAt ?? now;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `
          INSERT INTO plans (
            id,
            remoteId,
            userId,
            name,
            plannedDate,
            isDeleted,
            syncStatus,
            createdAt,
            updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            remoteId = excluded.remoteId,
            userId = excluded.userId,
            name = excluded.name,
            plannedDate = excluded.plannedDate,
            isDeleted = excluded.isDeleted,
            syncStatus = excluded.syncStatus,
            createdAt = excluded.createdAt,
            updatedAt = excluded.updatedAt;
        `,
        [
          resolvedId,
          plan.remoteId ?? existingByRemoteId?.remoteId ?? null,
          plan.userId,
          plan.name,
          plan.plannedDate ?? null,
          plan.isDeleted ? 1 : 0,
          'pending',
          createdAt,
          now,
        ]
      );

      const existingPeRows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM plan_exercises WHERE planId = ?;`,
        [resolvedId]
      );

      for (const { id: peId } of existingPeRows) {
        await db.runAsync(
          `DELETE FROM plan_sets WHERE planExerciseId = ?;`,
          [peId]
        );
      }

      await db.runAsync(
        `DELETE FROM plan_exercises WHERE planId = ?;`,
        [resolvedId]
      );

      for (const planExercise of exercises) {
        await db.runAsync(
          `
            INSERT INTO plan_exercises (id, planId, exerciseId, orderIndex, createdAt)
            VALUES (?, ?, ?, ?, ?);
          `,
          [
            planExercise.id ?? generateUuid(),
            resolvedId,
            planExercise.exerciseId,
            planExercise.orderIndex,
            planExercise.createdAt ?? now,
          ]
        );
      }

      for (const planSet of sets) {
        await db.runAsync(
          `
            INSERT INTO plan_sets (
              id,
              planExerciseId,
              reps,
              weight,
              weightUnit,
              weightKg,
              duration,
              distance,
              notes,
              segmentsJson,
              orderIndex,
              createdAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `,
          [
            planSet.id ?? generateUuid(),
            planSet.planExerciseId,
            planSet.reps ?? null,
            planSet.weight ?? null,
            planSet.weightUnit ?? null,
            planSet.weightKg ?? null,
            planSet.duration ?? null,
            planSet.distance ?? null,
            planSet.notes ?? null,
            serializeSetSegments(planSet.segments),
            planSet.orderIndex,
            planSet.createdAt ?? now,
          ]
        );
      }
    });

    return resolvedId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save plan: ${message}`);
  }
}

/**
 * Paginated list sorted by plannedDate ascending.
 * Page is 1-indexed.
 */
export async function getPlans(page: number, limit: number): Promise<Plan[]> {
  try {
    const db = await requireDatabase();
    const offset = (page - 1) * limit;

    const rows = await db.getAllAsync<PlanRow>(
      `
        SELECT *
        FROM plans
        WHERE isDeleted = 0
        ORDER BY
          CASE WHEN plannedDate IS NULL THEN 1 ELSE 0 END,
          plannedDate ASC,
          createdAt DESC
        LIMIT ? OFFSET ?;
      `,
      [limit, offset]
    );

    return rows.map(mapPlanRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get plans: ${message}`);
  }
}

/**
 * Get one plan with nested exercises and sets, and join exercises for details.
 */
export async function getPlanById(id: string): Promise<FullPlan | null> {
  try {
    const db = await requireDatabase();
    const planRows = await db.getAllAsync<PlanRow>(
      `
        SELECT *
        FROM plans
        WHERE (id = ? OR remoteId = ?) AND isDeleted = 0
        LIMIT 1;
      `,
      [id, id]
    );

    if (planRows.length === 0) {
      return null;
    }

    const plan = mapPlanRow(planRows[0]);

    const peRows = await db.getAllAsync<PlanExerciseRow>(
      `
        SELECT *
        FROM plan_exercises
        WHERE planId = ?
        ORDER BY orderIndex ASC;
      `,
      [plan.id]
    );

    if (peRows.length === 0) {
      return { ...plan, exercises: [] };
    }

    const peIds = peRows.map((row) => row.id);
    const pePlaceholders = peIds.map(() => '?').join(', ');

    const allSetRows = await db.getAllAsync<PlanSetRow>(
      `
        SELECT *
        FROM plan_sets
        WHERE planExerciseId IN (${pePlaceholders})
        ORDER BY planExerciseId, orderIndex ASC;
      `,
      peIds
    );

    const uniqueExerciseIds = [...new Set(peRows.map((row) => row.exerciseId))];
    const exercisePlaceholders = uniqueExerciseIds.map(() => '?').join(', ');

    const exerciseRows = await db.getAllAsync<ExerciseRow>(
      `SELECT * FROM exercises WHERE id IN (${exercisePlaceholders});`,
      uniqueExerciseIds
    );

    const exerciseMap = new Map<string, Exercise>(
      exerciseRows.map((row) => [row.id, mapExerciseRow(row)])
    );

    const setsByPlanExerciseId = new Map<string, PlanSet[]>();
    for (const row of allSetRows) {
      const existing = setsByPlanExerciseId.get(row.planExerciseId) ?? [];
      existing.push(mapPlanSetRow(row));
      setsByPlanExerciseId.set(row.planExerciseId, existing);
    }

    const nestedExercises = peRows.map((row) => ({
      ...mapPlanExerciseRow(row),
      sets: setsByPlanExerciseId.get(row.id) ?? [],
      exercise: exerciseMap.get(row.exerciseId) as Exercise,
    }));

    return { ...plan, exercises: nestedExercises };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get plan by id: ${message}`);
  }
}

/**
 * Update top-level plan fields and optionally replace nested rows.
 */
export async function updatePlan(
  id: string,
  plan: Partial<Plan>,
  exercises?: PlanExercise[],
  sets?: PlanSet[]
): Promise<void> {
  try {
    const db = await requireDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      const setClauses: string[] = ['syncStatus = ?', 'updatedAt = ?'];
      const params: Array<string | number | null> = ['pending', now];

      if (plan.remoteId !== undefined) {
        setClauses.push('remoteId = ?');
        params.push(plan.remoteId);
      }
      if (plan.userId !== undefined) {
        setClauses.push('userId = ?');
        params.push(plan.userId);
      }
      if (plan.name !== undefined) {
        setClauses.push('name = ?');
        params.push(plan.name);
      }
      if ('plannedDate' in plan) {
        setClauses.push('plannedDate = ?');
        params.push(plan.plannedDate ?? null);
      }

      await db.runAsync(
        `UPDATE plans SET ${setClauses.join(', ')} WHERE id = ? OR remoteId = ?;`,
        [...params, id, id]
      );

      if (exercises !== undefined && sets !== undefined) {
        const resolvedRows = await db.getAllAsync<{ id: string }>(
          `SELECT id FROM plans WHERE id = ? OR remoteId = ? LIMIT 1;`,
          [id, id]
        );
        const resolvedId = resolvedRows.length > 0 ? resolvedRows[0].id : id;

        const existingPeRows = await db.getAllAsync<{ id: string }>(
          `SELECT id FROM plan_exercises WHERE planId = ?;`,
          [resolvedId]
        );

        for (const { id: peId } of existingPeRows) {
          await db.runAsync(
            `DELETE FROM plan_sets WHERE planExerciseId = ?;`,
            [peId]
          );
        }

        await db.runAsync(
          `DELETE FROM plan_exercises WHERE planId = ?;`,
          [resolvedId]
        );

        for (const planExercise of exercises) {
          await db.runAsync(
            `
              INSERT INTO plan_exercises (id, planId, exerciseId, orderIndex, createdAt)
              VALUES (?, ?, ?, ?, ?);
            `,
            [
              planExercise.id ?? generateUuid(),
              resolvedId,
              planExercise.exerciseId,
              planExercise.orderIndex,
              planExercise.createdAt ?? now,
            ]
          );
        }

        for (const planSet of sets) {
          await db.runAsync(
            `
              INSERT INTO plan_sets (
                id,
                planExerciseId,
                reps,
                weight,
                weightUnit,
                weightKg,
                duration,
                distance,
                notes,
                segmentsJson,
                orderIndex,
                createdAt
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `,
            [
              planSet.id ?? generateUuid(),
              planSet.planExerciseId,
              planSet.reps ?? null,
              planSet.weight ?? null,
              planSet.weightUnit ?? null,
              planSet.weightKg ?? null,
              planSet.duration ?? null,
              planSet.distance ?? null,
              planSet.notes ?? null,
              serializeSetSegments(planSet.segments),
              planSet.orderIndex,
              planSet.createdAt ?? now,
            ]
          );
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update plan: ${message}`);
  }
}

/**
 * Soft delete by setting isDeleted = 1.
 */
export async function deletePlan(id: string): Promise<void> {
  try {
    const db = await requireDatabase();
    await db.runAsync(
      `
        UPDATE plans
        SET isDeleted = 1,
            syncStatus = 'pending',
            updatedAt = ?
        WHERE id = ? OR remoteId = ?;
      `,
      [new Date().toISOString(), id, id]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to delete plan: ${message}`);
  }
}

/**
 * Search plans by name.
 */
export async function searchPlans(query: string): Promise<Plan[]> {
  try {
    const db = await requireDatabase();
    const sanitized = query.trim();

    if (!sanitized) {
      return getPlans(1, 50);
    }

    const likePattern = `%${sanitized}%`;
    const rows = await db.getAllAsync<PlanRow>(
      `
        SELECT *
        FROM plans
        WHERE isDeleted = 0
          AND name LIKE ? COLLATE NOCASE
        ORDER BY
          CASE WHEN plannedDate IS NULL THEN 1 ELSE 0 END,
          plannedDate ASC,
          createdAt DESC;
      `,
      [likePattern]
    );

    return rows.map(mapPlanRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to search plans: ${message}`);
  }
}
