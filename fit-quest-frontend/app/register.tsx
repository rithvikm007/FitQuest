import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/contexts/AuthContext';
import { validateRegisterForm } from '@/utils/authValidation';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const validationErrors = useMemo(
    () => validateRegisterForm(username, email, password, confirmPassword),
    [username, email, password, confirmPassword]
  );

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    const errors = validateRegisterForm(username, email, password, confirmPassword);
    if (errors.username || errors.email || errors.password || errors.confirmPassword) {
      setFormError('Please fix the form errors before continuing.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await register(username.trim(), email.trim(), password);
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
          <Text className="text-center text-4xl font-extrabold text-white">Create Account</Text>
          <Text className="text-center text-sm text-neutral-300">Sign up to start tracking workouts offline.</Text>
        </View>

        <View className="gap-4">
          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a username"
            autoCapitalize="none"
            error={hasAttemptedSubmit ? validationErrors.username : undefined}
          />

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
            placeholder="At least 6 characters"
            secureTextEntry
            error={hasAttemptedSubmit ? validationErrors.password : undefined}
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            secureTextEntry
            error={hasAttemptedSubmit ? validationErrors.confirmPassword : undefined}
          />

          {formError ? <Text className="text-sm text-red-400">{formError}</Text> : null}
          {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

          <Button title={isSubmitting ? 'Signing Up...' : 'Sign Up'} onPress={handleSubmit} loading={isSubmitting} />

          <Pressable onPress={() => router.push('/login')}>
            <Text className="text-center text-sm text-neutral-300">
              Already have an account? <Text className="font-semibold text-primary">Log in</Text>
            </Text>
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
