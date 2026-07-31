import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { FileUp, CheckCircle2, AlertTriangle, Copy, X, Landmark } from "lucide-react-native";
import { extractPdfText } from "@/utils/pdfExtract";
import { useColorScheme } from "nativewind";
import { setPendingImport } from "@/utils/pendingImport";
import { useAppData } from "@/contexts/AppDataContext";
import { nextId } from "@/utils/id";
import { accountLabelFor, guessAccount } from "@/constants/accounts";
import { catInfo } from "@/constants/categories";
import { fmtDate } from "@/utils/format";
import { matchMethod, parseStatement, type RawRow } from "@/utils/importEngine";
import { suggestCategory } from "@/utils/classifier";
import { findBestMatch, mergeTransaction, type DuplicateMatch } from "@/utils/duplicates";
import DuplicateReview from "@/screens/DuplicateReview";
import type { Transaction } from "@/types";

// Un movimiento del banco ya convertido a formato Finzo, junto con la
// información de si se parece a algo que ya tienes.
type Candidate = {
  tx: Transaction; // el movimiento nuevo, listo para guardarse
  raw: RawRow; // los datos crudos del banco (para aprender/fusionar)
  match: DuplicateMatch | null; // el parecido encontrado (o null si es nuevo)
};

// Cuántos movimientos se dibujan en la vista previa. Un extracto largo con
// cientos de filas dentro de un ScrollView se siente pesado al desplazar;
// con cien ya se ve de sobra si el archivo se leyó bien.
const PREVIEW_LIMIT = 100;

// Decisión que toma la persona (o el sistema) sobre cada candidato.
export type Resolution = "new" | "merge" | "keepBoth" | "skip";

export default function ImportSheet({
  onClose,
  incoming,
}: {
  onClose: () => void;
  /**
   * Archivo que llegó desde otra app ("Compartir → Finzo"). Si viene, se
   * carga solo al abrir la pantalla y no hace falta elegir nada.
   */
  incoming?: { uri: string; name: string } | null;
}) {
  const { t, fmt, monthNames, showToast, transactions, commitImport, learnMerchantCategory, merchantLearned } =
    useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  const [fileName, setFileName] = useState<string | null>(null);
  const [bank, setBank] = useState<string | undefined>(undefined);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [done, setDone] = useState(false);
  const [importedTotal, setImportedTotal] = useState(0);

  const iconMuted = colorScheme === "dark" ? "#94a3b8" : "#475569";
  const primaryText = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";

  const newOnes = useMemo(() => candidates.filter((c) => !c.match), [candidates]);
  const dupes = useMemo(() => candidates.filter((c) => c.match), [candidates]);

  // Archivo llegado desde fuera: se carga una sola vez, al abrir. La marca
  // evita que un redibujado lo vuelva a leer — el archivo se borra tras
  // leerlo, así que un segundo intento fallaría y mostraría un error falso.
  const alreadyLoaded = useRef(false);
  useEffect(() => {
    if (!incoming || alreadyLoaded.current) return;
    alreadyLoaded.current = true;
    // Aquí se limpia el aviso de Inicio, y no antes: esto es lo único que
    // demuestra que la pantalla se abrió DE VERDAD con el archivo. Limpiarlo
    // al pedir la navegación sería confundir "se mandó abrir" con "se abrió",
    // que es exactamente donde se perdía el archivo.
    setPendingImport(null);
    void loadFile(incoming.uri, incoming.name, "application/pdf");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "text/comma-separated-values",
        "text/plain",
        "application/vnd.ms-excel",
        "application/pdf",
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await loadFile(asset.uri, asset.name, asset.mimeType);
  }

  /**
   * Lee un archivo y lo convierte en candidatos a importar.
   *
   * Se separó de pickFile para que sirva a los dos caminos: el de siempre
   * (elegir el archivo a mano) y el nuevo (llegar desde "Compartir" o
   * "Abrir con" de Android, con el archivo ya dado). Un segundo lector en
   * paralelo se habría desviado del primero en cuanto uno de los dos se
   * tocara.
   */
  async function loadFile(uri: string, name: string, mimeType?: string) {
    setLoading(true);
    setDone(false);
    const asset = { uri, name, mimeType };
    const isPdf = asset.name.toLowerCase().endsWith(".pdf") ||
      asset.mimeType === "application/pdf";
    let file: File | null = null;
    let readAsPdf = false;
    try {
      file = new File(asset.uri);
      readAsPdf = isPdf;

      let text: string;
      if (isPdf) {
        setLoadingPdf(true);
        const arrayBuffer = await file.arrayBuffer();
        text = await extractPdfText(new Uint8Array(arrayBuffer));
        setLoadingPdf(false);
        if (!text.trim()) {
          showToastAndClose(t("importSheet.pdfError"));
          return;
        }
      } else {
        text = await file.text();
      }

      const detectedBank = guessAccount(asset.name, text.slice(0, 400));
      const parsed = parseStatement(text, detectedBank);

      if (!parsed.ok) {
        showToastAndClose(isPdf ? t("importSheet.pdfError") : t(parsed.reason === "empty" ? "importSheet.emptyFile" : "importSheet.missingColumns"));
        return;
      }
      if (parsed.rows.length === 0) {
        showToastAndClose(isPdf ? t("importSheet.pdfError") : t("importSheet.emptyFile"));
        return;
      }

      // Convertimos cada fila del banco en un movimiento de Finzo y
      // buscamos si se parece a algo que ya tienes. Vamos marcando los
      // que ya se "usaron" para que un movimiento tuyo no se empareje con
      // dos filas del banco a la vez.
      const matchedIds = new Set<number>();
      const built: Candidate[] = parsed.rows.map((raw) => {
        // Si el archivo ya trae una categoría reconocible la respetamos;
        // si no, la adivinamos por el comercio (KFC → comida, etc.).
        const category = suggestCategory(raw.merchant || raw.description, raw.type, merchantLearned);
        const tx: Transaction = {
          id: nextId(),
          type: raw.type,
          amount: raw.amount,
          category,
          date: raw.date,
          method: matchMethod(raw.methodRaw, t),
          description: raw.description,
          notes: "",
          merchant: raw.merchant,
          reference: raw.reference || undefined,
          account: raw.account,
          origin: "imported",
        };
        const match = findBestMatch(transactions, raw, matchedIds);
        if (match) matchedIds.add(match.existing.id);
        return { tx, raw, match };
      });

      setFileName(asset.name);
      setBank(detectedBank);
      setCandidates(built);
      setErrorCount(parsed.errorCount);
    } catch {
      showToastAndClose(readAsPdf ? t("importSheet.pdfError") : t("importSheet.readError"));
    } finally {
      // Seguridad/privacidad: el archivo del banco se borra del celular
      // apenas terminamos de leerlo. No lo guardamos más de lo necesario.
      try {
        if (file?.exists) file.delete();
      } catch {
        // Si no se puede borrar, no es grave: está en la carpeta temporal
        // que el sistema limpia solo.
      }
      setLoading(false);
      setLoadingPdf(false);
    }
  }

  function showToastAndClose(msg: string) {
    showToast(msg);
    setLoading(false);
  }

  // Aplica un conjunto de decisiones y guarda todo de una vez.
  function applyResolutions(resolutions: Map<number, Resolution>) {
    const toAdd: Transaction[] = [];
    const toReplace: Transaction[] = [];

    for (const cand of candidates) {
      const decision = resolutions.get(cand.tx.id) ?? (cand.match ? "keepBoth" : "new");
      if (decision === "skip") continue;
      if (decision === "merge" && cand.match) {
        toReplace.push(mergeTransaction(cand.match.existing, cand.raw));
      } else {
        // "new" o "keepBoth": entra tal cual. Si el usuario ya lo tenía
        // manual y elige mantener ambos, este queda marcado "importado".
        toAdd.push(cand.tx);
      }
    }

    commitImport(toAdd, toReplace);
    setImportedTotal(toAdd.length + toReplace.length);
    setReviewing(false);
    setDone(true);
  }

  // "Importar todo": los nuevos entran, y los posibles duplicados se
  // mantienen ambos (la decisión más segura: nunca borra nada). Si quiere
  // fusionar, para eso está el botón "Revisar".
  function importAll() {
    if (candidates.length === 0) return;
    applyResolutions(new Map());
  }

  function reset() {
    setFileName(null);
    setCandidates([]);
    setErrorCount(0);
    setBank(undefined);
    setDone(false);
  }

  // --- Pantalla de revisión de duplicados (Fase 5) ---
  if (reviewing) {
    return (
      <DuplicateReview
        dupes={dupes}
        newCount={newOnes.length}
        onFinish={applyResolutions}
        onCancel={() => setReviewing(false)}
        onLearn={learnMerchantCategory}
      />
    );
  }

  return (
    <View className="absolute inset-0 z-40 justify-end">
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      <View
        className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-3"
        style={{ paddingBottom: 32 + insets.bottom, maxHeight: "88%" }}
      >
        <View className="items-center mb-3">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </View>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="font-extrabold text-base" style={{ color: primaryText }}>
            {t("importSheet.title")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <X size={16} color={iconMuted} />
          </TouchableOpacity>
        </View>

        {done ? (
          <View className="items-center py-6">
            <View className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950 items-center justify-center mb-3">
              <CheckCircle2 size={28} color="#059669" />
            </View>
            <Text className="font-extrabold text-base mb-1" style={{ color: primaryText }}>
              {t("importSheet.successTitle", { count: importedTotal })}
            </Text>
            <TouchableOpacity onPress={onClose} className="mt-4 w-full bg-emerald-600 py-4 rounded-2xl items-center">
              <Text className="text-white font-extrabold">{t("common.close")}</Text>
            </TouchableOpacity>
          </View>
        ) : !fileName ? (
          <>
            <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("importSheet.subtitle")}</Text>
            <TouchableOpacity
              onPress={pickFile}
              disabled={loading}
              className="w-full py-8 rounded-2xl items-center border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#059669" />
                  <Text className="text-xs text-slate-500 dark:text-slate-300 mt-2">
                    {loadingPdf ? t("importSheet.analyzingPdf") : t("importSheet.analyzing")}
                  </Text>
                </>
              ) : (
                <>
                  <FileUp size={26} color={iconMuted} />
                  <Text className="text-sm font-bold text-slate-600 dark:text-slate-200 mt-2">
                    {t("importSheet.pickFile")}
                  </Text>
                  <Text className="text-[11px] text-slate-400 dark:text-slate-300 mt-1">CSV · PDF</Text>
                </>
              )}
            </TouchableOpacity>
            <View className="flex-row items-center gap-2 mt-4 px-1">
              <Landmark size={13} color={iconMuted} />
              <Text className="text-[11px] text-slate-400 dark:text-slate-300 flex-1">
                {t("importSheet.compatBanks")}
              </Text>
            </View>
          </>
        ) : (
          <ScrollView>
            <View className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 mb-3">
              <Text className="text-xs font-semibold text-slate-500 dark:text-slate-300" numberOfLines={1}>
                {fileName}
              </Text>
              <Text className="text-[11px] text-slate-400 dark:text-slate-300 mt-1">
                {bank ? t("importSheet.detectedBank", { bank: accountLabelFor(bank) }) : t("importSheet.unknownBank")}
              </Text>
            </View>

            <View className="items-center py-2 mb-1">
              <Text className="font-extrabold text-lg" style={{ color: primaryText }}>
                {t("importSheet.foundCount", { count: candidates.length })}
              </Text>
              <Text className="text-[11px] text-slate-400 dark:text-slate-300">{t("importSheet.analyzedOk")}</Text>
            </View>

            <View className="gap-2.5 mb-4">
              <View className="flex-row items-center gap-3 bg-emerald-50 dark:bg-emerald-950 rounded-2xl p-3.5">
                <CheckCircle2 size={18} color="#059669" />
                <Text className="text-sm font-bold text-emerald-700 dark:text-slate-100 flex-1">
                  {t("importSheet.summaryNew", { count: newOnes.length })}
                </Text>
              </View>
              {dupes.length > 0 && (
                <View className="flex-row items-center gap-3 bg-amber-50 dark:bg-slate-800 rounded-2xl p-3.5">
                  <Copy size={18} color="#f59e0b" />
                  <Text className="text-sm font-bold text-amber-700 dark:text-slate-100 flex-1">
                    {t("importSheet.summaryDupes", { count: dupes.length })}
                  </Text>
                </View>
              )}
              {errorCount > 0 && (
                <View className="flex-row items-center gap-3 bg-rose-50 dark:bg-slate-800 rounded-2xl p-3.5">
                  <AlertTriangle size={18} color="#e11d48" />
                  <Text className="text-sm font-bold text-rose-600 dark:text-slate-100 flex-1">
                    {t("importSheet.summaryErrors", { count: errorCount })}
                  </Text>
                </View>
              )}
            </View>

            {/* VISTA PREVIA
                Antes solo se decía cuántos movimientos había: "34
                encontrados, 30 nuevos". Nadie importa 30 movimientos a
                ciegas en su cuenta, y si el banco venía mal leído no había
                forma de notarlo hasta después de guardarlo todo.
                Ahora se ven, con su fecha, su monto y marcados los que ya
                tienes. */}
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("importSheet.previewTitle")}
            </Text>
            <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
              {candidates.slice(0, PREVIEW_LIMIT).map((c, i) => (
                <View
                  key={c.tx.id}
                  className={`flex-row items-center gap-2.5 px-3 py-2.5 ${
                    i > 0 ? "border-t border-slate-100 dark:border-slate-800" : ""
                  }`}
                >
                  <Text className="text-[11px] text-slate-400 w-14">{fmtDate(c.tx.date, monthNames)}</Text>
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-xs font-bold"
                      style={{ color: primaryText }}
                      numberOfLines={1}
                    >
                      {c.tx.description || t(catInfo(c.tx.category).label)}
                    </Text>
                    {c.match && (
                      <Text className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                        {t("importSheet.previewDupe")}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`text-xs font-extrabold ${
                      c.tx.type === "expense" ? "text-rose-500" : "text-emerald-600"
                    }`}
                  >
                    {c.tx.type === "expense" ? "-" : "+"}
                    {fmt(c.tx.amount)}
                  </Text>
                </View>
              ))}
              {candidates.length > PREVIEW_LIMIT && (
                <Text className="text-[11px] text-slate-400 text-center py-2.5 border-t border-slate-100 dark:border-slate-800">
                  {t("importSheet.previewMore", { count: candidates.length - PREVIEW_LIMIT })}
                </Text>
              )}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={reset}
                className="w-12 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 items-center justify-center"
              >
                <X size={18} color={iconMuted} />
              </TouchableOpacity>
              {dupes.length > 0 && (
                <TouchableOpacity
                  onPress={() => setReviewing(true)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 items-center"
                >
                  <Text className="font-bold text-slate-600 dark:text-slate-200">{t("importSheet.reviewButton")}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={importAll} className="flex-1 py-3.5 rounded-2xl bg-emerald-600 items-center">
                <Text className="font-bold text-white">{t("importSheet.importAll")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
