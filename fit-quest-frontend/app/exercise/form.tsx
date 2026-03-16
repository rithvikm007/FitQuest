import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { getExerciseById, saveExercise } from '@/services/db/exerciseDbService';
import { addToSyncQueue } from '@/services/db/syncQueueService';
import type { Equipment, Exercise, ExerciseCategory, ExerciseType, PrimaryMuscle } from '@/types/models';

const CATEGORY_OPTIONS: ExerciseCategory[] = [
  'chest',
  'back',
  'shoulders',
  'legs',
  'arms',
  'core',
  'cardio',
  'full body',
];

const PRIMARY_MUSCLE_OPTIONS: PrimaryMuscle[] = [
  'chest',
  'back',
  'quadriceps',
  'hamstrings',
  'glutes',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'calves',
  'forearms',
  'full body',
  'other',
];

const TYPE_OPTIONS: ExerciseType[] = [
  'weight and reps',
  'bodyweight reps',
  'weighted bodyweight',
  'assisted bodyweight',
  'duration',
  'duration and weight',
  'distance and duration',
  'weight and distance',
];

const EQUIPMENT_OPTIONS: Equipment[] = [
  'body weight',
  'dumbbell',
  'barbell',
  'machine',
  'cable',
  'kettlebell',
  'resistance band',
  'band',
  'medicine ball',
  'stability ball',
  'other',
];

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

function SelectorChips<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-300">{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              className={`rounded-full border px-3 py-2 ${selected ? 'border-primary bg-primary' : 'border-neutral-700 bg-neutral-900'}`}
              onPress={() => onChange(option)}
            >
              <Text className={`text-xs font-semibold capitalize ${selected ? 'text-white' : 'text-neutral-200'}`}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ExerciseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getPendingChanges } = useSync();

  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('chest');
  const [primaryMuscle, setPrimaryMuscle] = useState<PrimaryMuscle>('chest');
  const [type, setType] = useState<ExerciseType>('weight and reps');
  const [equipment, setEquipment] = useState<Equipment>('body weight');
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [existingExercise, setExistingExercise] = useState<Exercise | null>(null);

  const isEditMode = useMemo(() => Boolean(id), [id]);

  useEffect(() => {
    const loadExercise = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      try {
        const exercise = await getExerciseById(id);

        if (!exercise) {
          setError('Exercise not found.');
          return;
        }

        setExistingExercise(exercise);
        setName(exercise.name);
        setDescription(exercise.description ?? '');
        setVideoUrl(exercise.videoUrl ?? '');
        setCategory(exercise.category);
        setPrimaryMuscle(exercise.primaryMuscle);
        setType(exercise.type);
        setEquipment(exercise.equipment);
        setInstructions(exercise.instructions.length ? exercise.instructions : ['']);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadExercise();
  }, [id]);

  const updateInstruction = (index: number, value: string) => {
    setInstructions((current) => current.map((item, i) => (i === index ? value : item)));
  };

  const removeInstruction = (index: number) => {
    setInstructions((current) => {
      if (current.length === 1) {
        return [''];
      }
      return current.filter((_, i) => i !== index);
    });
  };

  const addInstruction = () => {
    setInstructions((current) => [...current, '']);
  };

  const validateForm = () => {
    if (!name.trim()) {
      return 'Exercise name is required.';
    }

    const cleanedInstructions = instructions.map((item) => item.trim()).filter(Boolean);
    if (cleanedInstructions.length === 0) {
      return 'At least one instruction step is required.';
    }

    return null;
  };

  const onSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const cleanedInstructions = instructions.map((item) => item.trim()).filter(Boolean);

      const payload: Exercise = {
        id: existingExercise?.id ?? generateUuid(),
        remoteId: existingExercise?.remoteId,
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        primaryMuscle,
        otherMuscles: existingExercise?.otherMuscles ?? [],
        type,
        equipment,
        instructions: cleanedInstructions,
        videoUrl: videoUrl.trim() || undefined,
        isCustom: existingExercise?.isCustom ?? true,
        userId: existingExercise?.userId ?? user?.id,
        isDeleted: false,
        syncStatus: 'pending',
        createdAt: existingExercise?.createdAt ?? now,
        updatedAt: now,
      };

      const savedExerciseId = await saveExercise(payload);
      const operation = existingExercise ? 'update' : 'create';

      await addToSyncQueue('exercise', savedExerciseId, operation, {
        ...payload,
        id: savedExerciseId,
        remoteId: payload.remoteId ?? null,
      });

      await getPendingChanges();
      router.replace('/(tabs)/exercises' as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <Text className="text-neutral-200">Loading exercise...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerClassName="gap-4 px-4 pb-8 pt-5">
      <View className="gap-1">
        <Text className="text-3xl font-bold text-white">{isEditMode ? 'Edit Exercise' : 'Create Exercise'}</Text>
        <Text className="text-sm text-neutral-300">
          {isEditMode ? 'Update your custom exercise details.' : 'Add a custom exercise to your library.'}
        </Text>
      </View>

      {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

      <Input label="Name" value={name} onChangeText={setName} placeholder="Exercise name" />

      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the movement"
        multiline
      />

      <SelectorChips title="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />

      <SelectorChips
        title="Primary Muscle"
        options={PRIMARY_MUSCLE_OPTIONS}
        value={primaryMuscle}
        onChange={setPrimaryMuscle}
      />

      <SelectorChips title="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />

      <SelectorChips title="Equipment" options={EQUIPMENT_OPTIONS} value={equipment} onChange={setEquipment} />

      <Input
        label="Video URL (optional)"
        value={videoUrl}
        onChangeText={setVideoUrl}
        placeholder="https://..."
        autoCapitalize="none"
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-neutral-300">Instructions</Text>
        {instructions.map((instruction, index) => (
          <View key={`instruction-${index}`} className="flex-row items-start gap-2">
            <View className="flex-1">
              <Input
                value={instruction}
                onChangeText={(value) => updateInstruction(index, value)}
                placeholder={`Step ${index + 1}`}
              />
            </View>
            <Pressable
              className="mt-6 rounded-lg bg-red-600 px-3 py-2"
              onPress={() => removeInstruction(index)}
            >
              <Text className="text-xs font-semibold text-white">Remove</Text>
            </Pressable>
          </View>
        ))}

        <Pressable className="self-start rounded-lg bg-neutral-800 px-3 py-2" onPress={addInstruction}>
          <Text className="text-sm font-semibold text-white">Add Step</Text>
        </Pressable>
      </View>

      <View className="mt-2 gap-3">
        <Button
          title={isSaving ? 'Saving...' : 'Save Exercise'}
          onPress={onSave}
          loading={isSaving}
          disabled={isSaving}
        />
        <Button title="Cancel" variant="outline" onPress={() => router.back()} disabled={isSaving} />
      </View>
    </ScrollView>
  );
}
