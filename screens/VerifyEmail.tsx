import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
    <View className="flex-1 bg-[#17100c]">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image
        source={require("../assets/images/onboarding/fino-sunset-background.png")}
        resizeMode="cover"
        className="absolute inset-0 h-full w-full"
        style={{ transform: [{ scale: 1.12 }, { translateY: 70 }] }}
      />
      <View className="absolute inset-0 bg-black/40" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 120,
          paddingBottom: insets.bottom + 24,
        }}
      >
      <View>
      <View className="items-center mb-7">
        <Text className="text-3xl font-extrabold text-white mb-1 text-center">
          {t("verifyEmail.title")}
        </Text>
        <Text className="text-base font-semibold text-white/90 mb-7">Te enviamos un enlace</Text>
        <Text className="mb-7 text-[92px] leading-[106px]">✉️</Text>
        <View className="w-full rounded-2xl bg-white/95 px-6 py-5">
          <Text className="text-base text-center text-slate-600">{t("verifyEmail.sentTo")}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit className="mt-1 text-center font-extrabold text-slate-900">{email}</Text>
          <Text className="mt-2 text-sm text-center text-slate-500">{t("verifyEmail.spamHint")}</Text>
        </View>
      </View>

      {message ? <Text className="text-xs text-center text-white mb-4">{message}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleCheck}
        disabled={checking || resending}
        className={`w-full bg-amber-500 py-4 rounded-2xl items-center justify-center ${
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
        className="mt-3 rounded-2xl border-2 border-amber-400 items-center py-3.5"
      >
        <Text className="text-sm text-amber-300 font-bold">
          {resending ? t("verifyEmail.resending") : t("verifyEmail.resendButton")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.7} onPress={onLogout} className="mt-4 items-center py-2">
        <Text className="text-sm font-semibold text-white">{t("verifyEmail.useOtherAccount")}</Text>
      </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}
