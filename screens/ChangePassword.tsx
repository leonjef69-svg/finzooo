import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyRound } from "lucide-react-native";
import AuthField from "@/components/AuthField";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

type Errors = { currentPassword?: string; newPassword?: string; confirmPassword?: string; general?: string };

export default function ChangePassword({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    const e: Errors = {};
    if (!currentPassword) e.currentPassword = t("changePassword.currentPasswordError");
    if (newPassword.length < 8) e.newPassword = t("changePassword.newPasswordError");
    if (confirmPassword !== newPassword) e.confirmPassword = t("changePassword.confirmError");
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await onSubmit(currentPassword, newPassword);
      setDone(true);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      setErrors({ general: firebaseErrorMessage(code) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("changePassword.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {done ? (
          <View className="items-center px-8 pt-14">
            <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-4">
              <KeyRound size={26} color="#059669" />
            </View>
            <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100 text-center">
              {t("changePassword.success")}
            </Text>
            <TouchableOpacity
              onPress={onBack}
              className="w-full bg-emerald-600 py-4 rounded-2xl items-center justify-center mt-8"
            >
              <Text className="text-white font-bold">{t("changePassword.done")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="px-6 gap-4 mt-2">
            <AuthField
              label={t("changePassword.currentPasswordLabel")}
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="••••••••"
              error={errors.currentPassword}
            />
            <AuthField
              label={t("changePassword.newPasswordLabel")}
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="••••••••"
              error={errors.newPassword}
            />
            <AuthField
              label={t("changePassword.confirmPasswordLabel")}
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
              error={errors.confirmPassword}
            />
            {errors.general ? (
              <Text className="text-rose-500 text-xs font-medium text-center">{errors.general}</Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={submit}
              disabled={loading}
              className={`w-full bg-emerald-600 py-4 rounded-2xl items-center justify-center mt-2 ${
                loading ? "opacity-70" : ""
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold">{t("changePassword.submit")}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
