import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ThemedConfirmModal } from '@/components/common/ThemedConfirmModal';
import { useSync } from '@/contexts/SyncContext';
import { addToSyncQueue } from '@/services/db/syncQueueService';
import { deletePlan, getPlanById } from '@/services/db/planDbService';
import type { FullPlan } from '@/services/db/planDbService';
import type { ExerciseType, PlanSet } from '@/types/models';

type TableColumn = 'reps' | 'weight' | 'duration' | 'distance';

function formatPlannedDate(dateIso?: string): string {
  if (!dateIso) {
    return 'No planned date';
  }

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

function getSetValue(set: PlanSet, column: TableColumn): string {
  if (column === 'reps') {
    return set.reps !== undefined ? String(set.reps) : '-';
  }

  if (column === 'weight') {
    return set.weight !== undefined ? `${set.weight} ${set.weightUnit ?? 'kg'}` : '-';
  }

  if (column === 'duration') {
    return set.duration !== undefined ? `${set.duration}s` : '-';
  }

  return set.distance !== undefined ? String(set.distance) : '-';
}

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { getPendingChanges } = useSync();

  const [plan, setPlan] = useState<FullPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!id) {
      setError('Missing plan ID in route.');
      setPlan(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const loadedPlan = await getPlanById(id);
      setPlan(loadedPlan);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPlan(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadPlan();
    }, [loadPlan])
  );

  const handleDelete = async () => {
    if (!plan || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePlan(plan.id);
      await addToSyncQueue('plan', plan.id, 'delete', {
        id: plan.id,
        remoteId: plan.remoteId ?? null,
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

  const handleStartWorkout = () => {
    if (!plan) {
      return;
    }

    router.push({ pathname: '/workout/form', params: { planId: plan.id } } as never);
  };

  const tableColumnsByExerciseId = useMemo(() => {
    const map = new Map<string, TableColumn[]>();
    plan?.exercises.forEach((entry) => {
      map.set(entry.id, getColumnsForExerciseType(entry.exercise.type));
    });
    return map;
  }, [plan]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-neutral-950 px-6" edges={['top', 'bottom']}>
        <Text className="text-xl font-bold text-white">Plan Not Found</Text>
        <Text className="text-center text-sm text-neutral-300">
          {error ?? 'This plan may have been deleted or does not exist.'}
        </Text>
        <Pressable className="rounded-xl bg-primary px-4 py-2" onPress={() => router.back()}>
          <Text className="font-semibold text-white">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 bg-neutral-950" contentContainerClassName="gap-4 px-4 pb-8 pt-5">
      <Stack.Screen
        options={{
          title: plan.name,
          headerRight: () => (
            <View className="flex-row gap-2">
              <Pressable
                className="rounded-lg bg-secondary px-3 py-1.5"
                onPress={() => router.push({ pathname: '/plan/form', params: { id: plan.id } } as never)}
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

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-2xl font-bold text-white">{plan.name}</Text>
        <Text className="mt-2 text-sm text-neutral-300">{formatPlannedDate(plan.plannedDate)}</Text>
      </View>

      <Pressable className="items-center rounded-xl bg-primary px-4 py-3" onPress={handleStartWorkout}>
        <Text className="font-semibold text-white">Start Workout</Text>
      </Pressable>

      {plan.exercises.length === 0 ? (
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <Text className="text-sm text-neutral-300">No exercises added to this plan yet.</Text>
        </View>
      ) : (
        <View className="gap-3">
          {plan.exercises.map((entry, exerciseIndex) => {
            const columns = tableColumnsByExerciseId.get(entry.id) ?? ['reps'];

            return (
              <View key={entry.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <Text className="text-base font-semibold text-white">
                  {exerciseIndex + 1}. {entry.exercise.name}
                </Text>
                <Text className="mt-1 text-xs capitalize text-neutral-400">{entry.exercise.type}</Text>

                <View className="mt-3 rounded-xl border border-neutral-800">
                  <View className="flex-row border-b border-neutral-800 bg-neutral-950/60 px-2 py-2">
                    <Text className="w-10 text-xs font-semibold text-neutral-300">Set</Text>
                    {columns.map((column) => (
                      <Text key={column} className="flex-1 text-xs font-semibold text-neutral-300">
                        {getColumnHeader(column)}
                      </Text>
                    ))}
                  </View>

                  {entry.sets.length === 0 ? (
                    <View className="px-2 py-3">
                      <Text className="text-xs text-neutral-400">No planned sets.</Text>
                    </View>
                  ) : (
                    entry.sets.map((setRow, setIndex) => (
                      <View
                        key={setRow.id}
                        className="flex-row border-b border-neutral-800 px-2 py-2 last:border-b-0"
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
      </ScrollView>

      <ThemedConfirmModal
        visible={isDeleteModalOpen}
        title="Delete Plan"
        message="Are you sure you want to delete this plan?"
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
