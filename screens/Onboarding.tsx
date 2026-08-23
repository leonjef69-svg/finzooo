import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { Bell, ChevronRight, Landmark, ReceiptText, Sparkles, WalletCards } from "lucide-react-native";
import { COUNTRIES, type Country } from "@/constants/countries";
import { currencyLabelFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { deviceCountry } from "@/utils/deviceLocale";

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { t, setInitialCountry } = useAppData();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<Country>(() => deviceCountry());
  const [choosing, setChoosing] = useState(false);
  const [asking, setAsking] = useState(false);
  const insets = useSafeAreaInsets();

  function nextStep() {
    if (step === 1) setInitialCountry(country.language, country.currency);
    setStep(step + 1);
  }

  async function allowNotifications() {
    if (asking) return;
    setAsking(true);
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Fino",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      await Notifications.requestPermissionsAsync();
    } finally {
      setAsking(false);
      onFinish();
    }
  }

  return (
    <LinearGradient colors={["#fff7ed", "#ecfdf5", "#dbeafe"]} className="flex-1">
      <View className="flex-1" style={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }}>
        {step === 0 ? (
          <View className="flex-1 px-6 justify-center">
            <View className="h-60 overflow-hidden rounded-[32px] bg-emerald-600 mb-7">
              <View className="absolute top-6 right-7 w-14 h-14 rounded-full bg-amber-300" />
              <View className="absolute -bottom-10 -left-12 w-60 h-44 rounded-full bg-emerald-800" />
              <View className="absolute -bottom-16 right-[-25px] w-64 h-52 rounded-full bg-teal-700" />
              <View className="absolute bottom-7 left-8 right-8 flex-row items-end gap-2">
                {[42, 68, 52, 86, 60].map((h, i) => <View key={i} className="flex-1 rounded-t-md bg-white/90" style={{ height: h }} />)}
              </View>
              <View className="absolute top-7 left-7 px-4 py-3 rounded-2xl bg-white flex-row items-center gap-2">
                <WalletCards size={22} color="#059669" />
                <Text className="font-extrabold text-slate-900">Fino</Text>
              </View>
            </View>
            <Text className="text-3xl font-black text-slate-900 mb-3">{t("onboarding.welcomeTitle")}</Text>
            <Text className="text-base leading-6 text-slate-600">{t("onboarding.welcomeBody")}</Text>
            <View className="flex-row gap-2 mt-6">
              {[[ReceiptText, t("onboarding.auto")], [Landmark, t("onboarding.budget")], [Sparkles, t("onboarding.insights")]].map(([Icon, label]: any, i) => (
                <View key={i} className="flex-1 bg-white/80 rounded-2xl p-3 items-center gap-2">
                  <Icon size={20} color="#059669" />
                  <Text className="text-[11px] font-bold text-slate-700 text-center">{label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : step === 1 ? (
          <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <Text className="text-3xl font-black text-slate-900 mb-2">{t("onboarding.countryTitle")}</Text>
            <Text className="text-sm text-slate-600 mb-6">{t("onboarding.countryBody")}</Text>
            <View className="bg-white rounded-[28px] p-5">
              <Text className="text-5xl mb-3">{country.flag}</Text>
              <Text className="text-xl font-extrabold text-slate-900">{t(country.label)}</Text>
              <Text className="text-sm text-slate-500 mt-1">{currencyLabelFor(country.currency, t)} · {country.currency}</Text>
              <TouchableOpacity onPress={() => setChoosing((v) => !v)} className="mt-5 rounded-2xl bg-slate-100 py-3 items-center">
                <Text className="font-bold text-emerald-700">{t("onboarding.changeCountry")}</Text>
              </TouchableOpacity>
            </View>
            {choosing && <View className="mt-3 bg-white rounded-3xl p-2">
              {COUNTRIES.map((item) => <TouchableOpacity key={item.id} onPress={() => { setCountry(item); setChoosing(false); }} className="flex-row items-center px-3 py-3 rounded-2xl">
                <Text className="text-2xl mr-3">{item.flag}</Text><Text className="flex-1 font-semibold text-slate-800">{t(item.label)}</Text><Text className="text-xs text-slate-500">{item.currency}</Text>
              </TouchableOpacity>)}
            </View>}
          </ScrollView>
        ) : (
          <View className="flex-1 px-6 justify-center">
            <View className="w-20 h-20 rounded-[28px] bg-emerald-600 items-center justify-center mb-7"><Bell size={36} color="white" /></View>
            <Text className="text-3xl font-black text-slate-900 mb-3">{t("onboarding.notificationsTitle")}</Text>
            <Text className="text-base leading-6 text-slate-600 mb-7">{t("onboarding.notificationsBody")}</Text>
            <View className="bg-white/80 rounded-3xl p-5"><Text className="font-bold text-slate-900">{t("onboarding.notificationsPromise")}</Text></View>
          </View>
        )}
        <View className="px-6 pt-4">
          <TouchableOpacity onPress={() => step < 2 ? nextStep() : allowNotifications()} className="bg-emerald-600 rounded-2xl py-4 flex-row justify-center items-center gap-2">
            <Text className="text-white font-extrabold">{step === 2 ? (asking ? t("onboarding.allowing") : t("onboarding.allow")) : t("onboarding.next")}</Text><ChevronRight size={18} color="white" />
          </TouchableOpacity>
          {step === 2 && <TouchableOpacity onPress={onFinish} className="py-3 items-center"><Text className="text-sm font-semibold text-slate-500">{t("onboarding.later")}</Text></TouchableOpacity>}
        </View>
      </View>
    </LinearGradient>
  );
}
