import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, Image as ImageIcon, RotateCcw, ScanLine, X } from "lucide-react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import RecortarBoleta from "@/components/RecortarBoleta";
import { EXPENSE_CATS, INCOME_CATS, catInfo } from "@/constants/categories";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import { isSupported, recognize } from "@/modules/text-recognizer";
import { suggestCategory } from "@/utils/classifier";
import { nextId } from "@/utils/id";
import { prepareForOcr } from "@/utils/receiptPreprocess";
import { parseReceipt, type ReceiptRead } from "@/utils/receiptParser";
import { isValidISODate, normalizeDateInput } from "@/utils/date";
import type { Transaction } from "@/types";

/** Hoy en formato interno, en hora local. */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Stage =
  | "intro" // esperando que se elija cámara o galería
  | "working" // leyendo la foto
  | "review" // se leyó: falta confirmar y corregir
  | "failed"; // no se pudo leer nada

type Kind = "expense" | "income";

export default function ScanReceipt({ onClose }: { onClose: () => void }) {
  const { t, fmt, merchantLearned, addOrUpdateTransaction, userCurrency } = useAppData();
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>("intro");
  const [read, setRead] = useState<ReceiptRead | null>(null);

  // Los campos que se pueden corregir antes de guardar. Se guardan aparte de
  // `read` para no perder lo que se leyó de verdad: así el aviso de "revisa
  // los datos" sigue teniendo sentido aunque ya se haya corregido algo.
  const [amountText, setAmountText] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [category, setCategory] = useState("otros");
  /** La foto tomada y todavía sin recortar. Mientras exista, se enseña el recortador. */
  const [porRecortar, setPorRecortar] = useState<{ uri: string; ancho: number; alto: number } | null>(null);

  // Latido del ícono mientras lee, para que se note que está trabajando.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "working") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, pulse]);

  async function pick(source: "camera" | "gallery") {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 1,
        /**
         * EL RECORTE YA NO LO HACE ANDROID, y el motivo es suyo (09/08/2026):
         * *"ese cuadro sigue siendo de color blanco, no se ve nada cuando se recorta la
         * imagen"*.
         *
         * Con `allowsEditing` el recuadro lo pinta el sistema, cada fabricante a su manera, y
         * el suyo lo dibuja en blanco sobre una foto que también es blanca: el papel. Desde la
         * app no se podía cambiar ni el color ni el grosor — esa pantalla no era nuestra.
         *
         * Recortar sigue haciendo falta: quita la mesa, la mano y el resto de la foto, que es
         * donde el lector se inventa texto. Ahora lo hace components/RecortarBoleta.
         */
        allowsEditing: false,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      // Sin las medidas no hay forma de convertir lo que se ve a píxeles, así que ahí se lee
      // la foto entera en vez de enseñar un recortador que no podría acertar.
      if (asset.width && asset.height) {
        setPorRecortar({ uri: asset.uri, ancho: asset.width, alto: asset.height });
        return;
      }
      await run(asset.uri, asset.width, asset.height);
    } catch {
      setStage("failed");
    }
  }

  async function run(uri: string, width?: number, height?: number) {
    setStage("working");
    const prepared = await prepareForOcr(uri, width, height);
    const outcome = await recognize(prepared);

    if (!outcome.ok) {
      setStage("failed");
      return;
    }

    // CON SU MONEDA, no con soles a secas: en Chile o Colombia los precios no llevan céntimos,
    // y con la regla de los soles el escáner no encontraría ni un monto. Ver usaCentimos.
    const parsed = parseReceipt(outcome.result.text, new Date(), userCurrency);
    setRead(parsed);
    setAmountText(parsed.total !== null ? String(parsed.total) : "");
    setMerchant(parsed.merchant);
    setDate(parsed.date || todayISO());
    setKind("expense");
    setCategory(suggestCategory(parsed.merchant, "expense", merchantLearned));
    setStage("review");
  }

  function save() {
    const amount = Number(amountText.replace(",", "."));
    if (!isFinite(amount) || amount <= 0) return;
    const iso = normalizeDateInput(date);
    // El campo de fecha es texto libre. Ya hubo un fallo por esto: guardar
    // una fecha imposible tumbaba la app al intentar mostrar ese movimiento
    // (ver el comentario de isValidISODate). Aquí no se guarda nada que no
    // pase esa comprobación.
    if (!isValidISODate(iso)) return;

    const transaction: Transaction = {
      id: nextId(),
      type: kind,
      amount,
      category,
      date: iso,
      method: "cash",
      description: merchant || t(catInfo(category).label),
      notes: read?.docNumber ? t("scan.noteDoc", { doc: read.docNumber }) : "",
      merchant: merchant || undefined,
      origin: "manual",
    };
    addOrUpdateTransaction(transaction);
    onClose();
  }

  const cats = kind === "expense" ? EXPENSE_CATS : INCOME_CATS;
  const amountValid = (() => {
    const n = Number(amountText.replace(",", "."));
    return isFinite(n) && n > 0;
  })();
  const dateValid = isValidISODate(normalizeDateInput(date));
  const canSave = amountValid && dateValid;

  // EL RECORTADOR TAPA LA PANTALLA ENTERA, antes que nada. Va aquí y no dentro del cuerpo para
  // que no se dibuje media pantalla del escáner debajo mientras se recorta.
  if (porRecortar) {
    return (
      <RecortarBoleta
        uri={porRecortar.uri}
        anchoImagen={porRecortar.ancho}
        altoImagen={porRecortar.alto}
        onCancelar={() => setPorRecortar(null)}
        onListo={(uri, ancho, alto) => {
          setPorRecortar(null);
          run(uri, ancho, alto);
        }}
      />
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t("scan.title")}
        </Text>
        <TouchableOpacity onPress={onClose} className="w-9 h-9 items-center justify-center">
          <X size={22} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {/* El escáner es código nativo: no llega con "Buscar actualización".
            Con un APK anterior a esta función el módulo no existe, y hay que
            decirlo claro en vez de mostrar un botón que no haría nada. */}
        {!isSupported ? (
          <View
            className="rounded-3xl p-5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
            style={CARD_SHADOW}
          >
            <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              {t("scan.unsupportedTitle")}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-300 leading-5">
              {t("scan.unsupportedBody")}
            </Text>
          </View>
        ) : stage === "intro" ? (
          <>
            <View className="items-center py-6">
              <View className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-slate-800 items-center justify-center mb-4">
                <ScanLine size={34} color="#059669" />
              </View>
              <Text className="text-sm text-center text-slate-500 dark:text-slate-300 leading-5 px-4">
                {t("scan.introBody")}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => pick("camera")}
              className="flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600"
            >
              <Camera size={18} color="#ffffff" />
              <Text className="text-white font-bold">{t("scan.takePhoto")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => pick("gallery")}
              className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-3"
            >
              <ImageIcon size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">
                {t("scan.fromGallery")}
              </Text>
            </TouchableOpacity>

            <Text className="text-[11px] text-center text-slate-400 mt-5 leading-4">
              {t("scan.privacy")}
            </Text>
          </>
        ) : stage === "working" ? (
          <View className="items-center py-16">
            <Animated.View
              style={{
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
              }}
              className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-slate-800 items-center justify-center mb-5"
            >
              <ScanLine size={34} color="#059669" />
            </Animated.View>
            <ActivityIndicator color="#059669" />
            <Text className="text-sm text-slate-500 dark:text-slate-300 mt-4">
              {t("scan.working")}
            </Text>
          </View>
        ) : stage === "failed" ? (
          <View className="items-center py-10">
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 text-center">
              {t("scan.failedTitle")}
            </Text>
            <Text className="text-sm text-center text-slate-500 dark:text-slate-300 leading-5 mb-6">
              {t("scan.failedBody")}
            </Text>
            <TouchableOpacity
              onPress={() => setStage("intro")}
              className="flex-row items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("scan.retry")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Aviso cuando la lectura salió floja. No se esconde el
                resultado: se muestra igual, pero avisando, porque casi
                siempre hay algo aprovechable aunque falte el total. */}
            {read?.confidence !== "high" && (
              <View className="rounded-2xl p-3.5 mb-4 bg-amber-50 dark:bg-slate-800 border-[1.5px] border-amber-200 dark:border-slate-700">
                <Text className="text-xs text-amber-800 dark:text-amber-300 leading-5">
                  {t(read?.confidence === "low" ? "scan.checkLow" : "scan.checkMedium")}
                </Text>
              </View>
            )}

            <View
              className="rounded-3xl p-5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              {/* Gasto o ingreso */}
              <View className="flex-row gap-2 mb-4">
                {(["expense", "income"] as const).map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => {
                      setKind(k);
                      setCategory(suggestCategory(merchant, k, merchantLearned));
                    }}
                    className={`flex-1 py-2.5 rounded-full border-[1.5px] items-center ${
                      kind === k
                        ? k === "expense"
                          ? "bg-rose-50 dark:bg-slate-800 border-rose-300"
                          : "bg-emerald-50 dark:bg-slate-800 border-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        kind === k
                          ? k === "expense"
                            ? "text-rose-500"
                            : "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {t(k === "expense" ? "addSheet.expense" : "addSheet.income")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Field label={t("scan.fieldAmount")}>
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 py-1"
                />
              </Field>

              <Field label={t("scan.fieldMerchant")}>
                <TextInput
                  value={merchant}
                  onChangeText={(text) => {
                    setMerchant(text);
                    setCategory(suggestCategory(text, kind, merchantLearned));
                  }}
                  placeholder={t("scan.fieldMerchantHint")}
                  placeholderTextColor="#94a3b8"
                  className="text-sm font-bold text-slate-900 dark:text-slate-100 py-1"
                />
              </Field>

              <Field label={t("scan.fieldDate")}>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="#94a3b8"
                  className="text-sm font-bold text-slate-900 dark:text-slate-100 py-1"
                />
                {!dateValid && (
                  <Text className="text-[11px] text-rose-500 mt-0.5">{t("scan.dateInvalid")}</Text>
                )}
              </Field>

              {/* Lo que se leyó pero no se guarda como campo propio: sirve
                  para comprobar de un vistazo que la foto era la correcta. */}
              {(read?.time || read?.docNumber) && (
                <Text className="text-[11px] text-slate-400 mt-1">
                  {[read?.time, read?.docNumber].filter(Boolean).join(" · ")}
                </Text>
              )}

              <Text className="text-[11px] font-bold text-slate-400 mt-5 mb-2">
                {t("scan.fieldCategory")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                <View className="flex-row gap-2 px-1">
                  {cats.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategory(c.id)}
                      className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full border-[1.5px] ${
                        category === c.id
                          ? "bg-emerald-50 dark:bg-slate-800 border-emerald-400"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <CategoryAvatar id={c.id} size={14} />
                      <Text
                        className={`text-[11px] font-bold ${
                          category === c.id ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {t(c.label)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity
              onPress={save}
              disabled={!canSave}
              className={`flex-row items-center justify-center gap-2 py-4 rounded-2xl mt-4 ${
                canSave ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"
              }`}
            >
              <Check size={18} color={canSave ? "#ffffff" : "#94a3b8"} />
              <Text className={`font-bold ${canSave ? "text-white" : "text-slate-400"}`}>
                {canSave
                  ? t("scan.save", { amount: fmt(Number(amountText.replace(",", "."))) })
                  : t("scan.saveDisabled")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStage("intro")}
              className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-2"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("scan.another")}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-[11px] font-bold text-slate-400 mb-0.5">{label}</Text>
      {children}
    </View>
  );
}
