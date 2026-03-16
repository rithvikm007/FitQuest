import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

type UserInfoDraft = {
  firstName: string;
  lastName: string;
};

type BodyStatsDraft = {
  age: string;
  height: string;
  weight: string;
};

function toNumericField(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }

  return numeric;
}

function getUserInfoDraftFromUser(user: {
  firstName?: string;
  lastName?: string;
  age?: number;
  height?: number;
  weight?: number;
} | null): UserInfoDraft {
  return {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
  };
}

function getBodyStatsDraftFromUser(user: {
  firstName?: string;
  lastName?: string;
  age?: number;
  height?: number;
  weight?: number;
} | null): BodyStatsDraft {
  return {
    age: user?.age !== undefined ? String(user.age) : '',
    height: user?.height !== undefined ? String(user.height) : '',
    weight: user?.weight !== undefined ? String(user.weight) : '',
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading, error, updateProfile, logout } = useAuth();

  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [isBodyStatsModalOpen, setIsBodyStatsModalOpen] = useState(false);
  const [isSavingUserInfo, setIsSavingUserInfo] = useState(false);
  const [isSavingBodyStats, setIsSavingBodyStats] = useState(false);
  const [userInfoError, setUserInfoError] = useState<string | null>(null);
  const [bodyStatsError, setBodyStatsError] = useState<string | null>(null);
  const [userInfoDraft, setUserInfoDraft] = useState<UserInfoDraft>(getUserInfoDraftFromUser(user));
  const [bodyStatsDraft, setBodyStatsDraft] = useState<BodyStatsDraft>(getBodyStatsDraftFromUser(user));

  const appVersion = useMemo(() => {
    return (
      Constants.expoConfig?.version ??
      Constants.manifest2?.extra?.expoClient?.version ??
      '1.0.0'
    );
  }, []);

  const openUserInfoModal = () => {
    setUserInfoDraft(getUserInfoDraftFromUser(user));
    setUserInfoError(null);
    setIsUserInfoModalOpen(true);
  };

  const openBodyStatsModal = () => {
    setBodyStatsDraft(getBodyStatsDraftFromUser(user));
    setBodyStatsError(null);
    setIsBodyStatsModalOpen(true);
  };

  const closeUserInfoModal = () => {
    if (isSavingUserInfo) {
      return;
    }

    setIsUserInfoModalOpen(false);
    setUserInfoError(null);
  };

  const closeBodyStatsModal = () => {
    if (isSavingBodyStats) {
      return;
    }

    setIsBodyStatsModalOpen(false);
    setBodyStatsError(null);
  };

  const validateBodyStatsDraft = (): string | null => {
    if (bodyStatsDraft.age.trim() && toNumericField(bodyStatsDraft.age) === undefined) {
      return 'Age must be a positive number.';
    }

    if (bodyStatsDraft.height.trim() && toNumericField(bodyStatsDraft.height) === undefined) {
      return 'Height must be a positive number.';
    }

    if (bodyStatsDraft.weight.trim() && toNumericField(bodyStatsDraft.weight) === undefined) {
      return 'Weight must be a positive number.';
    }

    return null;
  };

  const handleSaveUserInfo = async () => {
    setIsSavingUserInfo(true);
    setUserInfoError(null);

    try {
      await updateProfile({
        firstName: userInfoDraft.firstName.trim() || undefined,
        lastName: userInfoDraft.lastName.trim() || undefined,
      });

      setIsUserInfoModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUserInfoError(message);
    } finally {
      setIsSavingUserInfo(false);
    }
  };

  const handleSaveBodyStats = async () => {
    const validationError = validateBodyStatsDraft();
    if (validationError) {
      setBodyStatsError(validationError);
      return;
    }

    setIsSavingBodyStats(true);
    setBodyStatsError(null);

    try {
      await updateProfile({
        age: toNumericField(bodyStatsDraft.age),
        height: toNumericField(bodyStatsDraft.height),
        weight: toNumericField(bodyStatsDraft.weight),
      });

      setIsBodyStatsModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBodyStatsError(message);
    } finally {
      setIsSavingBodyStats(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              Alert.alert('Logout Failed', message);
            }
          })();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-950">
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-8 pt-5">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-white">Profile</Text>
          <Text className="text-sm text-neutral-300">Manage your account and fitness stats.</Text>
        </View>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-primary">User Info</Text>
          <View className="mt-3 gap-2">
            <Text className="text-sm text-neutral-300">Username</Text>
            <Text className="text-base font-semibold text-white">{user?.username ?? 'Unknown'}</Text>
            <Text className="mt-2 text-sm text-neutral-300">Email</Text>
            <Text className="text-base font-semibold text-white">{user?.email ?? 'Unknown'}</Text>
            <Text className="mt-2 text-sm text-neutral-300">First Name</Text>
            <Text className="text-base font-semibold text-white">{user?.firstName ?? 'Not set'}</Text>
            <Text className="mt-2 text-sm text-neutral-300">Last Name</Text>
            <Text className="text-base font-semibold text-white">{user?.lastName ?? 'Not set'}</Text>
          </View>

          <Pressable className="mt-4 items-center rounded-lg bg-secondary px-3 py-2" onPress={openUserInfoModal}>
            <Text className="text-sm font-semibold text-white">Edit Name</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-primary">Body Stats</Text>
          <View className="mt-3 gap-2">
            <Text className="text-sm text-neutral-300">Age</Text>
            <Text className="text-base font-semibold text-white">{user?.age ?? 'Not set'}</Text>
            <Text className="mt-2 text-sm text-neutral-300">Height (cm)</Text>
            <Text className="text-base font-semibold text-white">{user?.height ?? 'Not set'}</Text>
            <Text className="mt-2 text-sm text-neutral-300">Weight (kg)</Text>
            <Text className="text-base font-semibold text-white">{user?.weight ?? 'Not set'}</Text>
          </View>

          <Pressable className="mt-4 items-center rounded-lg bg-primary px-3 py-2" onPress={openBodyStatsModal}>
            <Text className="text-sm font-semibold text-white">Update Stats</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-primary">Settings</Text>
          <Pressable className="mt-3 items-center rounded-lg bg-red-600 px-3 py-2" onPress={confirmLogout}>
            <Text className="text-sm font-semibold text-white">Logout</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-primary bg-primary/15 p-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-primary">About</Text>
          <Text className="mt-2 text-sm text-white">FitQuest</Text>
          <Text className="mt-1 text-sm text-neutral-200">Version {appVersion}</Text>
        </View>
      </ScrollView>

      <Modal visible={isUserInfoModalOpen} transparent animationType="slide" onRequestClose={closeUserInfoModal}>
        <View className="flex-1 bg-black/70">
          <View className="mt-16 flex-1 rounded-t-3xl border border-neutral-800 bg-neutral-950 p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-white">Edit User Info</Text>
              <Pressable className="rounded-lg bg-neutral-800 px-3 py-2" onPress={closeUserInfoModal}>
                <Text className="font-semibold text-white">Close</Text>
              </Pressable>
            </View>

            {userInfoError ? <Text className="mb-2 text-sm text-red-400">{userInfoError}</Text> : null}

            <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
              <Input
                label="First Name"
                value={userInfoDraft.firstName}
                onChangeText={(value) => setUserInfoDraft((current) => ({ ...current, firstName: value }))}
                placeholder="First name"
              />
              <Input
                label="Last Name"
                value={userInfoDraft.lastName}
                onChangeText={(value) => setUserInfoDraft((current) => ({ ...current, lastName: value }))}
                placeholder="Last name"
              />

              <Button
                title={isSavingUserInfo ? 'Saving...' : 'Save User Info'}
                onPress={handleSaveUserInfo}
                disabled={isSavingUserInfo}
                loading={isSavingUserInfo}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={closeUserInfoModal}
                disabled={isSavingUserInfo}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isBodyStatsModalOpen} transparent animationType="slide" onRequestClose={closeBodyStatsModal}>
        <View className="flex-1 bg-black/70">
          <View className="mt-16 flex-1 rounded-t-3xl border border-neutral-800 bg-neutral-950 p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-white">Update Body Stats</Text>
              <Pressable className="rounded-lg bg-neutral-800 px-3 py-2" onPress={closeBodyStatsModal}>
                <Text className="font-semibold text-white">Close</Text>
              </Pressable>
            </View>

            {bodyStatsError ? <Text className="mb-2 text-sm text-red-400">{bodyStatsError}</Text> : null}

            <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
              <Input
                label="Age"
                value={bodyStatsDraft.age}
                onChangeText={(value) => setBodyStatsDraft((current) => ({ ...current, age: value }))}
                keyboardType="numeric"
                placeholder="Age"
              />
              <Input
                label="Height (cm)"
                value={bodyStatsDraft.height}
                onChangeText={(value) => setBodyStatsDraft((current) => ({ ...current, height: value }))}
                keyboardType="numeric"
                placeholder="Height"
              />
              <Input
                label="Weight (kg)"
                value={bodyStatsDraft.weight}
                onChangeText={(value) => setBodyStatsDraft((current) => ({ ...current, weight: value }))}
                keyboardType="numeric"
                placeholder="Weight"
              />

              <Button
                title={isSavingBodyStats ? 'Saving...' : 'Save Body Stats'}
                onPress={handleSaveBodyStats}
                disabled={isSavingBodyStats}
                loading={isSavingBodyStats}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={closeBodyStatsModal}
                disabled={isSavingBodyStats}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
