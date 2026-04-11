import type {
  BackendExerciseDocument,
  BackendPlanDocument,
  BackendWorkoutDocument,
  Exercise,
  Plan,
  PlanExercise,
  PlanSet,
  PlanWithExercises,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutWithExercises,
} from '@/types/models';

type IdFactory = () => string;

export type NormalizedWorkoutData = {
  workout: Workout;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
  unresolvedExerciseRemoteIds: string[];
};

export type NormalizedPlanData = {
  plan: Plan;
  exercises: PlanExercise[];
  sets: PlanSet[];
  unresolvedExerciseRemoteIds: string[];
};

function defaultIdFactory(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = char === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isMongoObjectId(value: string | undefined): value is string {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

export function toIsoString(value: string | Date | undefined, fallbackIso: string): string {
  if (!value) return fallbackIso;
  if (value instanceof Date) return value.toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIso;
  }

  return parsed.toISOString();
}

export function extractRemoteId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === 'string') {
      return maybeId;
    }
  }

  return undefined;
}

export function isCompleteBackendExerciseDocument(value: unknown): value is BackendExerciseDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BackendExerciseDocument>;
  return (
    typeof candidate._id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.primaryMuscle === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.equipment === 'string' &&
    Array.isArray(candidate.instructions)
  );
}

export function toBackendExercisePayload(exercise: Partial<Exercise>): Record<string, unknown> {
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

export function toBackendWorkoutPayload(workout: WorkoutWithExercises): Record<string, unknown> {
  const sourcePlanRemoteId =
    isMongoObjectId(workout.sourcePlanRemoteId)
      ? workout.sourcePlanRemoteId
      : isMongoObjectId(workout.sourcePlanId)
        ? workout.sourcePlanId
        : undefined;

  return {
    ...(workout.remoteId ? { _id: workout.remoteId } : {}),
    user: workout.remoteId ? undefined : workout.userId,
    date: workout.date,
    name: workout.name,
    notes: workout.notes,
    ...(sourcePlanRemoteId ? { sourcePlan: sourcePlanRemoteId } : {}),
    exercises: workout.exercises.map((workoutExercise) => ({
      exercise: workoutExercise.exercise.remoteId ?? workoutExercise.exerciseId,
      sets: workoutExercise.sets
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((set) => ({
          reps: set.reps,
          weight: set.weight,
          weightUnit: set.weightUnit,
          weightKg: set.weightKg,
          duration: set.duration,
          distance: set.distance,
          notes: set.notes,
        })),
    })),
  };
}

export function toBackendPlanPayload(plan: PlanWithExercises): Record<string, unknown> {
  return {
    ...(plan.remoteId ? { _id: plan.remoteId } : {}),
    user: plan.remoteId ? undefined : plan.userId,
    name: plan.name,
    plannedDate: plan.plannedDate,
    exercises: plan.exercises.map((planExercise) => ({
      exercise: planExercise.exercise.remoteId ?? planExercise.exerciseId,
      sets: planExercise.sets
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((set) => ({
          reps: set.reps,
          weight: set.weight,
          weightUnit: set.weightUnit,
          weightKg: set.weightKg,
          duration: set.duration,
          distance: set.distance,
          notes: set.notes,
        })),
    })),
  };
}

export function toLocalExerciseRecord(
  document: BackendExerciseDocument,
  options?: {
    existingLocalId?: string;
    nowIso?: string;
    idFactory?: IdFactory;
  }
): Exercise {
  const now = options?.nowIso ?? new Date().toISOString();
  const createId = options?.idFactory ?? defaultIdFactory;

  return {
    id: options?.existingLocalId ?? createId(),
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
    createdAt: toIsoString(document.createdAt, now),
    updatedAt: toIsoString(document.updatedAt, now),
  };
}

export function toLocalWorkoutNormalized(
  document: BackendWorkoutDocument,
  options: {
    fallbackUserId: string;
    existingLocalWorkoutId?: string;
    sourcePlanLocalId?: string;
    resolveLocalExerciseId?: (remoteExerciseId: string) => string | undefined;
    nowIso?: string;
    idFactory?: IdFactory;
  }
): NormalizedWorkoutData {
  const now = options.nowIso ?? new Date().toISOString();
  const createId = options.idFactory ?? defaultIdFactory;
  const localWorkoutId = options.existingLocalWorkoutId ?? createId();

  const exercises: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];
  const unresolvedExerciseRemoteIds: string[] = [];

  for (const [exerciseIndex, remoteExercise] of (document.exercises ?? []).entries()) {
    const remoteExerciseId = extractRemoteId(remoteExercise.exercise);
    const localExerciseId = (() => {
      if (!remoteExerciseId) {
        return undefined;
      }

      // If resolver is provided, unresolved IDs should stay unresolved
      // so callers can decide whether to skip or backfill them.
      if (options.resolveLocalExerciseId) {
        return options.resolveLocalExerciseId(remoteExerciseId);
      }

      return remoteExerciseId;
    })();

    if (!localExerciseId) {
      if (remoteExerciseId) {
        unresolvedExerciseRemoteIds.push(remoteExerciseId);
      }
      continue;
    }

    const workoutExerciseId = createId();
    exercises.push({
      id: workoutExerciseId,
      workoutId: localWorkoutId,
      exerciseId: localExerciseId,
      orderIndex: exerciseIndex,
      createdAt: now,
    });

    for (const [setIndex, set] of (remoteExercise.sets ?? []).entries()) {
      sets.push({
        id: createId(),
        workoutExerciseId,
        reps: set.reps,
        weight: set.weight,
        weightUnit: set.weightUnit,
        weightKg: set.weightKg,
        duration: set.duration,
        distance: set.distance,
        notes: set.notes,
        orderIndex: setIndex,
        createdAt: now,
      });
    }
  }

  const workout: Workout = {
    id: localWorkoutId,
    remoteId: document._id,
    userId: options.fallbackUserId,
    date: toIsoString(document.date, now),
    name: document.name,
    notes: document.notes,
    sourcePlanId: options.sourcePlanLocalId,
    sourcePlanRemoteId: document.sourcePlan,
    isDeleted: false,
    syncStatus: 'synced',
    createdAt: toIsoString(document.createdAt, now),
    updatedAt: toIsoString(document.updatedAt, now),
  };

  return {
    workout,
    exercises,
    sets,
    unresolvedExerciseRemoteIds,
  };
}

export function toLocalPlanNormalized(
  document: BackendPlanDocument,
  options: {
    fallbackUserId: string;
    existingLocalPlanId?: string;
    resolveLocalExerciseId?: (remoteExerciseId: string) => string | undefined;
    nowIso?: string;
    idFactory?: IdFactory;
  }
): NormalizedPlanData {
  const now = options.nowIso ?? new Date().toISOString();
  const createId = options.idFactory ?? defaultIdFactory;
  const localPlanId = options.existingLocalPlanId ?? createId();

  const exercises: PlanExercise[] = [];
  const sets: PlanSet[] = [];
  const unresolvedExerciseRemoteIds: string[] = [];

  for (const [exerciseIndex, remoteExercise] of (document.exercises ?? []).entries()) {
    const remoteExerciseId = extractRemoteId(remoteExercise.exercise);
    const localExerciseId = (() => {
      if (!remoteExerciseId) {
        return undefined;
      }

      if (options.resolveLocalExerciseId) {
        return options.resolveLocalExerciseId(remoteExerciseId);
      }

      return remoteExerciseId;
    })();

    if (!localExerciseId) {
      if (remoteExerciseId) {
        unresolvedExerciseRemoteIds.push(remoteExerciseId);
      }
      continue;
    }

    const planExerciseId = createId();
    exercises.push({
      id: planExerciseId,
      planId: localPlanId,
      exerciseId: localExerciseId,
      orderIndex: exerciseIndex,
      createdAt: now,
    });

    for (const [setIndex, set] of (remoteExercise.sets ?? []).entries()) {
      sets.push({
        id: createId(),
        planExerciseId,
        reps: set.reps,
        weight: set.weight,
        weightUnit: set.weightUnit,
        weightKg: set.weightKg,
        duration: set.duration,
        distance: set.distance,
        notes: set.notes,
        orderIndex: setIndex,
        createdAt: now,
      });
    }
  }

  const plan: Plan = {
    id: localPlanId,
    remoteId: document._id,
    userId: options.fallbackUserId,
    name: document.name,
    plannedDate: document.plannedDate ? toIsoString(document.plannedDate, now) : undefined,
    isDeleted: false,
    syncStatus: 'synced',
    createdAt: toIsoString(document.createdAt, now),
    updatedAt: toIsoString(document.updatedAt, now),
  };

  return {
    plan,
    exercises,
    sets,
    unresolvedExerciseRemoteIds,
  };
}
