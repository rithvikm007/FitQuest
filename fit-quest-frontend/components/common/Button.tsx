import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantClassMap: Record<ButtonVariant, { container: string; pressed: string; text: string }> = {
  primary: {
    container: 'bg-primary',
    pressed: 'bg-violet-700',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-secondary',
    pressed: 'bg-indigo-700',
    text: 'text-white',
  },
  outline: {
    container: 'border-2 border-primary bg-transparent',
    pressed: 'bg-primary/10',
    text: 'text-primary',
  },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantClasses = variantClassMap[variant];

  const pressedBackgroundColor =
    variant === 'primary'
      ? '#7E22CE'
      : variant === 'secondary'
        ? '#3730A3'
        : 'rgba(165, 86, 251, 0.1)';

  return (
    <Pressable
      className={`${fullWidth ? 'w-full' : ''} rounded-xl px-4 py-3 ${variantClasses.container} ${isDisabled ? 'bg-neutral-500 opacity-70' : ''}`}
      style={({ pressed }) => (pressed && !isDisabled ? { backgroundColor: pressedBackgroundColor } : undefined)}
      disabled={isDisabled}
      onPress={onPress}
    >
      <View className="min-h-6 flex-row items-center justify-center gap-2">
        {loading ? <ActivityIndicator color={variant === 'outline' ? '#A556FB' : '#FFFFFF'} /> : null}
        <Text className={`text-center text-base font-semibold ${variantClasses.text}`}>{title}</Text>
      </View>
    </Pressable>
  );
}
