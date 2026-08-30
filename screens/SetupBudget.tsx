import { useState } from "react";
import { Image, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Bell, ChevronRight, Globe2, Target } from "lucide-react-native";
import { currencySymbolFor } from "@/constants/currencies";
import { countryById } from "@/constants/countries";
import { useAppData } from "@/contexts/AppDataContext";
import { sanitizeAmountInput } from "@/utils/amount";

export default function SetupBudget({ onSaved }: { onSaved: (amount: number) => void }) {
  const { userCurrency, userCountry, t, monthNames } = useAppData();
  const [amount, setAmount] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const now = new Date();
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const parsed = parseFloat(amount) || 0;
  const disabled = !amount || parsed <= 0;

  async function enableNotifications() {
    if (notificationsEnabled) { setNotificationsEnabled(false); return; }
    try {
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Avisos de Fino", importance: Notifications.AndroidImportance.DEFAULT });
      const result = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(result.granted);
    } catch { setNotificationsEnabled(false); }
  }

  return (
    <View className="flex-1 bg-[#17100c] px-6 justify-center">
      <Image source={require("../assets/images/onboarding/fino-sunset-background.png")} resizeMode="cover" className="absolute inset-0 h-full w-full" />
      <View className="absolute inset-0 bg-black/45" />
      <View className="rounded-[28px] bg-white/95 p-5">
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-3xl bg-emerald-50 items-center justify-center mb-6">
          <Target size={30} color="#059669" />
        </View>
        <Text className="text-xl font-extrabold text-slate-900 mb-2 text-center">Configura Fino</Text>
        <Text className="text-sm text-slate-600 dark:text-slate-200 leading-relaxed text-center px-2">
          {t("setup.subtitle")}
        </Text>
      </View>

      <TouchableOpacity onPress={() => router.push("/country")} className="mb-2 flex-row items-center rounded-2xl bg-white border border-slate-200 px-4 py-3"><Globe2 size={20} color="#d97706" /><Text className="ml-3 flex-1 font-bold text-slate-900">País</Text><Text className="mr-2 text-slate-600">{countryById(userCountry)?.name ?? userCountry}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/currency")} className="mb-2 flex-row items-center rounded-2xl bg-white border border-slate-200 px-4 py-3"><Text className="text-xl">💰</Text><Text className="ml-3 flex-1 font-bold text-slate-900">Moneda</Text><Text className="mr-2 text-slate-600">{currencySymbolFor(userCurrency)} · {userCurrency}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity onPress={enableNotifications} className="mb-4 flex-row items-center rounded-2xl bg-white border border-slate-200 px-4 py-3"><Bell size={20} color="#7c3aed" /><Text className="ml-3 flex-1 font-bold text-slate-900">Avisos</Text><Text className={notificationsEnabled ? "font-bold text-emerald-600" : "text-slate-500"}>{notificationsEnabled ? "Activado" : "Desactivado"}</Text></TouchableOpacity>

      <View>
        <Text className="text-xs font-semibold text-slate-500 dark:text-slate-300 text-center mb-2">{monthLabel}</Text>
        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5 text-center">
          {t("setup.monthlyBudget")}
        </Text>
        <View className="flex-row items-center justify-center bg-slate-50 dark:bg-noche-2 rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde px-4 py-5">
          <Text className="text-slate-500 dark:text-slate-300 font-bold text-xl mr-1">{currencySymbolFor(userCurrency)}</Text>
          <TextInput
            disableFullscreenUI            autoFocus
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 text-center w-40"
          />
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onSaved(parsed)}
        disabled={disabled}
        className={`w-full mt-8 bg-emerald-600 py-4 rounded-2xl items-center justify-center ${
          disabled ? "opacity-40" : ""
        }`}
      >
        <Text className="text-white font-bold">{t("setup.start")}</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
}
