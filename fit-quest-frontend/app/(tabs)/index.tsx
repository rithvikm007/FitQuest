import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { getDatabase, initDatabase } from '@/database/index';
import {
  deleteExercise,
  getExerciseById,
  getExercises,
  saveExercise,
  searchExercises,
} from '@/services/db/exerciseDbService';
import { clearUser, getUser, saveUser, updateUserProfile } from '@/services/db/userDbService';
import type { Exercise, User } from '@/types/models';
import '@/global.css';

type TestResult = {
  label: string;
  status: 'pass' | 'fail' | 'info';
  details: string;
};

const seedUser: Partial<User> = {
  username: 'fitquestdev',
  email: 'fitquestdev@example.com',
  remoteId: 'mongo-user-123',
};

function formatValue(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

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

export default function HomeScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const appendResult = (result: TestResult) => {
    setResults((currentResults) => [...currentResults, result]);
  };

  const runSmokeTest = async () => {
    setResults([]);
    setIsRunning(true);

    if (Platform.OS === 'web') {
      appendResult({
        label: 'Platform check',
        status: 'fail',
        details: 'SQLite smoke test must be run on Android or iOS. Web uses a no-op database stub.',
      });
      setIsRunning(false);
      return;
    }

    try {
      appendResult({
        label: 'Step 1: clearUser()',
        status: 'info',
        details: 'Removing any previous local user row before starting the smoke test.',
      });
      await clearUser();

      appendResult({
        label: 'Step 2: saveUser()',
        status: 'info',
        details: `Saving seed user: ${formatValue(seedUser)}`,
      });
      await saveUser(seedUser);

      const savedUser = await getUser();
      if (!savedUser || savedUser.username !== seedUser.username || savedUser.remoteId !== seedUser.remoteId) {
        throw new Error(`Saved user mismatch. Received: ${formatValue(savedUser)}`);
      }

      appendResult({
        label: 'Step 3: getUser()',
        status: 'pass',
        details: `Loaded user successfully: ${formatValue(savedUser)}`,
      });

      await updateUserProfile({
        firstName: 'Fit',
        lastName: 'Quest',
        age: 28,
        height: 178,
        weight: 76,
      });

      const updatedUser = await getUser();
      const profileUpdated =
        updatedUser?.firstName === 'Fit' &&
        updatedUser?.lastName === 'Quest' &&
        updatedUser?.age === 28 &&
        updatedUser?.height === 178 &&
        updatedUser?.weight === 76 &&
        updatedUser?.remoteId === seedUser.remoteId;

      if (!updatedUser || !profileUpdated) {
        throw new Error(`Updated user mismatch. Received: ${formatValue(updatedUser)}`);
      }

      appendResult({
        label: 'Step 4: updateUserProfile()',
        status: 'pass',
        details: `Profile updated correctly and remoteId preserved: ${formatValue(updatedUser)}`,
      });

      await clearUser();
      const clearedUser = await getUser();

      if (clearedUser !== null) {
        throw new Error(`Expected null after clearUser(), received: ${formatValue(clearedUser)}`);
      }

      appendResult({
        label: 'Step 5: clearUser()',
        status: 'pass',
        details: 'Local user row removed successfully. getUser() returned null.',
      });

      appendResult({
        label: 'Smoke test complete',
        status: 'pass',
        details: 'Task 2.1 passed on this device. You can remove this test harness after verification.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendResult({
        label: 'Smoke test failed',
        status: 'fail',
        details: message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runExerciseSmokeTest = async () => {
    setResults([]);
    setIsRunning(true);

    if (Platform.OS === 'web') {
      appendResult({
        label: 'Platform check',
        status: 'fail',
        details: 'SQLite smoke test must be run on Android or iOS. Web uses a no-op database stub.',
      });
      setIsRunning(false);
      return;
    }

    try {
      await initDatabase();
      const db = getDatabase();
      await db.runAsync('DELETE FROM exercises;');

      appendResult({
        label: 'Step 1: clear exercises',
        status: 'pass',
        details: 'Exercises table cleared for deterministic Task 2.2 smoke test.',
      });

      const now = new Date().toISOString();
      const exerciseA: Exercise = {
        id: generateUuid(),
        name: 'Push Up',
        description: 'Bodyweight push exercise',
        category: 'chest',
        primaryMuscle: 'chest',
        otherMuscles: ['triceps', 'shoulders'],
        type: 'bodyweight reps',
        equipment: 'body weight',
        instructions: ['Get into plank position', 'Lower chest', 'Push back up'],
        isCustom: true,
        userId: 'local-user-1',
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };

      const savedAId = await saveExercise(exerciseA);
      const savedA = await getExerciseById(savedAId);

      if (!savedA || savedA.name !== 'Push Up' || savedA.syncStatus !== 'pending') {
        throw new Error(`Exercise create/get mismatch: ${formatValue(savedA)}`);
      }

      appendResult({
        label: 'Step 2: save/get exercise',
        status: 'pass',
        details: `Saved and loaded exercise A: ${formatValue(savedA)}`,
      });

      const remoteId = 'mongo-exercise-1';
      const exerciseB: Exercise = {
        id: generateUuid(),
        remoteId,
        name: 'Bench Press',
        description: 'Barbell chest press',
        category: 'chest',
        primaryMuscle: 'chest',
        otherMuscles: ['triceps', 'shoulders'],
        type: 'weight and reps',
        equipment: 'barbell',
        instructions: ['Lie on bench', 'Lower bar to chest', 'Press up'],
        videoUrl: 'https://example.com/bench',
        isCustom: false,
        userId: 'local-user-1',
        isDeleted: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      };

      const savedBId = await saveExercise(exerciseB);

      const updatedB: Exercise = {
        ...exerciseB,
        id: generateUuid(),
        name: 'Bench Press Updated',
      };
      const reconciledId = await saveExercise(updatedB);

      if (reconciledId !== savedBId) {
        throw new Error(`Expected remoteId reconciliation to keep id ${savedBId}, got ${reconciledId}`);
      }

      const lookupByRemote = await getExerciseById(remoteId);
      if (!lookupByRemote || lookupByRemote.id !== savedBId || lookupByRemote.name !== 'Bench Press Updated') {
        throw new Error(`Lookup by remoteId failed: ${formatValue(lookupByRemote)}`);
      }

      appendResult({
        label: 'Step 3: remoteId reconciliation',
        status: 'pass',
        details: `Upsert by remoteId succeeded: ${formatValue(lookupByRemote)}`,
      });

      const allExercises = await getExercises();
      const chestExercises = await getExercises({ category: 'chest' });
      const customExercises = await getExercises({ isCustom: true });
      const searchResult = await searchExercises('bench');

      if (allExercises.length !== 2) {
        throw new Error(`Expected 2 active exercises, got ${allExercises.length}`);
      }

      if (chestExercises.length !== 2) {
        throw new Error(`Expected 2 chest exercises, got ${chestExercises.length}`);
      }

      if (customExercises.length !== 1 || customExercises[0].name !== 'Push Up') {
        throw new Error(`Custom exercise filter mismatch: ${formatValue(customExercises)}`);
      }

      if (!searchResult.some((exercise) => exercise.name.toLowerCase().includes('bench'))) {
        throw new Error(`Search results mismatch: ${formatValue(searchResult)}`);
      }

      appendResult({
        label: 'Step 4: filters and search',
        status: 'pass',
        details: `Filters/search passed. all=${allExercises.length}, chest=${chestExercises.length}, custom=${customExercises.length}, search=${searchResult.length}`,
      });

      await deleteExercise(savedAId);
      const deletedA = await getExerciseById(savedAId);
      const remainingExercises = await getExercises();

      if (deletedA !== null) {
        throw new Error(`Expected deleted exercise lookup to return null, received: ${formatValue(deletedA)}`);
      }

      if (remainingExercises.length !== 1 || remainingExercises[0].id !== savedBId) {
        throw new Error(`Soft delete failed. Remaining rows: ${formatValue(remainingExercises)}`);
      }

      appendResult({
        label: 'Step 5: soft delete',
        status: 'pass',
        details: `Soft delete works. Remaining active exercise: ${remainingExercises[0].name}`,
      });

      appendResult({
        label: 'Smoke test complete',
        status: 'pass',
        details: 'Task 2.2 passed on this device. CRUD, filters, search, JSON fields, and soft delete verified.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendResult({
        label: 'Smoke test failed',
        status: 'fail',
        details: message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerClassName="gap-4 p-6">
      <View className="gap-2">
        <Text className="text-3xl font-bold text-white">Phase 2 Smoke Tests</Text>
        <Text className="text-sm leading-6 text-neutral-300">
          Run these on Android or iOS to verify database service behavior before moving forward.
        </Text>
      </View>

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Available tests</Text>
        <Text className="text-sm leading-6 text-neutral-200">Task 2.1: User CRUD + remoteId preservation</Text>
        <Text className="text-sm leading-6 text-neutral-200">Task 2.2: Exercise CRUD + JSON parse/stringify + filters/search + soft delete</Text>
      </View>

      <View className="gap-3">
        <View className="flex-row gap-3">
          <Pressable
            className={`flex-1 rounded-xl px-4 py-4 ${isRunning ? 'bg-violet-300' : 'bg-primary'}`}
            disabled={isRunning}
            onPress={runSmokeTest}>
            <View className="min-h-6 flex-row items-center justify-center gap-2">
              {isRunning ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text className="text-center font-semibold text-white">
                {isRunning ? 'Running...' : 'Run Task 2.1 Test'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            className={`flex-1 rounded-xl px-4 py-4 ${isRunning ? 'bg-indigo-300' : 'bg-secondary'}`}
            disabled={isRunning}
            onPress={runExerciseSmokeTest}>
            <View className="min-h-6 flex-row items-center justify-center gap-2">
              {isRunning ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text className="text-center font-semibold text-white">
                {isRunning ? 'Running...' : 'Run Task 2.2 Test'}
              </Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          className="rounded-xl border border-neutral-700 px-4 py-4"
          disabled={isRunning}
          onPress={() => setResults([])}>
          <Text className="text-center font-semibold text-neutral-200">Clear Log</Text>
        </Pressable>
      </View>

      <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="text-lg font-semibold text-white">Results</Text>

        {results.length === 0 ? (
          <Text className="text-sm leading-6 text-neutral-400">
            No results yet. Run the test and watch this panel for pass or fail details.
          </Text>
        ) : (
          results.map((result, index) => {
            const accentClass =
              result.status === 'pass'
                ? 'border-emerald-500 bg-emerald-500/10'
                : result.status === 'fail'
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-secondary bg-secondary/10';

            return (
              <View key={`${result.label}-${index}`} className={`gap-2 rounded-xl border p-3 ${accentClass}`}>
                <Text className="font-semibold text-white">{result.label}</Text>
                <Text className="text-xs leading-5 text-neutral-200">{result.details}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
