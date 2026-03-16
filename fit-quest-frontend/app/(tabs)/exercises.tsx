import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedAlertModal } from '@/components/common/ThemedAlertModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SyncStatusChip } from '@/components/common/SyncStatusChip';
import { useSync } from '@/contexts/SyncContext';
import { getWorkoutById, getWorkouts } from '@/services/db/workoutDbService';
import type { SyncStatus, Workout } from '@/types/models';

type WorkoutListItem = Workout & {
  exerciseCount: number;
};

function formatWorkoutDate(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getSyncBadge(status: SyncStatus): { label: 'SYNCED' | 'FAILED' | 'PENDING'; status: 'synced' | 'failed' | 'pending' } {
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

export default function WorkoutsScreen() {
  const router = useRouter();
  const { sync, pendingCount } = useSync();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [alertState, setAlertState] = useState<{ title: string; message: string; tone: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const loadWorkouts = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const baseWorkouts = await getWorkouts(1, 60);
      const withExerciseCount = await Promise.all(
        baseWorkouts.map(async (workout) => {
          const detail = await getWorkoutById(workout.id);
          return {
            ...workout,
            exerciseCount: detail?.exercises.length ?? 0,
          };
        })
      );

      setWorkouts(withExerciseCount);
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
      void loadWorkouts(false);
    }, [loadWorkouts])
  );

  const onRefresh = async () => {
    await loadWorkouts(true);
  };

  const handleSync = useCallback(async () => {
    try {
      const summary = await sync();
      await loadWorkouts(true);

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
  }, [loadWorkouts, sync]);

  const filteredWorkouts = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return workouts;
    }

    return workouts.filter((item) => (item.name?.toLowerCase() ?? '').includes(query));
  }, [searchText, workouts]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
      <View className="bg-[#0B0B0D] px-5 pb-4 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">History</Text>
          <Pressable
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5"
            onPress={() => void handleSync()}
          >
            <Text className="text-xs font-semibold text-[#DBB8FF]">{pendingCount} Pending</Text>
          </Pressable>
        </View>
        <Text className="mt-2 text-sm uppercase tracking-[2px] text-neutral-400">Tracking your kinetic progress</Text>
      </View>

      {error ? <Text className="px-5 pt-2 text-sm text-red-300">{error}</Text> : null}

      <View className="flex-row items-center gap-3 px-5 pt-4">
        <View className="flex-1 rounded-2xl border border-white/10 bg-[#1D1D20] px-4 py-3">
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search workouts..."
            placeholderTextColor="#71717A"
            className="text-base text-white"
          />
        </View>
        <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#1D1D20]">
          <Text className="text-lg text-[#DBB8FF]">☷</Text>
        </View>
      </View>

      <FlatList
        data={filteredWorkouts}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 + insets.bottom, paddingTop: 16, gap: 14 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#A556FB" />}
        ListEmptyComponent={
          <View className="rounded-3xl border border-white/10 bg-[#1B1B1F] p-5">
            <Text className="text-sm text-neutral-300">No workouts found.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const syncBadge = getSyncBadge(item.syncStatus);

          return (
            <Pressable
              className="rounded-3xl border border-white/10 bg-[#1B1B1F] p-5"
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } } as never)}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-white">{item.name?.trim() || 'Workout Session'}</Text>
                  <Text className="mt-1 text-sm uppercase tracking-[1px] text-neutral-400">{formatWorkoutDate(item.date)}</Text>
                </View>

                <SyncStatusChip status={syncBadge.status} label={syncBadge.label} />
              </View>

              <View className="mt-6 flex-row items-center justify-between">
                <Text className="text-base font-semibold text-neutral-100">
                  {item.exerciseCount} exercise{item.exerciseCount === 1 ? '' : 's'}
                </Text>
                {item.syncStatus === 'failed' ? <Text className="text-xs font-semibold text-red-300">Needs next sync</Text> : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        className="absolute right-6 h-16 w-16 items-center justify-center rounded-full bg-[#7A3BFF]"
        style={{ bottom: Math.max(insets.bottom, 8) + 16 }}
        onPress={() => router.push('/workout/form' as never)}
      >
        <Text className="text-3xl leading-none text-white">+</Text>
      </Pressable>

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
