import { Text, View } from 'react-native';

type SyncStatus = 'synced' | 'pending' | 'failed';

type SyncStatusChipProps = {
  status: SyncStatus;
  label?: string;
};

function getChipClasses(status: SyncStatus): { chipClassName: string; textClassName: string; defaultLabel: string } {
  if (status === 'synced') {
    return {
      chipClassName: 'border-emerald-400/40 bg-emerald-400/15',
      textClassName: 'text-emerald-300',
      defaultLabel: 'SYNCED',
    };
  }

  if (status === 'failed') {
    return {
      chipClassName: 'border-red-400/40 bg-red-400/15',
      textClassName: 'text-red-300',
      defaultLabel: 'FAILED',
    };
  }

  return {
    chipClassName: 'border-violet-400/40 bg-violet-400/15',
    textClassName: 'text-violet-300',
    defaultLabel: 'PENDING',
  };
}

export function SyncStatusChip({ status, label }: SyncStatusChipProps) {
  const styles = getChipClasses(status);

  return (
    <View className={`rounded-full border px-3 py-1 ${styles.chipClassName}`}>
      <Text className={`text-xs font-bold tracking-[1px] ${styles.textClassName}`}>
        {label ?? styles.defaultLabel}
      </Text>
    </View>
  );
}
