/**
 * Database stub for web platform
 * Web doesn't support SQLite, returns no-op functions
 */

console.warn('SQLite database is not supported on web platform');

/**
 * No-op database initialization for web
 */
export async function initDatabase(): Promise<void> {
  console.log('Database initialization skipped (web platform)');
  return Promise.resolve();
}

/**
 * No-op close for web
 */
export async function closeDatabase(): Promise<void> {
  return Promise.resolve();
}

/**
 * No-op reset for web
 */
export async function resetDatabase(): Promise<void> {
  return Promise.resolve();
}

/**
 * Returns null for web
 */
export function getDatabase(): any {
  return null;
}

export default getDatabase;
