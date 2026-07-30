import { useEffect, useMemo, useRef, useState } from "react";
import { uploadToDrive, DriveNotSignedIn, DriveDenied } from "@/utils/googleDrive";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Cloud, FileDown, Share2, Sheet, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { catInfo } from "@/constants/categories";
import { methodLabel } from "@/constants/i18n";
import { monthKey, fmtDate } from "@/utils/format";
import { useAppData } from "@/contexts/AppDataContext";

type ExportType = "all" | "expense" | "income";
type ExportFormat = "pdf" | "csv";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function ExportPdfSheet({
  onClose,
  initialMonth,
  initialFormat,
  autoExport,
  destination: initialDestination = "share",
}: {
  onClose: () => void;
  // Mes "AAAA-MM" con el que abrir ya elegido. Lo usa la orden por voz
  // ("exporta mis gastos de enero"). Si ese mes no tiene movimientos, el
  // efecto de más abajo cae solo al más reciente que sí los tenga.
  initialMonth?: string;
  initialFormat?: ExportFormat;
  // Exportar solo, sin esperar a que se toque el botón (orden por voz).
  autoExport?: boolean;
  // "share" abre el menú de compartir; "drive" sube el archivo a Google
  // Drive sin ninguna ventana de por medio.
  destination?: "share" | "drive";
}) {
  const { t, transactions, month, monthNames, fmt, userName, showToast } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [exportType, setExportType] = useState<ExportType>("all");
  const [format, setFormat] = useState<ExportFormat>(initialFormat ?? "pdf");
  // Dónde va el archivo. Era una propiedad fija que solo podía cambiar la
  // orden por voz: la subida a Drive estaba entera y funcionando, pero sin
  // ningún botón que la alcanzara. Ahora es un estado con su selector.
  const [destination, setDestination] = useState<"share" | "drive">(initialDestination);
  const [exporting, setExporting] = useState(false);

  // Antes se exportaba siempre el mes que se estuviera viendo en Inicio, sin
  // posibilidad de elegir otro: para bajarse un mes pasado había que salir,
  // cambiarlo con las flechas y volver a entrar aquí. Ahora se elige desde
  // esta misma pantalla, y arranca en el mes que se venía viendo para que
  // el camino de siempre siga siendo el más corto.
  const viewedMk = monthKey(month.y, month.m);
  const [selectedMk, setSelectedMk] = useState(initialMonth || viewedMk);

  // Solo meses que tengan al menos un movimiento —gasto o ingreso, da igual
  // el monto—, del más reciente al más antiguo. Un mes vacío no se ofrece:
  // elegirlo solo llevaría a un "0 movimientos" y a un botón que no hace
  // nada. Ojo: NO se filtra por el tipo elegido abajo (Gastos/Ingresos), o
  // los meses irían apareciendo y desapareciendo al cambiar ese selector.
  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map((tx) => tx.date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // El mes que se venía viendo puede no estar en la lista (si está vacío),
  // así que en ese caso se cae al más reciente que sí tenga movimientos.
  useEffect(() => {
    if (availableMonths.length === 0) return;
    if (!availableMonths.includes(selectedMk)) setSelectedMk(availableMonths[0]);
  }, [availableMonths, selectedMk]);

  // "2026-08" → "Agosto 2026", en el idioma elegido. No se puede usar el
  // monthLabel del contexto porque ese siempre describe el mes que se está
  // viendo, no el que se eligió aquí.
  function labelForMonth(key: string) {
    const [y, m] = key.split("-").map(Number);
    return `${monthNames[m - 1]} ${y}`;
  }

  const selectedMonthLabel = labelForMonth(selectedMk);

  const TYPE_OPTIONS: { id: ExportType; label: string }[] = [
    { id: "all", label: t("exportPdf.all") },
    { id: "expense", label: t("exportPdf.expenses") },
    { id: "income", label: t("exportPdf.income") },
  ];

  const FORMAT_OPTIONS: { id: ExportFormat; label: string; Icon: typeof FileDown }[] = [
    { id: "pdf", label: "PDF", Icon: FileDown },
    { id: "csv", label: "Excel (CSV)", Icon: Sheet },
  ];

  const monthTx = transactions
    .filter((tx) => tx.date.startsWith(selectedMk))
    .filter((tx) => exportType === "all" || tx.type === exportType)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const total = monthTx.reduce(
    (sum, tx) => sum + (tx.type === "expense" ? -tx.amount : tx.amount),
    0
  );

  function reportTitleFor(exportType: ExportType) {
    return exportType === "expense"
      ? t("exportPdf.pdfTitleExpenses")
      : exportType === "income"
      ? t("exportPdf.pdfTitleIncome")
      : t("exportPdf.pdfTitleAll");
  }

  async function exportAsPdf() {
    const rows = monthTx
      .map((tx) => {
        const c = catInfo(tx.category);
        const amountColor = tx.type === "expense" ? "#e11d48" : "#059669";
        const sign = tx.type === "expense" ? "-" : "+";
        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${fmtDate(tx.date, monthNames)}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${t(c.label)}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${tx.description || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${methodLabel(tx.method, t)}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:${amountColor};font-weight:bold;">
              ${sign}${fmt(tx.amount)}
            </td>
          </tr>`;
      })
      .join("");

    const html = `
      <html>
        <body style="font-family:-apple-system,Helvetica,sans-serif;padding:28px;color:#0f172a;">
          <h1 style="color:#059669;margin-bottom:2px;">Finzo</h1>
          <p style="color:#64748b;margin-top:0;">${userName}</p>
          <h2 style="margin-bottom:4px;">${reportTitleFor(exportType)}</h2>
          <p style="color:#64748b;margin-top:0;">${selectedMonthLabel}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="text-align:left;padding:8px;">${t("exportPdf.colDate")}</th>
                <th style="text-align:left;padding:8px;">${t("exportPdf.colCategory")}</th>
                <th style="text-align:left;padding:8px;">${t("exportPdf.colDescription")}</th>
                <th style="text-align:left;padding:8px;">${t("exportPdf.colMethod")}</th>
                <th style="text-align:right;padding:8px;">${t("exportPdf.colAmount")}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <h3 style="text-align:right;margin-top:20px;">
            ${t("exportPdf.total")}: ${fmt(total)}
          </h3>
        </body>
      </html>`;

    const { uri } = await Print.printToFileAsync({ html });

    // El PDF recién creado se llama con un código de máquina
    // ("00568bde-f682-452f-803e-bdf56d86c76a.pdf"), que es lo que aparecía
    // al compartirlo por WhatsApp: ilegible para quien lo recibe e
    // imposible de encontrar después entre los archivos.
    //
    // Se cambia a un nombre que se lee: "finzo-todos-2026-06.pdf". El
    // nombre YA se calculaba aquí abajo, pero solo lo usaba la subida a
    // Drive; el archivo que se compartía seguía siendo el del código.
    const fileName = `finzo-${exportType}-${selectedMk}.pdf`;
    let shareUri = uri;
    try {
      const nice = new File(Paths.cache, fileName);
      if (nice.exists) nice.delete();
      new File(uri).move(nice);
      shareUri = nice.uri;
    } catch {
      // Si el renombrado falla se comparte con el nombre feo: es mejor eso
      // que quedarse sin exportar.
    }

    return { uri: shareUri, mimeType: "application/pdf", fileName };
  }

  async function exportAsCsv() {
    const header = [
      t("exportPdf.colDate"),
      t("exportPdf.colCategory"),
      t("exportPdf.colDescription"),
      t("exportPdf.colMethod"),
      t("exportPdf.colAmount"),
    ]
      .map(csvEscape)
      .join(",");

    const rows = monthTx.map((tx) => {
      const c = catInfo(tx.category);
      const signedAmount = tx.type === "expense" ? -tx.amount : tx.amount;
      return [
        fmtDate(tx.date, monthNames),
        t(c.label),
        tx.description || "",
        methodLabel(tx.method, t),
        signedAmount.toFixed(2),
      ]
        .map((v) => csvEscape(String(v)))
        .join(",");
    });

    const csv = [header, ...rows, "", `${csvEscape(t("exportPdf.total"))},,,,${total.toFixed(2)}`].join(
      "\n"
    );

    const fileName = `finzo-${exportType}-${selectedMk}.csv`;
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    return { uri: file.uri, mimeType: "text/csv", fileName };
  }

  async function handleExport() {
    if (monthTx.length === 0) {
      showToast(t("exportPdf.noData"));
      return;
    }
    setExporting(true);
    try {
      // Primero se arma el archivo, y después se decide qué hacer con él.
      // Antes cada función se compartía a sí misma; separarlo es lo que
      // permite mandarlo a Drive sin duplicar todo el armado.
      const file = format === "pdf" ? await exportAsPdf() : await exportAsCsv();

      if (destination === "drive") {
        const uploaded = await uploadToDrive(file.uri, file.fileName, file.mimeType);
        showToast(t("exportPdf.savedToDrive", { name: uploaded.name || file.fileName }));
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType,
          UTI: file.mimeType === "application/pdf" ? "com.adobe.pdf" : "public.comma-separated-values-text",
        });
      }
    } catch (e) {
      if (e instanceof DriveNotSignedIn) showToast(t("exportPdf.driveNoAccount"));
      else if (e instanceof DriveDenied) showToast(t("exportPdf.driveDenied"));
      else showToast(t(destination === "drive" ? "exportPdf.driveError" : "exportPdf.error"));
    } finally {
      setExporting(false);
    }
  }

  // Exportación automática por orden de voz ("exporta enero de 2025").
  //
  // Se exige que el mes pedido TENGA movimientos de verdad. Sin eso, el
  // efecto de más arriba lo habría cambiado por el mes reciente que sí los
  // tiene, y se habría enviado en silencio el archivo de un mes que nadie
  // pidió — con la persona creyendo que era el suyo.
  const autoFired = useRef(false);
  useEffect(() => {
    if (!autoExport || autoFired.current || !initialMonth) return;
    if (availableMonths.length === 0) return;
    autoFired.current = true;

    if (!availableMonths.includes(initialMonth)) {
      showToast(t("exportPdf.noDataForMonth", { month: labelForMonth(initialMonth) }));
      return;
    }
    handleExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExport, initialMonth, availableMonths]);

  return (
    <View className="absolute inset-0 z-40 justify-end">
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      <View
        className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-3"
        style={{ paddingBottom: 32 + insets.bottom }}
      >
        <View className="items-center mb-3">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </View>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
            {t("exportPdf.exportDataTitle")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <X size={16} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">
          {t("exportPdf.subtitle", { month: selectedMonthLabel })}
        </Text>

        {/* Selector de mes. En fila con desplazamiento horizontal en vez de
            una lista desplegable: así se ven varios meses de un vistazo y se
            elige de un toque, sin abrir otro panel encima de este. */}
        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
          {t("exportPdf.monthLabel")}
        </Text>
        {availableMonths.length === 0 ? (
          <View className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 mb-4">
            <Text className="text-xs text-slate-500 dark:text-slate-300">
              {t("exportPdf.noMonths")}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            className="mb-4"
          >
            {availableMonths.map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => setSelectedMk(key)}
                className={`px-4 py-2.5 rounded-xl border-[1.5px] ${
                  selectedMk === key
                    ? "bg-emerald-600 border-emerald-600"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    selectedMk === key ? "text-white" : "text-slate-600 dark:text-slate-200"
                  }`}
                >
                  {labelForMonth(key)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
          {t("exportPdf.formatLabel")}
        </Text>
        <View className="flex-row gap-2.5 mb-4">
          {FORMAT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setFormat(opt.id)}
              className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-[1.5px] ${
                format === opt.id
                  ? "bg-emerald-600 border-emerald-600"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              }`}
            >
              <opt.Icon
                size={16}
                color={format === opt.id ? "#ffffff" : colorScheme === "dark" ? "#94a3b8" : "#475569"}
              />
              <Text
                className={`text-sm font-bold ${
                  format === opt.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
          {t("exportPdf.typeLabel")}
        </Text>
        <View className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-row mb-4">
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setExportType(opt.id)}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                exportType === opt.id ? "bg-emerald-600" : ""
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  exportType === opt.id ? "text-white" : "text-slate-500 dark:text-slate-300"
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* DÓNDE VA EL ARCHIVO.
            "Compartir" abre la lista de Android (WhatsApp, correo…). Qué
            apps salen ahí lo decide Android, no Finzo, y de un celular a
            otro cambia. "Guardar en Drive" no depende de esa lista: sube el
            archivo directo, sin ventanas de por medio. */}
        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
          {t("exportPdf.destinationLabel")}
        </Text>
        <View className="flex-row gap-2.5 mb-4">
          {([
            { id: "share", label: t("exportPdf.destShare"), Icon: Share2 },
            { id: "drive", label: t("exportPdf.destDrive"), Icon: Cloud },
          ] as const).map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setDestination(opt.id)}
              className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-[1.5px] ${
                destination === opt.id
                  ? "bg-emerald-600 border-emerald-600"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              }`}
            >
              <opt.Icon
                size={16}
                color={destination === opt.id ? "#ffffff" : colorScheme === "dark" ? "#94a3b8" : "#475569"}
              />
              <Text
                className={`text-sm font-bold ${
                  destination === opt.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-4">
          <Text className="text-xs text-slate-500 dark:text-slate-300">
            {t("exportPdf.countLabel", { count: monthTx.length })}
          </Text>
          <Text
            className="text-lg font-extrabold mt-0.5"
            style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
          >
            {fmt(total)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting}
          className={`w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 bg-emerald-600 ${
            exporting ? "opacity-60" : ""
          }`}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : format === "pdf" ? (
            <FileDown size={18} color="#ffffff" />
          ) : (
            <Sheet size={18} color="#ffffff" />
          )}
          <Text className="text-white font-extrabold">
            {exporting
              ? t("exportPdf.exporting")
              : t(destination === "drive" ? "exportPdf.saveToDrive" : "exportPdf.exportFormat", {
                  // El botón decía "Exportar PDF" incluso con Excel
                  // elegido. Ahora nombra lo que de verdad va a salir.
                  format: format === "pdf" ? "PDF" : "Excel",
                })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
