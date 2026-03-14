import { getDatabase, initDatabase } from '@/database/index';
import type { User } from '@/types/models';

function generateUuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback UUID v4 generator for environments without Web Crypto support.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = char === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
}

type UserRow = {
  id: string;
  remoteId: string | null;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  createdAt: string;
  updatedAt: string;
  lastSynced: string | null;
};

async function requireDatabase() {
  await initDatabase();
  const db = getDatabase();

  if (!db) {
    throw new Error('Local database is not available on this platform.');
  }

  return db;
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    remoteId: row.remoteId ?? undefined,
    username: row.username,
    email: row.email,
    firstName: row.firstName ?? undefined,
    lastName: row.lastName ?? undefined,
    age: row.age ?? undefined,
    height: row.height ?? undefined,
    weight: row.weight ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSynced: row.lastSynced ?? undefined,
  };
}

async function getExistingUserByRemoteId(remoteId: string): Promise<User | null> {
  const db = await requireDatabase();
  const rows = await db.getAllAsync<UserRow>(
    'SELECT * FROM users WHERE remoteId = ? LIMIT 1;',
    [remoteId]
  );

  if (rows.length === 0) {
    return null;
  }

  return mapUserRow(rows[0]);
}

function mergeUser(existingUser: User | null, nextUser: Partial<User>): User {
  const now = new Date().toISOString();
  const resolvedId = nextUser.id ?? existingUser?.id ?? generateUuid();
  const username = nextUser.username ?? existingUser?.username;
  const email = nextUser.email ?? existingUser?.email;

  if (!username) {
    throw new Error('Cannot save user without a username.');
  }

  if (!email) {
    throw new Error('Cannot save user without an email address.');
  }

  return {
    id: resolvedId,
    remoteId: nextUser.remoteId ?? existingUser?.remoteId,
    username,
    email,
    firstName: nextUser.firstName ?? existingUser?.firstName,
    lastName: nextUser.lastName ?? existingUser?.lastName,
    age: nextUser.age ?? existingUser?.age,
    height: nextUser.height ?? existingUser?.height,
    weight: nextUser.weight ?? existingUser?.weight,
    createdAt: nextUser.createdAt ?? existingUser?.createdAt ?? now,
    updatedAt: nextUser.updatedAt ?? now,
    lastSynced: nextUser.lastSynced ?? existingUser?.lastSynced,
  };
}

export async function saveUser(user: Partial<User>): Promise<void> {
  try {
    const db = await requireDatabase();
    const existingUser = user.remoteId
      ? await getExistingUserByRemoteId(user.remoteId)
      : await getUser();
    const mergedUser = mergeUser(existingUser, user);

    await db.runAsync(
      `
        INSERT INTO users (
          id,
          remoteId,
          username,
          email,
          firstName,
          lastName,
          age,
          height,
          weight,
          createdAt,
          updatedAt,
          lastSynced
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          remoteId = excluded.remoteId,
          username = excluded.username,
          email = excluded.email,
          firstName = excluded.firstName,
          lastName = excluded.lastName,
          age = excluded.age,
          height = excluded.height,
          weight = excluded.weight,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt,
          lastSynced = excluded.lastSynced;
      `,
      [
        mergedUser.id,
        mergedUser.remoteId ?? null,
        mergedUser.username,
        mergedUser.email,
        mergedUser.firstName ?? null,
        mergedUser.lastName ?? null,
        mergedUser.age ?? null,
        mergedUser.height ?? null,
        mergedUser.weight ?? null,
        mergedUser.createdAt,
        mergedUser.updatedAt,
        mergedUser.lastSynced ?? null,
      ]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save user: ${message}`);
  }
}

export async function getUser(): Promise<User | null> {
  try {
    const db = await requireDatabase();
    const rows = await db.getAllAsync<UserRow>(
      `
        SELECT *
        FROM users
        ORDER BY updatedAt DESC, createdAt DESC
        LIMIT 1;
      `
    );

    if (rows.length === 0) {
      return null;
    }

    return mapUserRow(rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get user: ${message}`);
  }
}

export async function updateUserProfile(profile: Partial<User>): Promise<void> {
  try {
    const existingUser = await getUser();

    if (!existingUser) {
      throw new Error('No local user found to update.');
    }

    await saveUser({
      ...existingUser,
      ...profile,
      id: existingUser.id,
      remoteId: profile.remoteId ?? existingUser.remoteId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update user profile: ${message}`);
  }
}

export async function clearUser(): Promise<void> {
  try {
    const db = await requireDatabase();
    // Clear dependent tables first to satisfy foreign key constraints on users.id.
    await db.runAsync('DELETE FROM sync_queue;');
    await db.runAsync('DELETE FROM workout_sets;');
    await db.runAsync('DELETE FROM workout_exercises;');
    await db.runAsync('DELETE FROM workouts;');
    await db.runAsync('DELETE FROM plan_sets;');
    await db.runAsync('DELETE FROM plan_exercises;');
    await db.runAsync('DELETE FROM plans;');
    await db.runAsync('DELETE FROM exercises;');
    await db.runAsync('DELETE FROM users;');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clear user data: ${message}`);
  }
}
