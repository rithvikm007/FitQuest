import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useSync } from '@/contexts/SyncContext';

type SyncStatusIndicatorProps = {
  onSyncPress: () => void;
};

function formatRelativeTime(value: Date | null): string {
  if (!value) {
    return 'Never synced';
  }

  const diffMs = Date.now() - value.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return 'Just now';
  }

  if (diffMins < 60) {
    return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function SyncStatusIndicator({ onSyncPress }: SyncStatusIndicatorProps) {
  const { isSyncing, pendingCount, lastSynced } = useSync();

  return (
    <View className="items-end gap-1">
      <Pressable className="relative rounded-full bg-secondary px-3 py-2" onPress={onSyncPress} disabled={isSyncing}>
        <Ionicons name={isSyncing ? 'sync' : 'cloud-upload-outline'} size={20} color="#FFFFFF" />

        {pendingCount > 0 ? (
          <View className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 py-0.5">
            <Text className="text-center text-[10px] font-semibold text-white">{pendingCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Text className="text-xs text-neutral-300">{isSyncing ? 'Syncing...' : formatRelativeTime(lastSynced)}</Text>
    </View>
  );
}
