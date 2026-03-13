import * as SQLite from 'expo-sqlite';

export function getDatabase(): SQLite.SQLiteDatabase | null;
export function initDatabase(): Promise<void>;
export function closeDatabase(): Promise<void>;
export function resetDatabase(): Promise<void>;

declare const _default: typeof getDatabase;
export default _default;