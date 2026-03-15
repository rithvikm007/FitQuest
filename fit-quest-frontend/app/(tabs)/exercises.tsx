import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Input } from '@/components/common/Input';
import { useSync } from '@/contexts/SyncContext';
import { getExercises } from '@/services/db/exerciseDbService';
import type { Equipment, Exercise, ExerciseCategory } from '@/types/models';

const CATEGORY_FILTERS: Array<{ label: string; value: ExerciseCategory | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Legs', value: 'legs' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
  { label: 'Cardio', value: 'cardio' },
];

function getEquipmentIconName(equipment: Equipment): keyof typeof Ionicons.glyphMap {
  switch (equipment) {
    case 'barbell':
    case 'olympic barbell':
    case 'smith machine':
      return 'barbell-outline';
    case 'dumbbell':
    case 'kettlebell':
    case 'weight plate':
      return 'fitness-outline';
    case 'band':
    case 'resistance band':
    case 'rope':
      return 'git-branch-outline';
    case 'body weight':
      return 'body-outline';
    case 'machine':
    case 'cable':
      return 'hardware-chip-outline';
    case 'medicine ball':
    case 'stability ball':
      return 'american-football-outline';
    case 'step':
      return 'trail-sign-outline';
    case 'sled':
    case 'tire':
      return 'car-sport-outline';
    default:
      return 'barbell-outline';
  }
}

export default function ExercisesScreen() {
  const router = useRouter();
  const { sync } = useSync();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadExercises = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const loadedExercises = await getExercises();
      setExercises(loadedExercises);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const filteredExercises = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const categoryMatches = selectedCategory === 'all' || exercise.category === selectedCategory;
      const searchMatches =
        !normalizedQuery ||
        exercise.name.toLowerCase().includes(normalizedQuery) ||
        (exercise.description ?? '').toLowerCase().includes(normalizedQuery);

      return categoryMatches && searchMatches;
    });
  }, [exercises, searchQuery, selectedCategory]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await sync();
    } catch {
      // Keep local reload behavior even if remote sync fails.
    } finally {
      await loadExercises(true);
    }
  };

  return (
    <View className="flex-1 bg-neutral-950">
      <View className="gap-3 px-4 pb-2 pt-5">
        <Text className="text-3xl font-bold text-white">Exercises</Text>

        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exercises"
          autoCapitalize="none"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
          <View className="flex-row gap-2 px-1">
            {CATEGORY_FILTERS.map((filter) => {
              const isActive = filter.value === selectedCategory;
              return (
                <Pressable
                  key={filter.value}
                  className={`rounded-full border px-3 py-2 ${isActive ? 'border-primary bg-primary' : 'border-neutral-700 bg-neutral-900'}`}
                  onPress={() => setSelectedCategory(filter.value)}
                >
                  <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-neutral-200'}`}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}
      </View>

      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#A556FB" />}
        ListEmptyComponent={
          <View className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <Text className="text-sm text-neutral-200">
              {isLoading ? 'Loading exercises...' : 'No exercises found. Pull to refresh.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            className="mb-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
            onPress={() =>
              router.push({ pathname: '/exercise/[id]', params: { id: item.id } } as never)
            }
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">{item.name}</Text>
                <Text className="mt-1 text-sm text-neutral-300" numberOfLines={2}>
                  {item.description || 'No description'}
                </Text>
              </View>

              <Ionicons name={getEquipmentIconName(item.equipment)} size={22} color="#A556FB" />
            </View>

            <View className="mt-3 self-start rounded-full border border-secondary bg-secondary/30 px-3 py-1">
              <Text className="text-xs font-semibold capitalize text-white">{item.category}</Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary"
        onPress={() => router.push({ pathname: '/exercise/form' } as never)}
      >
        <Text className="text-3xl font-semibold leading-none text-white">+</Text>
      </Pressable>
    </View>
  );
}
