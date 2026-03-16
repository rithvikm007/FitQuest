import { Text, TextInput, type TextInputProps, View, Pressable } from 'react-native';
import { useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type InputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry,
  keyboardType,
  multiline,
  autoCapitalize = 'none',
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = !!secureTextEntry;

  return (
    <View className="w-full gap-1">
      {label ? <Text className="text-sm font-medium text-neutral-300">{label}</Text> : null}
      <View className="relative">
        <TextInput
          className={`rounded-xl border px-4 py-3 text-base text-white pr-12 ${error ? 'border-red-500 bg-red-950/20' : 'border-white/10 bg-[#1D1D20]'}`}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#71717A"
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
        />
        {isPassword ? (
          <Pressable
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={22}
              color="#A3A3A3"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-xs text-red-400">{error}</Text> : null}
    </View>
  );
}
