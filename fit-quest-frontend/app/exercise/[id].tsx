import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function ExerciseDetailPlaceholder() {
  const params = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-neutral-950 px-6">
      <Text className="text-2xl font-bold text-white">Exercise Detail</Text>
      <Text className="text-center text-sm text-neutral-300">Route is working for exercise id:</Text>
      <Text className="text-center text-sm font-semibold text-primary">{params.id ?? 'unknown'}</Text>
      <Text className="text-center text-xs text-neutral-400">Task 7.2 will replace this placeholder.</Text>
    </View>
  );
}
