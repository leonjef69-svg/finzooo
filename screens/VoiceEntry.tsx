import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Mic, MicOff, Check, RotateCcw, X, ArrowUpRight, ArrowDownRight } from "lucide-react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useAppData } from "@/contexts/AppDataContext";
import { type VoiceFailure } from "@/utils/voiceParser";
import { parseVoiceCommand } from "@/utils/voiceCommand";
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
  | "summary" // se pidió un resumen del mes
  | "failed" // se escuchó algo pero no se entendió
  | "denied"; // no dio permiso al micrófono

type Kind = "expense" | "income";

export default function VoiceEntry({ onClose }: { onClose: () => void }) {
  const { t, fmt, userLanguage, monthNames, transactions, merchantLearned, addOrUpdateTransaction, showToast } =
    useAppData();
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>("listening");
  // Mes del que se pidió el resumen ("AAAA-MM") y si se pidió de lo que
  // salió, de lo que entró, o de todo.
  const [summaryMk, setSummaryMk] = useState("");
  const [summaryFocus, setSummaryFocus] = useState<"expense" | "income" | "all">("all");
  // Categoría pedida ("solo comida"), o vacío para todas.
  const [summaryCategory, setSummaryCategory] = useState("");
  const [heard, setHeard] = useState("");
  const [failure, setFailure] = useState<VoiceFailure>("empty");
  // Una frase puede traer varios movimientos ("10 en hamburguesa y 20 en
  // gaseosa"), así que siempre se trabaja con una lista, aunque casi
  // siempre tenga uno solo.
  const [rows, setRows] = useState<RawRow[]>([]);
  const [kinds, setKinds] = useState<Kind[]>([]);

  // Marca que esta escucha ya terminó de procesarse. Hace falta porque
  // Android manda el resultado final y DESPUÉS el aviso de "terminé": sin
  // esto, la frase se procesaría dos veces.
  const settled = useRef(false);
  // Lo último que se alcanzó a escuchar. Va en una "caja" además del estado
  // porque el aviso de "terminé" de Android puede llegar con la copia vieja
  // del texto, y entonces se perdería justo la frase que la persona dijo.
  const heardRef = useRef("");

  // Número de la escucha actual.
  //
  // Android avisa de que una escucha terminó CON RETRASO. Al abrir una
  // nueva se cierra la anterior, y ese aviso tardío llegaba cuando la nueva
  // ya había empezado — matándola al instante, con la persona hablando.
  // Ahora cada escucha lleva su número y los avisos que traen uno viejo se
  // ignoran.
  const runId = useRef(0);
  const activeRun = useRef(-1);

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
    runId.current += 1;

    // Cierra cualquier escucha anterior antes de abrir una nueva.
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Si no había ninguna abierta, no hay nada que cerrar.
    }

    settled.current = false;
    heardRef.current = "";
    setHeard("");
    setRows([]);
    setKinds([]);
    setSummaryMk("");
    setSummaryCategory("");
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
        // Cuánto silencio espera Android antes de dar por terminada la
        // frase. Sin esto usa su valor por defecto, que es cortísimo:
        // bastaba dudar un segundo a mitad de frase para que cortara y se
        // registrara solo lo dicho hasta ahí.
        //
        // El mínimo de 3 segundos da margen para empezar a hablar; los 2,5
        // de silencio permiten pensar entre un gasto y el siguiente cuando
        // se dictan varios seguidos.
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 3000,
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
        },
      });

      // Respaldo por si Android no manda el aviso de arranque (hay
      // celulares que se lo saltan). Sin esto, esta escucha nunca se daría
      // por válida y la pantalla se quedaría escuchando sin procesar nada.
      // El segundo y medio es de sobra: ningún resultado real llega antes.
      const mine = runId.current;
      setTimeout(() => {
        if (runId.current === mine && activeRun.current !== mine) {
          activeRun.current = mine;
        }
      }, 1500);
    } catch {
      setFailure("empty");
      setStage("failed");
    }
  }

  function settle(text: string) {
    if (settled.current) return;
    settled.current = true;

    const command = parseVoiceCommand(text);

    // Exportar: el archivo se genera solo y se abre el menú de compartir,
    // sin tocar nada más. Antes solo dejaba la pantalla lista, por si el
    // micrófono oía mal el mes; se cambió porque así se pidió. La red de
    // seguridad quedó del otro lado: si el mes que se entendió no tiene
    // movimientos, no se exporta nada y se avisa cuál era.
    if (command.kind === "export") {
      router.replace({
        pathname: "/export-pdf",
        params: {
          month: command.monthKey,
          format: command.format,
          dest: command.destination,
          auto: "1",
        },
      });
      return;
    }

    if (command.kind === "summary") {
      setSummaryMk(command.monthKey);
      setSummaryFocus(command.focus);
      setSummaryCategory(command.category ?? "");
      setStage("summary");
      return;
    }

    const parsed = command.parsed;
    if (!parsed.ok) {
      setFailure(parsed.reason);
      setStage("failed");
      return;
    }
    setRows(parsed.rows);
    setKinds(parsed.rows.map((r) => r.type));
    setStage("confirm");
  }

  // Android confirma aquí que la escucha arrancó de verdad. Desde este
  // momento, sus avisos pertenecen a ESTA escucha y no a una anterior.
  useSpeechRecognitionEvent("start", () => {
    activeRun.current = runId.current;
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (activeRun.current !== runId.current) return;
    const text = event.results[0]?.transcript ?? "";
    if (text) {
      heardRef.current = text;
      setHeard(text);
    }
    if (event.isFinal) settle(text || heardRef.current);
  });

  // Los errores NO se filtran por número de escucha a propósito: si algo
  // falla antes de que Android confirme el arranque, sin esto la pantalla
  // se quedaría escuchando para siempre. El cierre que hacemos nosotros
  // llega como "aborted", que ya se ignora aquí.
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
    // Este es el aviso que llegaba tarde y mataba la escucha nueva.
    if (activeRun.current !== runId.current) return;
    if (settled.current) return;
    settle(heardRef.current);
  });

  // La categoría se vuelve a adivinar según el tipo elegido, porque un
  // ingreso nunca va en una categoría de gasto.
  function categoryOf(row: RawRow, kind: Kind) {
    return suggestCategory(row.merchant || row.description, kind, merchantLearned);
  }

  function toggleKind(index: number) {
    setKinds((prev) => prev.map((k, i) => (i === index ? (k === "expense" ? "income" : "expense") : k)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setKinds((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    if (rows.length === 0) return;
    rows.forEach((row, i) => {
      const kind = kinds[i];
      const category = categoryOf(row, kind);
      const transaction: Transaction = {
        id: nextId(),
        type: kind,
        amount: row.amount,
        category,
        date: row.date,
        method: "cash",
        description: row.description || t(catInfo(category).label),
        notes: "",
        merchant: row.merchant || undefined,
        origin: "manual",
      };
      addOrUpdateTransaction(transaction);
    });
    // El aviso de addOrUpdateTransaction habla de un solo movimiento; si
    // fueron varios, este lo reemplaza (el último gana).
    if (rows.length > 1) showToast(t("voice.savedPlural", { count: rows.length }));
    onClose();
  }

  // Cuentas del mes pedido: cuánto salió, cuánto entró y en qué se fue más.
  // Se calcula aquí y no en un archivo aparte porque son cuatro líneas y
  // solo las usa esta pantalla.
  const summary = (() => {
    if (!summaryMk) return null;
    const monthTx = transactions.filter((tx) => tx.date.startsWith(summaryMk));

    // El "protagonista" es lo que se pidió; el otro lado va como línea
    // pequeña debajo. Antes el protagonista era SIEMPRE el gasto, así que
    // pedir un resumen de ingresos mostraba gastos.
    const wantsIncome = summaryFocus === "income";
    const all = monthTx.filter((tx) => (wantsIncome ? tx.type === "income" : tx.type === "expense"));
    const other = monthTx.filter((tx) => (wantsIncome ? tx.type === "expense" : tx.type === "income"));

    // Si se pidió una categoría, el resumen es SOLO de esa.
    const main = summaryCategory ? all.filter((tx) => tx.category === summaryCategory) : all;

    const byCategory = new Map<string, number>();
    for (const tx of main) byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
    const [y, m] = summaryMk.split("-").map(Number);

    return {
      label: `${monthNames[m - 1]} ${y}`,
      isIncome: wantsIncome,
      category: summaryCategory,
      total: main.reduce((s, tx) => s + tx.amount, 0),
      otherTotal: other.reduce((s, tx) => s + tx.amount, 0),
      count: main.length,
      // Sin categoría pedida se enseña en qué se fue más (las categorías);
      // con una categoría, esa lista sería una sola fila repitiendo el
      // total, así que se enseñan los movimientos concretos, que es lo que
      // de verdad se quiere ver.
      top: Array.from(byCategory.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
      items: [...main].sort((a, b) => b.amount - a.amount).slice(0, 6),
    };
  })();

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const single = rows.length === 1;

  return (
    // Panel flotante, no pantalla completa.
    //
    // Antes esto ocupaba toda la pantalla con el fondo de la app, y se
    // sentía como "me sacó de lo que estaba haciendo y me metió en Finzo".
    // Ahora se ve un panel encima de lo que había, con el resto oscurecido:
    // la misma app, el mismo código, pero se percibe como algo que se abre
    // un momento y se va. Tocar fuera lo cierra.
    <View className="absolute inset-0 z-50 items-center justify-center px-5">
      <TouchableOpacity
        className="absolute inset-0 bg-slate-900/80"
        activeOpacity={1}
        onPress={onClose}
      />

      <View
        className="w-full rounded-3xl bg-white dark:bg-slate-900 px-5 pt-3 pb-6"
        style={[
          CARD_SHADOW,
          // Tope de alto para que la lista de 30 movimientos no se salga de
          // la pantalla en celulares chicos.
          { maxHeight: "88%", marginTop: insets.top, marginBottom: insets.bottom },
        ]}
      >
        <View className="flex-row justify-end">
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <X size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View className="items-center justify-center px-2 pb-1">
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
            {!heard && (
              <Text className="text-[11px] text-center text-slate-400 leading-4 mt-2">
                {t("voice.example2")}
              </Text>
            )}
          </>
        )}

        {stage === "confirm" && rows.length > 0 && (
          <View className="w-full">
            <Text className="text-xs text-center text-slate-400 mb-4">"{heard}"</Text>

            {single ? (
              <SingleCard
                row={rows[0]}
                kind={kinds[0]}
                category={categoryOf(rows[0], kinds[0])}
                fmt={fmt}
                t={t}
                onKind={(k) => setKinds([k])}
              />
            ) : (
              <>
                {/* Con muchos movimientos, revisar uno por uno es imposible.
                    Esta línea deja comprobar de un vistazo lo único que de
                    verdad importa: cuántos son y cuánto suman. */}
                <View className="flex-row items-center justify-between px-1 mb-2">
                  <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-300">
                    {t("voice.manyCount", { count: rows.length })}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                    {fmt(rows.reduce((s, r, i) => s + (kinds[i] === "expense" ? r.amount : -r.amount), 0))}
                  </Text>
                </View>
                <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingVertical: 2 }}>
                <View className="gap-2">
                  {rows.map((row, i) => {
                    const kind = kinds[i];
                    const cat = catInfo(categoryOf(row, kind));
                    return (
                      <View
                        key={`${row.amount}-${i}`}
                        className="flex-row items-center gap-3 rounded-2xl p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                        style={CARD_SHADOW}
                      >
                        <Text className="text-xl">{cat.emoji}</Text>
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {row.description || t(cat.label)}
                          </Text>
                          <Text className="text-[11px] text-slate-500 dark:text-slate-300">{t(cat.label)}</Text>
                        </View>
                        {/* Tocar el monto cambia entre gasto e ingreso. */}
                        <TouchableOpacity onPress={() => toggleKind(i)}>
                          <Text
                            className={`text-sm font-extrabold ${
                              kind === "expense" ? "text-rose-500" : "text-emerald-600"
                            }`}
                          >
                            {kind === "expense" ? "-" : "+"}
                            {fmt(row.amount)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeRow(i)}
                          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
                        >
                          <X size={13} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              onPress={save}
              className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-violet-500 mt-4"
            >
              <Check size={18} color="#ffffff" />
              <Text className="text-white font-bold">
                {single ? t("voice.save") : t("voice.saveMany", { count: rows.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-2"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("voice.retry")}</Text>
            </TouchableOpacity>
            <Text className="text-[10px] text-center text-slate-400 mt-3 leading-4">
              {t(single ? "voice.editHint" : "voice.manyHint")}
            </Text>
          </View>
        )}

        {stage === "summary" && summary && (
          <View className="w-full">
            <Text className="text-xs text-center text-slate-400 mb-4">"{heard}"</Text>

            <View
              className="w-full rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
              style={CARD_SHADOW}
            >
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 text-center">
                {summary.category
                  ? `${catInfo(summary.category).emoji} ${t(catInfo(summary.category).label)} · ${summary.label}`
                  : summary.label}
              </Text>

              {summary.count === 0 ? (
                <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5 mt-3">
                  {summary.category
                    ? t("voice.summaryEmptyCategory", { cat: t(catInfo(summary.category).label) })
                    : t(summary.isIncome ? "voice.summaryEmptyIncome" : "voice.summaryEmpty")}
                </Text>
              ) : (
                <>
                  <Text
                    className={`text-3xl font-extrabold text-center mt-1 ${
                      summary.isIncome ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {fmt(summary.total)}
                  </Text>
                  <Text className="text-[11px] text-center text-slate-500 dark:text-slate-300">
                    {t(summary.isIncome ? "voice.summaryEarned" : "voice.summarySpent", {
                      count: summary.count,
                    })}
                  </Text>
                  {summary.otherTotal > 0 && !summary.category && (
                    <Text
                      className={`text-[11px] text-center mt-0.5 ${
                        summary.isIncome ? "text-rose-500" : "text-emerald-600"
                      }`}
                    >
                      {t(summary.isIncome ? "voice.summaryOutLine" : "voice.summaryIncome", {
                        amount: fmt(summary.otherTotal),
                      })}
                    </Text>
                  )}

                  {summary.category ? (
                    // Con una categoría pedida se listan los movimientos.
                    <View className="mt-4 gap-2">
                      {summary.items.map((tx) => (
                        <View key={tx.id} className="flex-row items-center gap-2.5">
                          <Text className="flex-1 text-xs text-slate-900 dark:text-slate-100" numberOfLines={1}>
                            {tx.description || t(catInfo(tx.category).label)}
                          </Text>
                          <Text className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {fmt(tx.amount)}
                          </Text>
                        </View>
                      ))}
                      {summary.count > summary.items.length && (
                        <Text className="text-[10px] text-slate-400 text-center mt-1">
                          {t("voice.summaryMore", { count: summary.count - summary.items.length })}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View className="mt-4 gap-2">
                      {summary.top.map(([category, amount]) => {
                        const cat = catInfo(category);
                        const share = Math.round((amount / summary.total) * 100);
                        return (
                          <View key={category} className="flex-row items-center gap-2.5">
                            <Text className="text-base">{cat.emoji}</Text>
                            <Text className="flex-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                              {t(cat.label)}
                            </Text>
                            <Text className="text-[11px] text-slate-400">{share}%</Text>
                            <Text className="text-xs font-bold text-slate-900 dark:text-slate-100 w-20 text-right">
                              {fmt(amount)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: "/export-pdf",
                  params: { month: summaryMk, format: "pdf", auto: "1" },
                })
              }
              className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-violet-500 mt-4"
            >
              <Check size={18} color="#ffffff" />
              <Text className="text-white font-bold">{t("voice.summaryExport")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-2"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("voice.retry")}</Text>
            </TouchableOpacity>
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
    </View>
  );
}

// Tarjeta grande para cuando la frase trae un solo movimiento, que es el
// caso normal. Cuando son varios se usa la lista compacta de arriba.
function SingleCard({
  row,
  kind,
  category,
  fmt,
  t,
  onKind,
}: {
  row: RawRow;
  kind: Kind;
  category: string;
  fmt: (n: number) => string;
  t: (k: string, vars?: Record<string, string | number>) => string;
  onKind: (k: Kind) => void;
}) {
  const cat = catInfo(category);
  return (
    <View
      className="w-full rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 items-center"
      style={CARD_SHADOW}
    >
      <Text className="text-4xl mb-1">{cat.emoji}</Text>
      <Text className={`text-3xl font-extrabold ${kind === "expense" ? "text-rose-500" : "text-emerald-600"}`}>
        {kind === "expense" ? "-" : "+"}
        {fmt(row.amount)}
      </Text>
      <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
        {row.description || t(cat.label)}
      </Text>
      <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">{t(cat.label)}</Text>

      {/* Cambiar gasto/ingreso de un toque. Es el dato que más daño hace si
          sale al revés y el más difícil de notar después. */}
      <View className="flex-row gap-2 mt-4">
        <TouchableOpacity
          onPress={() => onKind("expense")}
          className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border ${
            kind === "expense"
              ? "bg-rose-50 dark:bg-slate-800 border-rose-300"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <ArrowUpRight size={13} color={kind === "expense" ? "#f43f5e" : "#94a3b8"} />
          <Text className={`text-[11px] font-bold ${kind === "expense" ? "text-rose-500" : "text-slate-400"}`}>
            {t("addSheet.expense")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onKind("income")}
          className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border ${
            kind === "income"
              ? "bg-emerald-50 dark:bg-slate-800 border-emerald-300"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <ArrowDownRight size={13} color={kind === "income" ? "#059669" : "#94a3b8"} />
          <Text className={`text-[11px] font-bold ${kind === "income" ? "text-emerald-600" : "text-slate-400"}`}>
            {t("addSheet.income")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
