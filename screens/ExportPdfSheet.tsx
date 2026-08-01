import { useEffect, useMemo, useRef, useState } from "react";
import { uploadToDrive, DriveNotSignedIn, DriveDenied } from "@/utils/googleDrive";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import {
  BarChart3,
  Cloud,
  Eye,
  FileDown,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  Pencil,
  Share2,
  Sheet,
  X,
} from "lucide-react-native";
import * as MailComposer from "expo-mail-composer";
import { useColorScheme } from "nativewind";
import * as XLSX from "xlsx";
import { catInfo } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";
import PdfPreview from "@/components/PdfPreview";
import { methodLabel } from "@/constants/i18n";
import { LOGO_DATA_URI } from "@/constants/logo";
import { monthKey, fmtDate } from "@/utils/format";
import { buildPdfHtml, type PdfTx } from "@/utils/exportPdfHtml";
import { buildFileName, cancelRetry, markExported, toDateKey } from "@/utils/scheduledExport";
import {
  isGmailInstalled,
  isWhatsAppInstalled,
  shareToGmail,
  shareToMail,
  shareToWhatsApp,
} from "@/modules/share-to-app";
import {
  contactsFor,
  findContactByName,
  loadContacts,
  checkPhone,
  nextContactId,
  resolveRecipient,
  saveContacts,
  validateContact,
  type SendContact,
} from "@/utils/sendContacts";
import { useAppData } from "@/contexts/AppDataContext";

// Cuántos movimientos se dibujan en la vista previa. El PDF los lleva todos;
// esto es solo lo que se ve antes de decidir. Con cincuenta ya se comprueba
// que el mes y el tipo son los correctos, que es para lo que sirve mirar.
const PREVIEW_LIMIT = 50;

type ExportType = "all" | "expense" | "income";
type ExportFormat = "pdf" | "xlsx" | "csv";

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
  initialType,
  autoExport,
  destination: initialDestination = "share",
  silent,
  fileName: forcedName,
  recipientName,
}: {
  onClose: () => void;
  // Mes "AAAA-MM" con el que abrir ya elegido. Lo usa la orden por voz
  // ("exporta mis gastos de enero"). Si ese mes no tiene movimientos, el
  // efecto de más abajo cae solo al más reciente que sí los tenga.
  initialMonth?: string;
  initialFormat?: ExportFormat;
  initialType?: ExportType;
  // Exportar solo, sin esperar a que se toque el botón (orden por voz).
  autoExport?: boolean;
  // Sin pantalla. Lo usa la copia automática a Drive, que corre al abrir la
  // app: exporta, avisa con un mensajito y se cierra. Mostrar la hoja de
  // exportar para cerrarla medio segundo después sería un parpadeo raro
  // encima de Inicio, y encima daría tiempo a tocarla.
  silent?: boolean;
  // Nombre completo con extensión ("Gastos_Julio.pdf"), tal como lo dejó la
  // pantalla de recordatorios. Si no viene, se arma aquí igual que allí.
  fileName?: string;
  /**
   * A quien, tal como lo dijo la voz ("mama", "contador"). Se busca entre
   * los contactos guardados; si no aparece, se abre la app y se elige alli,
   * que es lo que pasaba antes de poder decirlo.
   */
  recipientName?: string;
  // Dónde va el archivo: "share" abre el menú de compartir de Android,
  // "mail" abre la aplicación de correo con el archivo ya adjunto, y
  // "drive" lo sube a Google Drive sin ninguna ventana de por medio.
  destination?: "share" | "mail" | "gmail" | "whatsapp" | "drive";
}) {
  const { t, transactions, month, monthNames, fmt, userName, showToast, categoryBudgets } =
    useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [exportType, setExportType] = useState<ExportType>(initialType ?? "all");
  const [format, setFormat] = useState<ExportFormat>(initialFormat ?? "pdf");
  // Dónde va el archivo. Era una propiedad fija que solo podía cambiar la
  // orden por voz: la subida a Drive estaba entera y funcionando, pero sin
  // ningún botón que la alcanzara. Ahora es un estado con su selector.
  const [destination, setDestination] = useState<"share" | "mail" | "gmail" | "whatsapp" | "drive">(
    initialDestination
  );
  const [exporting, setExporting] = useState(false);
  // Los gráficos vienen puestos porque son lo que hace que el reporte se
  // entienda de un vistazo. Se pueden quitar para quien quiera solo la lista
  // —por ejemplo si el PDF se lo va a pasar al contador—.
  const [charts, setCharts] = useState(true);
  // Se pregunta una vez al abrir. Es falso también cuando el APK es anterior
  // a esta función, porque la parte que habla con Gmail es código nativo y no
  // llega en las actualizaciones por internet.
  const [gmailDisponible] = useState(() => isGmailInstalled());
  const [whatsappDisponible] = useState(() => isWhatsAppInstalled());
  // El documento que se está mirando en grande, o null. Se guarda el HTML ya
  // armado y no una marca de "abierto": así lo que se ve es exactamente lo
  // que había en el momento de tocar, sin recalcularse por debajo.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // A quién mandarlo. La lista se guarda; la elección NO: se toca cada vez,
  // a propósito. Ver utils/sendContacts.
  const [contactos, setContactos] = useState<SendContact[]>([]);
  const [contactoId, setContactoId] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  // Cual se esta cambiando, o null si se esta creando uno nuevo. El
  // formulario es el mismo para las dos cosas.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoValor, setNuevoValor] = useState("");
  // Si los contactos ya se leyeron del almacenamiento. Lo mira la
  // exportacion automatica por voz antes de arrancar: sin ellos no sabria a
  // quien mandarlo aunque se hubiera dicho.
  const [contactosCargados, setContactosCargados] = useState(false);

  useEffect(() => {
    let vivo = true;
    loadContacts().then((l) => {
      if (!vivo) return;
      setContactos(l);
      setContactosCargados(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const contactosDelDestino = useMemo(
    () => contactsFor(contactos, destination),
    [contactos, destination]
  );

  // AL CAMBIAR DE DESTINO se suelta el elegido: un contacto de correo no
  // sirve para WhatsApp, y dejarlo marcado invitaría a mandar a un sitio que
  // no existe.
  //
  // Mira SOLO el destino, y esto es la corrección de un fallo de verdad.
  //
  // Antes miraba también la lista de contactos, así que se disparaba al
  // añadir uno. Y como añadir cambia la lista, el contacto recién creado
  // —que se deja elegido a propósito— se soltaba medio segundo después, solo.
  // Sin aviso ni nada visible.
  //
  // Se veía así: guardabas tu correo, tocabas Exportar, y Gmail abría con el
  // asunto, el texto y el PDF puestos pero el "Para" EN BLANCO. El mismo
  // fallo que tenía WhatsApp, con otra cara: el dato existía y se perdía en
  // el último paso.
  useEffect(() => {
    setAgregando(false);
    setEditandoId(null);
    setContactoId(null);
  }, [destination]);

  // A QUIÉN dijo la voz. Va aparte del de arriba porque este sí tiene que
  // volver a mirar cuando cambia la lista: los contactos se leen del
  // almacenamiento después de abrirse la pantalla.
  useEffect(() => {
    // Drive es tuyo y Compartir abre el menú de Android: ahí no hay a quién
    // mandar nada. Sin esto, "exporta julio a mi drive" acabaría avisando de
    // que no existe el contacto "mi drive" — un contacto que no haría falta.
    if (!recipientName || destination === "drive" || destination === "share") return;
    const encontrado = findContactByName(contactos, recipientName, destination);
    if (encontrado) setContactoId(encontrado.id);
    // Si se dijo un nombre y no está guardado, se avisa. Callarlo abriría
    // WhatsApp sin destinatario y parecería que no entendió a quién.
    //
    // Y se distingue entre "ese nombre no está" y "no hay ninguno guardado",
    // porque son problemas distintos con soluciones distintas. Antes, sin
    // ningún contacto guardado, no se decía NADA: WhatsApp abría su lista de
    // contactos con el archivo puesto y parecía que la orden no se había
    // entendido, cuando lo que faltaba era decirle el número una vez.
    if (!encontrado && contactosCargados) {
      const aviso = contactos.length === 0 ? "exportPdf.noContactsYet" : "exportPdf.contactNotFound";
      showToast(t(aviso, { name: recipientName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, contactos, contactosCargados, recipientName]);

  const contactoElegido = contactosDelDestino.find((c) => c.id === contactoId) ?? null;

  // Como quedaria el numero escrito, para poder contarlo antes de guardarlo.
  const revisionNumero = useMemo(() => checkPhone(nuevoValor), [nuevoValor]);

  /** Abre el formulario con un contacto ya escrito dentro, para cambiarlo. */
  function editarContacto(c: SendContact) {
    setEditandoId(c.id);
    setNuevoNombre(c.name);
    setNuevoValor(c.value);
    setAgregando(true);
  }

  function cerrarFormulario() {
    setAgregando(false);
    setEditandoId(null);
    setNuevoNombre("");
    setNuevoValor("");
  }

  function guardarContacto() {
    const kind: SendContact["kind"] = destination === "whatsapp" ? "whatsapp" : "email";
    const r = validateContact(nuevoNombre, kind, nuevoValor);
    if (!r.ok) {
      showToast(t(r.reason === "name" ? "exportPdf.contactNameError" : "exportPdf.contactValueError"));
      return;
    }

    // CAMBIAR UNO QUE YA ESTÁ.
    //
    // Conserva su identificador a propósito: si estaba elegido para enviar,
    // sigue estándolo después de corregirlo. Con un identificador nuevo se
    // habría quedado sin elegir justo después de arreglarle el número, que es
    // el momento en el que se va a usar.
    if (editandoId) {
      const lista = contactos.map((c) => (c.id === editandoId ? { ...c, ...r.contact } : c));
      setContactos(lista);
      saveContacts(lista);
      cerrarFormulario();
      showToast(t("exportPdf.contactSaved"));
      return;
    }

    const nuevo: SendContact = { id: nextContactId(contactos), ...r.contact };
    const lista = [...contactos, nuevo];
    setContactos(lista);
    saveContacts(lista);
    // Se deja elegido el que se acaba de crear: quien lo añade es para
    // mandarle algo ahora, no para tener que tocarlo otra vez.
    setContactoId(nuevo.id);
    cerrarFormulario();
  }

  function borrarContacto(id: string) {
    const lista = contactos.filter((c) => c.id !== id);
    setContactos(lista);
    saveContacts(lista);
    if (contactoId === id) setContactoId(null);
    showToast(t("exportPdf.contactRemoved"));
  }

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
    { id: "xlsx", label: "Excel", Icon: FileSpreadsheet },
    { id: "csv", label: "CSV", Icon: Sheet },
  ];

  const monthTx = transactions
    .filter((tx) => tx.date.startsWith(selectedMk))
    .filter((tx) => exportType === "all" || tx.type === exportType)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const total = monthTx.reduce(
    (sum, tx) => sum + (tx.type === "expense" ? -tx.amount : tx.amount),
    0
  );

  /**
   * Cómo se llamará el archivo.
   *
   * Si la pantalla de recordatorios ya decidió un nombre, manda ese. Si no,
   * se arma igual que allí: "Gastos_2026-07-31.pdf". Antes salía
   * "finzo-expense-2026-07.pdf", con la palabra en inglés del código dentro
   * del nombre que ve la persona que recibe el archivo.
   */
  function nombreDeArchivo(extension: "pdf" | "xlsx" | "csv"): string {
    if (forcedName) return forcedName;
    return buildFileName({
      mode: "auto",
      custom: "",
      typeLabel:
        exportType === "expense"
          ? t("exportPdf.expenses")
          : exportType === "income"
            ? t("exportPdf.income")
            : t("exportPdf.all"),
      dateKey: selectedMk,
      extension,
    });
  }

  function reportTitleFor(exportType: ExportType) {
    return exportType === "expense"
      ? t("exportPdf.pdfTitleExpenses")
      : exportType === "income"
      ? t("exportPdf.pdfTitleIncome")
      : t("exportPdf.pdfTitleAll");
  }

  /**
   * Arma el HTML del documento.
   *
   * Lo usan las DOS cosas: la vista previa y la exportación de verdad. Es lo
   * que hace que lo que se ve antes sea exactamente lo que sale después —
   * dos armadores distintos se habrían separado en cuanto alguien tocara uno,
   * y una vista previa que no coincide con el archivo es peor que no tener
   * vista previa.
   */
  function construirHtml(): string {
    const [y, m] = selectedMk.split("-").map(Number);
    // Días que tiene el mes elegido. El día 0 del mes siguiente es el último
    // del actual, y así también sale bien febrero en año bisiesto.
    const daysInMonth = new Date(y, m, 0).getDate();

    const pdfTxs: PdfTx[] = monthTx.map((tx) => {
      const c = catInfo(tx.category);
      return {
        dateLabel: fmtDate(tx.date, monthNames),
        day: Number(tx.date.slice(8, 10)),
        categoryLabel: t(c.label),
        categoryColor: c.color,
        description: tx.description || "",
        methodLabel: methodLabel(tx.method, t),
        amount: tx.amount,
        type: tx.type,
      };
    });

    // Los límites por categoría, con lo gastado DEL MES ELEGIDO.
    //
    // No se usa el categorySpent del contexto a propósito: ese siempre mira
    // el mes que se está viendo en Inicio, no el que se eligió aquí.
    // Exportando junio desde julio habría salido el gasto de julio contra los
    // límites, y nadie lo habría notado hasta comparar dos meses.
    const gastadoPorCategoria: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type !== "expense" || !tx.date.startsWith(selectedMk)) continue;
      gastadoPorCategoria[tx.category] = (gastadoPorCategoria[tx.category] || 0) + tx.amount;
    }
    const limites = Object.entries(categoryBudgets)
      .filter(([, limit]) => limit > 0)
      .map(([id, limit]) => {
        const c = catInfo(id);
        return {
          name: t(c.label),
          color: COLOR_HEX_600[c.color] || "#64748b",
          limit,
          spent: gastadoPorCategoria[id] || 0,
        };
      })
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

    // Los tres meses que TERMINAN en el mes elegido, del más antiguo al más
    // reciente. Solo los que tuvieron gasto: un mes en cero no aporta y hace
    // que las columnas de los otros se vean más chicas de lo que son.
    const meses = [2, 1, 0]
      .map((atras) => {
        const d = new Date(y, m - 1 - atras, 1);
        const key = monthKey(d.getFullYear(), d.getMonth());
        const total = transactions
          .filter((tx) => tx.type === "expense" && tx.date.startsWith(key))
          .reduce((s, tx) => s + tx.amount, 0);
        return { label: monthNames[d.getMonth()].slice(0, 3), value: total };
      })
      .filter((b) => b.value > 0);

    return buildPdfHtml({
      logoDataUri: LOGO_DATA_URI,
      userName,
      title: reportTitleFor(exportType),
      monthLabel: selectedMonthLabel,
      txs: pdfTxs,
      daysInMonth,
      fmt,
      charts,
      // Los presupuestos y las columnas de los tres meses son de GASTO: no
      // existe un presupuesto de ingresos ni tiene sentido comparar cuánto
      // gastaste en un reporte donde pediste solo lo que entró. En un
      // "exportar ingresos" salían igual, hablando de otra cosa.
      categoryBudgets: charts && exportType !== "income" ? limites : [],
      monthly: charts && exportType !== "income" ? meses : [],
      // toDateKey y no toISOString(): toISOString da la fecha en horario de
      // Greenwich, y Perú va cinco horas por detrás. Un PDF exportado a las
      // 8 de la noche del 30 habría salido fechado el 31.
      generatedAt: fmtDate(toDateKey(new Date()), monthNames),
      texts: {
        colDate: t("exportPdf.colDate"),
        colCategory: t("exportPdf.colCategory"),
        colDescription: t("exportPdf.colDescription"),
        colMethod: t("exportPdf.colMethod"),
        colAmount: t("exportPdf.colAmount"),
        total: t("exportPdf.total"),
        income: t("exportPdf.income"),
        expenses: t("exportPdf.expenses"),
        balance: t("exportPdf.balance"),
        byCategory: t("exportPdf.chartByCategory"),
        byCategoryBudget: t("categoryBudgets.rowLabel"),
        byMonth: t("reports.byMonth"),
        byDay: t("exportPdf.chartByDay"),
        generatedOn: t("exportPdf.generatedOn"),
        movements: t("exportPdf.movements"),
      },
    });
  }

  async function exportAsPdf() {
    const html = construirHtml();

    const { uri } = await Print.printToFileAsync({ html });

    // El PDF recién creado se llama con un código de máquina
    // ("00568bde-f682-452f-803e-bdf56d86c76a.pdf"), que es lo que aparecía
    // al compartirlo por WhatsApp: ilegible para quien lo recibe e
    // imposible de encontrar después entre los archivos.
    //
    // Se cambia a un nombre que se lee: "finzo-todos-2026-06.pdf". El
    // nombre YA se calculaba aquí abajo, pero solo lo usaba la subida a
    // Drive; el archivo que se compartía seguía siendo el del código.
    const fileName = nombreDeArchivo("pdf");
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

  /**
   * Las filas del reporte, sin dar formato todavía.
   *
   * Las comparten el CSV y el Excel. Antes solo existía la versión del CSV;
   * copiarla para el Excel habría hecho que un cambio en las columnas se
   * aplicara a uno y al otro no, y nadie lo notaría hasta abrir los dos
   * archivos del mismo mes y verlos distintos.
   */
  function filasDelReporte(): (string | number)[][] {
    const cabecera = [
      t("exportPdf.colDate"),
      t("exportPdf.colCategory"),
      t("exportPdf.colDescription"),
      t("exportPdf.colMethod"),
      t("exportPdf.colAmount"),
    ];
    const filas = monthTx.map((tx) => {
      const c = catInfo(tx.category);
      const montoConSigno = tx.type === "expense" ? -tx.amount : tx.amount;
      return [
        fmtDate(tx.date, monthNames),
        t(c.label),
        tx.description || "",
        methodLabel(tx.method, t),
        montoConSigno,
      ];
    });
    return [cabecera, ...filas, [], [t("exportPdf.total"), "", "", "", total]];
  }

  /**
   * Excel de verdad (.xlsx), no un CSV con nombre de Excel.
   *
   * El formato que había se llamaba "Excel (CSV)" y era un CSV: se abre en
   * Excel, sí, pero con todo en una columna hasta que alguien sepa separarlo,
   * y con los montos como texto. Este sale con sus columnas y con los montos
   * como NÚMEROS, así que se pueden sumar y ordenar sin tocar nada.
   */
  async function exportAsExcel() {
    const wb = XLSX.utils.book_new();
    const hoja = XLSX.utils.aoa_to_sheet(filasDelReporte());
    // Anchos de columna, o la descripción sale cortada y hay que arrastrar
    // cada borde a mano al abrirlo.
    hoja["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, hoja, t("exportPdf.movements").slice(0, 31));

    const bytes = new Uint8Array(
      XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
    );

    const fileName = nombreDeArchivo("xlsx");
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);

    return {
      uri: file.uri,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName,
    };
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

    const fileName = nombreDeArchivo("csv");
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    return { uri: file.uri, mimeType: "text/csv", fileName };
  }

  /**
   * Se llama al terminar una exportación de verdad, venga de donde venga.
   *
   * Apunta el día y retira el aviso de repesca. Lo segundo importa: si se
   * exportó a las 9:05, el "todavía no exportaste" de las 9:30 tiene que no
   * llegar. Un recordatorio que insiste después de hecha la tarea se
   * silencia en dos días, y con él se pierde el que sí servía.
   */
  function exportacionHecha() {
    markExported(new Date());
    cancelRetry().catch(() => {});
  }

  async function handleExport() {
    if (monthTx.length === 0) {
      showToast(t("exportPdf.noData"));
      return;
    }

    // A QUIÉN VA. Se busca AQUÍ, y no se lee del contacto ya marcado en
    // pantalla, a propósito.
    //
    // Cuando la orden viene por voz, el efecto que busca el nombre entre los
    // contactos y esta función corren en la MISMA vuelta de React. Ese efecto
    // llama a setContactoId, pero eso no cambia nada al instante: apunta el
    // cambio para la vuelta siguiente. Así que aquí, en la vuelta de ahora,
    // el contacto marcado seguía siendo NINGUNO — aunque estuviera guardado y
    // el nombre se hubiera entendido perfectamente.
    //
    // Resultado: se llamaba a WhatsApp sin número y WhatsApp abría su lista
    // de contactos. Desde fuera parecía que no había entendido a quién,
    // cuando lo sabía y lo perdía en el último paso.
    //
    // Buscarlo aquí no depende de ninguna vuelta: los contactos ya están
    // cargados (la exportación automática espera a que lo estén) y el nombre
    // llega por parámetro.
    const destinatario = resolveRecipient(contactoElegido, contactos, recipientName, destination);

    // TENÍAS CONTACTOS Y NO ELEGISTE A NADIE.
    //
    // Se avisa antes de salir de Finzo, porque después ya no hay dónde: la
    // app de correo o WhatsApp se abren encima y el aviso quedaría detrás.
    //
    // No frena el envío —dejar el destinatario en blanco y escribirlo allí es
    // una forma legítima de usarlo—, pero avisa de que va a pasar. Abrir
    // Gmail con el "Para" vacío sin decir nada es lo que parece un fallo.
    const pideDestinatario =
      destination === "whatsapp" || destination === "gmail" || destination === "mail";
    if (pideDestinatario && !destinatario && contactosDelDestino.length > 0) {
      showToast(t("exportPdf.noContactPicked"));
    }

    setExporting(true);
    try {
      // Primero se arma el archivo, y después se decide qué hacer con él.
      // Antes cada función se compartía a sí misma; separarlo es lo que
      // permite mandarlo a Drive sin duplicar todo el armado.
      const file =
        format === "pdf"
          ? await exportAsPdf()
          : format === "xlsx"
            ? await exportAsExcel()
            : await exportAsCsv();

      if (destination === "drive") {
        const uploaded = await uploadToDrive(file.uri, file.fileName, file.mimeType);
        showToast(t("exportPdf.savedToDrive", { name: uploaded.name || file.fileName }));
        exportacionHecha();
        return;
      }

      if (destination === "whatsapp") {
        // Va directo a WhatsApp, sin pasar por el menú de compartir. Ese menú
        // lo arma Android: WhatsApp puede salir al final de una lista larga,
        // o no salir. Así se abre el selector de contactos de WhatsApp con el
        // archivo ya adjunto y solo queda elegir a quién.
        const ok = shareToWhatsApp(
          file.uri,
          file.mimeType,
          t("exportPdf.mailBody", { month: selectedMonthLabel }),
          destinatario?.value ?? ""
        );
        if (!ok) {
          // Si no se pudo —sin WhatsApp, o con un APK anterior a esto— se cae
          // al menú de compartir de siempre en vez de no hacer nada.
          showToast(t("exportPdf.whatsappMissing"));
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, { mimeType: file.mimeType });
          }
        }
        exportacionHecha();
        return;
      }

      if (destination === "gmail") {
        // Va directo a Gmail, sin pasar por el menú de compartir. "Correo"
        // abre la app de correo que esté puesta por defecto, que en un Honor
        // suele ser la del fabricante: quien tiene las dos instaladas no
        // tenía forma de llegar a Gmail.
        const ok = shareToGmail(
          file.uri,
          file.mimeType,
          t("exportPdf.mailSubject", { month: selectedMonthLabel }),
          t("exportPdf.mailBody", { month: selectedMonthLabel }),
          destinatario?.value ?? ""
        );
        if (!ok) {
          // Si no se pudo (sin Gmail, o sin la parte nativa porque el APK es
          // anterior), se cae al menú de compartir en vez de no hacer nada.
          showToast(t("schedExport.gmailMissing"));
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, { mimeType: file.mimeType });
          }
        }
        exportacionHecha();
        return;
      }

      if (destination === "mail") {
        // El correo va aparte del menú de compartir a propósito. Ese menú
        // lo arma Android y qué apps salen ahí cambia de un celular a otro:
        // en el suyo aparecían WhatsApp y poco más. Esto abre directamente
        // la aplicación de correo, con el archivo ya adjunto y el asunto
        // puesto.
        // Primero, directo a la aplicación de correo, igual que Gmail y
        // WhatsApp. Antes esto siempre pasaba por el menú de Android
        // preguntando con qué aplicación abrirlo — y con la orden por voz eso
        // era justo el toque que se quería quitar: se decía la frase entera y
        // aun así había que contestar una pregunta antes de ver el correo.
        const directo = shareToMail(
          file.uri,
          file.mimeType,
          t("exportPdf.mailSubject", { month: selectedMonthLabel }),
          t("exportPdf.mailBody", { month: selectedMonthLabel }),
          destinatario?.value ?? ""
        );
        if (directo) {
          exportacionHecha();
          return;
        }

        // Si no se pudo —sin aplicación de correo, o con un APK anterior a
        // esto, porque es código nativo y no llega por actualización— se cae
        // al camino de siempre: el menú de Android.
        if (!(await MailComposer.isAvailableAsync())) {
          showToast(t("exportPdf.mailUnavailable"));
          return;
        }
        await MailComposer.composeAsync({
          recipients: destinatario ? [destinatario.value] : undefined,
          subject: t("exportPdf.mailSubject", { month: selectedMonthLabel }),
          body: t("exportPdf.mailBody", { month: selectedMonthLabel }),
          attachments: [file.uri],
        });
        exportacionHecha();
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType,
          UTI: file.mimeType === "application/pdf" ? "com.adobe.pdf" : "public.data",
        });
        exportacionHecha();
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

    // Si la voz dijo A QUIÉN, hay que esperar a que los contactos terminen
    // de cargarse.
    //
    // Se cargan del almacenamiento, que tarda un instante, y la exportación
    // automática arrancaba en cuanto sabía el mes — antes de eso. Resultado:
    // WhatsApp se abría con el archivo pero SIN el número, y había que
    // buscar el contacto a mano justo en la orden que existe para no tener
    // que buscarlo. Y no fallaba nada, así que parecía que no había
    // entendido a quién.
    if (recipientName && !contactosCargados) return;

    autoFired.current = true;

    if (!availableMonths.includes(initialMonth)) {
      showToast(t("exportPdf.noDataForMonth", { month: labelForMonth(initialMonth) }));
      // Sin pantalla no hay nada que mirar ni forma de salir: si no se cierra
      // aquí, la copia automática de un mes vacío dejaría a la persona con
      // una pantalla en blanco encima de Inicio.
      if (silent) onClose();
      return;
    }
    handleExport().finally(() => {
      if (silent) onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExport, initialMonth, availableMonths, recipientName, contactosCargados]);

  // La copia automática a Drive no dibuja nada. El trabajo lo hacen los
  // efectos de arriba, que corren igual: un componente que devuelve null
  // sigue vivo.
  if (silent) return null;

  return (
    <View className="absolute inset-0 z-40 justify-end">
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      {/* La hoja no puede pasar del 88% de la pantalla. Con la vista previa
          dentro, en un celular corto el botón de exportar se salía por abajo
          y no había forma de alcanzarlo: se veían las opciones pero no se
          podía exportar. El tope, más el ScrollView de más abajo, dejan el
          botón siempre pegado al borde inferior y todo lo demás se desliza. */}
      <View
        className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-3"
        style={{ maxHeight: "88%", paddingBottom: 20 + insets.bottom }}
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

        <ScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 4 }}
        >

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
        <View className="flex-row flex-wrap gap-2 mb-4">
          {([
            { id: "share", label: t("exportPdf.destShare"), Icon: Share2 },
            { id: "mail", label: t("exportPdf.destMail"), Icon: Mail },
            // Gmail solo si de verdad está instalado. Un botón "Gmail" en un
            // celular sin Gmail solo puede decepcionar.
            ...(gmailDisponible
              ? ([{ id: "gmail", label: t("schedExport.destGmail"), Icon: Mail }] as const)
              : []),
            ...(whatsappDisponible
              ? ([{ id: "whatsapp", label: t("exportPdf.destWhatsApp"), Icon: MessageCircle }] as const)
              : []),
            { id: "drive", label: t("exportPdf.destDrive"), Icon: Cloud },
          ] as const).map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setDestination(opt.id)}
              className={`flex-row items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl border-[1.5px] ${
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

        {/* A QUIÉN.
            Solo para los destinos que necesitan una persona: Drive es tuyo y
            Compartir abre el menú de Android, donde ya eliges allí.

            Se elige EN EL MOMENTO, no una vez y para siempre. Un destinatario
            guardado como fijo se olvida a los tres meses, y un día se toca
            Exportar en automático y el estado de cuenta se va a quien no
            toca. Aquí siempre se toca el nombre de quien lo va a recibir. */}
        {(destination === "mail" || destination === "gmail" || destination === "whatsapp") && (
          <>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.sendTo")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {contactosDelDestino.map((c) => (
                <View
                  key={c.id}
                  className={`flex-row items-center rounded-xl border-[1.5px] ${
                    contactoId === c.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <TouchableOpacity
                    onPress={() => setContactoId(contactoId === c.id ? null : c.id)}
                    onLongPress={() => borrarContacto(c.id)}
                    className="pl-3.5 pr-2 py-2.5"
                  >
                    <Text
                      className={`text-xs font-bold ${
                        contactoId === c.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                      }`}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                  {/* CAMBIARLO.
                      Un número con un dígito de menos no da ningún error
                      visible, así que se descubre tarde. Sin esto, la única
                      forma de corregirlo era borrarlo y escribirlo entero
                      otra vez. */}
                  <TouchableOpacity
                    onPress={() => editarContacto(c)}
                    hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                    className="px-1 py-2.5"
                  >
                    <Pencil size={12} color={contactoId === c.id ? "#ffffff" : "#94a3b8"} strokeWidth={2.6} />
                  </TouchableOpacity>
                  {/* BORRAR, A LA VISTA.
                      Se borraba manteniendo pulsado, y eso no lo descubre
                      nadie: un contacto escrito mal se quedaba ahí para
                      siempre. Mantener pulsado sigue funcionando para quien
                      ya lo sabía. */}
                  <TouchableOpacity
                    onPress={() => borrarContacto(c.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 4, right: 10 }}
                    className="pr-3 pl-0.5 py-2.5"
                  >
                    <X size={13} color={contactoId === c.id ? "#ffffff" : "#94a3b8"} strokeWidth={2.8} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => { setEditandoId(null); setNuevoNombre(""); setNuevoValor(""); setAgregando(true); }}
                className="px-3.5 py-2.5 rounded-xl border-[1.5px] border-dashed border-slate-300 dark:border-slate-600"
              >
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  {t("exportPdf.addContact")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
              {contactoId
                ? t("exportPdf.sendToHint")
                : contactosDelDestino.length > 0
                  ? t("exportPdf.sendToNone")
                  : t("exportPdf.sendToEmpty")}
            </Text>

            {agregando && (
              <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 mb-4">
                <TextInput
                  value={nuevoNombre}
                  onChangeText={setNuevoNombre}
                  placeholder={t("exportPdf.contactName")}
                  placeholderTextColor="#94a3b8"
                  maxLength={30}
                  className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 mb-2"
                />
                <TextInput
                  value={nuevoValor}
                  onChangeText={setNuevoValor}
                  placeholder={
                    destination === "whatsapp"
                      ? t("exportPdf.contactPhone")
                      : t("exportPdf.contactEmail")
                  }
                  placeholderTextColor="#94a3b8"
                  keyboardType={destination === "whatsapp" ? "phone-pad" : "email-address"}
                  autoCapitalize="none"
                  maxLength={60}
                  className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                />
                {/* EL NÚMERO TAL COMO SE VA A USAR.
                    Un número mal escrito no da ningún error: WhatsApp abre un
                    chat vacío en vez de decir que no existe, y eso se
                    descubre cuando el reporte no llegó. Aquí se ve antes. */}
                {destination === "whatsapp" && revisionNumero.normalized !== "" && (
                  <Text
                    className={`text-[11px] mt-2 ${
                      revisionNumero.warning
                        ? "font-bold text-amber-600 dark:text-amber-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {revisionNumero.warning === "peruLength"
                      ? t("exportPdf.phonePeru", { count: revisionNumero.normalized.length })
                      : t("exportPdf.phonePreview", { number: revisionNumero.normalized })}
                  </Text>
                )}

                <View className="flex-row gap-2.5 mt-3">
                  <TouchableOpacity
                    onPress={cerrarFormulario}
                    className="flex-1 py-2.5 rounded-xl items-center border-[1.5px] border-slate-200 dark:border-slate-700"
                  >
                    <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
                      {t("common.cancel")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={guardarContacto}
                    className="flex-1 py-2.5 rounded-xl items-center bg-emerald-600"
                  >
                    <Text className="text-xs font-bold text-white">{t("common.save")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* GRÁFICOS.
            Solo tiene sentido en PDF: un CSV es una tabla de números que se
            abre en Excel, no tiene dónde dibujar nada. Se oculta en vez de
            mostrarse apagado para no ofrecer algo que no va a pasar. */}
        {format === "pdf" && (
          <TouchableOpacity
            onPress={() => setCharts((v) => !v)}
            className={`flex-row items-center gap-3 rounded-xl border-[1.5px] px-4 py-3 mb-4 ${
              charts
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-600"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            }`}
          >
            <BarChart3 size={17} color={charts ? "#059669" : colorScheme === "dark" ? "#94a3b8" : "#475569"} />
            <View className="flex-1">
              <Text
                className={`text-sm font-bold ${
                  charts ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-200"
                }`}
              >
                {t("exportPdf.chartsLabel")}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t("exportPdf.chartsHint")}
              </Text>
            </View>
            <View
              className={`w-5 h-5 rounded-md border-[1.5px] items-center justify-center ${
                charts ? "bg-emerald-600 border-emerald-600" : "border-slate-300 dark:border-slate-600"
              }`}
            >
              {charts && <Text className="text-white text-[11px] font-extrabold">✓</Text>}
            </View>
          </TouchableOpacity>
        )}

        {/* VISTA PREVIA.
            Antes solo se decía "34 movimientos" y un total. Eso no basta
            para saber si lo que va a salir es lo correcto: con el mes o el
            tipo mal elegidos el número también se ve razonable, y el error
            se descubría al abrir el archivo o, peor, cuando ya lo había
            recibido otra persona. Ahora se ven antes de mandarlo. */}
        <View className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-4">
          <View className="flex-row items-end justify-between">
            <View>
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
            {monthTx.length > 0 && (
              <Text className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1">
                {t("exportPdf.previewLabel")}
              </Text>
            )}
          </View>

          {monthTx.length > 0 && (
            <View className="mt-3 border-t-[1.5px] border-slate-200 dark:border-slate-700 pt-1">
              {monthTx.slice(0, PREVIEW_LIMIT).map((tx) => {
                const c = catInfo(tx.category);
                return (
                  <View
                    key={tx.id}
                    className="flex-row items-center gap-2.5 py-1.5"
                  >
                    <View
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <Text
                      className="text-[11px] text-slate-400 dark:text-slate-500"
                      style={{ width: 62 }}
                      numberOfLines={1}
                    >
                      {fmtDate(tx.date, monthNames)}
                    </Text>
                    <Text
                      className="flex-1 text-xs text-slate-600 dark:text-slate-200"
                      numberOfLines={1}
                    >
                      {tx.description || t(c.label)}
                    </Text>
                    <Text
                      className="text-xs font-bold"
                      style={{ color: tx.type === "expense" ? "#e11d48" : "#059669" }}
                    >
                      {tx.type === "expense" ? "-" : "+"}
                      {fmt(tx.amount)}
                    </Text>
                  </View>
                );
              })}
              {monthTx.length > PREVIEW_LIMIT && (
                <Text className="text-[11px] text-slate-400 dark:text-slate-500 pt-1.5">
                  {t("exportPdf.previewMore", { count: monthTx.length - PREVIEW_LIMIT })}
                </Text>
              )}
            </View>
          )}
        </View>

        </ScrollView>

        {/* VER EL DOCUMENTO ANTES DE MANDARLO.
            Enseña el MISMO HTML que se le da al generador del PDF, así que
            no es una aproximación: es el documento, antes de convertirlo.
            Solo en PDF — un Excel es una tabla de números y se mira en Excel. */}
        {format === "pdf" && monthTx.length > 0 && (
          <TouchableOpacity
            onPress={() => setPreviewHtml(construirHtml())}
            className="w-full mt-3 py-3.5 rounded-2xl items-center flex-row justify-center gap-2 border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <Eye size={17} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
            <Text className="text-slate-600 dark:text-slate-200 font-bold">
              {t("exportPdf.seeDocument")}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting}
          className={`w-full mt-3 py-4 rounded-2xl items-center flex-row justify-center gap-2 bg-emerald-600 ${
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
                  format: format === "pdf" ? "PDF" : format === "xlsx" ? "Excel" : "CSV",
                })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Va el último y por encima de todo: al abrirse tapa la hoja de
          exportar entera, que es lo que se quiere para mirar un documento. */}
      {previewHtml !== null && (
        <PdfPreview
          html={previewHtml}
          title={`${reportTitleFor(exportType)} · ${selectedMonthLabel}`}
          onClose={() => setPreviewHtml(null)}
        />
      )}
    </View>
  );
}
