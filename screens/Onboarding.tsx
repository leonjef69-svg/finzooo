import { useState, type ReactNode } from "react";
import { ActivityIndicator, ImageBackground, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BellRing, ChartNoAxesCombined, ReceiptText, ShieldCheck } from "lucide-react-native";

type Props = { onGoogle: () => Promise<void>; onCreateAccount: () => void; onLogin: () => void };

export default function Onboarding({ onGoogle, onCreateAccount, onLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");

  async function continueWithGoogle() {
    setGoogleError("");
    setGoogleLoading(true);
    try { await onGoogle(); }
    catch (error) { setGoogleError(error instanceof Error ? error.message : "No se pudo entrar con Google."); }
    finally { setGoogleLoading(false); }
  }

  return (
    <ImageBackground
      source={require("../assets/images/onboarding/fino-person-background.png")}
      resizeMode="cover"
      className="flex-1 bg-[#17100c]"
      style={{ flex: 1 }}
      imageStyle={{ transform: [{ scale: 1.34 }, { translateY: -82 }] }}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View pointerEvents="none" className="absolute inset-0 bg-black/20" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: insets.top + 34,
          paddingBottom: insets.bottom + 18,
        }}
      >
        <View className="items-center">
          <Text className="text-5xl font-extrabold text-white">Fino<Text className="text-amber-300">✦</Text></Text>
          <Text className="mt-2 text-2xl font-extrabold text-center text-white">Tu dinero bajo control</Text>
          <Text className="mt-1 text-base font-semibold text-white/90">Simple, rápido y claro</Text>
        </View>
        <View className="mt-auto mb-5 flex-row flex-wrap justify-between gap-y-3 px-1">
          <Feature icon={<BellRing size={20} color="#15803d" />} tint="bg-emerald-50" title="Movimiento" subtitle="Automático" />
          <Feature icon={<ReceiptText size={20} color="#e11d48" />} tint="bg-rose-50" title="Comida" subtitle="S/ 45" />
          <Feature icon={<ChartNoAxesCombined size={20} color="#6d28d9" />} tint="bg-violet-50" title="Presupuesto" subtitle="S/ 500" />
          <Feature icon={<ShieldCheck size={20} color="#15803d" />} tint="bg-emerald-50" title="Ahorro" subtitle="S/ 120" />
        </View>
        <View>
          {Platform.OS === "android" ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continuar con Google" disabled={googleLoading} onPress={continueWithGoogle} className="h-14 rounded-2xl bg-white flex-row items-center justify-center">
            {googleLoading ? <ActivityIndicator color="#0f766e" /> : <><Text className="mr-3 text-2xl font-extrabold text-[#4285F4]">G</Text><Text className="text-base font-extrabold text-slate-900">Continuar con Google</Text></>}
          </TouchableOpacity> : null}
          <TouchableOpacity onPress={onCreateAccount} className={`${Platform.OS === "android" ? "mt-3" : ""} h-14 rounded-2xl bg-amber-500 items-center justify-center`}><Text className="text-base font-extrabold text-white">Crear cuenta</Text></TouchableOpacity>
          <TouchableOpacity onPress={onLogin} className="h-12 items-center justify-center"><Text className="text-sm font-bold text-white underline">Ya tengo una cuenta</Text></TouchableOpacity>
          {googleError ? <Text className="mt-2 text-center text-xs font-bold text-red-200">{googleError}</Text> : null}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

function Feature({ icon, tint, title, subtitle }: { icon: ReactNode; tint: string; title: string; subtitle: string }) {
  return (
    <View className="w-[48%] min-h-16 flex-row items-center rounded-2xl bg-white/95 px-3 py-2">
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${tint}`}>{icon}</View>
      <View className="ml-2 flex-1"><Text numberOfLines={1} className="text-xs font-extrabold text-slate-800">{title}</Text><Text numberOfLines={1} className="text-xs font-bold text-slate-500">{subtitle}</Text></View>
    </View>
  );
}
