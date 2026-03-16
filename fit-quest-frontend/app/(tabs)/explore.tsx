import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import '@/global.css';

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['top']}>
      <ScrollView className="flex-1 bg-neutral-950" contentContainerClassName="gap-4 p-6">
        <View className="gap-2">
          <Text className="text-2xl font-bold text-white">Explore</Text>
          <Text className="text-sm leading-6 text-neutral-300">
            This starter tab has been simplified so the app can boot cleanly while the FitQuest
            features are being built.
          </Text>
        </View>

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-secondary">
            Current focus
          </Text>
          <Text className="text-sm leading-6 text-neutral-200">
            Phase 2 database services are in progress. Use the Home tab to run the Task 2.1 smoke
            test for the local user database service.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
