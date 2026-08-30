import { useState } from "react";
import { ActivityIndicator, Image, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";

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
    <View className="flex-1 bg-[#17100c]">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image source={require("../assets/images/onboarding/fino-sunset-background.png")} resizeMode="cover" className="absolute inset-0 h-full w-full" />
      <View className="absolute inset-0 bg-black/25" />
      <View className="flex-1 px-5 justify-between" style={{ paddingTop: insets.top + 42, paddingBottom: insets.bottom + 22 }}>
        <View className="items-center">
          <Text className="text-5xl font-extrabold text-white">Fino<Text className="text-amber-300">✦</Text></Text>
          <Text className="mt-2 text-2xl font-extrabold text-center text-white">Tu dinero bajo control</Text>
          <Text className="mt-1 text-base font-semibold text-white/90">Simple, rápido y claro</Text>
        </View>
        <View className="rounded-[28px] bg-black/35 p-3">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continuar con Google" disabled={googleLoading} onPress={continueWithGoogle} className="h-14 rounded-2xl bg-white flex-row items-center justify-center">
            {googleLoading ? <ActivityIndicator color="#0f766e" /> : <><Text className="mr-3 text-2xl font-extrabold text-[#4285F4]">G</Text><Text className="text-base font-extrabold text-slate-900">Continuar con Google</Text></>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onCreateAccount} className="mt-3 h-14 rounded-2xl bg-emerald-600 items-center justify-center"><Text className="text-base font-extrabold text-white">Crear cuenta</Text></TouchableOpacity>
          <TouchableOpacity onPress={onLogin} className="h-12 items-center justify-center"><Text className="text-sm font-bold text-white underline">Ya tengo una cuenta</Text></TouchableOpacity>
          <View className="mt-1 flex-row items-center justify-center rounded-2xl bg-white/90 px-4 py-3"><ShieldCheck size={21} color="#d97706" /><Text className="ml-2 text-sm font-semibold text-slate-800">Tus datos, solo tuyos.</Text></View>
          {googleError ? <Text className="mt-2 text-center text-xs font-bold text-red-200">{googleError}</Text> : null}
        </View>
      </View>
    </View>
  );
}
