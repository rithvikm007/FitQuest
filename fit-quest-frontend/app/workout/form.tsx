import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { getExerciseById } from '@/services/db/exerciseDbService';
import { getPlanById } from '@/services/db/planDbService';
import { addToSyncQueue } from '@/services/db/syncQueueService';
import { getWorkoutById, saveWorkout } from '@/services/db/workoutDbService';
import type { Exercise, ExerciseType, Workout, WorkoutExercise, WorkoutSet } from '@/types/models';

const EXERCISE_PICKER_SELECTION_KEY = '@fitquest_exercise_picker_selection';

type TableColumn = 'reps' | 'weight' | 'duration' | 'distance';

type DraftSet = {
  id: string;
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  notes: string;
};

type DraftExercise = {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  sets: DraftSet[];
};

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

function createEmptyDraftSet(): DraftSet {
  return {
    id: generateUuid(),
    reps: '',
    weight: '',
    duration: '',
    distance: '',
    notes: '',
  };
}

function formatDateForDisplay(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return date.toISOString().slice(0, 10);
}

function parseDateInputToIso(dateInput: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return null;
  }

  const parsedDate = new Date(`${dateInput.trim()}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return numeric;
}

export default function WorkoutFormScreen() {
  const { id, workoutId, planId } = useLocalSearchParams<{
    id?: string;
    workoutId?: string;
    planId?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getPendingChanges } = useSync();

  const resolvedWorkoutId = id ?? workoutId;
  const isEditMode = Boolean(resolvedWorkoutId);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingWorkout, setExistingWorkout] = useState<Workout | null>(null);
  const [sourcePlanId, setSourcePlanId] = useState<string | undefined>(undefined);
  const [sourcePlanRemoteId, setSourcePlanRemoteId] = useState<string | undefined>(undefined);

  const [workoutDateInput, setWorkoutDateInput] = useState(formatDateForDisplay(new Date().toISOString()));
  const [workoutName, setWorkoutName] = useState('');
  const [notes, setNotes] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);

        if (resolvedWorkoutId) {
          const fullWorkout = await getWorkoutById(resolvedWorkoutId);

          if (!fullWorkout) {
            setError('Workout not found.');
            return;
          }

          setExistingWorkout(fullWorkout);
          setWorkoutDateInput(formatDateForDisplay(fullWorkout.date));
          setWorkoutName(fullWorkout.name ?? '');
          setNotes(fullWorkout.notes ?? '');
          setSourcePlanId(fullWorkout.sourcePlanId);
          setSourcePlanRemoteId(fullWorkout.sourcePlanRemoteId);
          setDraftExercises(
            fullWorkout.exercises.map((entry) => ({
              id: generateUuid(),
              exerciseId: entry.exerciseId,
              exercise: entry.exercise,
              sets: entry.sets.length
                ? entry.sets.map((setRow) => ({
                    id: generateUuid(),
                    reps: setRow.reps !== undefined ? String(setRow.reps) : '',
                    weight: setRow.weight !== undefined ? String(setRow.weight) : '',
                    duration: setRow.duration !== undefined ? String(setRow.duration) : '',
                    distance: setRow.distance !== undefined ? String(setRow.distance) : '',
                    notes: setRow.notes ?? '',
                  }))
                : [createEmptyDraftSet()],
            }))
          );

          return;
        }

        if (planId) {
          const plan = await getPlanById(planId);

          if (plan) {
            setWorkoutName(plan.name || 'Workout');
            setSourcePlanId(plan.id);
            setSourcePlanRemoteId(plan.remoteId);
            setDraftExercises(
              plan.exercises.map((entry) => ({
                id: generateUuid(),
                exerciseId: entry.exerciseId,
                exercise: entry.exercise,
                sets: entry.sets.length
                  ? entry.sets.map((setRow) => ({
                      id: generateUuid(),
                      reps: setRow.reps !== undefined ? String(setRow.reps) : '',
                      weight: setRow.weight !== undefined ? String(setRow.weight) : '',
                      duration: setRow.duration !== undefined ? String(setRow.duration) : '',
                      distance: setRow.distance !== undefined ? String(setRow.distance) : '',
                      notes: setRow.notes ?? '',
                    }))
                  : [createEmptyDraftSet()],
              }))
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialData();
  }, [planId, resolvedWorkoutId]);

  const selectedExerciseIds = useMemo(
    () => new Set(draftExercises.map((item) => item.exerciseId)),
    [draftExercises]
  );

  const addExerciseToDraft = async (exerciseId: string) => {
    if (selectedExerciseIds.has(exerciseId)) {
      setError('That exercise is already added to this workout.');
      return;
    }

    try {
      const exercise = await getExerciseById(exerciseId);
      if (!exercise) {
        setError('Selected exercise no longer exists.');
        return;
      }

      setDraftExercises((current) => [
        ...current,
        {
          id: generateUuid(),
          exerciseId: exercise.id,
          exercise,
          sets: [createEmptyDraftSet()],
        },
      ]);

      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  useFocusEffect(
    useMemo(
      () =>
        () => {
          const consumeSelection = async () => {
            try {
              const rawSelection = await AsyncStorage.getItem(EXERCISE_PICKER_SELECTION_KEY);
              if (!rawSelection) {
                return;
              }

              await AsyncStorage.removeItem(EXERCISE_PICKER_SELECTION_KEY);

              const parsed = JSON.parse(rawSelection) as { exerciseId?: string };
              if (!parsed.exerciseId) {
                return;
              }

              await addExerciseToDraft(parsed.exerciseId);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setError(message);
            }
          };

          void consumeSelection();
        },
      [addExerciseToDraft]
    )
  );

  const removeExerciseFromDraft = (draftExerciseId: string) => {
    setDraftExercises((current) => current.filter((item) => item.id !== draftExerciseId));
  };

  const addSetToExercise = (draftExerciseId: string) => {
    setDraftExercises((current) =>
      current.map((item) =>
        item.id === draftExerciseId ? { ...item, sets: [...item.sets, createEmptyDraftSet()] } : item
      )
    );
  };

  const removeSetFromExercise = (draftExerciseId: string, draftSetId: string) => {
    setDraftExercises((current) =>
      current.map((item) => {
        if (item.id !== draftExerciseId) {
          return item;
        }

        const nextSets = item.sets.filter((set) => set.id !== draftSetId);
        return {
          ...item,
          sets: nextSets.length ? nextSets : [createEmptyDraftSet()],
        };
      })
    );
  };

  const updateSetField = (
    draftExerciseId: string,
    draftSetId: string,
    field: keyof DraftSet,
    value: string
  ) => {
    setDraftExercises((current) =>
      current.map((item) => {
        if (item.id !== draftExerciseId) {
          return item;
        }

        return {
          ...item,
          sets: item.sets.map((setItem) =>
            setItem.id === draftSetId ? { ...setItem, [field]: value } : setItem
          ),
        };
      })
    );
  };

  const validateForm = (): string | null => {
    const parsedDate = parseDateInputToIso(workoutDateInput);
    if (!parsedDate) {
      return 'Date must be in YYYY-MM-DD format.';
    }

    if (draftExercises.length === 0) {
      return 'Add at least one exercise.';
    }

    for (const draftExercise of draftExercises) {
      if (draftExercise.sets.length === 0) {
        return `Add at least one set for ${draftExercise.exercise.name}.`;
      }

      const columns = getColumnsForExerciseType(draftExercise.exercise.type);
      for (const draftSet of draftExercise.sets) {
        const hasAnyMetric = columns.some((column) => {
          if (column === 'reps') return Boolean(draftSet.reps.trim());
          if (column === 'weight') return Boolean(draftSet.weight.trim());
          if (column === 'duration') return Boolean(draftSet.duration.trim());
          return Boolean(draftSet.distance.trim());
        });

        if (!hasAnyMetric) {
          return `Each set for ${draftExercise.exercise.name} must have at least one value.`;
        }
      }
    }

    return null;
  };

  const onSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const parsedDateIso = parseDateInputToIso(workoutDateInput);
    if (!parsedDateIso) {
      setError('Date must be in YYYY-MM-DD format.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const resolvedWorkoutId = existingWorkout?.id ?? generateUuid();
      const resolvedUserId = existingWorkout?.userId ?? user?.id;

      if (!resolvedUserId) {
        throw new Error('Cannot save workout because no authenticated user is available.');
      }

      const workoutPayload: Workout = {
        id: resolvedWorkoutId,
        remoteId: existingWorkout?.remoteId,
        userId: resolvedUserId,
        date: parsedDateIso,
        name: workoutName.trim() || undefined,
        notes: notes.trim() || undefined,
        sourcePlanId,
        sourcePlanRemoteId,
        isDeleted: false,
        syncStatus: 'pending',
        createdAt: existingWorkout?.createdAt ?? now,
        updatedAt: now,
      };

      const workoutExercises: WorkoutExercise[] = [];
      const workoutSets: WorkoutSet[] = [];

      draftExercises.forEach((draftExercise, exerciseIndex) => {
        const workoutExerciseId = generateUuid();

        workoutExercises.push({
          id: workoutExerciseId,
          workoutId: resolvedWorkoutId,
          exerciseId: draftExercise.exerciseId,
          orderIndex: exerciseIndex,
          createdAt: now,
        });

        draftExercise.sets.forEach((draftSet, setIndex) => {
          workoutSets.push({
            id: generateUuid(),
            workoutExerciseId,
            reps: toOptionalNumber(draftSet.reps),
            weight: toOptionalNumber(draftSet.weight),
            duration: toOptionalNumber(draftSet.duration),
            distance: toOptionalNumber(draftSet.distance),
            notes: draftSet.notes.trim() || undefined,
            orderIndex: setIndex,
            createdAt: now,
          });
        });
      });

      const savedWorkoutId = await saveWorkout(workoutPayload, workoutExercises, workoutSets);
      const operation = existingWorkout ? 'update' : 'create';

      await addToSyncQueue('workout', savedWorkoutId, operation, {
        ...workoutPayload,
        id: savedWorkoutId,
        remoteId: workoutPayload.remoteId ?? null,
        exercises: workoutExercises,
        sets: workoutSets,
      });

      await getPendingChanges();
      router.replace({ pathname: '/workout/[id]', params: { id: savedWorkoutId } } as never);
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
        <Text className="text-neutral-200">Loading workout form...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ title: isEditMode ? 'Edit Workout' : 'New Workout' }} />

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-8 pt-5">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-white">{isEditMode ? 'Edit Workout' : 'New Workout'}</Text>
          <Text className="text-sm text-neutral-300">
            {planId && !isEditMode
              ? 'Pre-filled from plan. Adjust details and save.'
              : 'Log exercises, sets, and notes for this workout.'}
          </Text>
        </View>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Input
          label="Date (YYYY-MM-DD)"
          value={workoutDateInput}
          onChangeText={setWorkoutDateInput}
          placeholder="2026-03-15"
          autoCapitalize="none"
        />

        <Input
          label="Workout Name (optional)"
          value={workoutName}
          onChangeText={setWorkoutName}
          placeholder="Push Day"
        />

        <Input
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it feel?"
          multiline
        />

        <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-white">Exercises</Text>
            <Pressable
              className="rounded-lg bg-primary px-3 py-2"
              onPress={() => {
                setError(null);
                router.push('/modal/exercise-picker' as never);
              }}
            >
              <Text className="text-sm font-semibold text-white">Add Exercise</Text>
            </Pressable>
          </View>

          {draftExercises.length === 0 ? (
            <Text className="text-sm text-neutral-300">No exercises added yet.</Text>
          ) : (
            <View className="gap-4">
              {draftExercises.map((draftExercise) => {
                const columns = getColumnsForExerciseType(draftExercise.exercise.type);

                return (
                  <View key={draftExercise.id} className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="text-base font-semibold text-white">{draftExercise.exercise.name}</Text>
                        <Text className="text-xs capitalize text-neutral-400">{draftExercise.exercise.type}</Text>
                      </View>
                      <Pressable
                        className="rounded-lg bg-red-600 px-3 py-1.5"
                        onPress={() => removeExerciseFromDraft(draftExercise.id)}
                      >
                        <Text className="text-xs font-semibold text-white">Remove</Text>
                      </Pressable>
                    </View>

                    <View className="mt-3 gap-3">
                      {draftExercise.sets.map((draftSet, setIndex) => (
                        <View key={draftSet.id} className="rounded-lg border border-neutral-700 bg-neutral-900 p-3">
                          <View className="mb-2 flex-row items-center justify-between">
                            <Text className="text-sm font-semibold text-white">Set {setIndex + 1}</Text>
                            <Pressable
                              className="rounded bg-neutral-800 px-2 py-1"
                              onPress={() => removeSetFromExercise(draftExercise.id, draftSet.id)}
                            >
                              <Text className="text-xs text-neutral-200">Remove</Text>
                            </Pressable>
                          </View>

                          <View className="gap-2">
                            {columns.includes('reps') ? (
                              <Input
                                label="Reps"
                                value={draftSet.reps}
                                onChangeText={(value) =>
                                  updateSetField(draftExercise.id, draftSet.id, 'reps', value)
                                }
                                keyboardType="numeric"
                                placeholder="e.g. 10"
                              />
                            ) : null}

                            {columns.includes('weight') ? (
                              <Input
                                label="Weight"
                                value={draftSet.weight}
                                onChangeText={(value) =>
                                  updateSetField(draftExercise.id, draftSet.id, 'weight', value)
                                }
                                keyboardType="numeric"
                                placeholder="e.g. 60"
                              />
                            ) : null}

                            {columns.includes('duration') ? (
                              <Input
                                label="Duration (seconds)"
                                value={draftSet.duration}
                                onChangeText={(value) =>
                                  updateSetField(draftExercise.id, draftSet.id, 'duration', value)
                                }
                                keyboardType="numeric"
                                placeholder="e.g. 45"
                              />
                            ) : null}

                            {columns.includes('distance') ? (
                              <Input
                                label="Distance"
                                value={draftSet.distance}
                                onChangeText={(value) =>
                                  updateSetField(draftExercise.id, draftSet.id, 'distance', value)
                                }
                                keyboardType="numeric"
                                placeholder="e.g. 1000"
                              />
                            ) : null}

                            <Input
                              label="Set Notes (optional)"
                              value={draftSet.notes}
                              onChangeText={(value) =>
                                updateSetField(draftExercise.id, draftSet.id, 'notes', value)
                              }
                              placeholder="Optional notes"
                            />
                          </View>
                        </View>
                      ))}
                    </View>

                    <Pressable
                      className="mt-3 self-start rounded-lg bg-neutral-800 px-3 py-2"
                      onPress={() => addSetToExercise(draftExercise.id)}
                    >
                      <Text className="text-sm font-semibold text-white">Add Set</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View className="gap-3">
          <Button
            title={isSaving ? 'Saving...' : 'Save Workout'}
            onPress={onSave}
            loading={isSaving}
            disabled={isSaving}
          />
          <Button title="Cancel" variant="outline" onPress={() => router.back()} disabled={isSaving} />
        </View>
      </ScrollView>
    </View>
  );
}
