import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/contexts/AuthContext';
import { validateLoginForm } from '@/utils/authValidation';

export default function LoginScreen() {
  const router = useRouter();
  const { login, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const validationErrors = useMemo(() => validateLoginForm(email, password), [email, password]);

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    const errors = validateLoginForm(email, password);
    if (errors.email || errors.password) {
      setFormError('Please fix the form errors before continuing.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch {
      // error state is surfaced by AuthContext.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-neutral-950"
      >
        <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <Text className="text-center text-4xl font-extrabold text-white">FitQuest</Text>
          <Text className="text-center text-sm text-neutral-300">Log in to continue your training journey.</Text>
        </View>

        <View className="gap-4">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            error={hasAttemptedSubmit ? validationErrors.email : undefined}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            error={hasAttemptedSubmit ? validationErrors.password : undefined}
          />

          {formError ? <Text className="text-sm text-red-400">{formError}</Text> : null}
          {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

          <Button title={isSubmitting ? 'Logging In...' : 'Log In'} onPress={handleSubmit} loading={isSubmitting} />

          <Pressable onPress={() => router.push('/register')}>
            <Text className="text-center text-sm text-neutral-300">
              Don't have an account? <Text className="font-semibold text-primary">Sign up</Text>
            </Text>
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
