import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { ThemedAlertModal } from '@/components/common/ThemedAlertModal';
import { useAuth } from '@/contexts/AuthContext';
import { clearApiBaseUrlOverride, getApiBaseUrl, setApiBaseUrl } from '@/services/api';
import { validateLoginForm } from '@/utils/authValidation';

export default function LoginScreen() {
  const router = useRouter();
  const { login, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isBackendUrlModalOpen, setIsBackendUrlModalOpen] = useState(false);
  const [isSavingBackendUrl, setIsSavingBackendUrl] = useState(false);
  const [backendUrlDraft, setBackendUrlDraft] = useState(getApiBaseUrl());
  const [backendUrlError, setBackendUrlError] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{ title: string; message: string; tone: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardOffset(event.endCoordinates.height);
    });

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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

  const openBackendUrlModal = () => {
    setBackendUrlDraft(getApiBaseUrl());
    setBackendUrlError(null);
    setIsBackendUrlModalOpen(true);
  };

  const closeBackendUrlModal = () => {
    if (isSavingBackendUrl) {
      return;
    }

    setIsBackendUrlModalOpen(false);
    setBackendUrlError(null);
  };

  const handleSaveBackendUrl = async () => {
    setIsSavingBackendUrl(true);
    setBackendUrlError(null);

    try {
      const normalized = await setApiBaseUrl(backendUrlDraft);
      setBackendUrlDraft(normalized);
      setIsBackendUrlModalOpen(false);
      setAlertState({
        title: 'Backend URL Updated',
        message: `Using ${normalized}`,
        tone: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBackendUrlError(message);
    } finally {
      setIsSavingBackendUrl(false);
    }
  };

  const handleResetBackendUrl = async () => {
    setIsSavingBackendUrl(true);
    setBackendUrlError(null);

    try {
      const resolved = await clearApiBaseUrlOverride();
      setBackendUrlDraft(resolved);
      setIsBackendUrlModalOpen(false);
      setAlertState({
        title: 'Backend URL Reset',
        message: `Using default ${resolved}`,
        tone: 'info',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBackendUrlError(message);
    } finally {
      setIsSavingBackendUrl(false);
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

          <Pressable onPress={openBackendUrlModal}>
            <Text className="text-center text-xs text-neutral-500">Backend URL: {getApiBaseUrl()}</Text>
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>

      <ThemedAlertModal
        visible={alertState !== null}
        title={alertState?.title ?? ''}
        message={alertState?.message ?? ''}
        tone={alertState?.tone ?? 'info'}
        onClose={() => setAlertState(null)}
      />

      <Modal
        visible={isBackendUrlModalOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeBackendUrlModal}
      >
        <View
          className="flex-1 justify-end bg-black/70"
          style={{ paddingBottom: Platform.OS === 'android' ? keyboardOffset : 0 }}
        >
            <SafeAreaView className="rounded-t-3xl border border-white/10 bg-[#141313] p-5" edges={['bottom']}>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-white">Backend URL</Text>
                <Pressable onPress={closeBackendUrlModal}>
                  <Text className="text-sm font-semibold text-neutral-300">Close</Text>
                </Pressable>
              </View>

              <Text className="mb-2 text-xs text-neutral-400">Example: http://192.168.1.50:3000/api</Text>

              {backendUrlError ? <Text className="mb-2 text-sm text-red-300">{backendUrlError}</Text> : null}

              <View className="gap-3 pb-4">
                <Input
                  label="API Base URL"
                  value={backendUrlDraft}
                  onChangeText={setBackendUrlDraft}
                  placeholder="http://192.168.1.50:3000/api"
                  autoCapitalize="none"
                />

                <Pressable
                  className="mt-2 rounded-2xl bg-[#6F31F5] py-4"
                  onPress={() => void handleSaveBackendUrl()}
                  disabled={isSavingBackendUrl}
                >
                  <Text className="text-center text-base font-bold text-white">
                    {isSavingBackendUrl ? 'Saving...' : 'Save URL'}
                  </Text>
                </Pressable>

                <Pressable
                  className="rounded-2xl border border-white/15 bg-[#222227] py-4"
                  onPress={() => void handleResetBackendUrl()}
                  disabled={isSavingBackendUrl}
                >
                  <Text className="text-center text-base font-bold text-neutral-200">Use Default</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
      </Modal>
    </SafeAreaView>
  );
}
