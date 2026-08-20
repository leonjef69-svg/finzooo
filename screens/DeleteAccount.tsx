import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle } from "lucide-react-native";
import AuthField from "@/components/AuthField";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

export default function DeleteAccount({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: (currentPassword: string) => Promise<void>;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!password) {
      setError(t("deleteAccount.passwordError"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      setError(firebaseErrorMessage(code));
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("deleteAccount.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="px-6 items-center pt-4">
          <View className="w-16 h-16 rounded-full bg-rose-50 items-center justify-center mb-4">
            <AlertTriangle size={26} color="#e11d48" />
          </View>
          <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100 text-center">
            {t("deleteAccount.warningTitle")}
          </Text>
          <Text className="text-sm text-slate-600 dark:text-slate-200 text-center mt-2 leading-relaxed">
            {t("deleteAccount.warningBody")}
          </Text>
        </View>

        <View className="px-6 gap-4 mt-8">
          <AuthField
            label={t("deleteAccount.confirmLabel")}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            error={error}
          />

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={submit}
            disabled={loading}
            className={`w-full bg-rose-500 py-4 rounded-2xl items-center justify-center mt-2 ${
              loading ? "opacity-70" : ""
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold">{t("deleteAccount.submit")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack} disabled={loading} className="py-2 items-center">
            <Text className="text-sm font-semibold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
