import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, MicOff, Check, RotateCcw, X, ArrowUpRight, ArrowDownRight } from "lucide-react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useAppData } from "@/contexts/AppDataContext";
import { parseVoice, type VoiceFailure } from "@/utils/voiceParser";
import { suggestCategory } from "@/utils/classifier";
import { catInfo } from "@/constants/categories";
import { nextId } from "@/utils/id";
import { CARD_SHADOW } from "@/constants/style";
import type { RawRow } from "@/utils/importEngine";
import type { Transaction } from "@/types";

// El idioma que se le pide al reconocedor. Si se le pasa el idioma
// equivocado entiende cualquier cosa, así que sigue al de la app.
const LOCALES: Record<string, string> = {
  es: "es-PE",
  en: "en-US",
  pt: "pt-BR",
};

type Stage =
  | "listening" // el micrófono está abierto
  | "confirm" // se entendió: falta que la persona apruebe
  | "failed" // se escuchó algo pero no se entendió
  | "denied"; // no dio permiso al micrófono

export default function VoiceEntry({ onClose }: { onClose: () => void }) {
  const { t, fmt, userLanguage, merchantLearned, addOrUpdateTransaction } = useAppData();
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>("listening");
  const [heard, setHeard] = useState("");
  const [failure, setFailure] = useState<VoiceFailure>("empty");
  const [row, setRow] = useState<RawRow | null>(null);
  const [type, setType] = useState<"expense" | "income">("expense");

  // Marca que esta escucha ya terminó de procesarse. Hace falta porque
  // Android manda el resultado final y DESPUÉS el aviso de "terminé": sin
  // esto, la frase se procesaría dos veces.
  const settled = useRef(false);
  // Lo último que se alcanzó a escuchar. Va en una "caja" además del estado
  // porque el aviso de "terminé" de Android puede llegar con la copia vieja
  // del texto, y entonces se perdería justo la frase que la persona dijo.
  const heardRef = useRef("");

  // ---- Animación del micrófono ----
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "listening") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, pulse]);

  // ---- Arranque ----
  // Se abre el micrófono solo, sin que haya que tocar nada más: la persona
  // ya tocó una vez para llegar hasta aquí.
  useEffect(() => {
    start();
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Si ya estaba cerrado no hay nada que cancelar.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    settled.current = false;
    heardRef.current = "";
    setHeard("");
    setRow(null);
    setStage("listening");
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setStage("denied");
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: LOCALES[userLanguage] ?? "es-PE",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      });
    } catch {
      setFailure("empty");
      setStage("failed");
    }
  }

  function settle(text: string) {
    if (settled.current) return;
    settled.current = true;

    const parsed = parseVoice(text);
    if (!parsed.ok) {
      setFailure(parsed.reason);
      setStage("failed");
      return;
    }
    setRow(parsed.row);
    setType(parsed.row.type);
    setStage("confirm");
  }

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (text) {
      heardRef.current = text;
      setHeard(text);
    }
    if (event.isFinal) settle(text || heardRef.current);
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (event.error === "aborted" || settled.current) return;
    settled.current = true;
    setFailure("empty");
    setStage("failed");
  });

  // Android a veces cierra el micrófono sin mandar un resultado final
  // (por ejemplo si la persona se queda callada). Lo que se alcanzó a
  // escuchar igual sirve.
  useSpeechRecognitionEvent("end", () => {
    if (settled.current) return;
    settle(heardRef.current);
  });

  // La categoría se vuelve a adivinar cada vez que cambia el tipo, porque
  // un ingreso nunca va en una categoría de gasto.
  const category = row ? suggestCategory(row.merchant || row.description, type, merchantLearned) : "otros";
  const cat = catInfo(category);

  function save() {
    if (!row) return;
    const transaction: Transaction = {
      id: nextId(),
      type,
      amount: row.amount,
      category,
      date: row.date,
      method: "cash",
      description: row.description || t(cat.label),
      notes: "",
      merchant: row.merchant || undefined,
      origin: "manual",
    };
    addOrUpdateTransaction(transaction);
    onClose();
  }

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row justify-end px-5 pt-2">
        <TouchableOpacity
          onPress={onClose}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
        >
          <X size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        {stage === "listening" && (
          <>
            <View className="w-32 h-32 items-center justify-center mb-8">
              <Animated.View
                className="absolute w-24 h-24 rounded-full bg-violet-500"
                style={{ transform: [{ scale }], opacity }}
              />
              <View className="w-20 h-20 rounded-full bg-violet-500 items-center justify-center">
                <Mic size={32} color="#ffffff" />
              </View>
            </View>
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {t("voice.listening")}
            </Text>
            <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5">
              {heard || t("voice.example")}
            </Text>
          </>
        )}

        {stage === "confirm" && row && (
          <View className="w-full">
            <Text className="text-xs text-center text-slate-400 mb-4">"{heard}"</Text>

            <View
              className="w-full rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 items-center"
              style={CARD_SHADOW}
            >
              <Text className="text-4xl mb-1">{cat.emoji}</Text>
              <Text
                className={`text-3xl font-extrabold ${type === "expense" ? "text-rose-500" : "text-emerald-600"}`}
              >
                {type === "expense" ? "-" : "+"}
                {fmt(row.amount)}
              </Text>
              <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {row.description || t(cat.label)}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">{t(cat.label)}</Text>

              {/* Cambiar gasto/ingreso de un toque. Es el dato que más daño
                  hace si sale al revés y el más difícil de notar después. */}
              <View className="flex-row gap-2 mt-4">
                <TouchableOpacity
                  onPress={() => setType("expense")}
                  className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border ${
                    type === "expense"
                      ? "bg-rose-50 dark:bg-slate-800 border-rose-300"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <ArrowUpRight size={13} color={type === "expense" ? "#f43f5e" : "#94a3b8"} />
                  <Text
                    className={`text-[11px] font-bold ${type === "expense" ? "text-rose-500" : "text-slate-400"}`}
                  >
                    {t("addSheet.expense")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setType("income")}
                  className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border ${
                    type === "income"
                      ? "bg-emerald-50 dark:bg-slate-800 border-emerald-300"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <ArrowDownRight size={13} color={type === "income" ? "#059669" : "#94a3b8"} />
                  <Text
                    className={`text-[11px] font-bold ${type === "income" ? "text-emerald-600" : "text-slate-400"}`}
                  >
                    {t("addSheet.income")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={save}
              className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-violet-500 mt-4"
            >
              <Check size={18} color="#ffffff" />
              <Text className="text-white font-bold">{t("voice.save")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-2"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("voice.retry")}</Text>
            </TouchableOpacity>
            <Text className="text-[10px] text-center text-slate-400 mt-3 leading-4">
              {t("voice.editHint")}
            </Text>
          </View>
        )}

        {stage === "failed" && (
          <View className="w-full items-center">
            <View className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center mb-6">
              <MicOff size={28} color="#94a3b8" />
            </View>
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 text-center">
              {t(failure === "noAmount" ? "voice.noAmountTitle" : "voice.emptyTitle")}
            </Text>
            {heard ? <Text className="text-xs text-center text-slate-400 mb-2">"{heard}"</Text> : null}
            <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5 mb-6">
              {t(failure === "noAmount" ? "voice.noAmountHint" : "voice.emptyHint")}
            </Text>
            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-violet-500"
            >
              <RotateCcw size={18} color="#ffffff" />
              <Text className="text-white font-bold">{t("voice.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === "denied" && (
          <View className="w-full items-center">
            <View className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center mb-6">
              <MicOff size={28} color="#94a3b8" />
            </View>
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 text-center">
              {t("voice.deniedTitle")}
            </Text>
            <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5">
              {t("voice.deniedHint")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
