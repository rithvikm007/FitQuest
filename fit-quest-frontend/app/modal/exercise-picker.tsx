import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Input } from '@/components/common/Input';
import { getExercises, searchExercises } from '@/services/db/exerciseDbService';
import type { Exercise } from '@/types/models';

const EXERCISE_PICKER_SELECTION_KEY = '@fitquest_exercise_picker_selection';

export default function ExercisePickerModalScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    const loadExercises = async () => {
      try {
        setIsLoading(true);
        const trimmedQuery = query.trim();
        const rows = trimmedQuery ? await searchExercises(trimmedQuery) : await getExercises();
        setExercises(rows);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadExercises();
  }, [query]);

  const handleSelectExercise = async (exerciseId: string) => {
    try {
      await AsyncStorage.setItem(
        EXERCISE_PICKER_SELECTION_KEY,
        JSON.stringify({ exerciseId, selectedAt: Date.now() })
      );
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  return (
    <View className="flex-1 bg-neutral-950 px-4 pt-6">
      <Stack.Screen options={{ title: 'Pick Exercise' }} />

      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-white">Exercise Picker</Text>
        <Pressable className="rounded-lg bg-neutral-800 px-3 py-2" onPress={() => router.back()}>
          <Text className="font-semibold text-white">Close</Text>
        </Pressable>
      </View>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises"
        autoCapitalize="none"
      />

      {error ? <Text className="mt-3 text-sm text-red-400">{error}</Text> : null}

      <ScrollView className="mt-3" contentContainerClassName="gap-2 pb-8">
        {isLoading ? <Text className="text-sm text-neutral-300">Loading exercises...</Text> : null}

        {!isLoading && exercises.length === 0 ? (
          <Text className="text-sm text-neutral-300">No exercises found.</Text>
        ) : null}

        {exercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
            onPress={() => void handleSelectExercise(exercise.id)}
          >
            <Text className="text-sm font-semibold text-white">{exercise.name}</Text>
            <Text className="mt-1 text-xs capitalize text-neutral-400">
              {exercise.category} · {exercise.type}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
