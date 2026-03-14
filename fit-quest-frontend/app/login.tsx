import { Text, View } from 'react-native';

export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-neutral-950 px-6">
      <Text className="text-3xl font-bold text-white">Login</Text>
      <Text className="text-center text-sm text-neutral-300">
        Placeholder login route for auth-guard wiring. Task 6.1 will replace this screen.
      </Text>
      <Text className="text-base font-semibold text-primary">Task 6.1 screen pending</Text>
    </View>
  );
}
