import { Text, TouchableOpacity, View } from "react-native";
import { useAppData } from "@/contexts/AppDataContext";

export default function CelebrationOverlay({
  goalName,
  onClose,
}: {
  goalName: string | null;
  onClose: () => void;
}) {
  const { t } = useAppData();
  if (!goalName) return null;
  return (
    <TouchableOpacity
      className="absolute inset-0 z-50 items-center justify-center px-8"
      activeOpacity={1}
      onPress={onClose}
    >
      <View className="absolute inset-0 bg-slate-900/60" />
      <View className="bg-white dark:bg-noche-2 rounded-3xl p-7 w-full items-center">
        <Text style={{ fontSize: 48 }} className="mb-3">
          🎉
        </Text>
        <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-lg mb-1.5">{t("celebration.title")}</Text>
        <Text className="text-sm text-slate-600 dark:text-slate-200 text-center">
          {t("celebration.message", { goalName })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
