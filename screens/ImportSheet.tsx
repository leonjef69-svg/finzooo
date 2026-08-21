import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { FileUp, CheckCircle2, AlertTriangle, Copy, X, Landmark } from "lucide-react-native";
import { diagnosePdf, extractPdfText, seEntiende } from "@/utils/pdfExtract";
import { extractExcelText, looksLikeExcel } from "@/utils/excelExtract";
import { useColorScheme } from "nativewind";
import { setPendingImport } from "@/utils/pendingImport";
import { useAppData } from "@/contexts/AppDataContext";
import { nextId } from "@/utils/id";
import { accountLabelFor, guessAccount } from "@/constants/accounts";
import { catInfo } from "@/constants/categories";
import { fmtDate } from "@/utils/format";
import { matchCategory, matchMethod, parseStatement, type RawRow } from "@/utils/importEngine";
import { suggestCategory } from "@/utils/classifier";
import { findBestMatch, mergeTransaction, type DuplicateMatch } from "@/utils/duplicates";
import DuplicateReview from "@/screens/DuplicateReview";
import { elegirArchivo, puedeElegirArchivo } from "@/modules/incoming-file";
import type { Transaction } from "@/types";

/**
 * La extensión que le toca a un documento de Google ya convertido.
 *
 * Existe porque el resto de la pantalla decide cómo leer un archivo mirando
 * su nombre, y una Hoja de Google no tiene extensión ninguna.
 */
const EXTENSION_CONVERTIDA: Record<string, string> = {
  "text/csv": ".csv",
  "text/comma-separated-values": ".csv",
  "text/plain": ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  // Drive a veces solo ofrece PDF de un documento suyo. Se acepta —el lector de PDF de Fino
  // sabe sacar una tabla— pero tiene que llamarse .pdf o acabaria en el lector de texto.
  "application/pdf": ".pdf",
};

/**
 * ELEGIR A QUÉ MES VAN LOS MOVIMIENTOS SIN FECHA (13/08/2026).
 *
 * Sale de su hoja de control: los montos y las categorías están escritos, y el mes vive en la
 * cabecera del archivo o en la cabeza de quien la llenó. Tirar esas filas era perder movimientos
 * de verdad; ponerles la fecha de hoy sería meter gastos viejos en el mes actual y descuadrarle
 * el presupuesto sin que se note. Lo único honesto es preguntar.
 *
 * Se ofrecen los doce meses hacia atrás desde hoy. Hacia adelante no: un gasto que todavía no ha
 * pasado no se importa de un archivo.
 */
function ElegirMes({
  visible,
  cuantos,
  monthNames,
  t,
  onCancel,
  onElegir,
}: {
  visible: boolean;
  cuantos: number;
  monthNames: string[];
  t: (k: string, p?: Record<string, string | number>) => string;
  onCancel: () => void;
  onElegir: (anio: number, mes: number) => void;
}) {
  if (!visible) return null;
  const hoy = new Date();
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  });
  return (
    <View className="absolute inset-0 items-center justify-center px-8 z-50">
      <TouchableOpacity className="absolute inset-0 bg-slate-900/50" activeOpacity={1} onPress={onCancel} />
      <View className="bg-white dark:bg-noche-2 rounded-3xl p-6 w-full max-h-[70%]">
        <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base mb-1.5">
          {t("importSheet.pickMonthTitle", { count: cuantos })}
        </Text>
        {/* Se dice el día exacto que se va a poner. "Los meto en agosto" no basta: en Fino un
            movimiento tiene día, y quien importa tiene derecho a saber cuál antes de aceptar. */}
        <Text className="text-sm text-slate-600 dark:text-slate-200 mb-4">
          {t("importSheet.pickMonthMessage")}
        </Text>
        <ScrollView className="max-h-64">
          {meses.map(({ anio, mes }) => (
            <TouchableOpacity
              key={`${anio}-${mes}`}
              onPress={() => onElegir(anio, mes)}
              className="py-3.5 px-4 rounded-xl bg-slate-100 dark:bg-noche-2 mb-2"
            >
              <Text className="font-bold text-slate-700 dark:text-slate-100">
                {monthNames[mes - 1]} {anio}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={onCancel} className="mt-2 py-3 rounded-xl bg-slate-100 dark:bg-noche-2 items-center">
          <Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Un movimiento del banco ya convertido a formato Fino, junto con la
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
   * Archivo que llegó desde otra app ("Compartir → Fino"). Si viene, se
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
  /** De las descartadas, cuántas eran movimientos de verdad a los que solo les faltaba la fecha. */
  const [sinFecha, setSinFecha] = useState(0);
  /** Esas mismas filas, enteras salvo la fecha, esperando a que se elija el mes. */
  const [rowsSinFecha, setRowsSinFecha] = useState<RawRow[]>([]);
  const [eligiendoMes, setEligiendoMes] = useState(false);
  /**
   * Los movimientos tuyos que ya se emparejaron con una fila del archivo.
   *
   * Es un ref y no un estado porque tiene que sobrevivir a la segunda tanda —la de las filas a
   * las que se les pone el mes a mano—: sin eso, un movimiento tuyo podria emparejarse dos
   * veces y saldria como repetido cuando no lo es.
   */
  const yaEmparejados = useRef<Set<number>>(new Set());
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
    // Sin forzar el tipo. Antes iba "application/pdf" fijo, así que un Excel
    // o un CSV compartidos a Fino se leían como si fueran un PDF: el lector
    // de PDF no encontraba nada y salía "no se pudo leer el texto de este
    // PDF" sobre un archivo que ni siquiera era un PDF.
    //
    // Se deja que decida el nombre del archivo, que es lo que Android nos da
    // de verdad al compartir.
    void loadFile(incoming.uri, incoming.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  /**
   * QUÉ FORMATOS SE OFRECEN CUANDO ELIGE LA LIBRERÍA DE SIEMPRE.
   *
   * Solo se usa en apps viejas, donde Fino todavía no sabe abrir la pantalla
   * de Android él mismo. Ahí las Hojas de Google **no se pueden ofrecer**:
   * salen en gris igualmente —la librería le pone al pedido una categoría que
   * las descarta, ver elegirArchivo en IncomingFileModule.kt— y ofrecer algo
   * que no se puede tocar es peor que no ofrecerlo.
   */
  const FORMATOS = [
    "text/csv",
    "text/comma-separated-values",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/pdf",
  ];

  async function pickFile() {
    // NADA DE ESTO PUEDE FALLAR EN SILENCIO. Antes no existía este try, y
    // cuando la librería se quedaba trabada con una elección anterior a medias
    // —le pasó a él el 12/08/2026— tocar el botón no hacía absolutamente nada:
    // ni error, ni pantalla, ni forma de saber qué estaba pasando.
    try {
      if (!puedeElegirArchivo) {
        const result = await DocumentPicker.getDocumentAsync({
          type: FORMATOS,
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        await loadFile(asset.uri, asset.name, asset.mimeType);
        return;
      }

      const elegido = await elegirArchivo();
      if (elegido.estado === "cancelado") return;
      if (elegido.estado === "error") {
        showToastAndClose(`${t("importSheet.unreadable")} (${elegido.motivo})`);
        return;
      }
      // Si hubo conversión, manda lo convertido. El nombre de una Hoja de
      // Google viene sin extensión ("Mis gastos"), y de la extensión depende
      // que se lea como texto o como Excel: sin esto, un CSV recién convertido
      // se intentaría abrir como hoja de cálculo y no saldría nada.
      const extra = EXTENSION_CONVERTIDA[elegido.convertido ?? ""] ?? "";
      const nombre =
        extra && !elegido.nombre.toLowerCase().endsWith(extra)
          ? elegido.nombre + extra
          : elegido.nombre;
      await loadFile(elegido.uri, nombre, elegido.convertido ?? undefined);
    } catch (e) {
      setLoading(false);
      showToastAndClose(`${t("importSheet.unreadable")} (${String(e)})`);
    }
  }

  /**
   * Convierte filas del archivo en movimientos de Fino, marcando los que se parecen a algo que
   * ya tienes.
   *
   * Se sacó del cuerpo de loadFile para poder usarla DOS veces sobre el mismo archivo: primero
   * con las filas que traían fecha, y después con las que solo la tuvieron cuando se eligió el
   * mes a mano. Copiarla habría bastado hoy y se habría desviado de la otra en el primer arreglo.
   */
  function construirCandidatos(raws: RawRow[]): Candidate[] {
    return raws.map((raw) => {
      // LA CATEGORÍA DEL ARCHIVO MANDA, Y ANTES SE TIRABA (12/08/2026).
      //
      // El comentario que había aquí decía "si el archivo ya trae una categoría reconocible la
      // respetamos" — y la línea de debajo no lo hacía: adivinaba SIEMPRE por la descripción.
      // La columna se leía, se guardaba en categoryRaw y ahí se quedaba. matchCategory existía
      // y no la llamaba nadie.
      //
      // Lo vio él con su propio Excel: la fila decía "Transporte" y el movimiento entró como
      // "Otros". Alguien que se toma el trabajo de clasificar sus movimientos antes de
      // importarlos espera que eso sirva de algo.
      //
      // El orden es: lo que ESCRIBIÓ una persona primero, lo que adivina la app después. Si la
      // categoría del archivo no se reconoce —"Alimentación" no es ninguna de las de Fino— se
      // cae a la adivinanza de siempre, que para "SUPERMERCADO PLAZA" acierta igual.
      const delArchivo = matchCategory(raw.categoryRaw, raw.type, t);
      const generica = delArchivo === (raw.type === "expense" ? "otros" : "otro_ingreso");
      const category = generica
        ? suggestCategory(raw.merchant || raw.description, raw.type, merchantLearned)
        : delArchivo;
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
      const match = findBestMatch(transactions, raw, yaEmparejados.current);
      if (match) yaEmparejados.current.add(match.existing.id);
      return { tx, raw, match };
    });
  }

  /**
   * Mete las filas sin fecha en el mes que se eligió, con día 1.
   *
   * El día 1 es una decisión, no un descuido: el archivo no dice ninguno, y hace falta uno para
   * que el movimiento exista. Se avisa en el cartel antes de elegir.
   */
  function ponerlesElMes(anio: number, mes: number) {
    const fecha = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const conFecha = rowsSinFecha.map((r) => ({ ...r, date: fecha }));
    setCandidates((previos) => [...previos, ...construirCandidatos(conFecha)]);
    setRowsSinFecha([]);
    setSinFecha(0);
    setEligiendoMes(false);
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
    const isExcel = !isPdf && looksLikeExcel(asset.name, asset.mimeType);
    let file: File | null = null;
    let readAsPdf = false;
    try {
      file = new File(asset.uri);
      readAsPdf = isPdf;

      let text: string;
      if (isPdf) {
        setLoadingPdf(true);
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        text = await extractPdfText(bytes);
        setLoadingPdf(false);
        // SE MIRA SI SALIÓ TEXTO **Y SI SE ENTIENDE**. Antes solo se miraba lo primero.
        //
        // Ese "solo lo primero" es lo que dejó al usuario sin respuesta el 07/08/2026:
        // subió su estado de cuenta real y salieron 7.024 caracteres de símbolos sin
        // sentido. Como texto había, esta comprobación lo daba por bueno, el importador
        // no encontraba ninguna columna y acababa saliendo el mensaje más genérico de
        // todos. La app tenía la respuesta —el texto no se entiende— y no la usaba.
        if (!text.trim() || !seEntiende(text)) {
          // Se dice POR QUÉ, no solo que no se pudo. Antes salía siempre el
          // mismo consejo —"expórtalo como CSV"— que sirve para un caso y
          // para los otros dos no, y dejaba sin saber si tenía arreglo.
          const problema = diagnosePdf(bytes, text);
          showToastAndClose(
            t(
              problema === "encrypted"
                ? "importSheet.pdfEncrypted"
                : problema === "scanned"
                  ? "importSheet.pdfScanned"
                  : problema === "sinLetras"
                    ? "importSheet.pdfSinLetras"
                    : "importSheet.pdfError"
            )
          );
          return;
        }
      } else if (isExcel) {
        // Un Excel es un archivo BINARIO, no texto. Antes se ofrecía el tipo
        // "application/vnd.ms-excel" en el selector pero se leía con
        // file.text(), así que salía un montón de caracteres ilegibles y el
        // importador decía que no encontraba las columnas — un mensaje que
        // hacía pensar que el archivo estaba mal cuando el fallo era este.
        //
        // Se convierte a texto separado por comas y entra por la misma
        // puerta que un CSV, con las mismas reglas de banco y duplicados.
        setLoadingPdf(true);
        const arrayBuffer = await file.arrayBuffer();
        text = extractExcelText(new Uint8Array(arrayBuffer)).text;
        setLoadingPdf(false);
        if (!text.trim()) {
          showToastAndClose(t("importSheet.excelError"));
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
      // SE CIERRA SOLO SI NO HAY ABSOLUTAMENTE NADA. Antes bastaba con que ninguna fila
      // trajera fecha para dar el archivo por vacío y cerrar — que es justo lo que le pasaba a
      // su hoja de control, donde los montos y las categorías SÍ estaban escritos. Con filas sin
      // fecha la pantalla se queda abierta para poder preguntarle de qué mes son.
      if (parsed.rows.length === 0 && parsed.rowsSinFecha.length === 0) {
        showToastAndClose(isPdf ? t("importSheet.pdfError") : t("importSheet.emptyFile"));
        return;
      }

      // Se empieza de cero con los emparejamientos: son de este archivo y de ninguno anterior.
      yaEmparejados.current = new Set();
      const built: Candidate[] = construirCandidatos(parsed.rows);

      setFileName(asset.name);
      setBank(detectedBank);
      setCandidates(built);
      setErrorCount(parsed.errorCount);
      setSinFecha(parsed.sinFecha);
      setRowsSinFecha(parsed.rowsSinFecha);
    } catch {
      showToastAndClose(readAsPdf ? t("importSheet.pdfError") : isExcel ? t("importSheet.excelError") : t("importSheet.readError"));
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
    setSinFecha(0);
    setRowsSinFecha([]);
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
        className="bg-white dark:bg-noche-2 rounded-t-3xl px-5 pt-3"
        style={{ paddingBottom: 32 + insets.bottom, maxHeight: "88%" }}
      >
        <View className="items-center mb-3">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-noche-3" />
        </View>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="font-extrabold text-base" style={{ color: primaryText }}>
            {t("importSheet.title")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
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
            <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("importSheet.subtitle2")}</Text>
            <TouchableOpacity
              onPress={pickFile}
              disabled={loading}
              className="w-full py-8 rounded-2xl items-center border-2 border-dashed border-slate-300 dark:border-noche-borde bg-slate-50 dark:bg-noche-2"
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
                  {/* Los formatos que se aceptan, a la vista. Esta línea
                      decía "CSV · PDF" y se quedó igual al añadir Excel: el
                      selector ya lo aceptaba, pero desde fuera no había forma
                      de saberlo y parecía que la función no estaba. */}
                  <Text className="text-[11px] text-slate-400 dark:text-slate-300 mt-1">
                    CSV · Excel · PDF
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <View className="flex-row items-center gap-2 mt-4 px-1">
              <Landmark size={13} color={iconMuted} />
              <Text className="text-[11px] text-slate-400 dark:text-slate-300 flex-1">
                {t("importSheet.compatBanks2")}
              </Text>
            </View>
          </>
        ) : (
          <ScrollView>
            <View className="bg-slate-50 dark:bg-noche-2 rounded-2xl p-3.5 mb-3">
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
                <View className="flex-row items-center gap-3 bg-amber-50 dark:bg-noche-2 rounded-2xl p-3.5">
                  <Copy size={18} color="#f59e0b" />
                  <Text className="text-sm font-bold text-amber-700 dark:text-slate-100 flex-1">
                    {t("importSheet.summaryDupes", { count: dupes.length })}
                  </Text>
                </View>
              )}
              {errorCount > 0 && (
                <View className="flex-row items-center gap-3 bg-rose-50 dark:bg-noche-2 rounded-2xl p-3.5">
                  <AlertTriangle size={18} color="#e11d48" />
                  <Text className="text-sm font-bold text-rose-600 dark:text-slate-100 flex-1">
                    {t("importSheet.summaryErrors", { count: errorCount })}
                  </Text>
                </View>
              )}
              {/* LAS QUE SOLO LES FALTA LA FECHA, APARTE Y CON QUÉ HACER.
                  "3 con errores" no deja actuar: no dice si son huecos de la hoja o
                  movimientos de verdad que se están perdiendo. Estas son lo segundo, y
                  se arreglan escribiendo la fecha en la hoja. */}
              {sinFecha > 0 && (
                <TouchableOpacity
                  onPress={() => setEligiendoMes(true)}
                  className="flex-row items-center gap-3 bg-amber-50 dark:bg-noche-2 rounded-2xl p-3.5 border-[1.5px] border-amber-300"
                >
                  <AlertTriangle size={18} color="#f59e0b" />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-amber-700 dark:text-slate-100">
                      {t("importSheet.summaryNoDate", { count: sinFecha })}
                    </Text>
                    {/* EL AVISO ES EL BOTÓN. Decir "3 sin fecha" y dejarlo ahí obliga a salir,
                        arreglar el archivo y volver a empezar; y muchas veces el archivo no se
                        puede arreglar —es de un tercero— o simplemente no lleva fechas. */}
                    <Text className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                      {t("importSheet.pickMonthAction")}
                    </Text>
                  </View>
                </TouchableOpacity>
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
            <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde overflow-hidden mb-4">
              {candidates.slice(0, PREVIEW_LIMIT).map((c, i) => (
                <View
                  key={c.tx.id}
                  className={`flex-row items-center gap-2.5 px-3 py-2.5 ${
                    i > 0 ? "border-t border-slate-100 dark:border-noche-borde" : ""
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
                <Text className="text-[11px] text-slate-400 text-center py-2.5 border-t border-slate-100 dark:border-noche-borde">
                  {t("importSheet.previewMore", { count: candidates.length - PREVIEW_LIMIT })}
                </Text>
              )}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={reset}
                className="w-12 py-3.5 rounded-2xl bg-slate-100 dark:bg-noche-2 items-center justify-center"
              >
                <X size={18} color={iconMuted} />
              </TouchableOpacity>
              {dupes.length > 0 && (
                <TouchableOpacity
                  onPress={() => setReviewing(true)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-noche-2 items-center"
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

      {/* Va el ultimo para quedar por encima de todo lo demas. */}
      <ElegirMes
        visible={eligiendoMes}
        cuantos={sinFecha}
        monthNames={monthNames}
        t={t}
        onCancel={() => setEligiendoMes(false)}
        onElegir={ponerlesElMes}
      />
    </View>
  );
}
