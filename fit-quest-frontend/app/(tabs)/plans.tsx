import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedAlertModal } from '@/components/common/ThemedAlertModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useSync } from '@/contexts/SyncContext';
import { getPlanById, getPlans } from '@/services/db/planDbService';
import type { Plan } from '@/types/models';

type PlanListItem = Plan & {
  exerciseCount: number;
};

function formatPlannedDate(dateIso?: string): string {
  if (!dateIso) {
    return 'No schedule';
  }

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function PlansScreen() {
  const router = useRouter();
  const { sync, pendingCount } = useSync();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [alertState, setAlertState] = useState<{ title: string; message: string; tone: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const loadPlans = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const basePlans = await getPlans(1, 30);
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

  const handleSync = useCallback(async () => {
    try {
      const summary = await sync();
      await loadPlans(true);

      if (summary.errors.length > 0) {
        setAlertState({
          title: 'Sync Incomplete',
          message: summary.errors[0],
          tone: 'warning',
        });
        return;
      }

      setAlertState({
        title: 'Sync Complete',
        message: `Uploaded ${summary.uploaded}, downloaded ${summary.downloaded}.`,
        tone: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAlertState({
        title: 'Sync Failed',
        message,
        tone: 'error',
      });
    }
  }, [loadPlans, sync]);

  const activePlanId = useMemo(() => plans[0]?.id ?? null, [plans]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
      <View className="bg-[#0B0B0D] px-5 pb-5 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">My Plans</Text>
          <Pressable
            className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5"
            onPress={() => void handleSync()}
          >
            <Text className="text-xs font-semibold text-violet-200">{pendingCount} Pending</Text>
          </Pressable>
        </View>
        <Text className="mt-2 text-base text-neutral-300">Curated workflows for your physical evolution.</Text>
      </View>

      {error ? <Text className="px-5 pt-2 text-sm text-red-300">{error}</Text> : null}

      <Pressable
        className="mx-5 mt-5 flex-row items-center justify-center gap-2 rounded-2xl border border-[#7A3BFF] bg-[#1A1624] py-4"
        onPress={() => router.push('/plan/form' as never)}
      >
        <Text className="text-xl text-[#DBB8FF]">+</Text>
        <Text className="text-lg font-bold text-[#DBB8FF]">Create New Plan</Text>
      </Pressable>

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 18, gap: 14 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadPlans(true)} tintColor="#A556FB" />}
        ListEmptyComponent={
          <View className="rounded-3xl border border-white/10 bg-[#1B1B1F] p-5">
            <Text className="text-sm text-neutral-300">No plans yet. Create your first plan.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = item.id === activePlanId;

          return (
            <Pressable
              className={`rounded-3xl border p-5 ${isActive ? 'border-[#6F31F5]/80 bg-[#1B1A24]' : 'border-white/10 bg-[#1B1B1F]'}`}
              onPress={() => router.push({ pathname: '/plan/[id]', params: { id: item.id } } as never)}
            >
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  {isActive ? <Text className="text-xs font-bold tracking-[2px] text-amber-300">CURRENTLY ACTIVE</Text> : null}
                  <Text className="mt-1 text-xl font-bold text-white">{item.name}</Text>
                </View>
                <View className="rounded-xl bg-white/10 px-2 py-1">
                  <Text className="text-xs font-semibold text-neutral-200">{item.exerciseCount} EX</Text>
                </View>
              </View>

              <View className="mt-5 flex-row items-end justify-between">
                <View>
                  <Text className="text-xs uppercase tracking-[1px] text-neutral-400">Planned</Text>
                  <Text className="mt-1 text-lg font-semibold text-neutral-100">{formatPlannedDate(item.plannedDate)}</Text>
                </View>

                <Pressable
                  className={`rounded-xl px-4 py-2 ${isActive ? 'bg-[#6F31F5]' : 'bg-[#3A3A3C]'}`}
                  onPress={() =>
                    router.push({ pathname: '/workout/form', params: { planId: item.id } } as never)
                  }
                >
                  <Text className="text-sm font-semibold text-white">{isActive ? 'Resume' : 'Start Now'}</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      <ThemedAlertModal
        visible={alertState !== null}
        title={alertState?.title ?? ''}
        message={alertState?.message ?? ''}
        tone={alertState?.tone ?? 'info'}
        onClose={() => setAlertState(null)}
      />
    </SafeAreaView>
  );
}
