import { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { Bell, ChevronRight, Globe2, Target } from "lucide-react-native";
import { currencySymbolFor } from "@/constants/currencies";
import { countryById } from "@/constants/countries";
import { useAppData } from "@/contexts/AppDataContext";
import { parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { irUnaVez } from "@/utils/nav";

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
    Notifications.getPermissionsAsync().then((result) => setNotificationsEnabled(result.granted)).catch(() => setNotificationsEnabled(false));
  }, []);

  async function enableNotifications() {
    if (notificationsEnabled) return;
    try {
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Avisos de Fino", importance: Notifications.AndroidImportance.DEFAULT });
      const result = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(result.granted);
    } catch { setNotificationsEnabled(false); }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-[#17100c]"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image source={require("../assets/images/onboarding/fino-sunset-background.png")} resizeMode="cover" className="absolute inset-0 h-full w-full" />
      <View className="absolute inset-0 bg-black/45" />
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
        <View className="w-16 h-16 rounded-3xl bg-amber-50 items-center justify-center mb-5">
          <Target size={30} color="#d97706" />
        </View>
        <Text className="text-2xl font-extrabold text-white mb-2 text-center">Configura Fino</Text>
        <Text className="text-sm text-white/90 leading-relaxed text-center px-2">
          {t("setup.subtitle")}
        </Text>
      </View>

      <TouchableOpacity onPress={() => irUnaVez("/country")} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Globe2 size={20} color="#d97706" /><Text className="ml-3 flex-1 font-bold text-slate-900">País</Text><Text className="mr-2 text-slate-600">{countryById(userCountry)?.name ?? userCountry}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity onPress={() => irUnaVez("/currency")} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Text className="text-xl">💰</Text><Text className="ml-3 flex-1 font-bold text-slate-900">Moneda</Text><Text className="mr-2 text-slate-600">{currencySymbolFor(userCurrency)} · {userCurrency}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity onPress={enableNotifications} className="mb-5 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Bell size={20} color="#7c3aed" /><Text className="ml-3 flex-1 font-bold text-slate-900">Avisos</Text><Text className={notificationsEnabled ? "font-bold text-emerald-600" : "text-slate-500"}>{notificationsEnabled ? "Activado" : "Desactivado"}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>

      <View>
        <Text className="text-xs font-semibold text-white/75 text-center mb-2">{monthLabel}</Text>
        <Text className="text-xs font-semibold text-white mb-1.5 text-center">
          {t("setup.monthlyBudget")}
        </Text>
        <View className="flex-row items-center justify-center bg-white/95 rounded-2xl px-4 py-5">
          <Text className="text-slate-500 font-bold text-xl mr-1">{currencySymbolFor(userCurrency)}</Text>
          <TextInput
            disableFullscreenUI            autoFocus
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            className="text-3xl font-extrabold text-slate-900 text-center w-40"
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
