import { getDatabase, initDatabase } from '@/database/index';
import type { SyncQueueItem, SyncOperation } from '@/types/models';

type QueueRow = {
  id: number;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: string;
  createdAt: string;
  syncedAt: string | null;
};

async function requireDatabase() {
  await initDatabase();
  const db = getDatabase();

  if (!db) {
    throw new Error('Local database is not available on this platform.');
  }

  return db;
}

function mapQueueRow(row: QueueRow): SyncQueueItem {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    operation: row.operation,
    payload: row.payload,
    createdAt: row.createdAt,
    syncedAt: row.syncedAt ?? undefined,
  };
}

function tryParsePayload(payload: string): Record<string, unknown> {
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

function normalizePayload(entityId: string, payload: any): Record<string, unknown> {
  const base = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const hasRemoteId = Object.prototype.hasOwnProperty.call(base, 'remoteId');

  return {
    ...base,
    id: (base as Record<string, unknown>).id ?? entityId,
    ...(hasRemoteId ? { remoteId: (base as Record<string, unknown>).remoteId ?? null } : {}),
  };
}

function mergePayloads(oldPayload: string, nextPayload: Record<string, unknown>): string {
  const oldParsed = tryParsePayload(oldPayload);
  return JSON.stringify({ ...oldParsed, ...nextPayload });
}

async function findPendingItem(entityType: string, entityId: string): Promise<QueueRow | null> {
  const db = await requireDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    `
      SELECT *
      FROM sync_queue
      WHERE entityType = ?
        AND entityId = ?
        AND syncedAt IS NULL
      ORDER BY createdAt ASC, id ASC
      LIMIT 1;
    `,
    [entityType, entityId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * Adds an item to the sync queue, collapsing duplicate pending operations where practical.
 */
export async function addToSyncQueue(
  entityType: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  payload: any
): Promise<void> {
  try {
    const db = await requireDatabase();
    const now = new Date().toISOString();
    const normalizedPayload = normalizePayload(entityId, payload);
    const incomingPayload = JSON.stringify(normalizedPayload);
    const existing = await findPendingItem(entityType, entityId);

    if (!existing) {
      await db.runAsync(
        `
          INSERT INTO sync_queue (entityType, entityId, operation, payload, createdAt, syncedAt)
          VALUES (?, ?, ?, ?, ?, NULL);
        `,
        [entityType, entityId, operation, incomingPayload, now]
      );
      return;
    }

    // create + update => keep create and merge payload
    if (existing.operation === 'create' && operation === 'update') {
      await db.runAsync(
        `UPDATE sync_queue SET payload = ? WHERE id = ?;`,
        [mergePayloads(existing.payload, normalizedPayload), existing.id]
      );
      return;
    }

    // create + delete => net no-op, remove queued create
    if (existing.operation === 'create' && operation === 'delete') {
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?;`, [existing.id]);
      return;
    }

    // update + update => keep one update and merge payload
    if (existing.operation === 'update' && operation === 'update') {
      await db.runAsync(
        `UPDATE sync_queue SET payload = ? WHERE id = ?;`,
        [mergePayloads(existing.payload, normalizedPayload), existing.id]
      );
      return;
    }

    // update + delete => collapse to single delete
    if (existing.operation === 'update' && operation === 'delete') {
      await db.runAsync(
        `UPDATE sync_queue SET operation = 'delete', payload = ? WHERE id = ?;`,
        [incomingPayload, existing.id]
      );
      return;
    }

    // create + create, update + create, delete + create, delete + update, delete + delete
    // fall back to replacing existing pending item with the latest intent.
    await db.runAsync(
      `UPDATE sync_queue SET operation = ?, payload = ? WHERE id = ?;`,
      [operation, incomingPayload, existing.id]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to add item to sync queue: ${message}`);
  }
}

/**
 * Returns all pending (unsynced) queue items ordered oldest first.
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await requireDatabase();
    const rows = await db.getAllAsync<QueueRow>(
      `
        SELECT *
        FROM sync_queue
        WHERE syncedAt IS NULL
        ORDER BY createdAt ASC, id ASC;
      `
    );

    return rows.map(mapQueueRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get sync queue: ${message}`);
  }
}

/**
 * Marks a queue row as synced by setting syncedAt.
 */
export async function markSynced(queueId: number): Promise<void> {
  try {
    const db = await requireDatabase();
    await db.runAsync(
      `
        UPDATE sync_queue
        SET syncedAt = ?
        WHERE id = ?;
      `,
      [new Date().toISOString(), queueId]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to mark queue item as synced: ${message}`);
  }
}

/**
 * Deletes all already-synced queue rows.
 */
export async function clearSyncedItems(): Promise<void> {
  try {
    const db = await requireDatabase();
    await db.runAsync(
      `
        DELETE FROM sync_queue
        WHERE syncedAt IS NOT NULL;
      `
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clear synced queue items: ${message}`);
  }
}

/**
 * Returns number of pending (unsynced) queue rows.
 */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await requireDatabase();
    const rows = await db.getAllAsync<{ count: number }>(
      `
        SELECT COUNT(*) as count
        FROM sync_queue
        WHERE syncedAt IS NULL;
      `
    );

    return rows[0]?.count ?? 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get pending sync count: ${message}`);
  }
}
