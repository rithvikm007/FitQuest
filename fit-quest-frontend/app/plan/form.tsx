import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/common/Input';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { getExerciseById } from '@/services/db/exerciseDbService';
import { getPlanById, savePlan } from '@/services/db/planDbService';
import { addToSyncQueue } from '@/services/db/syncQueueService';
import type { Exercise, ExerciseType, Plan, PlanExercise, PlanSet, WeightUnit } from '@/types/models';

const EXERCISE_PICKER_SELECTION_KEY = '@fitquest_exercise_picker_selection';

type TableColumn = 'reps' | 'weight' | 'duration' | 'distance';

type DraftSetSegment = {
  id: string;
  reps: string;
  weight: string;
  weightUnit: WeightUnit;
  duration: string;
  distance: string;
};

type DraftSet = {
  id: string;
  segments: DraftSetSegment[];
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

function createEmptyDraftSetSegment(): DraftSetSegment {
  return {
    id: generateUuid(),
    reps: '',
    weight: '',
    weightUnit: 'kg',
    duration: '',
    distance: '',
  };
}

function createEmptyDraftSet(): DraftSet {
  return {
    id: generateUuid(),
    segments: [createEmptyDraftSetSegment()],
    notes: '',
  };
}

function normalizeWeightUnit(unit: string | undefined): WeightUnit {
  return unit === 'lb' ? 'lb' : 'kg';
}

function toWeightKg(weight: number | undefined, unit: WeightUnit): number | undefined {
  if (weight === undefined) {
    return undefined;
  }

  return unit === 'lb' ? weight * 0.45359237 : weight;
}

function formatDateForDisplay(dateIso?: string): string {
  if (!dateIso) {
    return '';
  }

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return date.toISOString().slice(0, 10);
}

function parseDateInputToIso(dateInput: string): string | null {
  const trimmed = dateInput.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsedDate = new Date(`${trimmed}T12:00:00`);
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

function toDraftSetFromPersistedSet(setRow: PlanSet): DraftSet {
  const persistedSegments = setRow.segments && setRow.segments.length > 0
    ? setRow.segments
    : [
        {
          reps: setRow.reps,
          weight: setRow.weight,
          weightUnit: setRow.weightUnit,
          duration: setRow.duration,
          distance: setRow.distance,
        },
      ];

  return {
    id: generateUuid(),
    segments: persistedSegments.map((segment) => ({
      id: generateUuid(),
      reps: segment.reps !== undefined ? String(segment.reps) : '',
      weight: segment.weight !== undefined ? String(segment.weight) : '',
      weightUnit: normalizeWeightUnit(segment.weightUnit),
      duration: segment.duration !== undefined ? String(segment.duration) : '',
      distance: segment.distance !== undefined ? String(segment.distance) : '',
    })),
    notes: setRow.notes ?? '',
  };
}

export default function PlanFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getPendingChanges } = useSync();

  const isEditMode = Boolean(id);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingPlan, setExistingPlan] = useState<Plan | null>(null);
  const [planName, setPlanName] = useState('');
  const [plannedDateInput, setPlannedDateInput] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);

        if (!id) {
          return;
        }

        const fullPlan = await getPlanById(id);
        if (!fullPlan) {
          setError('Plan not found.');
          return;
        }

        setExistingPlan(fullPlan);
        setPlanName(fullPlan.name);
        setPlannedDateInput(formatDateForDisplay(fullPlan.plannedDate));
        setDraftExercises(
          fullPlan.exercises.map((entry) => ({
            id: generateUuid(),
            exerciseId: entry.exerciseId,
            exercise: entry.exercise,
            sets: entry.sets.length
              ? entry.sets.map((setRow) => toDraftSetFromPersistedSet(setRow))
              : [createEmptyDraftSet()],
          }))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialData();
  }, [id]);

  const selectedExerciseIds = useMemo(
    () => new Set(draftExercises.map((item) => item.exerciseId)),
    [draftExercises]
  );

  const addExerciseToDraft = useCallback(
    async (exerciseId: string) => {
      if (selectedExerciseIds.has(exerciseId)) {
        setError('That exercise is already added to this plan.');
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
    },
    [selectedExerciseIds]
  );

  useFocusEffect(
    useCallback(() => {
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
    }, [addExerciseToDraft])
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
    field: 'notes',
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

  const addSegmentToSet = (draftExerciseId: string, draftSetId: string) => {
    setDraftExercises((current) =>
      current.map((item) => {
        if (item.id !== draftExerciseId) {
          return item;
        }

        return {
          ...item,
          sets: item.sets.map((setItem) =>
            setItem.id === draftSetId
              ? { ...setItem, segments: [...setItem.segments, createEmptyDraftSetSegment()] }
              : setItem
          ),
        };
      })
    );
  };

  const removeSegmentFromSet = (
    draftExerciseId: string,
    draftSetId: string,
    segmentId: string
  ) => {
    setDraftExercises((current) =>
      current.map((item) => {
        if (item.id !== draftExerciseId) {
          return item;
        }

        return {
          ...item,
          sets: item.sets.map((setItem) => {
            if (setItem.id !== draftSetId) {
              return setItem;
            }

            const nextSegments = setItem.segments.filter((segment) => segment.id !== segmentId);
            return {
              ...setItem,
              segments: nextSegments.length > 0 ? nextSegments : [createEmptyDraftSetSegment()],
            };
          }),
        };
      })
    );
  };

  const updateSegmentField = (
    draftExerciseId: string,
    draftSetId: string,
    segmentId: string,
    field: keyof DraftSetSegment,
    value: string
  ) => {
    setDraftExercises((current) =>
      current.map((item) => {
        if (item.id !== draftExerciseId) {
          return item;
        }

        return {
          ...item,
          sets: item.sets.map((setItem) => {
            if (setItem.id !== draftSetId) {
              return setItem;
            }

            return {
              ...setItem,
              segments: setItem.segments.map((segment) =>
                segment.id === segmentId ? { ...segment, [field]: value } : segment
              ),
            };
          }),
        };
      })
    );
  };

  const validateForm = (): string | null => {
    if (!planName.trim()) {
      return 'Plan name is required.';
    }

    const parsedDate = parseDateInputToIso(plannedDateInput);
    if (plannedDateInput.trim() && !parsedDate) {
      return 'Planned date must be in YYYY-MM-DD format.';
    }

    if (parsedDate) {
      const selectedDay = new Date(parsedDate);
      const today = new Date();
      selectedDay.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (selectedDay < today) {
        return 'Planned date should be today or in the future.';
      }
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
        const hasAnyMetricInSet = draftSet.segments.some((segment) =>
          columns.some((column) => {
            if (column === 'reps') return Boolean(segment.reps.trim());
            if (column === 'weight') return Boolean(segment.weight.trim());
            if (column === 'duration') return Boolean(segment.duration.trim());
            return Boolean(segment.distance.trim());
          })
        );

        if (!hasAnyMetricInSet) {
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

    const parsedPlannedDate = parseDateInputToIso(plannedDateInput);
    if (plannedDateInput.trim() && !parsedPlannedDate) {
      setError('Planned date must be in YYYY-MM-DD format.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const resolvedPlanId = existingPlan?.id ?? generateUuid();
      const resolvedUserId = existingPlan?.userId ?? user?.id;

      if (!resolvedUserId) {
        throw new Error('Cannot save plan because no authenticated user is available.');
      }

      const planPayload: Plan = {
        id: resolvedPlanId,
        remoteId: existingPlan?.remoteId,
        userId: resolvedUserId,
        name: planName.trim(),
        plannedDate: parsedPlannedDate ?? undefined,
        isDeleted: false,
        syncStatus: 'pending',
        createdAt: existingPlan?.createdAt ?? now,
        updatedAt: now,
      };

      const planExercises: PlanExercise[] = [];
      const planSets: PlanSet[] = [];

      draftExercises.forEach((draftExercise, exerciseIndex) => {
        const planExerciseId = generateUuid();

        planExercises.push({
          id: planExerciseId,
          planId: resolvedPlanId,
          exerciseId: draftExercise.exerciseId,
          orderIndex: exerciseIndex,
          createdAt: now,
        });

        draftExercise.sets.forEach((draftSet, setIndex) => {
          const parsedSegments = draftSet.segments.map((segment) => {
            const segmentWeight = toOptionalNumber(segment.weight);

            return {
              reps: toOptionalNumber(segment.reps),
              weight: segmentWeight,
              weightUnit: segmentWeight !== undefined ? segment.weightUnit : undefined,
              weightKg: toWeightKg(segmentWeight, segment.weightUnit),
              duration: toOptionalNumber(segment.duration),
              distance: toOptionalNumber(segment.distance),
            };
          });

          const primarySegment = parsedSegments[0] ?? {};

          planSets.push({
            id: generateUuid(),
            planExerciseId,
            reps: primarySegment.reps,
            weight: primarySegment.weight,
            weightUnit: primarySegment.weightUnit,
            weightKg: primarySegment.weightKg,
            duration: primarySegment.duration,
            distance: primarySegment.distance,
            notes: draftSet.notes.trim() || undefined,
            segments: parsedSegments,
            orderIndex: setIndex,
            createdAt: now,
          });
        });
      });

      const savedPlanId = await savePlan(planPayload, planExercises, planSets);
      const operation = existingPlan ? 'update' : 'create';

      await addToSyncQueue('plan', savedPlanId, operation, {
        ...planPayload,
        id: savedPlanId,
        remoteId: planPayload.remoteId ?? null,
        exercises: planExercises,
        sets: planSets,
      });

      await getPendingChanges();
      router.replace({ pathname: '/plan/[id]', params: { id: savedPlanId } } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-950" edges={['top', 'bottom']}>
        <Text className="text-neutral-200">Loading plan form...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#141313]" edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: isEditMode ? 'Edit Plan' : 'New Plan' }} />

      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-5 pb-32 pt-6">
        <View className="gap-2">
          <View className="self-start rounded-full border border-white/10 bg-[#1E1E22] px-3 py-1.5">
            <Text className="text-xs uppercase tracking-[2px] text-amber-300">Builder Mode</Text>
          </View>
          <Text className="text-5xl font-black text-[#DBB8FF]">Architect Your Growth.</Text>
          <Text className="text-sm text-neutral-300">Build your workout template with target sets.</Text>
        </View>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Input
          label="Plan Name"
          value={planName}
          onChangeText={setPlanName}
          placeholder="Upper Body Plan"
        />

        <Input
          label="Planned Date (optional, YYYY-MM-DD)"
          value={plannedDateInput}
          onChangeText={setPlannedDateInput}
          placeholder="2026-03-20"
          autoCapitalize="none"
        />

        <View className="gap-3 rounded-3xl border border-white/10 bg-[#1B1B1F] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Template Exercises</Text>
            <Pressable
              className="rounded-xl border border-[#6F31F5] bg-[#241A36] px-3 py-2"
              onPress={() => {
                setError(null);
                router.push('/modal/exercise-picker' as never);
              }}
            >
              <Text className="text-sm font-semibold text-[#DBB8FF]">Add Exercise</Text>
            </Pressable>
          </View>

          {draftExercises.length === 0 ? (
            <Text className="text-sm text-neutral-300">No exercises added yet.</Text>
          ) : (
            <View className="gap-4">
              {draftExercises.map((draftExercise) => {
                const columns = getColumnsForExerciseType(draftExercise.exercise.type);

                return (
                  <View key={draftExercise.id} className="rounded-2xl border border-white/10 bg-[#121214] p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="text-2xl font-bold text-white">{draftExercise.exercise.name}</Text>
                        <Text className="mt-1 text-xs uppercase tracking-[1px] text-[#DBB8FF]">{draftExercise.exercise.type}</Text>
                      </View>
                      <Pressable
                        className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1.5"
                        onPress={() => removeExerciseFromDraft(draftExercise.id)}
                      >
                        <Text className="text-xs font-semibold text-red-300">Remove</Text>
                      </Pressable>
                    </View>

                    <View className="mt-3 gap-3">
                      {draftExercise.sets.map((draftSet, setIndex) => (
                        <View key={draftSet.id} className="rounded-xl border border-white/10 bg-[#1D1D20] p-3">
                          <View className="mb-2 flex-row items-center justify-between">
                            <Text className="text-sm font-semibold text-white">Set {setIndex + 1}</Text>
                            <Pressable
                              className="rounded-lg border border-white/10 bg-[#2B2B30] px-2 py-1"
                              onPress={() => removeSetFromExercise(draftExercise.id, draftSet.id)}
                            >
                              <Text className="text-xs text-neutral-200">Remove</Text>
                            </Pressable>
                          </View>

                          <View className="gap-3">
                            {draftSet.segments.map((segment, segmentIndex) => (
                              <View key={segment.id} className="rounded-lg border border-white/10 bg-[#232328] p-3">
                                <View className="mb-2 flex-row items-center justify-between">
                                  <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#DBB8FF]">
                                    Entry {segmentIndex + 1}
                                  </Text>
                                  <Pressable
                                    className="rounded-md border border-white/10 bg-[#2F2F34] px-2 py-1"
                                    onPress={() => removeSegmentFromSet(draftExercise.id, draftSet.id, segment.id)}
                                  >
                                    <Text className="text-[11px] text-neutral-200">Remove Entry</Text>
                                  </Pressable>
                                </View>

                                <View className="gap-2">
                                  {columns.includes('reps') ? (
                                    <Input
                                      label="Target Reps"
                                      value={segment.reps}
                                      onChangeText={(value) =>
                                        updateSegmentField(draftExercise.id, draftSet.id, segment.id, 'reps', value)
                                      }
                                      keyboardType="numeric"
                                      placeholder="e.g. 10"
                                    />
                                  ) : null}

                                  {columns.includes('weight') ? (
                                    <View className="gap-2">
                                      <Input
                                        label={`Target Weight (${segment.weightUnit.toUpperCase()})`}
                                        value={segment.weight}
                                        onChangeText={(value) =>
                                          updateSegmentField(draftExercise.id, draftSet.id, segment.id, 'weight', value)
                                        }
                                        keyboardType="numeric"
                                        placeholder="e.g. 60"
                                      />
                                      <View className="flex-row rounded-lg border border-white/10 bg-[#2B2B30] p-1">
                                        {(['kg', 'lb'] as WeightUnit[]).map((unit) => {
                                          const selected = segment.weightUnit === unit;

                                          return (
                                            <Pressable
                                              key={unit}
                                              className={`flex-1 rounded-md px-3 py-2 ${selected ? 'bg-[#6F31F5]' : 'bg-transparent'}`}
                                              onPress={() =>
                                                updateSegmentField(
                                                  draftExercise.id,
                                                  draftSet.id,
                                                  segment.id,
                                                  'weightUnit',
                                                  unit
                                                )
                                              }
                                            >
                                              <Text className={`text-center text-xs font-semibold ${selected ? 'text-white' : 'text-neutral-300'}`}>
                                                {unit.toUpperCase()}
                                              </Text>
                                            </Pressable>
                                          );
                                        })}
                                      </View>
                                    </View>
                                  ) : null}

                                  {columns.includes('duration') ? (
                                    <Input
                                      label="Target Duration (seconds)"
                                      value={segment.duration}
                                      onChangeText={(value) =>
                                        updateSegmentField(draftExercise.id, draftSet.id, segment.id, 'duration', value)
                                      }
                                      keyboardType="numeric"
                                      placeholder="e.g. 45"
                                    />
                                  ) : null}

                                  {columns.includes('distance') ? (
                                    <Input
                                      label="Target Distance"
                                      value={segment.distance}
                                      onChangeText={(value) =>
                                        updateSegmentField(draftExercise.id, draftSet.id, segment.id, 'distance', value)
                                      }
                                      keyboardType="numeric"
                                      placeholder="e.g. 1000"
                                    />
                                  ) : null}
                                </View>
                              </View>
                            ))}

                            <Pressable
                              className="self-start rounded-lg border border-[#6F31F5]/40 bg-[#2A2140] px-3 py-2"
                              onPress={() => addSegmentToSet(draftExercise.id, draftSet.id)}
                            >
                              <Text className="text-xs font-semibold text-[#DBB8FF]">Add Drop/Pyramid Entry</Text>
                            </Pressable>

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
                      className="mt-3 self-start rounded-lg border border-white/10 bg-[#2B2B30] px-3 py-2"
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

        <View className="flex-row gap-3">
          <Pressable
            className="flex-[1.5] rounded-2xl bg-[#6F31F5] py-4"
            onPress={() => void onSave()}
            disabled={isSaving}
          >
            <Text className="text-center text-lg font-bold text-white">{isSaving ? 'Saving...' : 'Create Plan'}</Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-2xl border border-white/10 bg-[#202025] py-4"
            onPress={() => router.back()}
            disabled={isSaving}
          >
            <Text className="text-center text-base font-semibold text-neutral-300">Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
