import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles, Wallet, RefreshCw } from "lucide-react-native";
import * as Updates from "expo-updates";
import { LEGAL_CONTACT_EMAIL } from "@/constants/legal";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

const APP_VERSION = "1.0.0";

export default function AppInfo({ onBack }: { onBack: () => void }) {
  const { t, showToast } = useAppData();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);

  /**
   * Busca una actualización AHORA y la aplica.
   *
   * Normalmente esto pasa solo: la app la descarga al abrirse y la aplica
   * en el siguiente arranque. Pero eso obliga a cerrar y abrir dos veces, y
   * cuando algo está roto no hay forma de saber si ya llegó el arreglo o
   * todavía se está usando la versión con el fallo. Este botón quita esa
   * duda: se toca y, si hay algo nuevo, la app se reinicia con ello.
   */
  async function checkForUpdate() {
    if (checking) return;
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        showToast(t("appInfo.updateNone"));
        return;
      }
      showToast(t("appInfo.updateDownloading"));
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      showToast(t("appInfo.updateError"));
    } finally {
      setChecking(false);
    }
  }

  // Qué código se está ejecutando ahora mismo. "Embebida" significa que es
  // la que venía dentro del APK; si no, es una actualización recibida por
  // aire. Sin esto no había forma de saber si un arreglo ya había llegado.
  const runningLabel = Updates.isEmbeddedLaunch
    ? t("appInfo.updateEmbedded")
    : `${(Updates.updateId ?? "").slice(0, 8)} · ${
        Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : "—"
      }`;
  const WHATS_NEW = [
    t("appInfo.whatsNewItem1"),
    t("appInfo.whatsNewItem2"),
    t("appInfo.whatsNewItem3"),
  ];
  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("appInfo.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="items-center pt-4 pb-6">
          <View className="w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center mb-4">
            <Wallet size={28} color="#ffffff" strokeWidth={2.2} />
          </View>
          <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Finzo</Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {t("appInfo.version", { version: APP_VERSION })}
          </Text>
          <Text className="text-[10px] text-slate-400 mt-1">{runningLabel}</Text>

          <TouchableOpacity
            onPress={checkForUpdate}
            disabled={checking}
            className="flex-row items-center gap-2 mt-4 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <RefreshCw size={14} color="#64748b" />
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
              {t(checking ? "appInfo.updateChecking" : "appInfo.updateCheck")}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-6">
          <Text className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-center">
            {t("appInfo.description")}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300 text-center mt-6">
            {t("appInfo.questions", { email: LEGAL_CONTACT_EMAIL })}
          </Text>
        </View>

        <View className="h-px bg-slate-100 dark:bg-slate-800 mx-6 mt-8 mb-6" />

        <View className="px-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Sparkles size={16} color="#059669" />
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("appInfo.whatsNew", { version: APP_VERSION })}
            </Text>
          </View>
          <View className="gap-2">
            {WHATS_NEW.map((item, i) => (
              <View key={i} className="flex-row gap-2 pl-1">
                <Text className="text-emerald-600">•</Text>
                <Text className="text-sm text-slate-600 dark:text-slate-300 flex-1 leading-relaxed">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
