import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDatabase, initDatabase } from '@/database/index';
import {
  createExercise,
  createPlan,
  createWorkout,
  deleteExercise,
  deletePlan,
  deleteWorkout,
  syncData,
  updateExercise,
  updatePlan,
  updateWorkout,
} from '@/services/api';
import {
  extractRemoteId,
  isCompleteBackendExerciseDocument,
  toBackendExercisePayload,
  toBackendPlanPayload,
  toBackendWorkoutPayload,
  toIsoString,
  toLocalExerciseRecord,
  toLocalPlanNormalized,
  toLocalWorkoutNormalized,
} from '@/services/syncMappers';
import { getExerciseById, saveExercise } from '@/services/db/exerciseDbService';
import { getPlanById, savePlan } from '@/services/db/planDbService';
import { getSyncQueue, markSynced } from '@/services/db/syncQueueService';
import { getUser, saveUser } from '@/services/db/userDbService';
import { getWorkoutById, saveWorkout } from '@/services/db/workoutDbService';
import type {
  BackendExerciseDocument,
  BackendPlanDocument,
  BackendWorkoutDocument,
  Exercise,
  Plan,
  PlanExercise,
  PlanSet,
  SyncQueueItem,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/models';

const DEVICE_ID_KEY = '@fitquest_deviceId';
const SYNC_RETENTION_DAYS = 7;

type EntityType = 'workout' | 'plan' | 'exercise';

type SyncSummary = {
  uploaded: number;
  downloaded: number;
  errors: string[];
};

type UploadAccumulator = {
  exercises: Array<Record<string, unknown>>;
  workouts: Array<Record<string, unknown>>;
  plans: Array<Record<string, unknown>>;
};

type EntityRow = {
  id: string;
  remoteId: string | null;
  updatedAt: string;
  isDeleted: number;
  userId?: string;
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

function parsePayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}


function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('404') || message.toLowerCase().includes('not found');
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('failed to fetch')
  );
}

function compareIso(a: string | undefined, b: string | undefined): number {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;

  if (aTime === bTime) return 0;
  return aTime > bTime ? 1 : -1;
}

async function requireDatabase() {
  await initDatabase();
  const db = getDatabase();

  if (!db) {
    throw new Error('Local database is not available on this platform.');
  }

  return db;
}

function getEntityConfig(entityType: EntityType): { table: string; idField: string } {
  switch (entityType) {
    case 'workout':
      return { table: 'workouts', idField: 'id' };
    case 'plan':
      return { table: 'plans', idField: 'id' };
    case 'exercise':
      return { table: 'exercises', idField: 'id' };
    default:
      return { table: '', idField: '' };
  }
}

async function getEntityRowByAnyId(entityType: EntityType, idOrRemoteId: string): Promise<EntityRow | null> {
  const { table } = getEntityConfig(entityType);
  const db = await requireDatabase();

  const rows = await db.getAllAsync<EntityRow>(
    `
      SELECT id, remoteId, updatedAt, isDeleted, userId
      FROM ${table}
      WHERE id = ? OR remoteId = ?
      LIMIT 1;
    `,
    [idOrRemoteId, idOrRemoteId]
  );

  return rows[0] ?? null;
}

async function getEntityRowByRemoteId(entityType: EntityType, remoteId: string): Promise<EntityRow | null> {
  const { table } = getEntityConfig(entityType);
  const db = await requireDatabase();
  const rows = await db.getAllAsync<EntityRow>(
    `
      SELECT id, remoteId, updatedAt, isDeleted, userId
      FROM ${table}
      WHERE remoteId = ?
      LIMIT 1;
    `,
    [remoteId]
  );

  return rows[0] ?? null;
}

async function setEntitySynced(entityType: EntityType, idOrRemoteId: string): Promise<void> {
  const { table } = getEntityConfig(entityType);
  const db = await requireDatabase();
  await db.runAsync(
    `
      UPDATE ${table}
      SET syncStatus = 'synced',
          updatedAt = ?
      WHERE id = ? OR remoteId = ?;
    `,
    [new Date().toISOString(), idOrRemoteId, idOrRemoteId]
  );
}

async function setEntityFailed(entityType: EntityType, idOrRemoteId: string): Promise<void> {
  const { table } = getEntityConfig(entityType);
  const db = await requireDatabase();
  await db.runAsync(
    `
      UPDATE ${table}
      SET syncStatus = 'failed',
          updatedAt = ?
      WHERE id = ? OR remoteId = ?;
    `,
    [new Date().toISOString(), idOrRemoteId, idOrRemoteId]
  );
}

async function setEntityDeletedSynced(entityType: EntityType, idOrRemoteId: string): Promise<void> {
  const { table } = getEntityConfig(entityType);
  const db = await requireDatabase();

  await db.runAsync(
    `
      UPDATE ${table}
      SET isDeleted = 1,
          syncStatus = 'synced',
          updatedAt = ?
      WHERE id = ? OR remoteId = ?;
    `,
    [new Date().toISOString(), idOrRemoteId, idOrRemoteId]
  );
}

async function setEntityRemoteIdAndSynced(
  entityType: EntityType,
  localId: string,
  remoteId: string
): Promise<void> {
  const { table } = getEntityConfig(entityType);
  const db = await requireDatabase();

  await db.runAsync(
    `
      UPDATE ${table}
      SET remoteId = ?,
          syncStatus = 'synced',
          updatedAt = ?
      WHERE id = ?;
    `,
    [remoteId, new Date().toISOString(), localId]
  );
}

async function clearSyncedQueueItemsOlderThan(days: number): Promise<void> {
  const db = await requireDatabase();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  await db.runAsync(
    `
      DELETE FROM sync_queue
      WHERE syncedAt IS NOT NULL
        AND syncedAt < ?;
    `,
    [cutoff]
  );
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = generateUuid();
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

async function loadExerciseByQueueItem(item: SyncQueueItem): Promise<Exercise | null> {
  const localExercise = await getExerciseById(item.entityId);
  if (localExercise) {
    return localExercise;
  }

  const payload = parsePayload(item.payload);
  const payloadId = asString(payload.id);
  if (payloadId) {
    const byPayloadId = await getExerciseById(payloadId);
    if (byPayloadId) {
      return byPayloadId;
    }
  }

  return null;
}

async function loadWorkoutByQueueItem(item: SyncQueueItem) {
  const direct = await getWorkoutById(item.entityId);
  if (direct) {
    return direct;
  }

  const payload = parsePayload(item.payload);
  const payloadId = asString(payload.id);
  if (payloadId) {
    return getWorkoutById(payloadId);
  }

  return null;
}

async function loadPlanByQueueItem(item: SyncQueueItem) {
  const direct = await getPlanById(item.entityId);
  if (direct) {
    return direct;
  }

  const payload = parsePayload(item.payload);
  const payloadId = asString(payload.id);
  if (payloadId) {
    return getPlanById(payloadId);
  }

  return null;
}

async function resolveExerciseLocalIdFromRemote(remoteExerciseId: string): Promise<string | undefined> {
  const row = await getEntityRowByRemoteId('exercise', remoteExerciseId);
  return row?.id;
}

async function ensureExerciseForRemoteValue(value: unknown): Promise<Exercise | null> {
  const remoteId = extractRemoteId(value);
  if (!remoteId) {
    return null;
  }

  // Only persist when we have a fully shaped exercise document.
  // Some backend sync responses include partial nested exercise data.
  if (isCompleteBackendExerciseDocument(value)) {
    const normalized = toLocalExerciseRecord(value, { idFactory: generateUuid });
    const resolvedId = await saveExercise(normalized);
    await setEntitySynced('exercise', resolvedId);
    const saved = await getExerciseById(resolvedId);
    return saved;
  }

  const localId = await resolveExerciseLocalIdFromRemote(remoteId);
  if (!localId) {
    return null;
  }

  return getExerciseById(localId);
}

async function buildWorkoutFromBackendDocument(
  document: BackendWorkoutDocument,
  fallbackUserId: string
): Promise<{ workout: Workout; exercises: WorkoutExercise[]; sets: WorkoutSet[] } | null> {
  const existing = await getEntityRowByRemoteId('workout', document._id);
  const exerciseIdMap = new Map<string, string>();
  for (const remoteExercise of document.exercises ?? []) {
    const remoteExerciseId = extractRemoteId(remoteExercise.exercise);
    if (!remoteExerciseId || exerciseIdMap.has(remoteExerciseId)) {
      continue;
    }

    const resolvedExercise = await ensureExerciseForRemoteValue(remoteExercise.exercise);
    if (resolvedExercise) {
      exerciseIdMap.set(remoteExerciseId, resolvedExercise.id);
    }
  }

  const sourcePlanLocalId = document.sourcePlan
    ? (await getEntityRowByRemoteId('plan', document.sourcePlan))?.id
    : undefined;

  const mapped = toLocalWorkoutNormalized(document, {
    fallbackUserId,
    existingLocalWorkoutId: existing?.id,
    sourcePlanLocalId,
    resolveLocalExerciseId: (remoteExerciseId) => exerciseIdMap.get(remoteExerciseId),
    idFactory: generateUuid,
  });

  return {
    workout: mapped.workout,
    exercises: mapped.exercises,
    sets: mapped.sets,
  };
}

async function buildPlanFromBackendDocument(
  document: BackendPlanDocument,
  fallbackUserId: string
): Promise<{ plan: Plan; exercises: PlanExercise[]; sets: PlanSet[] } | null> {
  const existing = await getEntityRowByRemoteId('plan', document._id);
  const exerciseIdMap = new Map<string, string>();
  for (const remoteExercise of document.exercises ?? []) {
    const remoteExerciseId = extractRemoteId(remoteExercise.exercise);
    if (!remoteExerciseId || exerciseIdMap.has(remoteExerciseId)) {
      continue;
    }

    const resolvedExercise = await ensureExerciseForRemoteValue(remoteExercise.exercise);
    if (resolvedExercise) {
      exerciseIdMap.set(remoteExerciseId, resolvedExercise.id);
    }
  }

  const mapped = toLocalPlanNormalized(document, {
    fallbackUserId,
    existingLocalPlanId: existing?.id,
    resolveLocalExerciseId: (remoteExerciseId) => exerciseIdMap.get(remoteExerciseId),
    idFactory: generateUuid,
  });

  return {
    plan: mapped.plan,
    exercises: mapped.exercises,
    sets: mapped.sets,
  };
}

async function processExerciseQueueItem(
  token: string,
  item: SyncQueueItem
): Promise<Record<string, unknown> | null> {
  const payload = parsePayload(item.payload);
  const queuedRemoteId = asString(payload.remoteId);
  const exercise = await loadExerciseByQueueItem(item);

  if (item.operation === 'delete') {
    const targetRemoteId = queuedRemoteId ?? exercise?.remoteId;
    if (targetRemoteId) {
      try {
        await deleteExercise(token, targetRemoteId);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }
    }

    await setEntityDeletedSynced('exercise', item.entityId);
    return null;
  }

  if (!exercise) {
    throw new Error(`Exercise ${item.entityId} not found locally.`);
  }

  if (item.operation === 'create') {
    const created = await createExercise(token, exercise);
    await setEntityRemoteIdAndSynced('exercise', exercise.id, created._id);
    return toBackendExercisePayload({ ...exercise, remoteId: created._id });
  }

  const remoteId = exercise.remoteId ?? queuedRemoteId;
  if (!remoteId) {
    const created = await createExercise(token, exercise);
    await setEntityRemoteIdAndSynced('exercise', exercise.id, created._id);
    return toBackendExercisePayload({ ...exercise, remoteId: created._id });
  }

  try {
    await updateExercise(token, remoteId, exercise);
    await setEntitySynced('exercise', exercise.id);
    return toBackendExercisePayload({ ...exercise, remoteId });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    await setEntityDeletedSynced('exercise', exercise.id);
    return null;
  }
}

async function processWorkoutQueueItem(
  token: string,
  item: SyncQueueItem
): Promise<Record<string, unknown> | null> {
  const payload = parsePayload(item.payload);
  const queuedRemoteId = asString(payload.remoteId);

  if (item.operation === 'delete') {
    const row = await getEntityRowByAnyId('workout', item.entityId);
    const targetRemoteId = queuedRemoteId ?? row?.remoteId ?? undefined;

    if (targetRemoteId) {
      try {
        await deleteWorkout(token, targetRemoteId);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }
    }

    await setEntityDeletedSynced('workout', item.entityId);
    return null;
  }

  const workout = await loadWorkoutByQueueItem(item);
  if (!workout) {
    throw new Error(`Workout ${item.entityId} not found locally.`);
  }

  if (item.operation === 'create') {
    const created = await createWorkout(token, workout);
    await setEntityRemoteIdAndSynced('workout', workout.id, created._id);
    return toBackendWorkoutPayload({ ...workout, remoteId: created._id });
  }

  const remoteId = workout.remoteId ?? queuedRemoteId;
  if (!remoteId) {
    const created = await createWorkout(token, workout);
    await setEntityRemoteIdAndSynced('workout', workout.id, created._id);
    return toBackendWorkoutPayload({ ...workout, remoteId: created._id });
  }

  try {
    await updateWorkout(token, remoteId, workout);
    await setEntitySynced('workout', workout.id);
    return toBackendWorkoutPayload({ ...workout, remoteId });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    await setEntityDeletedSynced('workout', workout.id);
    return null;
  }
}

async function processPlanQueueItem(
  token: string,
  item: SyncQueueItem
): Promise<Record<string, unknown> | null> {
  const payload = parsePayload(item.payload);
  const queuedRemoteId = asString(payload.remoteId);

  if (item.operation === 'delete') {
    const row = await getEntityRowByAnyId('plan', item.entityId);
    const targetRemoteId = queuedRemoteId ?? row?.remoteId ?? undefined;

    if (targetRemoteId) {
      try {
        await deletePlan(token, targetRemoteId);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }
    }

    await setEntityDeletedSynced('plan', item.entityId);
    return null;
  }

  const plan = await loadPlanByQueueItem(item);
  if (!plan) {
    throw new Error(`Plan ${item.entityId} not found locally.`);
  }

  if (item.operation === 'create') {
    const created = await createPlan(token, plan);
    await setEntityRemoteIdAndSynced('plan', plan.id, created._id);
    return toBackendPlanPayload({ ...plan, remoteId: created._id });
  }

  const remoteId = plan.remoteId ?? queuedRemoteId;
  if (!remoteId) {
    const created = await createPlan(token, plan);
    await setEntityRemoteIdAndSynced('plan', plan.id, created._id);
    return toBackendPlanPayload({ ...plan, remoteId: created._id });
  }

  try {
    await updatePlan(token, remoteId, plan);
    await setEntitySynced('plan', plan.id);
    return toBackendPlanPayload({ ...plan, remoteId });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    await setEntityDeletedSynced('plan', plan.id);
    return null;
  }
}

async function processQueueItem(
  token: string,
  item: SyncQueueItem
): Promise<{ entityType: EntityType; payload: Record<string, unknown> } | null> {
  if (item.entityType === 'exercise') {
    const payload = await processExerciseQueueItem(token, item);
    return payload ? { entityType: 'exercise', payload } : null;
  }

  if (item.entityType === 'workout') {
    const payload = await processWorkoutQueueItem(token, item);
    return payload ? { entityType: 'workout', payload } : null;
  }

  if (item.entityType === 'plan') {
    const payload = await processPlanQueueItem(token, item);
    return payload ? { entityType: 'plan', payload } : null;
  }

  throw new Error(`Unsupported entity type in sync queue: ${item.entityType}`);
}

function groupQueueItems(queueItems: SyncQueueItem[]): {
  exercises: SyncQueueItem[];
  workouts: SyncQueueItem[];
  plans: SyncQueueItem[];
} {
  return {
    exercises: queueItems.filter((item) => item.entityType === 'exercise'),
    workouts: queueItems.filter((item) => item.entityType === 'workout'),
    plans: queueItems.filter((item) => item.entityType === 'plan'),
  };
}

async function mergeDownloadedData(downloaded: {
  workouts?: BackendWorkoutDocument[];
  plans?: BackendPlanDocument[];
}): Promise<number> {
  let mergedCount = 0;
  const user = await getUser();
  const fallbackUserId = user?.id ?? '';

  for (const remoteWorkout of downloaded.workouts ?? []) {
    const localRow = await getEntityRowByRemoteId('workout', remoteWorkout._id);
    const shouldApply =
      !localRow || compareIso(toIsoString(remoteWorkout.updatedAt, ''), localRow.updatedAt) >= 0;

    if (!shouldApply) {
      continue;
    }

    const mapped = await buildWorkoutFromBackendDocument(remoteWorkout, fallbackUserId);
    if (!mapped) {
      continue;
    }

    const savedWorkoutId = await saveWorkout(mapped.workout, mapped.exercises, mapped.sets);
    await setEntityRemoteIdAndSynced('workout', savedWorkoutId, remoteWorkout._id);
    mergedCount += 1;
  }

  for (const remotePlan of downloaded.plans ?? []) {
    const localRow = await getEntityRowByRemoteId('plan', remotePlan._id);
    const shouldApply = !localRow || compareIso(toIsoString(remotePlan.updatedAt, ''), localRow.updatedAt) >= 0;

    if (!shouldApply) {
      continue;
    }

    const mapped = await buildPlanFromBackendDocument(remotePlan, fallbackUserId);
    if (!mapped) {
      continue;
    }

    const savedPlanId = await savePlan(mapped.plan, mapped.exercises, mapped.sets);
    await setEntityRemoteIdAndSynced('plan', savedPlanId, remotePlan._id);
    mergedCount += 1;
  }

  return mergedCount;
}

/**
 * Performs full two-way sync.
 * Conflict policy (MVP): updatedAt last-write-wins.
 * Future versions can replace this with field-level or server-authoritative conflict resolution.
 */
export async function performSync(token: string): Promise<SyncSummary> {
  const summary: SyncSummary = {
    uploaded: 0,
    downloaded: 0,
    errors: [],
  };

  try {
    const user = await getUser();
    const pendingQueue = await getSyncQueue();
    const grouped = groupQueueItems(pendingQueue);
    const uploads: UploadAccumulator = {
      exercises: [],
      workouts: [],
      plans: [],
    };

    const orderedGroups = [grouped.exercises, grouped.workouts, grouped.plans];

    for (const group of orderedGroups) {
      for (const queueItem of group) {
        try {
          const uploadRecord = await processQueueItem(token, queueItem);

          if (uploadRecord) {
            if (uploadRecord.entityType === 'exercise') {
              uploads.exercises.push(uploadRecord.payload);
            } else if (uploadRecord.entityType === 'workout') {
              uploads.workouts.push(uploadRecord.payload);
            } else if (uploadRecord.entityType === 'plan') {
              uploads.plans.push(uploadRecord.payload);
            }
          }

          await markSynced(queueItem.id);
          summary.uploaded += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          summary.errors.push(`${queueItem.entityType}:${queueItem.entityId} ${message}`);

          if (
            queueItem.entityType === 'exercise' ||
            queueItem.entityType === 'workout' ||
            queueItem.entityType === 'plan'
          ) {
            await setEntityFailed(queueItem.entityType, queueItem.entityId);
          }

          if (isNetworkError(error)) {
            // Continue gracefully for this run; queue item remains pending for retry.
            continue;
          }
        }
      }
    }

    const deviceId = await getOrCreateDeviceId();
    const syncResponse = await syncData(token, {
      deviceId,
      workouts: uploads.workouts as never,
      plans: uploads.plans as never,
      exercises: uploads.exercises as never,
      weights: [],
      lastSyncAt: user?.lastSynced,
    });

    const downloadedCount = await mergeDownloadedData(syncResponse.downloaded ?? {});
    summary.downloaded += downloadedCount;

    const now = new Date().toISOString();
    const userForSyncStamp = user ?? (await getUser());
    if (userForSyncStamp) {
      await saveUser({
        ...userForSyncStamp,
        lastSynced: now,
        updatedAt: now,
      });
    }

    await clearSyncedQueueItemsOlderThan(SYNC_RETENTION_DAYS);

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push(`sync ${message}`);
    return summary;
  }
}
