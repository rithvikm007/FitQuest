import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useSync } from '@/contexts/SyncContext';
import { addToSyncQueue } from '@/services/db/syncQueueService';
import { deleteExercise, getExerciseById } from '@/services/db/exerciseDbService';
import type { Exercise } from '@/types/models';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getPendingChanges } = useSync();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExercise = async () => {
    if (!id) {
      setError('Missing exercise ID in route.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const loaded = await getExerciseById(id);
      setExercise(loaded);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExercise();
  }, [id]);

  const handleDeleteExercise = async () => {
    if (!exercise || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteExercise(exercise.id);
      await addToSyncQueue('exercise', exercise.id, 'delete', {
        id: exercise.id,
        remoteId: exercise.remoteId ?? null,
      });
      await getPendingChanges();
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete Exercise', 'Are you sure you want to delete this exercise?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDeleteExercise },
    ]);
  };

  const openVideoUrl = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      setError('Unable to open video URL.');
      return;
    }
    await Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-950">
        <LoadingSpinner />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-neutral-950 px-6">
        <Text className="text-xl font-bold text-white">Exercise Not Found</Text>
        <Text className="text-center text-sm text-neutral-300">
          {error ?? 'This exercise may have been deleted or does not exist.'}
        </Text>
        <Pressable className="rounded-xl bg-primary px-4 py-2" onPress={() => router.back()}>
          <Text className="font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerClassName="gap-4 px-4 pb-8 pt-5">
      <View className="flex-row items-center justify-between">
        <Pressable className="rounded-lg bg-neutral-900 px-3 py-2" onPress={() => router.back()}>
          <Text className="font-semibold text-white">Back</Text>
        </Pressable>

        {exercise.isCustom ? (
          <View className="flex-row gap-2">
            <Pressable
              className="rounded-lg bg-secondary px-3 py-2"
              onPress={() => router.push({ pathname: '/exercise/form', params: { id: exercise.id } } as never)}
            >
              <Text className="font-semibold text-white">Edit</Text>
            </Pressable>
            <Pressable
              className="rounded-lg bg-red-600 px-3 py-2"
              onPress={confirmDelete}
              disabled={isDeleting}
            >
              <Text className="font-semibold text-white">{isDeleting ? 'Deleting...' : 'Delete'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-2xl font-bold text-white">{exercise.name}</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <View className="rounded-full border border-secondary bg-secondary/30 px-3 py-1">
            <Text className="text-xs font-semibold capitalize text-white">{exercise.category}</Text>
          </View>
          <View className="rounded-full border border-primary bg-primary/30 px-3 py-1">
            <Text className="text-xs font-semibold capitalize text-white">{exercise.equipment}</Text>
          </View>
        </View>
      </View>

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Muscles</Text>
        <Text className="mt-2 text-sm text-white">Primary: {exercise.primaryMuscle}</Text>
        <Text className="mt-1 text-sm text-neutral-300">
          Other: {exercise.otherMuscles?.length ? exercise.otherMuscles.join(', ') : 'None'}
        </Text>
      </View>

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Type</Text>
        <Text className="mt-2 text-sm capitalize text-white">{exercise.type}</Text>
      </View>

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Description</Text>
        <Text className="mt-2 text-sm leading-6 text-neutral-200">{exercise.description || 'No description provided.'}</Text>
      </View>

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Instructions</Text>
        {exercise.instructions.length === 0 ? (
          <Text className="mt-2 text-sm text-neutral-300">No instructions provided.</Text>
        ) : (
          <View className="mt-2 gap-2">
            {exercise.instructions.map((instruction, index) => (
              <Text key={`${instruction}-${index}`} className="text-sm leading-6 text-neutral-200">
                {index + 1}. {instruction}
              </Text>
            ))}
          </View>
        )}
      </View>

      {exercise.videoUrl ? (
        <Pressable
          className="rounded-2xl border border-primary bg-primary/20 p-4"
          onPress={() => openVideoUrl(exercise.videoUrl!)}
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-primary">Video</Text>
          <Text className="mt-2 text-sm text-white">Open Exercise Video</Text>
          <Text className="mt-1 text-xs text-neutral-300" numberOfLines={1}>
            {exercise.videoUrl}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
