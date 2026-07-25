import { Text, TouchableOpacity, View } from "react-native";

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
    <View className="absolute inset-0 items-center justify-center px-8 z-50">
      <TouchableOpacity
        className="absolute inset-0 bg-slate-900/50"
        activeOpacity={1}
        onPress={onCancel}
      />
      <View className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full">
        <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base mb-1.5">{title}</Text>
        <Text className="text-sm text-slate-600 dark:text-slate-200 mb-5">{message}</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity onPress={onCancel} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 items-center">
            <Text className="font-bold text-slate-600 dark:text-slate-200">{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            className={`flex-1 py-3 rounded-xl items-center ${danger ? "bg-rose-500" : "bg-emerald-600"}`}
          >
            <Text className="font-bold text-white">{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
