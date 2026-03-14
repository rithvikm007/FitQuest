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

const variantClassMap: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-primary',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-secondary',
    text: 'text-white',
  },
  outline: {
    container: 'border-2 border-primary bg-transparent',
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

  return (
    <Pressable
      className={`${fullWidth ? 'w-full' : ''} rounded-xl px-4 py-3 ${variantClasses.container} ${isDisabled ? 'opacity-60' : 'active:opacity-85'}`}
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
