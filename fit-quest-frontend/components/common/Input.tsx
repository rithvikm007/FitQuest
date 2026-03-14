import { Text, TextInput, type TextInputProps, View } from 'react-native';

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
  return (
    <View className="w-full gap-1">
      {label ? <Text className="text-sm font-medium text-neutral-300">{label}</Text> : null}
      <TextInput
        className={`rounded-xl border bg-white px-4 py-3 text-base text-neutral-900 ${error ? 'border-red-500' : 'border-neutral-300'}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#737373"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
      />
      {error ? <Text className="text-xs text-red-400">{error}</Text> : null}
    </View>
  );
}
