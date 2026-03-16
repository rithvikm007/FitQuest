import { Modal, Pressable, Text, View } from 'react-native';

type AlertTone = 'info' | 'success' | 'warning' | 'error';

type ThemedAlertModalProps = {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  tone?: AlertTone;
  onClose: () => void;
};

const toneClassMap: Record<AlertTone, { iconBg: string; iconText: string; accent: string; button: string }> = {
  info: {
    iconBg: 'bg-[#3B82F6]/20',
    iconText: 'text-[#93C5FD]',
    accent: 'text-[#93C5FD]',
    button: 'bg-[#2563EB]',
  },
  success: {
    iconBg: 'bg-emerald-500/20',
    iconText: 'text-emerald-300',
    accent: 'text-emerald-300',
    button: 'bg-emerald-600',
  },
  warning: {
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-300',
    accent: 'text-amber-300',
    button: 'bg-amber-500',
  },
  error: {
    iconBg: 'bg-red-500/20',
    iconText: 'text-red-300',
    accent: 'text-red-300',
    button: 'bg-red-500',
  },
};

function getIconForTone(tone: AlertTone): string {
  if (tone === 'success') {
    return '✓';
  }

  if (tone === 'warning') {
    return '!';
  }

  if (tone === 'error') {
    return '×';
  }

  return 'i';
}

export function ThemedAlertModal({
  visible,
  title,
  message,
  buttonLabel = 'OK',
  tone = 'info',
  onClose,
}: ThemedAlertModalProps) {
  const toneClasses = toneClassMap[tone];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/65 px-6">
        <Pressable className="absolute inset-0" onPress={onClose} />

        <View className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1B1B1F] p-5">
          <View className="flex-row items-start gap-3">
            <View className={`h-9 w-9 items-center justify-center rounded-full ${toneClasses.iconBg}`}>
              <Text className={`text-xl font-black ${toneClasses.iconText}`}>{getIconForTone(tone)}</Text>
            </View>
            <View className="flex-1">
              <Text className={`text-2xl font-bold ${toneClasses.accent}`}>{title}</Text>
              <Text className="mt-2 text-sm leading-6 text-neutral-200">{message}</Text>
            </View>
          </View>

          <Pressable className={`mt-6 items-center rounded-xl px-4 py-3 ${toneClasses.button}`} onPress={onClose}>
            <Text className="text-base font-semibold text-white">{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
