import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { Bell, ChevronRight, Globe2, WalletCards } from "lucide-react-native";
import { currencySymbolFor } from "@/constants/currencies";
import { countryById } from "@/constants/countries";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { irUnaVez } from "@/utils/nav";

const notificationKey = () => `@fino/setup-notifications-enabled:${auth.currentUser?.uid ?? "local"}`;

export default function SetupBudget({ onSaved }: { onSaved: (amount: number) => void }) {
  const { userCurrency, userCountry, t, monthNames } = useAppData();
  const [amount, setAmount] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const insets = useSafeAreaInsets();
  const now = new Date();
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const parsed = parseAmountInput(amount);
  const disabled = !amount || parsed <= 0;

  useEffect(() => {
    async function refreshNotificationState() {
      try {
        const [enabledByUser, permission] = await Promise.all([
          AsyncStorage.getItem(notificationKey()),
          Notifications.getPermissionsAsync(),
        ]);
        const enabled = (enabledByUser === "true" || enabledByUser === "pending") && permission.granted;
        setNotificationsEnabled(enabled);
        if (enabled && enabledByUser !== "true") await AsyncStorage.setItem(notificationKey(), "true");
      } catch {
        setNotificationsEnabled(false);
      }
    }
    refreshNotificationState();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshNotificationState();
    });
    return () => subscription.remove();
  }, []);

  async function enableNotifications() {
    if (notificationsEnabled) {
      await Linking.openSettings();
      return;
    }
    try {
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Avisos de Fino", importance: Notifications.AndroidImportance.DEFAULT });
      await AsyncStorage.setItem(notificationKey(), "pending");
      await Linking.openSettings();
    } catch { setNotificationsEnabled(false); }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-[#17100c]"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image source={require("../assets/images/onboarding/fino-sunset-background.png")} resizeMode="cover" blurRadius={12} className="absolute inset-0 h-full w-full" />
      <View className="absolute inset-0 bg-black/55" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
      <View>
      <View className="items-center mb-7">
        <Text className="text-2xl font-extrabold text-white mb-2 text-center">Configura Fino</Text>
        <Text className="text-sm text-white/90 leading-relaxed text-center px-2">
          {t("setup.subtitle")}
        </Text>
      </View>

      <TouchableOpacity onPress={() => irUnaVez("/country")} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Globe2 size={20} color="#d97706" /><Text className="ml-3 flex-1 font-bold text-slate-900">País</Text><Text className="mr-2 text-slate-600">{countryById(userCountry)?.name ?? userCountry}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity onPress={() => irUnaVez("/currency")} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Text className="text-xl">💰</Text><Text className="ml-3 flex-1 font-bold text-slate-900">Moneda</Text><Text className="mr-2 text-slate-600">{currencySymbolFor(userCurrency)} · {userCurrency}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity onPress={enableNotifications} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Bell size={20} color="#7c3aed" /><Text className="ml-3 flex-1 font-bold text-slate-900">Avisos</Text><Text className={notificationsEnabled ? "font-bold text-emerald-600" : "text-slate-500"}>{notificationsEnabled ? "Activado" : "Desactivado"}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>

        <View className="flex-row items-center bg-white/95 rounded-2xl px-4 py-3.5">
          <WalletCards size={20} color="#d97706" />
          <View className="ml-3 mr-2">
            <Text className="font-bold text-slate-900">Presupuesto</Text>
            <Text className="text-[10px] text-slate-500">{monthLabel}</Text>
          </View>
          <View className="ml-auto w-[148px] flex-row items-center justify-end">
          <Text className="text-slate-500 font-bold text-sm mr-1">{currencySymbolFor(userCurrency)}</Text>
          <TextInput
            disableFullscreenUI
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => {
              const safe = sanitizeSafeAmountInput(v);
              const [whole = "", decimals] = safe.split(".");
              const normalized = whole.replace(/^0+(?=\d)/, "");
              setAmount(decimals === undefined ? normalized : `${normalized || "0"}.${decimals}`);
            }}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            maxFontSizeMultiplier={1.15}
            style={{ fontSize: amount.length > 12 ? 11 : amount.length > 9 ? 13 : amount.length > 7 ? 16 : 20 }}
            className="min-w-0 flex-1 font-extrabold text-slate-900 text-right"
          />
          </View>
        </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onSaved(parsed)}
        disabled={disabled}
        className={`w-full mt-8 bg-amber-500 py-4 rounded-2xl items-center justify-center ${
          disabled ? "opacity-40" : ""
        }`}
      >
        <Text className="text-white font-bold">{t("setup.start")}</Text>
      </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
