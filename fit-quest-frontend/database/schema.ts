/**
 * SQLite Database Schema Definitions
 * All table creation SQL statements for FitQuest offline-first database
 */

export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    firstName TEXT,
    lastName TEXT,
    age INTEGER,
    height REAL,
    weight REAL,
    createdAt TEXT NOT NULL,
    lastSynced TEXT
  );
`;

export const CREATE_EXERCISES_TABLE = `
  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    primaryMuscle TEXT NOT NULL,
    otherMuscles TEXT,
    type TEXT NOT NULL,
    equipment TEXT NOT NULL,
    instructions TEXT NOT NULL,
    videoUrl TEXT,
    isCustom INTEGER NOT NULL DEFAULT 0,
    userId TEXT,
    isDeleted INTEGER NOT NULL DEFAULT 0,
    syncStatus TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

export const CREATE_WORKOUTS_TABLE = `
  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    date TEXT NOT NULL,
    name TEXT,
    notes TEXT,
    sourcePlanId TEXT,
    isDeleted INTEGER NOT NULL DEFAULT 0,
    syncStatus TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (sourcePlanId) REFERENCES plans(id)
  );
`;

export const CREATE_WORKOUT_EXERCISES_TABLE = `
  CREATE TABLE IF NOT EXISTS workout_exercises (
    id TEXT PRIMARY KEY,
    workoutId TEXT NOT NULL,
    exerciseId TEXT NOT NULL,
    orderIndex INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (workoutId) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (exerciseId) REFERENCES exercises(id)
  );
`;

export const CREATE_WORKOUT_SETS_TABLE = `
  CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY,
    workoutExerciseId TEXT NOT NULL,
    reps INTEGER,
    weight REAL,
    duration INTEGER,
    distance REAL,
    notes TEXT,
    orderIndex INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (workoutExerciseId) REFERENCES workout_exercises(id) ON DELETE CASCADE
  );
`;

export const CREATE_PLANS_TABLE = `
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    plannedDate TEXT,
    isDeleted INTEGER NOT NULL DEFAULT 0,
    syncStatus TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`;

export const CREATE_PLAN_EXERCISES_TABLE = `
  CREATE TABLE IF NOT EXISTS plan_exercises (
    id TEXT PRIMARY KEY,
    planId TEXT NOT NULL,
    exerciseId TEXT NOT NULL,
    orderIndex INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE CASCADE,
    FOREIGN KEY (exerciseId) REFERENCES exercises(id)
  );
`;

export const CREATE_PLAN_SETS_TABLE = `
  CREATE TABLE IF NOT EXISTS plan_sets (
    id TEXT PRIMARY KEY,
    planExerciseId TEXT NOT NULL,
    reps INTEGER,
    weight REAL,
    duration INTEGER,
    distance REAL,
    notes TEXT,
    orderIndex INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (planExerciseId) REFERENCES plan_exercises(id) ON DELETE CASCADE
  );
`;

export const CREATE_SYNC_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    syncedAt TEXT
  );
`;

// Index definitions for performance optimization
export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);',
  'CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(userId);',
  'CREATE INDEX IF NOT EXISTS idx_exercises_deleted ON exercises(isDeleted);',
  'CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(userId, date DESC);',
  'CREATE INDEX IF NOT EXISTS idx_workouts_deleted ON workouts(isDeleted);',
  'CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workoutId);',
  'CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(workoutExerciseId);',
  'CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(userId);',
  'CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(plannedDate);',
  'CREATE INDEX IF NOT EXISTS idx_plans_deleted ON plans(isDeleted);',
  'CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan ON plan_exercises(planId);',
  'CREATE INDEX IF NOT EXISTS idx_plan_sets_exercise ON plan_sets(planExerciseId);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(syncedAt);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entityType, entityId);'
];

// All table creation statements in order
export const ALL_TABLES = [
  CREATE_USERS_TABLE,
  CREATE_EXERCISES_TABLE,
  CREATE_WORKOUTS_TABLE,
  CREATE_WORKOUT_EXERCISES_TABLE,
  CREATE_WORKOUT_SETS_TABLE,
  CREATE_PLANS_TABLE,
  CREATE_PLAN_EXERCISES_TABLE,
  CREATE_PLAN_SETS_TABLE,
  CREATE_SYNC_QUEUE_TABLE
];
