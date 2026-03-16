import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedAlertModal } from '@/components/common/ThemedAlertModal';
import { Input } from '@/components/common/Input';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SyncStatusChip } from '@/components/common/SyncStatusChip';
import { ThemedConfirmModal } from '@/components/common/ThemedConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';

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
} | null): UserInfoDraft {
  return {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
  };
}

function getBodyStatsDraftFromUser(user: {
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

function initialsFromName(firstName?: string, lastName?: string, username?: string): string {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';
  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }

  return username?.trim()?.slice(0, 2).toUpperCase() ?? 'FQ';
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading, error, updateProfile, logout } = useAuth();
  const { pendingCount, sync, isSyncing, lastSynced } = useSync();

  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [isBodyStatsModalOpen, setIsBodyStatsModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSavingUserInfo, setIsSavingUserInfo] = useState(false);
  const [isSavingBodyStats, setIsSavingBodyStats] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userInfoError, setUserInfoError] = useState<string | null>(null);
  const [bodyStatsError, setBodyStatsError] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{ title: string; message: string; tone: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [userInfoDraft, setUserInfoDraft] = useState<UserInfoDraft>(getUserInfoDraftFromUser(user));
  const [bodyStatsDraft, setBodyStatsDraft] = useState<BodyStatsDraft>(getBodyStatsDraftFromUser(user));

  const appVersion = useMemo(() => {
    return Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '1.0.0';
  }, []);

  const profileSyncChip = useMemo(() => {
    if (pendingCount > 0) {
      return {
        label: `${pendingCount} PENDING`,
        status: 'pending' as const,
      };
    }

    return {
      label: 'SYNCED',
      status: 'synced' as const,
    };
  }, [pendingCount]);

  const displayName = useMemo(() => {
    const first = user?.firstName?.trim();
    const last = user?.lastName?.trim();
    if (first || last) {
      return `${first ?? ''} ${last ?? ''}`.trim();
    }

    return user?.username ?? 'FitQuest Member';
  }, [user?.firstName, user?.lastName, user?.username]);

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

    const ageValue = toNumericField(bodyStatsDraft.age);
    if (ageValue !== undefined && (ageValue < 1 || ageValue > 150)) {
      return 'Age must be between 1 and 150.';
    }

    if (bodyStatsDraft.height.trim() && toNumericField(bodyStatsDraft.height) === undefined) {
      return 'Height must be a positive number.';
    }

    const heightValue = toNumericField(bodyStatsDraft.height);
    if (heightValue !== undefined && (heightValue < 50 || heightValue > 300)) {
      return 'Height must be between 50 and 300 cm.';
    }

    if (bodyStatsDraft.weight.trim() && toNumericField(bodyStatsDraft.weight) === undefined) {
      return 'Weight must be a positive number.';
    }

    const weightValue = toNumericField(bodyStatsDraft.weight);
    if (weightValue !== undefined && (weightValue < 20 || weightValue > 500)) {
      return 'Weight must be between 20 and 500 kg.';
    }

    return null;
  };

  const validateUserInfoDraft = (): string | null => {
    if (userInfoDraft.firstName.length > 50) {
      return 'First name must be 50 characters or less.';
    }

    if (userInfoDraft.lastName.length > 50) {
      return 'Last name must be 50 characters or less.';
    }

    return null;
  };

  const handleSaveUserInfo = async () => {
    const validationError = validateUserInfoDraft();
    if (validationError) {
      setUserInfoError(validationError);
      return;
    }

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
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logout();
      setIsLogoutModalOpen(false);
      router.replace('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setIsLogoutModalOpen(false);
      setAlertState({
        title: 'Logout Failed',
        message,
        tone: 'error',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSyncPress = async () => {
    try {
      const summary = await sync();

      if (summary.errors.length > 0) {
        setAlertState({
          title: 'Sync Incomplete',
          message: summary.errors[0],
          tone: 'warning',
        });
        return;
      }

      setAlertState({
        title: 'Sync Complete',
        message: `Uploaded ${summary.uploaded}, downloaded ${summary.downloaded}.`,
        tone: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAlertState({
        title: 'Sync Failed',
        message,
        tone: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#141313]" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-24 pt-6">
        <View className="items-center">
          <View className="h-28 w-28 items-center justify-center rounded-full border-4 border-[#9F6DFD] bg-[#232327]">
            <Text className="text-4xl font-black text-white">{initialsFromName(user?.firstName, user?.lastName, user?.username)}</Text>
          </View>
          <Text className="mt-4 text-3xl font-black text-white">{displayName}</Text>
          <Text className="mt-1 text-base text-neutral-400">{user?.email ?? 'No email available'}</Text>
        </View>

        {error ? <Text className="mt-4 text-sm text-red-300">{error}</Text> : null}

        <View className="mt-8">
          <View className="mb-3 flex-row items-end justify-between">
            <Text className="text-2xl font-bold text-white">Body Stats</Text>
            <Pressable onPress={openBodyStatsModal}>
              <Text className="text-sm font-semibold text-[#DBB8FF]">Edit</Text>
            </Pressable>
          </View>

          <View className="rounded-3xl border border-white/10 bg-[#1B1B1F] p-5">
            <View className="flex-row items-end justify-between">
              <View>
                <Text className="text-xs uppercase tracking-[2px] text-neutral-400">Current Weight</Text>
                <Text className="mt-1 text-4xl font-black text-[#DBB8FF]">{user?.weight ?? '--'}</Text>
              </View>
              <Pressable className="rounded-xl bg-[#6F31F5] px-3 py-2" onPress={openBodyStatsModal}>
                <Text className="text-sm font-semibold text-white">Update</Text>
              </Pressable>
            </View>

            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-white/10 bg-[#222227] p-3">
                <Text className="text-xs uppercase tracking-[1px] text-neutral-400">Age</Text>
                <Text className="mt-1 text-2xl font-bold text-white">{user?.age ?? '--'}</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-white/10 bg-[#222227] p-3">
                <Text className="text-xs uppercase tracking-[1px] text-neutral-400">Height</Text>
                <Text className="mt-1 text-2xl font-bold text-white">{user?.height ?? '--'} cm</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-6 rounded-3xl border border-white/10 bg-[#1B1B1F] p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Cloud Sync</Text>
            <SyncStatusChip status={profileSyncChip.status} label={profileSyncChip.label} />
          </View>

          <View className="mt-4 gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-neutral-400">Last backup</Text>
              <Text className="text-sm font-medium text-white">
                {lastSynced ? lastSynced.toLocaleTimeString() : 'Never'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-neutral-400">Queued changes</Text>
              <Text className="text-sm font-medium text-white">{pendingCount}</Text>
            </View>
          </View>

          <Pressable
            className="mt-5 rounded-2xl bg-[#6F31F5] py-4"
            onPress={() => void handleSyncPress()}
            disabled={isSyncing}
          >
            <Text className="text-center text-lg font-bold text-white">{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
          </Pressable>
        </View>

        <View className="mt-6 rounded-3xl border border-white/10 bg-[#1B1B1F] p-4">
          <Text className="mb-2 text-2xl font-bold text-white">Settings</Text>

          <Pressable className="rounded-xl border border-white/10 bg-[#25252A] px-4 py-3" onPress={openUserInfoModal}>
            <Text className="text-base font-semibold text-white">Edit User Info</Text>
          </Pressable>

          <Pressable className="mt-3 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3" onPress={confirmLogout}>
            <Text className="text-base font-semibold text-red-300">Logout</Text>
          </Pressable>
        </View>

        <Text className="mt-8 text-center text-xs uppercase tracking-[2px] text-neutral-500">FitQuest v{appVersion}</Text>
      </ScrollView>

      <ThemedConfirmModal
        visible={isLogoutModalOpen}
        title="Log Out"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        tone="danger"
        isLoading={isLoggingOut}
        onCancel={() => {
          if (!isLoggingOut) {
            setIsLogoutModalOpen(false);
          }
        }}
        onConfirm={() => void handleConfirmLogout()}
      />

      <ThemedAlertModal
        visible={alertState !== null}
        title={alertState?.title ?? ''}
        message={alertState?.message ?? ''}
        tone={alertState?.tone ?? 'info'}
        onClose={() => setAlertState(null)}
      />

      <Modal visible={isUserInfoModalOpen} transparent animationType="slide" onRequestClose={closeUserInfoModal}>
        <View className="flex-1 justify-end bg-black/70">
          <SafeAreaView className="rounded-t-3xl border border-white/10 bg-[#141313] p-5" edges={['bottom']}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-white">Edit User Info</Text>
              <Pressable onPress={closeUserInfoModal}>
                <Text className="text-sm font-semibold text-neutral-300">Close</Text>
              </Pressable>
            </View>

            {userInfoError ? <Text className="mb-2 text-sm text-red-300">{userInfoError}</Text> : null}

            <View className="gap-3 pb-4">
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

              <Pressable
                className="mt-2 rounded-2xl bg-[#6F31F5] py-4"
                onPress={() => void handleSaveUserInfo()}
                disabled={isSavingUserInfo}
              >
                <Text className="text-center text-base font-bold text-white">
                  {isSavingUserInfo ? 'Saving...' : 'Save User Info'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={isBodyStatsModalOpen} transparent animationType="slide" onRequestClose={closeBodyStatsModal}>
        <View className="flex-1 justify-end bg-black/70">
          <SafeAreaView className="rounded-t-3xl border border-white/10 bg-[#141313] p-5" edges={['bottom']}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-white">Update Body Stats</Text>
              <Pressable onPress={closeBodyStatsModal}>
                <Text className="text-sm font-semibold text-neutral-300">Close</Text>
              </Pressable>
            </View>

            {bodyStatsError ? <Text className="mb-2 text-sm text-red-300">{bodyStatsError}</Text> : null}

            <View className="gap-3 pb-4">
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

              <Pressable
                className="mt-2 rounded-2xl bg-[#6F31F5] py-4"
                onPress={() => void handleSaveBodyStats()}
                disabled={isSavingBodyStats}
              >
                <Text className="text-center text-base font-bold text-white">
                  {isSavingBodyStats ? 'Saving...' : 'Save Stats'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
