import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ThemedConfirmModal } from '@/components/common/ThemedConfirmModal';
import { useSync } from '@/contexts/SyncContext';
import { addToSyncQueue } from '@/services/db/syncQueueService';
import { deleteWorkout, getWorkoutById, saveWorkout } from '@/services/db/workoutDbService';
import type { FullWorkout } from '@/services/db/workoutDbService';
import type { ExerciseType, WorkoutExercise, WorkoutSet } from '@/types/models';

type TableColumn = 'reps' | 'weight' | 'duration' | 'distance';

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

function formatWorkoutDate(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getColumnsForExerciseType(type: ExerciseType): TableColumn[] {
  switch (type) {
    case 'weight and reps':
      return ['reps', 'weight'];
    case 'bodyweight reps':
      return ['reps'];
    case 'weighted bodyweight':
    case 'assisted bodyweight':
      return ['reps', 'weight'];
    case 'duration':
      return ['duration'];
    case 'duration and weight':
      return ['duration', 'weight'];
    case 'distance and duration':
      return ['distance', 'duration'];
    case 'weight and distance':
      return ['weight', 'distance'];
    default:
      return ['reps'];
  }
}

function getColumnHeader(column: TableColumn): string {
  switch (column) {
    case 'reps':
      return 'Reps';
    case 'weight':
      return 'Weight';
    case 'duration':
      return 'Duration';
    case 'distance':
      return 'Distance';
  }
}

function getSetValue(set: WorkoutSet, column: TableColumn): string {
  if (column === 'reps') {
    return set.reps !== undefined ? String(set.reps) : '-';
  }

  if (column === 'weight') {
    return set.weight !== undefined ? String(set.weight) : '-';
  }

  if (column === 'duration') {
    return set.duration !== undefined ? `${set.duration}s` : '-';
  }

  return set.distance !== undefined ? String(set.distance) : '-';
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { getPendingChanges } = useSync();

  const [workout, setWorkout] = useState<FullWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStartingAgain, setIsStartingAgain] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const loadWorkout = useCallback(async () => {
    if (!id) {
      setError('Missing workout ID in route.');
      setWorkout(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const loadedWorkout = await getWorkoutById(id);
      setWorkout(loadedWorkout);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setWorkout(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkout();
    }, [loadWorkout])
  );

  const handleDelete = async () => {
    if (!workout || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteWorkout(workout.id);
      await addToSyncQueue('workout', workout.id, 'delete', {
        id: workout.id,
        remoteId: workout.remoteId ?? null,
      });
      await getPendingChanges();
      setIsDeleteModalOpen(false);
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleStartAgain = async () => {
    if (!workout || isStartingAgain) {
      return;
    }

    setIsStartingAgain(true);
    try {
      const nowIso = new Date().toISOString();
      const newWorkoutId = generateUuid();
      const workoutExerciseIdMap = new Map<string, string>();

      const duplicatedWorkout = {
        ...workout,
        id: newWorkoutId,
        remoteId: undefined,
        date: nowIso,
        name: workout.name ? `${workout.name} (Again)` : 'Workout',
        sourcePlanId: workout.sourcePlanId,
        sourcePlanRemoteId: workout.sourcePlanRemoteId,
        isDeleted: false,
        syncStatus: 'pending' as const,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const duplicatedExercises: WorkoutExercise[] = workout.exercises.map((entry, index) => {
        const newWorkoutExerciseId = generateUuid();
        workoutExerciseIdMap.set(entry.id, newWorkoutExerciseId);

        return {
          id: newWorkoutExerciseId,
          workoutId: newWorkoutId,
          exerciseId: entry.exerciseId,
          orderIndex: index,
          createdAt: nowIso,
        };
      });

      const duplicatedSets: WorkoutSet[] = workout.exercises.flatMap((entry) => {
        const duplicatedWorkoutExerciseId = workoutExerciseIdMap.get(entry.id);

        if (!duplicatedWorkoutExerciseId) {
          return [];
        }

        return entry.sets.map((setRow, index) => ({
          id: generateUuid(),
          workoutExerciseId: duplicatedWorkoutExerciseId,
          reps: setRow.reps,
          weight: setRow.weight,
          duration: setRow.duration,
          distance: setRow.distance,
          notes: setRow.notes,
          orderIndex: index,
          createdAt: nowIso,
        }));
      });

      const savedWorkoutId = await saveWorkout(duplicatedWorkout, duplicatedExercises, duplicatedSets);
      await addToSyncQueue('workout', savedWorkoutId, 'create', {
        ...duplicatedWorkout,
        id: savedWorkoutId,
        remoteId: null,
        exercises: duplicatedExercises,
        sets: duplicatedSets,
      });
      await getPendingChanges();
      router.replace({ pathname: '/workout/[id]', params: { id: savedWorkoutId } } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsStartingAgain(false);
    }
  };

  const tableColumnsByExerciseId = useMemo(() => {
    const map = new Map<string, TableColumn[]>();
    workout?.exercises.forEach((entry) => {
      map.set(entry.id, getColumnsForExerciseType(entry.exercise.type));
    });
    return map;
  }, [workout]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#141313]" edges={['top', 'bottom']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-neutral-950 px-6" edges={['top', 'bottom']}>
        <Text className="text-xl font-bold text-white">Workout Not Found</Text>
        <Text className="text-center text-sm text-neutral-300">
          {error ?? 'This workout may have been deleted or does not exist.'}
        </Text>
        <Pressable className="rounded-xl bg-primary px-4 py-2" onPress={() => router.back()}>
          <Text className="font-semibold text-white">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#141313]" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 bg-[#141313]" contentContainerClassName="gap-5 px-5 pb-8 pt-5">
        <Stack.Screen
        options={{
          title: workout.name?.trim() || 'Workout',
          headerRight: () => (
            <View className="flex-row gap-2">
              <Pressable
                className="rounded-lg bg-secondary px-3 py-1.5"
                onPress={() => router.push({ pathname: '/workout/form', params: { id: workout.id } } as never)}
              >
                <Text className="text-xs font-semibold text-white">Edit</Text>
              </Pressable>
              <Pressable
                className="rounded-lg bg-red-600 px-3 py-1.5"
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                <Text className="text-xs font-semibold text-white">{isDeleting ? '...' : 'Delete'}</Text>
              </Pressable>
            </View>
          ),
        }}
        />

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <View className="rounded-3xl border border-white/10 bg-[#1B1B1F] p-5">
        <View className="flex-row items-center justify-between">
          <View className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
            <Text className="text-xs font-semibold text-amber-300">{workout.syncStatus.toUpperCase()}</Text>
          </View>
          <Text className="text-xs uppercase tracking-[1px] text-neutral-400">{formatWorkoutDate(workout.date)}</Text>
        </View>
        <Text className="mt-3 text-5xl font-black text-white">{workout.name?.trim() || 'Workout'}</Text>
        {workout.notes ? <Text className="mt-3 text-sm leading-6 text-neutral-200">{workout.notes}</Text> : null}
        </View>

        <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl border border-white/10 bg-[#1B1B1F] p-4">
          <Text className="text-xs uppercase tracking-[2px] text-neutral-400">Total Sets</Text>
          <Text className="mt-2 text-4xl font-black text-[#DBB8FF]">
            {workout.exercises.reduce((total, item) => total + item.sets.length, 0)}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl border border-white/10 bg-[#1B1B1F] p-4">
          <Text className="text-xs uppercase tracking-[2px] text-neutral-400">Exercises</Text>
          <Text className="mt-2 text-4xl font-black text-white">{workout.exercises.length}</Text>
        </View>
        </View>

        {workout.exercises.length === 0 ? (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <Text className="text-sm text-neutral-300">No exercises were logged for this workout.</Text>
          </View>
        ) : (
          <View className="gap-3">
          {workout.exercises.map((entry, exerciseIndex) => {
            const columns = tableColumnsByExerciseId.get(entry.id) ?? ['reps'];

            return (
              <View key={entry.id} className="rounded-3xl border border-white/10 bg-[#1B1B1F] p-4">
                <Text className="text-2xl font-bold text-white">
                  {exerciseIndex + 1}. {entry.exercise.name}
                </Text>
                <Text className="mt-1 text-xs uppercase tracking-[1px] text-[#DBB8FF]">{entry.exercise.type}</Text>

                <View className="mt-3 rounded-xl border border-white/10">
                  <View className="flex-row border-b border-white/10 bg-[#131317] px-2 py-2">
                    <Text className="w-10 text-xs font-semibold text-neutral-300">Set</Text>
                    {columns.map((column) => (
                      <Text key={column} className="flex-1 text-xs font-semibold text-neutral-300">
                        {getColumnHeader(column)}
                      </Text>
                    ))}
                  </View>

                  {entry.sets.length === 0 ? (
                    <View className="px-2 py-3">
                      <Text className="text-xs text-neutral-400">No sets recorded.</Text>
                    </View>
                  ) : (
                    entry.sets.map((setRow, setIndex) => (
                      <View
                        key={setRow.id}
                        className="flex-row border-b border-white/5 px-2 py-2 last:border-b-0"
                      >
                        <Text className="w-10 text-xs text-white">{setIndex + 1}</Text>
                        {columns.map((column) => (
                          <Text key={`${setRow.id}-${column}`} className="flex-1 text-xs text-white">
                            {getSetValue(setRow, column)}
                          </Text>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })}
          </View>
        )}

        <View className="flex-row gap-3">
        <Pressable
          className="flex-1 items-center rounded-2xl border border-white/10 bg-[#1D1D20] px-4 py-4"
          onPress={() => void handleStartAgain()}
          disabled={isStartingAgain}
        >
          <Text className="font-semibold text-neutral-200">{isStartingAgain ? 'Starting...' : 'Log Similar'}</Text>
        </Pressable>
        <Pressable
          className="flex-1 items-center rounded-2xl bg-[#6F31F5] px-4 py-4"
          onPress={() => router.push({ pathname: '/workout/form', params: { id: workout.id } } as never)}
        >
          <Text className="font-semibold text-white">Edit Workout</Text>
        </Pressable>
        </View>
      </ScrollView>

      <ThemedConfirmModal
        visible={isDeleteModalOpen}
        title="Delete Workout"
        message="Are you sure you want to delete this workout?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        isLoading={isDeleting}
        onCancel={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </SafeAreaView>
  );
}
