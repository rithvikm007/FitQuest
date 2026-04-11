import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  toBackendExercisePayload,
  toBackendPlanPayload,
  toBackendWorkoutPayload,
  toIsoString,
  toLocalExerciseRecord,
  toLocalPlanNormalized,
  toLocalWorkoutNormalized,
} from '@/services/syncMappers';

import type {
  BackendExerciseDocument,
  BackendPlanDocument,
  BackendUserDocument,
  BackendWorkoutDocument,
  Exercise,
  Plan,
  PlanExercise,
  PlanSet,
  PlanWithExercises,
  SyncPayload,
  SyncResponse,
  User,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutWithExercises,
} from '@/types/models';

const API_BASE_URL_KEY = '@fitquest_api_base_url';

function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim();

  if (!trimmed) {
    throw new Error('Backend URL cannot be empty.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Backend URL is invalid. Example: http://192.168.1.50:3000/api');
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  if (!cleanPath.endsWith('/api')) {
    parsed.pathname = cleanPath ? `${cleanPath}/api` : '/api';
  } else {
    parsed.pathname = cleanPath;
  }

  return parsed.toString().replace(/\/$/, '');
}

function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
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

let currentApiBaseUrl = resolveApiBaseUrl();

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
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
};

type NormalizedPlanBundle = {
  plan: Plan;
  exercises: PlanExercise[];
  sets: PlanSet[];
};

export const apiClient = axios.create({
  baseURL: currentApiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getApiBaseUrl(): string {
  return currentApiBaseUrl;
}

export async function initializeApiBaseUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(API_BASE_URL_KEY);

  if (!stored) {
    apiClient.defaults.baseURL = currentApiBaseUrl;
    return currentApiBaseUrl;
  }

  try {
    currentApiBaseUrl = normalizeApiBaseUrl(stored);
  } catch {
    await AsyncStorage.removeItem(API_BASE_URL_KEY);
    currentApiBaseUrl = resolveApiBaseUrl();
  }

  apiClient.defaults.baseURL = currentApiBaseUrl;
  return currentApiBaseUrl;
}

export async function setApiBaseUrl(nextBaseUrl: string): Promise<string> {
  const normalized = normalizeApiBaseUrl(nextBaseUrl);
  currentApiBaseUrl = normalized;
  apiClient.defaults.baseURL = normalized;
  await AsyncStorage.setItem(API_BASE_URL_KEY, normalized);
  return normalized;
}

export async function clearApiBaseUrlOverride(): Promise<string> {
  await AsyncStorage.removeItem(API_BASE_URL_KEY);
  currentApiBaseUrl = resolveApiBaseUrl();
  apiClient.defaults.baseURL = currentApiBaseUrl;
  return currentApiBaseUrl;
}

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
  return toBackendExercisePayload(exercise);
}

/**
 * Maps backend Exercise document to local Exercise while keeping remoteId separate.
 */
export function normalizeBackendExercise(document: BackendExerciseDocument, existingLocalId?: string): Exercise {
  return toLocalExerciseRecord(document, { existingLocalId, idFactory: generateUuid });
}

/**
 * Converts local normalized workout-with-exercises into backend nested workout payload.
 */
export function serializeWorkoutForApi(workout: WorkoutWithExercises): Record<string, unknown> {
  return toBackendWorkoutPayload(workout);
}

/**
 * Converts local normalized plan-with-exercises into backend nested plan payload.
 */
export function serializePlanForApi(plan: PlanWithExercises): Record<string, unknown> {
  return toBackendPlanPayload(plan);
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
  const mapped = toLocalWorkoutNormalized(document, {
    fallbackUserId: document.user,
    existingLocalWorkoutId: options?.existingLocalWorkoutId,
    sourcePlanLocalId: options?.sourcePlanLocalId,
    resolveLocalExerciseId: options?.resolveLocalExerciseId,
    idFactory: generateUuid,
  });

  return {
    workout: mapped.workout,
    exercises: mapped.exercises,
    sets: mapped.sets,
  };
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
  const mapped = toLocalPlanNormalized(document, {
    fallbackUserId: document.user,
    existingLocalPlanId: options?.existingLocalPlanId,
    resolveLocalExerciseId: options?.resolveLocalExerciseId,
    idFactory: generateUuid,
  });

  return {
    plan: mapped.plan,
    exercises: mapped.exercises,
    sets: mapped.sets,
  };
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
