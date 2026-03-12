/**
 * TypeScript Type Definitions
 * Interfaces and types matching the database schema and backend API
 */

// ============================================================================
// Enums and Union Types
// ============================================================================

export type SyncStatus = 'pending' | 'synced' | 'failed';

export type ExerciseCategory = 
  | 'chest' 
  | 'back' 
  | 'shoulders' 
  | 'legs' 
  | 'arms' 
  | 'core' 
  | 'cardio' 
  | 'full body';

export type PrimaryMuscle = 
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'cardio'
  | 'chest'
  | 'forearms'
  | 'full body'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'obliques'
  | 'core'
  | 'shoulders'
  | 'traps'
  | 'triceps'
  | 'upper back'
  | 'other';

export type ExerciseType = 
  | 'weight and reps'
  | 'bodyweight reps'
  | 'weighted bodyweight'
  | 'assisted bodyweight'
  | 'duration'
  | 'duration and weight'
  | 'distance and duration'
  | 'weight and distance';

export type Equipment = 
  | 'band'
  | 'cable'
  | 'dumbbell'
  | 'barbell'
  | 'body weight'
  | 'kettlebell'
  | 'machine'
  | 'medicine ball'
  | 'olympic barbell'
  | 'resistance band'
  | 'rope'
  | 'sled'
  | 'smith machine'
  | 'stability ball'
  | 'step'
  | 'tire'
  | 'weight plate'
  | 'other';

export type SyncOperation = 'create' | 'update' | 'delete';

// ============================================================================
// Core Entity Interfaces
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  height?: number; // in cm
  weight?: number; // in kg
  createdAt: string; // ISO date string
  lastSynced?: string; // ISO date string
}

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  category: ExerciseCategory;
  primaryMuscle: PrimaryMuscle;
  otherMuscles?: PrimaryMuscle[]; // JSON array
  type: ExerciseType;
  equipment: Equipment;
  instructions: string[]; // JSON array
  videoUrl?: string;
  isCustom: boolean;
  userId?: string;
  isDeleted: boolean;
  syncStatus: SyncStatus;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Workout {
  id: string;
  userId: string;
  date: string; // ISO date string
  name?: string;
  notes?: string;
  sourcePlanId?: string;
  isDeleted: boolean;
  syncStatus: SyncStatus;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
  createdAt: string; // ISO date string
}

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  reps?: number;
  weight?: number; // kg or lbs
  duration?: number; // seconds
  distance?: number; // meters
  notes?: string;
  orderIndex: number;
  createdAt: string; // ISO date string
}

export interface Plan {
  id: string;
  userId: string;
  name: string;
  plannedDate?: string; // ISO date string
  isDeleted: boolean;
  syncStatus: SyncStatus;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface PlanExercise {
  id: string;
  planId: string;
  exerciseId: string;
  orderIndex: number;
  createdAt: string; // ISO date string
}

export interface PlanSet {
  id: string;
  planExerciseId: string;
  reps?: number;
  weight?: number;
  duration?: number; // seconds
  distance?: number; // meters
  notes?: string;
  orderIndex: number;
  createdAt: string; // ISO date string
}

export interface SyncQueueItem {
  id: number;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: string; // JSON string
  createdAt: string; // ISO date string
  syncedAt?: string; // ISO date string
}

// ============================================================================
// Composite Types (with nested data)
// ============================================================================

export interface WorkoutWithExercises extends Workout {
  exercises: Array<WorkoutExercise & {
    sets: WorkoutSet[];
    exercise: Exercise;
  }>;
}

export interface PlanWithExercises extends Plan {
  exercises: Array<PlanExercise & {
    sets: PlanSet[];
    exercise: Exercise;
  }>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export interface ApiError {
  success: false;
  message: string;
}

export interface SyncPayload {
  deviceId: string;
  workouts?: Workout[];
  plans?: Plan[];
  exercises?: Exercise[];
  weights?: Array<{
    weight: number;
    measuredAt: string;
    notes?: string;
  }>;
  lastSyncAt?: string;
}

export interface SyncResponse {
  success: boolean;
  uploaded: {
    workouts: number;
  };
  downloaded: {
    workouts: Workout[];
    plans: Plan[];
  };
}
