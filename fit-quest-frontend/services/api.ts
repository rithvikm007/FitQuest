import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  BackendExerciseDocument,
  BackendPlanDocument,
  BackendUserDocument,
  BackendWorkoutDocument,
  Exercise,
  Plan,
  PlanSet,
  PlanWithExercises,
  SyncPayload,
  SyncResponse,
  User,
  Workout,
  WorkoutSet,
  WorkoutWithExercises,
} from '@/types/models';

function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // Expo exposes the Metro host in dev; reuse that host for backend on :3000.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;

  const host = hostUri?.split(':')[0];
  const lanUrl = host ? `http://${host}:3000/api` : undefined;

  if (Platform.OS === 'android') {
    // Android emulator cannot use localhost to reach host machine.
    return lanUrl ?? 'http://10.0.2.2:3000/api';
  }

  return lanUrl ?? 'http://localhost:3000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

type ApiErrorBody = {
  message?: string;
  error?: string;
};

type AuthEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type AuthUserData = {
  user: BackendUserDocument;
  token: string;
};

type MeData = {
  user: BackendUserDocument;
};

type NormalizedWorkoutBundle = {
  workout: Workout;
  sets: WorkoutSet[];
};

type NormalizedPlanBundle = {
  plan: Plan;
  sets: PlanSet[];
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function authConfig(token: string): AxiosRequestConfig {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const responseMessage = axiosError.response?.data?.message ?? axiosError.response?.data?.error;
    return responseMessage ?? axiosError.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toIso(value: string | Date | undefined, fallbackIso: string): string {
  if (!value) return fallbackIso;
  if (value instanceof Date) return value.toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIso;
  }

  return parsed.toISOString();
}

function extractMongoId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === 'string') {
      return maybeId;
    }
  }

  return undefined;
}

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

// ---------------------------------------------------------------------------
// Serializers / Normalizers
// ---------------------------------------------------------------------------

/**
 * Converts a local User object into a profile payload expected by /api/user/me.
 */
export function serializeUserProfileForApi(profile: Partial<User>): { profile: Record<string, unknown> } {
  return {
    profile: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
    },
  };
}

/**
 * Converts a backend user document into local User shape while preserving remoteId.
 */
export function normalizeBackendUser(document: BackendUserDocument, existingLocalId?: string): User {
  const now = new Date().toISOString();

  return {
    id: existingLocalId ?? generateUuid(),
    remoteId: document._id,
    username: document.username,
    email: document.email,
    firstName: document.profile?.firstName,
    lastName: document.profile?.lastName,
    age: document.profile?.age,
    height: document.profile?.height,
    weight: document.profile?.weight,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Maps local Exercise fields to backend Exercise payload shape.
 */
export function serializeExerciseForApi(exercise: Partial<Exercise>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: exercise.name,
    description: exercise.description,
    category: exercise.category,
    primaryMuscle: exercise.primaryMuscle,
    otherMuscles: exercise.otherMuscles ?? [],
    type: exercise.type,
    equipment: exercise.equipment,
    instructions: exercise.instructions ?? [],
    videoUrl: exercise.videoUrl,
    isCustom: exercise.isCustom,
  };

  if (exercise.remoteId) {
    payload._id = exercise.remoteId;
  }

  return payload;
}

/**
 * Maps backend Exercise document to local Exercise while keeping remoteId separate.
 */
export function normalizeBackendExercise(document: BackendExerciseDocument, existingLocalId?: string): Exercise {
  const now = new Date().toISOString();

  return {
    id: existingLocalId ?? generateUuid(),
    remoteId: document._id,
    name: document.name,
    description: document.description,
    category: document.category,
    primaryMuscle: document.primaryMuscle,
    otherMuscles: document.otherMuscles ?? [],
    type: document.type,
    equipment: document.equipment,
    instructions: document.instructions ?? [],
    videoUrl: document.videoUrl,
    isCustom: document.isCustom,
    userId: typeof document.user === 'string' ? document.user : undefined,
    isDeleted: false,
    syncStatus: 'synced',
    createdAt: toIso(document.createdAt, now),
    updatedAt: toIso(document.updatedAt, now),
  };
}

/**
 * Converts local normalized workout-with-exercises into backend nested workout payload.
 */
export function serializeWorkoutForApi(workout: WorkoutWithExercises): Record<string, unknown> {
  return {
    ...(workout.remoteId ? { _id: workout.remoteId } : {}),
    user: workout.remoteId ? undefined : workout.userId,
    date: workout.date,
    name: workout.name,
    notes: workout.notes,
    sourcePlan: workout.sourcePlanRemoteId ?? workout.sourcePlanId,
    exercises: workout.exercises.map((workoutExercise) => ({
      exercise: workoutExercise.exercise.remoteId ?? workoutExercise.exerciseId,
      sets: workoutExercise.sets
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((set) => ({
          reps: set.reps,
          weight: set.weight,
          duration: set.duration,
          distance: set.distance,
          notes: set.notes,
        })),
    })),
  };
}

/**
 * Converts local normalized plan-with-exercises into backend nested plan payload.
 */
export function serializePlanForApi(plan: PlanWithExercises): Record<string, unknown> {
  return {
    ...(plan.remoteId ? { _id: plan.remoteId } : {}),
    user: plan.remoteId ? undefined : plan.userId,
    name: plan.name,
    plannedDate: plan.plannedDate,
    exercises: plan.exercises.map((planExercise) => ({
      exercise: planExercise.exercise.remoteId ?? planExercise.exerciseId,
      sets: planExercise.sets
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((set) => ({
          reps: set.reps,
          weight: set.weight,
          duration: set.duration,
          distance: set.distance,
          notes: set.notes,
        })),
    })),
  };
}

/**
 * Normalizes backend workout doc into local workout row + local workout_sets rows.
 * Workout exercise rows are derived by workoutDbService at persistence time.
 */
export function normalizeBackendWorkout(
  document: BackendWorkoutDocument,
  options?: {
    existingLocalWorkoutId?: string;
    sourcePlanLocalId?: string;
    resolveLocalExerciseId?: (remoteExerciseId: string) => string | undefined;
  }
): NormalizedWorkoutBundle {
  const now = new Date().toISOString();
  const localWorkoutId = options?.existingLocalWorkoutId ?? generateUuid();

  const workout: Workout = {
    id: localWorkoutId,
    remoteId: document._id,
    userId: document.user,
    date: toIso(document.date, now),
    name: document.name,
    notes: document.notes,
    sourcePlanId: options?.sourcePlanLocalId,
    sourcePlanRemoteId: document.sourcePlan,
    isDeleted: false,
    syncStatus: 'synced',
    createdAt: toIso(document.createdAt, now),
    updatedAt: toIso(document.updatedAt, now),
  };

  const sets: WorkoutSet[] = [];
  for (const [exerciseIndex, remoteExercise] of document.exercises.entries()) {
    const remoteExerciseId = extractMongoId(remoteExercise.exercise) ?? '';
    const resolvedExerciseId =
      (remoteExerciseId && options?.resolveLocalExerciseId?.(remoteExerciseId)) ?? remoteExerciseId;

    const workoutExerciseId = generateUuid();

    for (const [setIndex, set] of (remoteExercise.sets ?? []).entries()) {
      sets.push({
        id: generateUuid(),
        workoutExerciseId,
        reps: set.reps,
        weight: set.weight,
        duration: set.duration,
        distance: set.distance,
        notes: set.notes,
        orderIndex: setIndex,
        createdAt: now,
      });
    }

    // We include an extra synthetic set row when a workout exercise has no sets
    // so callers can still recover ordering metadata through index values.
    if ((remoteExercise.sets ?? []).length === 0) {
      sets.push({
        id: generateUuid(),
        workoutExerciseId,
        orderIndex: 0,
        createdAt: now,
      });
    }

    // Carry exercise ordering through sort position. Caller can map this back
    // while creating workout_exercises rows.
    (sets[sets.length - 1] as WorkoutSet & { __exerciseIndex?: number; __exerciseId?: string }).__exerciseIndex =
      exerciseIndex;
    (sets[sets.length - 1] as WorkoutSet & { __exerciseIndex?: number; __exerciseId?: string }).__exerciseId =
      resolvedExerciseId;
  }

  return { workout, sets };
}

/**
 * Normalizes backend plan doc into local plan row + local plan_sets rows.
 * Plan exercise rows are derived by planDbService at persistence time.
 */
export function normalizeBackendPlan(
  document: BackendPlanDocument,
  options?: {
    existingLocalPlanId?: string;
    resolveLocalExerciseId?: (remoteExerciseId: string) => string | undefined;
  }
): NormalizedPlanBundle {
  const now = new Date().toISOString();
  const localPlanId = options?.existingLocalPlanId ?? generateUuid();

  const plan: Plan = {
    id: localPlanId,
    remoteId: document._id,
    userId: document.user,
    name: document.name,
    plannedDate: document.plannedDate ? toIso(document.plannedDate, now) : undefined,
    isDeleted: false,
    syncStatus: 'synced',
    createdAt: toIso(document.createdAt, now),
    updatedAt: toIso(document.updatedAt, now),
  };

  const sets: PlanSet[] = [];

  for (const [exerciseIndex, remoteExercise] of document.exercises.entries()) {
    const remoteExerciseId = extractMongoId(remoteExercise.exercise) ?? '';
    const resolvedExerciseId =
      (remoteExerciseId && options?.resolveLocalExerciseId?.(remoteExerciseId)) ?? remoteExerciseId;

    const planExerciseId = generateUuid();

    for (const [setIndex, set] of (remoteExercise.sets ?? []).entries()) {
      sets.push({
        id: generateUuid(),
        planExerciseId,
        reps: set.reps,
        weight: set.weight,
        duration: set.duration,
        distance: set.distance,
        notes: set.notes,
        orderIndex: setIndex,
        createdAt: now,
      });
    }

    if ((remoteExercise.sets ?? []).length === 0) {
      sets.push({
        id: generateUuid(),
        planExerciseId,
        orderIndex: 0,
        createdAt: now,
      });
    }

    (sets[sets.length - 1] as PlanSet & { __exerciseIndex?: number; __exerciseId?: string }).__exerciseIndex =
      exerciseIndex;
    (sets[sets.length - 1] as PlanSet & { __exerciseIndex?: number; __exerciseId?: string }).__exerciseId =
      resolvedExerciseId;
  }

  return { plan, sets };
}

// ---------------------------------------------------------------------------
// Auth APIs
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthEnvelope<AuthUserData>> {
  try {
    const response = await apiClient.post<AuthEnvelope<AuthUserData>>('/auth/login', { email, password });
    return response.data;
  } catch (error) {
    throw new Error(`Login failed: ${getErrorMessage(error)}`);
  }
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<AuthEnvelope<AuthUserData>> {
  try {
    const response = await apiClient.post<AuthEnvelope<AuthUserData>>('/auth/register', {
      username,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw new Error(`Register failed: ${getErrorMessage(error)}`);
  }
}

export async function getMe(token: string): Promise<AuthEnvelope<MeData>> {
  try {
    const response = await apiClient.get<AuthEnvelope<MeData>>('/auth/me', authConfig(token));
    return response.data;
  } catch (error) {
    throw new Error(`Get current user failed: ${getErrorMessage(error)}`);
  }
}

export async function updateProfile(
  token: string,
  profile: Partial<User>
): Promise<AuthEnvelope<MeData>> {
  try {
    const response = await apiClient.put<AuthEnvelope<MeData>>(
      '/auth/me',
      serializeUserProfileForApi(profile),
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Update profile failed: ${getErrorMessage(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Exercise APIs
// ---------------------------------------------------------------------------

export async function fetchExercises(
  token: string,
  filters?: {
    category?: string;
    type?: string;
    equipment?: string;
    primaryMuscle?: string;
    isCustom?: boolean;
  }
): Promise<BackendExerciseDocument[]> {
  try {
    const response = await apiClient.get<BackendExerciseDocument[]>('/exercises', {
      ...authConfig(token),
      params: {
        ...filters,
        isCustom: typeof filters?.isCustom === 'boolean' ? String(filters.isCustom) : undefined,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Fetch exercises failed: ${getErrorMessage(error)}`);
  }
}

export async function fetchExerciseById(token: string, id: string): Promise<BackendExerciseDocument> {
  try {
    const response = await apiClient.get<BackendExerciseDocument>(`/exercises/${id}`, authConfig(token));
    return response.data;
  } catch (error) {
    throw new Error(`Fetch exercise failed: ${getErrorMessage(error)}`);
  }
}

export async function createExercise(
  token: string,
  exercise: Partial<Exercise>
): Promise<BackendExerciseDocument> {
  try {
    const response = await apiClient.post<BackendExerciseDocument>(
      '/exercises',
      serializeExerciseForApi(exercise),
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Create exercise failed: ${getErrorMessage(error)}`);
  }
}

export async function updateExercise(
  token: string,
  id: string,
  exercise: Partial<Exercise>
): Promise<BackendExerciseDocument> {
  try {
    const response = await apiClient.put<BackendExerciseDocument>(
      `/exercises/${id}`,
      serializeExerciseForApi(exercise),
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Update exercise failed: ${getErrorMessage(error)}`);
  }
}

export async function deleteExercise(token: string, id: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.delete<{ message: string }>(`/exercises/${id}`, authConfig(token));
    return response.data;
  } catch (error) {
    throw new Error(`Delete exercise failed: ${getErrorMessage(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Workout APIs
// ---------------------------------------------------------------------------

export async function fetchWorkouts(
  token: string,
  page: number,
  limit: number
): Promise<BackendWorkoutDocument[]> {
  try {
    const response = await apiClient.get<BackendWorkoutDocument[]>('/workouts', {
      ...authConfig(token),
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Fetch workouts failed: ${getErrorMessage(error)}`);
  }
}

export async function createWorkout(
  token: string,
  workout: WorkoutWithExercises
): Promise<BackendWorkoutDocument> {
  try {
    const response = await apiClient.post<BackendWorkoutDocument>(
      '/workouts',
      serializeWorkoutForApi(workout),
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Create workout failed: ${getErrorMessage(error)}`);
  }
}

export async function updateWorkout(
  token: string,
  id: string,
  workout: WorkoutWithExercises
): Promise<BackendWorkoutDocument> {
  try {
    const response = await apiClient.put<BackendWorkoutDocument>(
      `/workouts/${id}`,
      serializeWorkoutForApi(workout),
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Update workout failed: ${getErrorMessage(error)}`);
  }
}

export async function deleteWorkout(token: string, id: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.delete<{ message: string }>(`/workouts/${id}`, authConfig(token));
    return response.data;
  } catch (error) {
    throw new Error(`Delete workout failed: ${getErrorMessage(error)}`);
  }
}

export async function startWorkoutFromPlan(
  token: string,
  planId: string,
  name?: string
): Promise<BackendWorkoutDocument> {
  try {
    const response = await apiClient.post<BackendWorkoutDocument>(
      `/workouts/from-plan/${planId}`,
      { name },
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Start workout from plan failed: ${getErrorMessage(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Plan APIs
// ---------------------------------------------------------------------------

export async function fetchPlans(token: string, page: number, limit: number): Promise<BackendPlanDocument[]> {
  try {
    const response = await apiClient.get<BackendPlanDocument[]>('/plans', {
      ...authConfig(token),
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Fetch plans failed: ${getErrorMessage(error)}`);
  }
}

export async function createPlan(token: string, plan: PlanWithExercises): Promise<BackendPlanDocument> {
  try {
    const response = await apiClient.post<BackendPlanDocument>(
      '/plans',
      serializePlanForApi(plan),
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Create plan failed: ${getErrorMessage(error)}`);
  }
}

export async function updatePlan(
  token: string,
  id: string,
  plan: PlanWithExercises
): Promise<BackendPlanDocument> {
  try {
    const response = await apiClient.put<BackendPlanDocument>(
      `/plans/${id}`,
      serializePlanForApi(plan),
      authConfig(token)
    );
    return response.data;
  } catch (error) {
    throw new Error(`Update plan failed: ${getErrorMessage(error)}`);
  }
}

export async function deletePlan(token: string, id: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.delete<{ message: string }>(`/plans/${id}`, authConfig(token));
    return response.data;
  } catch (error) {
    throw new Error(`Delete plan failed: ${getErrorMessage(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Sync API
// ---------------------------------------------------------------------------

export async function syncData(token: string, payload: SyncPayload): Promise<SyncResponse> {
  try {
    const response = await apiClient.post<SyncResponse>('/sync', payload, authConfig(token));
    return response.data;
  } catch (error) {
    throw new Error(`Sync failed: ${getErrorMessage(error)}`);
  }
}

export { API_BASE_URL };
