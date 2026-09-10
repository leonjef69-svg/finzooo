import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = true,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
    <View className="flex-1 items-center justify-center px-8" accessibilityViewIsModal>
      <TouchableOpacity
        className="absolute inset-0 bg-slate-900/50"
        activeOpacity={1}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
      />
      <View className="self-center bg-white dark:bg-noche-2 rounded-3xl p-6 w-full" style={{ maxHeight: "80%", maxWidth: 480 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base mb-1.5">{title}</Text>
          <Text className="text-sm text-slate-600 dark:text-slate-200">{message}</Text>
        </ScrollView>
        <View className="flex-row gap-3">
          <TouchableOpacity onPress={onCancel} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-noche-2 items-center">
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className="font-bold text-slate-600 dark:text-slate-200">{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            className={`flex-1 py-3 rounded-xl items-center ${danger ? "bg-rose-500" : "bg-emerald-600"}`}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className="font-bold text-white">{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    </Modal>
  );
}
