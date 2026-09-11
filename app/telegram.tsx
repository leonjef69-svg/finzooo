import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { MessageSquare, ShieldCheck } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import { useAppData } from "@/contexts/AppDataContext";
import { auth, db } from "@/utils/firebase";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TELEGRAM_BOT_USERNAME = "dotero2bot";
function makeCode() {
  return Array.from(Crypto.getRandomBytes(6), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export default function TelegramScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, showToast, t, userCountry } = useAppData();
  const uid = auth.currentUser?.uid;
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    return onSnapshot(doc(db, "telegramUsers", uid), (snapshot) => {
      setConnected(snapshot.exists() && snapshot.data().active === true);
      setLoading(false);
    }, () => setLoading(false));
  }, [uid]);

  async function generate() {
    if (!uid || !isPremium) return router.replace("/premium");
    const next = makeCode();
    const now = Date.now();
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";
      await setDoc(doc(db, "telegramLinkRequests", next), { uid, createdAtMs: now, expiresAtMs: now + 10 * 60_000, used: false, country: userCountry, timeZone });
      setCode(next);
      await Linking.openURL(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=link_${next}`);
    } catch {
      showToast("No se pudo generar el código. Revisa tu conexión.");
    }
  }

  async function disconnect() {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "telegramUsers", uid));
      setCode("");
      showToast(t("telegram.disconnected"));
    } catch {
      showToast(t("telegram.disconnectError"));
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-2">
        <BackButton onPress={() => router.back()} />
        <Text className="ml-3 text-xl font-black text-slate-900 dark:text-white">{t("telegram.title")}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
        <View className="rounded-3xl bg-emerald-500 p-5">
          <MessageSquare size={28} color="white" />
          <Text className="mt-3 text-xl font-black text-white">{t("telegram.hero")}</Text>
          <Text className="mt-1 text-sm text-emerald-50">{t("telegram.description")}</Text>
        </View>
        <View className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          {loading ? <ActivityIndicator color="#10b981" /> : connected ? (
            <>
              <Text className="font-extrabold text-emerald-600">{t("telegram.connected")}</Text>
              <TouchableOpacity onPress={disconnect} className="mt-4 rounded-xl bg-rose-50 p-3">
                <Text className="text-center font-bold text-rose-600">{t("telegram.disconnect")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="font-bold text-slate-900 dark:text-white">{t("telegram.step1")}</Text>
              <Text className="mt-2 text-sm text-slate-500">{t("telegram.step2")}</Text>
              {code ? (
                <View className="mt-4 rounded-xl bg-slate-100 p-4 dark:bg-noche-2">
                  <Text className="text-center text-sm font-bold text-emerald-600">{t("telegram.opened")}</Text>
                </View>
              ) : null}
              <TouchableOpacity onPress={generate} className="mt-4 rounded-xl bg-emerald-500 p-3">
                <Text className="text-center font-black text-white">{t(code ? "telegram.reopen" : "telegram.connect")}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <View className="flex-row rounded-2xl bg-sky-50 p-4 dark:bg-sky-950/30">
          <ShieldCheck size={20} color="#0284c7" />
          <Text className="ml-3 flex-1 text-xs leading-5 text-sky-800 dark:text-sky-200">{t("telegram.safety")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
