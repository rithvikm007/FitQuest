import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SyncStatusChip } from '@/components/common/SyncStatusChip';
import { useSync } from '@/contexts/SyncContext';
import { getExercises } from '@/services/db/exerciseDbService';
import type { Exercise } from '@/types/models';

function getSyncBadge(status: Exercise['syncStatus']): { label: 'SYNCED' | 'FAILED' | 'PENDING'; status: 'synced' | 'failed' | 'pending' } {
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

export default function ExerciseLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingCount } = useSync();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const loadExercises = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const items = await getExercises();
      setExercises(items);
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
      void loadExercises(false);
    }, [loadExercises])
  );

  const filteredExercises = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return exercises;
    }

    return exercises.filter((item) => {
      const inName = item.name.toLowerCase().includes(query);
      const inDescription = (item.description ?? '').toLowerCase().includes(query);
      return inName || inDescription;
    });
  }, [exercises, searchText]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
      <View className="bg-[#2A2A2D]/90 px-5 pb-4 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Exercise Library</Text>
          <View className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5">
            <Text className="text-xs font-semibold text-violet-200">{pendingCount} Pending</Text>
          </View>
        </View>
        <Text className="mt-2 text-sm text-neutral-400">Create and manage custom exercises.</Text>
      </View>

      {error ? <Text className="px-5 pt-2 text-sm text-red-300">{error}</Text> : null}

      <View className="flex-row items-center gap-3 px-5 pt-4">
        <View className="flex-1 rounded-2xl border border-white/10 bg-[#1D1D20] px-4 py-3">
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search exercises..."
            placeholderTextColor="#71717A"
            className="text-base text-white"
          />
        </View>
        <Pressable
          className="h-12 items-center justify-center rounded-2xl border border-[#7A3BFF] bg-[#1A1624] px-4"
          onPress={() => router.push('/exercise/form' as never)}
        >
          <MaterialIcons name="add" size={22} color="#DBB8FF" />
        </Pressable>
      </View>

      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 + insets.bottom, paddingTop: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadExercises(true)} tintColor="#A556FB" />}
        ListEmptyComponent={
          <View className="rounded-2xl border border-white/10 bg-[#1B1B1F] p-4">
            <Text className="text-sm text-neutral-300">No exercises found. Add your first one.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const syncBadge = getSyncBadge(item.syncStatus);
          const customLabel = item.isCustom ? 'Custom' : 'Built-in';

          return (
            <Pressable
              className="rounded-2xl border border-white/10 bg-[#1B1B1F] p-4"
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } } as never)}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-white">{item.name}</Text>
                  <Text className="mt-1 text-sm text-neutral-300 capitalize">
                    {item.category} • {item.equipment}
                  </Text>
                </View>

                <View className="items-end gap-2">
                  <SyncStatusChip status={syncBadge.status} label={syncBadge.label} />
                  <View className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-neutral-300">{customLabel}</Text>
                  </View>
                </View>
              </View>

              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-sm text-neutral-400 capitalize">Type: {item.type}</Text>
                {item.isCustom ? (
                  <Pressable
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5"
                    onPress={() => router.push({ pathname: '/exercise/form', params: { id: item.id } } as never)}
                  >
                    <Text className="text-xs font-semibold text-neutral-100">Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        className="absolute right-6 h-16 w-16 items-center justify-center rounded-full bg-[#7A3BFF]"
        style={{ bottom: Math.max(insets.bottom, 8) + 16 }}
        onPress={() => router.push('/exercise/form' as never)}
      >
        <MaterialIcons name="add" size={30} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}
