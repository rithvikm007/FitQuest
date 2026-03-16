import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SyncStatusIndicator } from '@/components/common/SyncStatusIndicator';
import { useSync } from '@/contexts/SyncContext';
import { getPendingCount } from '@/services/db/syncQueueService';
import { getPlanById, getPlans } from '@/services/db/planDbService';
import type { Plan, SyncStatus } from '@/types/models';

type PlanListItem = Plan & {
  exerciseCount: number;
};

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

function getSyncStatusBadgeClass(status: SyncStatus): string {
  switch (status) {
    case 'synced':
      return 'border-emerald-500 bg-emerald-500/20';
    case 'failed':
      return 'border-red-500 bg-red-500/20';
    default:
      return 'border-amber-500 bg-amber-500/20';
  }
}

function getSyncStatusLabel(status: SyncStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function PlansScreen() {
  const router = useRouter();
  const { sync } = useSync();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanListItem[]>([]);

  const loadPlans = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const basePlans = await getPlans(1, 20);
      const withExerciseCounts = await Promise.all(
        basePlans.map(async (plan) => {
          const detail = await getPlanById(plan.id);
          return {
            ...plan,
            exerciseCount: detail?.exercises.length ?? 0,
          };
        })
      );

      setPlans(withExerciseCounts);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPlans(false);
    }, [loadPlans])
  );

  const onRefresh = async () => {
    await loadPlans(true);
  };

  const handleSyncPress = useCallback(async () => {
    try {
      const pendingBefore = await getPendingCount();
      const summary = await sync();
      await loadPlans(true);
      const pendingAfter = await getPendingCount();
      const processed = Math.max(0, pendingBefore - pendingAfter);

      if (summary.errors.length > 0) {
        Alert.alert(
          'Sync Incomplete',
          `${summary.errors[0]}\n\nProcessed ${processed} change${processed === 1 ? '' : 's'}. Pending: ${pendingAfter}.`
        );
        return;
      }

      Alert.alert(
        'Sync Complete',
        `Uploaded: ${summary.uploaded}, Downloaded: ${summary.downloaded}. Pending: ${pendingAfter}.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Sync Failed', message);
    }
  }, [loadPlans, sync]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-950">
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <View className="flex-row items-start justify-between px-4 pb-3 pt-5">
        <Text className="text-3xl font-bold text-white">My Plans</Text>
        <SyncStatusIndicator onSyncPress={() => void handleSyncPress()} />
      </View>

      {error ? <Text className="px-4 pb-2 text-sm text-red-400">{error}</Text> : null}

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#A556FB" />}
        ListEmptyComponent={
          <View className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <Text className="text-sm text-neutral-200">No plans yet. Create your first plan!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mb-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <Pressable onPress={() => router.push({ pathname: '/plan/[id]', params: { id: item.id } } as never)}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-white">{item.name}</Text>
                  <Text className="mt-1 text-sm text-neutral-300">{formatPlannedDate(item.plannedDate)}</Text>
                  <Text className="mt-1 text-sm text-neutral-200">
                    {item.exerciseCount} exercise{item.exerciseCount === 1 ? '' : 's'}
                  </Text>
                </View>

                <View className={`rounded-full border px-3 py-1 ${getSyncStatusBadgeClass(item.syncStatus)}`}>
                  <Text className="text-xs font-semibold text-white">{getSyncStatusLabel(item.syncStatus)}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              className="mt-3 items-center rounded-lg bg-secondary px-3 py-2"
              onPress={() => router.push({ pathname: '/workout/form', params: { planId: item.id } } as never)}
            >
              <Text className="text-sm font-semibold text-white">Start Workout</Text>
            </Pressable>
          </View>
        )}
      />

      <Pressable
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary"
        onPress={() => router.push('/plan/form' as never)}
      >
        <Text className="text-3xl font-semibold leading-none text-white">+</Text>
      </Pressable>
    </View>
  );
}
