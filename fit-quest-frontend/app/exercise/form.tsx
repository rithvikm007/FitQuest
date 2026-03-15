import { Text, View } from 'react-native';

export default function ExerciseFormPlaceholder() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-neutral-950 px-6">
      <Text className="text-2xl font-bold text-white">Exercise Form</Text>
      <Text className="text-center text-sm text-neutral-300">FAB navigation is working.</Text>
      <Text className="text-center text-xs text-neutral-400">Task 7.3 will replace this placeholder.</Text>
    </View>
  );
}
