/**
 * Database Migration Runner
 * Executes all table creation and index statements
 */

import * as SQLite from 'expo-sqlite';
import { ADDITIVE_MIGRATIONS, ALL_TABLES, CREATE_INDEXES } from './schema';

async function runSafeStatement(db: SQLite.SQLiteDatabase, sql: string): Promise<void> {
  try {
    await db.execAsync(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isExpectedAddColumnError =
      message.includes('duplicate column name') ||
      message.includes('already exists');

    if (!isExpectedAddColumnError) {
      throw error;
    }
  }
}

async function backfillSyncColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE users
    SET updatedAt = createdAt
    WHERE updatedAt = '' OR updatedAt IS NULL;
  `);
}

/**
 * Run all database migrations
 * Creates all tables and indexes if they don't exist
 * @param db - SQLite database instance
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    console.log('Starting database migrations...');

    // Create all tables
    for (const tableSQL of ALL_TABLES) {
      await db.execAsync(tableSQL);
    }
    console.log('✓ All tables created successfully');

    // Apply additive migrations for existing databases created before new columns existed
    for (const migrationSQL of ADDITIVE_MIGRATIONS) {
      await runSafeStatement(db, migrationSQL);
    }
    await backfillSyncColumns(db);
    console.log('✓ Additive migrations applied successfully');

    // Create all indexes
    for (const indexSQL of CREATE_INDEXES) {
      await db.execAsync(indexSQL);
    }
    console.log('✓ All indexes created successfully');

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw new Error(`Database migration failed: ${error}`);
  }
}

/**
 * Drop all tables (useful for testing or reset)
 * WARNING: This will delete all data!
 * @param db - SQLite database instance
 */
export async function dropAllTables(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    console.log('Dropping all tables...');

    const tables = [
      'sync_queue',
      'plan_sets',
      'plan_exercises',
      'plans',
      'workout_sets',
      'workout_exercises',
      'workouts',
      'exercises',
      'users'
    ];

    for (const table of tables) {
      await db.execAsync(`DROP TABLE IF EXISTS ${table};`);
    }

    console.log('✓ All tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw new Error(`Failed to drop tables: ${error}`);
  }
}
