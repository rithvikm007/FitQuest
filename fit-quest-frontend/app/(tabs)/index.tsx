import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { clearUser, getUser, saveUser, updateUserProfile } from '@/services/db/userDbService';
import type { User } from '@/types/models';
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

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerClassName="gap-4 p-6">
      <View className="gap-2">
        <Text className="text-3xl font-bold text-white">Task 2.1 Smoke Test</Text>
        <Text className="text-sm leading-6 text-neutral-300">
          Run this on Android or iOS to verify saveUser, getUser, updateUserProfile, and clearUser.
        </Text>
      </View>

      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">What it checks</Text>
        <Text className="text-sm leading-6 text-neutral-200">1. Clears any old local user row.</Text>
        <Text className="text-sm leading-6 text-neutral-200">2. Saves a seed user and verifies the row.</Text>
        <Text className="text-sm leading-6 text-neutral-200">3. Updates profile fields and confirms remoteId is preserved.</Text>
        <Text className="text-sm leading-6 text-neutral-200">4. Clears the user again and confirms getUser returns null.</Text>
      </View>

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
          className="rounded-xl border border-neutral-700 px-4 py-4"
          disabled={isRunning}
          onPress={() => setResults([])}>
          <Text className="font-semibold text-neutral-200">Clear Log</Text>
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
