import { useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronRight, Globe2, Moon, Sun, WalletCards } from "lucide-react-native";
import { currencySymbolFor } from "@/constants/currencies";
import { languageLabelFor } from "@/constants/i18n";
import { currencyFlagFor, languageFlagFor } from "@/utils/decorativeFlags";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { irUnaVez } from "@/utils/nav";
import { useSetupNotifications } from "@/utils/setupNotifications";

export default function SetupBudget({ onSaved }: { onSaved: (amount: number) => void | Promise<void> }) {
  const { userCurrency, userLanguage, t, monthNames, themeMode, updateThemeMode } = useAppData();
  const [amount, setAmount] = useState("");
  const { notificationsEnabled, notificationBusy, notificationErrorKey, enableNotifications } = useSetupNotifications(auth.currentUser?.uid ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveBusy = useRef(false);
  const insets = useSafeAreaInsets();
  const now = new Date();
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const parsed = parseAmountInput(amount, userCurrency);
  const amountError = amountInputError(amount, userCurrency);
  const disabled = !amount || parsed <= 0 || !!amountError || saving || notificationBusy || !auth.currentUser;

  async function saveSetup() {
    if (saveBusy.current || disabled) return;
    saveBusy.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await onSaved(parsed);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("setup.saveFailed"));
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-[#17100c]"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image
        source={require("../assets/images/onboarding/fino-settings-background.png")}
        resizeMode="cover"
        className="absolute inset-0 h-full w-full"
      />
      <View className="absolute inset-0 bg-black/40" />
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
        <Text className="text-2xl font-extrabold text-white mb-2 text-center">{t("setup.configureTitle")}</Text>
        <Text className="text-sm text-white/90 leading-relaxed text-center px-2">
          {t("setup.subtitle")}
        </Text>
      </View>

      <TouchableOpacity disabled={saving} onPress={() => { if (!saveBusy.current) irUnaVez("/language"); }} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Globe2 size={20} color="#d97706" /><Text className="ml-3 flex-1 font-bold text-slate-900">{t("settings.language")}</Text><Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="mr-2 text-xl">{languageFlagFor(userLanguage)}</Text><Text numberOfLines={1} className="max-w-[45%] mr-2 text-slate-600">{languageLabelFor(userLanguage)}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity disabled={saving} onPress={() => { if (!saveBusy.current) irUnaVez("/currency"); }} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="text-xl">{currencyFlagFor(userCurrency)}</Text><Text className="ml-3 flex-1 font-bold text-slate-900">{t("settings.currency")}</Text><Text className="mr-2 text-slate-600">{currencySymbolFor(userCurrency)} · {userCurrency}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      <TouchableOpacity disabled={saving || notificationBusy} onPress={() => { if (!saveBusy.current) void enableNotifications(); }} className="mb-3 flex-row items-center rounded-2xl bg-white/95 px-4 py-4"><Bell size={20} color="#7c3aed" /><Text className="ml-3 flex-1 font-bold text-slate-900">{t("settings.notifications")}</Text><Text className={notificationsEnabled ? "font-bold text-emerald-600" : "text-slate-500"}>{t(notificationsEnabled ? "setup.notificationsOn" : "setup.notificationsOff")}</Text><ChevronRight size={18} color="#64748b" /></TouchableOpacity>
      {notificationErrorKey ? <Text accessibilityRole="alert" className="mb-3 text-xs font-semibold text-red-200">{t(notificationErrorKey)}</Text> : null}

      <View className="mb-3 rounded-2xl bg-white/95 px-4 py-3.5">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-slate-900">{t("setup.appearance")}</Text>
          <View className="flex-row rounded-xl bg-slate-100 p-1">
            <TouchableOpacity
              onPress={() => updateThemeMode("light")}
              accessibilityRole="button"
              accessibilityLabel={t("setup.lightAppearance")}
              className={`h-9 w-12 items-center justify-center rounded-lg ${themeMode === "light" ? "bg-amber-400" : ""}`}
            >
              <Sun size={17} color={themeMode === "light" ? "#ffffff" : "#64748b"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateThemeMode("dark")}
              accessibilityRole="button"
              accessibilityLabel={t("setup.darkAppearance")}
              className={`h-9 w-12 items-center justify-center rounded-lg ${themeMode === "dark" ? "bg-slate-800" : ""}`}
            >
              <Moon size={17} color={themeMode === "dark" ? "#ffffff" : "#64748b"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

        <View className="flex-row items-center bg-white/95 rounded-2xl px-4 py-3.5">
          <WalletCards size={20} color="#d97706" />
          <View className="ml-3 mr-2">
            <Text className="font-bold text-slate-900">{t("setup.monthlyBudget")}</Text>
            <Text className="text-[10px] text-slate-500">{monthLabel}</Text>
          </View>
          <View className="ml-auto w-[148px] flex-row items-center justify-end">
          <Text className="text-slate-500 font-bold text-sm mr-1">{currencySymbolFor(userCurrency)}</Text>
          <TextInput
            disableFullscreenUI
            keyboardType="decimal-pad"
            value={amount}
            editable={!saving}
            onChangeText={(v) => {
              const safe = sanitizeSafeAmountInput(v, userCurrency);
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

      {amountError ? <Text className="mt-2 text-xs font-semibold text-red-200">{t(amountError === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")}</Text> : null}
      {saveError ? <Text accessibilityRole="alert" className="mt-2 text-xs font-semibold text-red-200">{saveError}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={saveSetup}
        disabled={disabled}
        className={`w-full mt-8 bg-amber-500 py-4 rounded-2xl items-center justify-center ${
          disabled ? "opacity-40" : ""
        }`}
      >
        {saving ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-bold">{t("setup.start")}</Text>}
      </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
