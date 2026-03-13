/**
 * Database Initialization and Connection Management
 * Provides singleton database instance and initialization function
 */

import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

const DATABASE_NAME = 'fitquest.db';

let databaseInstance: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

/**
 * Get the database instance (creates if doesn't exist)
 * @returns SQLite database instance
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!databaseInstance) {
    databaseInstance = SQLite.openDatabaseSync(DATABASE_NAME);
  }
  return databaseInstance;
}

/**
 * Initialize the database
 * Opens connection and runs all migrations
 * Should be called once when the app starts
 * @returns Promise that resolves when database is ready
 */
export async function initDatabase(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        console.log('Initializing FitQuest database...');

        // Get or create database instance
        const db = getDatabase();

        // Enable foreign keys (important for CASCADE deletes)
        await db.execAsync('PRAGMA foreign_keys = ON;');
        console.log('✓ Foreign keys enabled');

        // Run all migrations
        await runMigrations(db);

        isInitialized = true;
        console.log('✓ FitQuest database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
        throw new Error(`Database initialization failed: ${error}`);
      }
    })();
  }

  try {
    await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

/**
 * Close the database connection
 * Should be called when the app is closing (rarely needed in React Native)
 */
export async function closeDatabase(): Promise<void> {
  if (databaseInstance) {
    try {
      await databaseInstance.closeAsync();
      databaseInstance = null;
      initializationPromise = null;
      isInitialized = false;
      console.log('✓ Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
      throw new Error(`Failed to close database: ${error}`);
    }
  }
}

/**
 * Reset the database (for testing/development)
 * WARNING: This will delete all data!
 */
export async function resetDatabase(): Promise<void> {
  try {
    console.log('Resetting database...');

    if (databaseInstance) {
      await databaseInstance.closeAsync();
      databaseInstance = null;
    }
    initializationPromise = null;
    isInitialized = false;

    // Delete the database file
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
    console.log('✓ Database file deleted');

    // Reinitialize
    await initDatabase();
    console.log('✓ Database reset complete');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw new Error(`Failed to reset database: ${error}`);
  }
}

// Export the database instance getter as default
export default getDatabase;
