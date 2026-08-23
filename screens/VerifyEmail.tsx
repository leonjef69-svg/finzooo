import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MailCheck } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";

export default function VerifyEmail({
  email,
  onCheckAgain,
  onResend,
  onLogout,
}: {
  email: string;
  onCheckAgain: () => Promise<boolean>;
  onResend: () => Promise<void>;
  onLogout: () => void;
}) {
  const { t } = useAppData();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const insets = useSafeAreaInsets();

  async function handleCheck() {
    if (checking || resending) return;
    setChecking(true);
    setMessage("");
    try {
      const verified = await onCheckAgain();
      if (!verified) {
        setMessage(t("verifyEmail.notDetected"));
      }
    } catch {
      // Un fallo de red o de Firebase no puede dejar a la persona mirando
      // un círculo para siempre. El botón vuelve a estar disponible abajo.
      setMessage(t("verifyEmail.notDetected"));
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    if (checking || resending) return;
    setResending(true);
    setMessage("");
    try {
      await onResend();
      setMessage(t("verifyEmail.resent"));
    } catch {
      setMessage(t("verifyEmail.notDetected"));
    } finally {
      setResending(false);
    }
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-noche px-6 justify-center"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-3xl bg-emerald-50 items-center justify-center mb-6">
          <MailCheck size={30} color="#059669" />
        </View>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-2 text-center">
          {t("verifyEmail.title")}
        </Text>
        <Text className="text-sm text-slate-600 dark:text-slate-200 leading-relaxed text-center px-2">
          {t("verifyEmail.sentTo")}{"\n"}
          <Text className="font-bold text-slate-700 dark:text-slate-200">{email}</Text>
          {"\n"}
          {t("verifyEmail.openToConfirm")}
        </Text>
        <Text className="text-xs text-amber-700 dark:text-amber-300 text-center mt-3">
          {t("verifyEmail.spamHint")}
        </Text>
      </View>

      {message ? <Text className="text-xs text-center text-slate-600 dark:text-slate-200 mb-4">{message}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleCheck}
        disabled={checking || resending}
        className={`w-full bg-emerald-600 py-4 rounded-2xl items-center justify-center ${
          checking ? "opacity-70" : ""
        }`}
      >
        {checking ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-bold">{t("verifyEmail.checkButton")}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleResend}
        disabled={checking || resending}
        className="mt-4 items-center py-2"
      >
        <Text className="text-sm text-emerald-600 font-bold">
          {resending ? t("verifyEmail.resending") : t("verifyEmail.resendButton")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.7} onPress={onLogout} className="mt-4 items-center py-2">
        <Text className="text-sm text-slate-500 dark:text-slate-300">{t("verifyEmail.useOtherAccount")}</Text>
      </TouchableOpacity>
    </View>
  );
}
