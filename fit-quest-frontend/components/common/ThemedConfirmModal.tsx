import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

type ConfirmTone = 'default' | 'danger';

type ThemedConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ThemedConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ThemedConfirmModalProps) {
  const confirmClassName =
    tone === 'danger'
      ? 'rounded-xl bg-red-500 px-4 py-3'
      : 'rounded-xl bg-[#6F31F5] px-4 py-3';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/65 px-6">
        <Pressable className="absolute inset-0" onPress={isLoading ? undefined : onCancel} />

        <View className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1B1B1F] p-5">
          <Text className="text-2xl font-bold text-white">{title}</Text>
          <Text className="mt-2 text-sm leading-6 text-neutral-300">{message}</Text>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              className="flex-1 items-center rounded-xl border border-white/15 bg-[#232327] px-4 py-3"
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text className="text-base font-semibold text-neutral-200">{cancelLabel}</Text>
            </Pressable>
            <Pressable
              className={`${confirmClassName} flex-1 items-center`}
              style={({ pressed }) => (pressed && !isLoading ? { opacity: 0.92 } : undefined)}
              onPress={onConfirm}
              disabled={isLoading}
            >
              <View className="min-h-6 flex-row items-center justify-center gap-2">
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text className="text-base font-semibold text-white">{confirmLabel}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
