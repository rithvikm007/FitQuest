import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedAlertModal } from '@/components/common/ThemedAlertModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SyncStatusChip } from '@/components/common/SyncStatusChip';
import { useSync } from '@/contexts/SyncContext';
import { getPlanById, getPlans } from '@/services/db/planDbService';
import { getWorkoutById, getWorkouts } from '@/services/db/workoutDbService';
import type { Plan, Workout } from '@/types/models';

type DashboardWorkout = Workout & {
  exerciseCount: number;
};

type DashboardPlan = Plan & {
  exerciseCount: number;
};

function formatCompactDate(dateIso: string): string {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return dateIso;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function getSyncMeta(status: Workout['syncStatus']): { label: 'SYNCED' | 'FAILED' | 'PENDING'; status: 'synced' | 'failed' | 'pending' } {
  if (status === 'synced') {
    return {
      label: 'SYNCED',
      status: 'synced',
    };
  }

  if (status === 'failed') {
    return {
      label: 'FAILED',
      status: 'failed',
    };
  }

  return {
    label: 'PENDING',
    status: 'pending',
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { pendingCount, sync, isSyncing } = useSync();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<DashboardWorkout[]>([]);
  const [plans, setPlans] = useState<DashboardPlan[]>([]);
  const [alertState, setAlertState] = useState<{ title: string; message: string; tone: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);

      const [rawWorkouts, rawPlans] = await Promise.all([getWorkouts(1, 8), getPlans(1, 6)]);

      const enrichedWorkouts = await Promise.all(
        rawWorkouts.map(async (workout) => {
          const detail = await getWorkoutById(workout.id);
          return {
            ...workout,
            exerciseCount: detail?.exercises.length ?? 0,
          };
        })
      );

      const enrichedPlans = await Promise.all(
        rawPlans.map(async (plan) => {
          const detail = await getPlanById(plan.id);
          return {
            ...plan,
            exerciseCount: detail?.exercises.length ?? 0,
          };
        })
      );

      setWorkouts(enrichedWorkouts);
      setPlans(enrichedPlans);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  const todaysPlan = plans[0] ?? null;
  const recentActivity = workouts.slice(0, 3);
  const weeklyMomentum = workouts.length;

  const progressBars = useMemo(() => {
    const bars = [0.78, 0.84, 0.68, 0.9, 0.72, 0.45, 0.83];
    return bars.map((value, index) => ({
      id: `${index}`,
      value,
      active: index < Math.min(weeklyMomentum, 5),
    }));
  }, [weeklyMomentum]);

  const handleSyncPress = useCallback(async () => {
    try {
      const summary = await sync();
      await loadDashboard();

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
  }, [loadDashboard, sync]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="pb-6">
        <View className="flex-row items-center justify-between bg-[#0B0B0D] px-5 pb-3 pt-4">
          <Text className="text-2xl font-bold text-white">FitQuest</Text>
          <View className="flex-row items-center gap-3">
            <Pressable
              className="rounded-full border border-amber-400/30 bg-amber-400/20 px-3 py-1.5"
              onPress={() => void handleSyncPress()}
              disabled={isSyncing}
            >
              <Text className="text-xs font-semibold text-amber-300">
                {isSyncing ? 'Syncing...' : `${pendingCount} Pending`}
              </Text>
            </Pressable>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5"
              onPress={() => router.push('/workout/form' as never)}
            >
              <Text className="text-xl leading-none text-white">+</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text className="px-5 pt-3 text-sm text-red-300">{error}</Text> : null}

        <View className="px-5 pt-3">
          <View className="overflow-hidden rounded-3xl border border-white/10 bg-[#1B1B1F] p-4">
            <Text className="text-xs uppercase tracking-[2px] text-neutral-400">Weekly Momentum</Text>
            <Text className="mt-2 text-4xl font-black text-[#DBB8FF]">{String(weeklyMomentum).padStart(2, '0')}</Text>
            <Text className="mt-1 text-base text-neutral-200">Workouts completed</Text>
            <View className="mt-4 flex-row items-end gap-2">
              {progressBars.map((bar) => (
                <View
                  key={bar.id}
                  className={`w-2 rounded-full ${bar.active ? 'bg-[#A556FB]' : 'bg-[#3A3A3C]'}`}
                  style={{ height: 16 + bar.value * 38 }}
                />
              ))}
            </View>
          </View>
        </View>

        <View className="px-5 pt-5">
          <View className="rounded-3xl border border-white/10 bg-[#1D1D20] p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-white">Today's Protocol</Text>
                <Text className="mt-1 text-base text-neutral-300">{todaysPlan?.name ?? 'No plan selected'}</Text>
              </View>
              <MaterialIcons name="playlist-play" size={22} color="#DBB8FF" />
            </View>

            <View className="mt-4 gap-2">
              {(todaysPlan?.exerciseCount ?? 0) > 0 ? (
                <Text className="text-sm text-neutral-200">
                  {todaysPlan?.exerciseCount ?? 0} planned exercise{(todaysPlan?.exerciseCount ?? 0) === 1 ? '' : 's'}
                </Text>
              ) : (
                <Text className="text-sm text-neutral-400">Add a plan to prefill your next workout.</Text>
              )}
            </View>

            <Pressable
              className="mt-6 rounded-2xl bg-[#6F31F5] px-4 py-4"
              onPress={() =>
                router.push(
                  todaysPlan
                    ? ({ pathname: '/workout/form', params: { planId: todaysPlan.id } } as never)
                    : ('/workout/form' as never)
                )
              }
            >
              <Text className="text-center text-lg font-bold text-white">Start Workout</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row gap-3 px-5 pt-4">
          <Pressable
            className="flex-1 items-center rounded-2xl border border-white/10 bg-[#18181B] px-4 py-4"
            onPress={() => router.push('/workout/form' as never)}
          >
            <MaterialIcons name="add-circle-outline" size={22} color="#DBB8FF" />
            <Text className="mt-2 text-sm font-semibold text-neutral-100">New Workout</Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center rounded-2xl border border-white/10 bg-[#18181B] px-4 py-4"
            onPress={() => router.push('/plans' as never)}
          >
            <MaterialIcons name="event-note" size={22} color="#DBB8FF" />
            <Text className="mt-2 text-sm font-semibold text-neutral-100">Training Plans</Text>
          </Pressable>
        </View>

        <View className="px-5 pt-3">
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#18181B] px-4 py-3"
            onPress={() => router.push('/exercise' as never)}
          >
            <MaterialIcons name="fitness-center" size={20} color="#DBB8FF" />
            <Text className="text-sm font-semibold text-neutral-100">Exercise Library</Text>
          </Pressable>
        </View>

        <View className="px-5 pt-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Recent Activity</Text>
            <Pressable onPress={() => router.push('/exercises' as never)}>
              <Text className="text-sm font-semibold text-[#DBB8FF]">View All</Text>
            </Pressable>
          </View>

          {recentActivity.length === 0 ? (
            <View className="rounded-2xl border border-white/10 bg-[#1B1B1F] p-4">
              <Text className="text-sm text-neutral-300">No workouts yet. Start your first session.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {recentActivity.map((workout) => {
                const syncMeta = getSyncMeta(workout.syncStatus);

                return (
                  <Pressable
                    key={workout.id}
                    className="rounded-2xl border border-white/10 bg-[#1B1B1F] p-4"
                    onPress={() =>
                      router.push({ pathname: '/workout/[id]', params: { id: workout.id } } as never)
                    }
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1">
                          <Text className="text-lg font-bold text-white">{workout.name?.trim() || 'Workout Session'}</Text>
                        <Text className="mt-1 text-sm text-neutral-300">
                          {workout.exerciseCount} exercise{workout.exerciseCount === 1 ? '' : 's'} • {formatCompactDate(workout.date)}
                        </Text>
                      </View>
                      <SyncStatusChip status={syncMeta.status} label={syncMeta.label} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

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
