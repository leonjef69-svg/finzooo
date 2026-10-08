import ConfirmDialog from "@/components/ConfirmDialog";
import EtiquetaMetodo from "@/components/EtiquetaMetodo";
import IconBadge from "@/components/IconBadge";
import MonthSelector from "@/components/MonthSelector";
import MovementAllButton from "@/components/MovementAllButton";
import PressableScale from "@/components/PressableScale";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import SpaceTransferAmounts from "@/components/SpaceTransferAmounts";
import { catInfo } from "@/constants/categories";
import { iconoDe } from "@/constants/iconos";
import { CARD_SHADOW, SALDO_TARJETA, SALDO_VERDE } from "@/constants/style";
import { balanceGradientForVisualStyle } from "@/constants/visualTheme";
import { useAppData } from "@/contexts/AppDataContext";
import type { Month, Transaction } from "@/types";
import { amountInputError, parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { formatBudgetDisplay } from "@/utils/budgetDisplay";
import {
  estadoEn,
  cuandoAvisar,
  fechaEnElMes,
  mesDe,
  pagosDelMes,
  type EstadoDelPago,
  type PagoProgramado,
} from "@/utils/calendarioPagos";
import { availablePersonalBalance, budgetUsed } from "@/utils/finances";
import { paymentForCalendarNotification } from "@/utils/calendarNotificationTap";
import { fmtDate, monthKey } from "@/utils/format";
import { esFoto } from "@/utils/iconosFavoritos";
import { compactPersonalTransferRows, type TransferGroupSummary } from "@/utils/linkedTransfers";
import { irUnaVez } from "@/utils/nav";
import { compararMovimientos } from "@/utils/ordenarMovimientos";
import { usePendingImport } from "@/utils/pendingImport";
import {
  mergeSeenHomeNotificationIds,
  shouldShowHomeExportResult,
  summarizeHomeNotifications,
  unreadHomeNotificationIds,
} from "@/utils/homeNotifications";
import { ultimoIntentoEnFondo, type UltimoIntento } from "@/utils/exportarEnFondo";
import { loadJSON, saveJSONNow, STORAGE_KEYS } from "@/utils/storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Notifications from "expo-notifications";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CreditCard,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eraser,
  Eye,
  EyeOff,
  FileUp,
  ArrowRightLeft,
  ListChecks,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Modal from "@/components/PrivateModal";
import { useReduceMotion } from "@/utils/useReduceMotion";
import Animated, {
  cancelAnimation,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const softShadow = CARD_SHADOW;

function fechaCompletaParaAviso(iso: string, idiomaUsuario: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return iso;
  const idioma = idiomaUsuario === "en" ? "en-US" : idiomaUsuario === "pt" ? "pt-BR" : "es-PE";
  return new Date(anio, mes - 1, dia, 12).toLocaleDateString(idioma, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Oculta temporalmente el acceso mientras se define una conversión de moneda
// confiable. La pantalla, los datos y el flujo permanecen intactos para poder
// reactivarlos sin reconstruir la función.
const MOSTRAR_TARJETA_CREDITO = false;

/* LA FILA, APARTE Y MEMOIZADA.
   Antes se dibujaba dentro de renderItem, una función nueva en cada pasada, y encima
   preguntaba `selected.includes(id)` — un recorrido de la lista de seleccionados POR CADA
   fila. Resultado: marcar un movimiento volvía a dibujar los treinta de la pantalla. Ahora
   cada fila recibe ya masticado si está marcada, y React solo redibuja la que cambió. */
const FilaMovimiento = memo(function FilaMovimiento({
  tx,
  index,
  marcada,
  selectMode,
  oscuro,
  fmt,
  t,
  monthNames,
  onPress,
  transferGroup,
}: {
  tx: Transaction;
  index: number;
  marcada: boolean;
  selectMode: boolean;
  oscuro: boolean;
  fmt: (n: number) => string;
  t: (k: string, v?: Record<string, string | number>) => string;
  monthNames: string[];
  onPress: (id: number, grouped: boolean) => void;
  transferGroup?: TransferGroupSummary;
}) {
  const c = catInfo(tx.category);
  const isTransfer = Boolean(tx.internalTransfer);
  const spaceName = tx.internalTransferSpaceName || t(tx.internalTransfer === "family" ? "spaces.family" : "spaces.boxes");
  const title = isTransfer
    ? spaceName
    : tx.description || t(c.label);
  // Si la persona dejó como descripción el mismo nombre de la categoría,
  // mostrar ambos renglones es una repetición, no información adicional.
  const repeatsCategory = title.trim().localeCompare(t(c.label).trim(), undefined, { sensitivity: "accent" }) === 0;
  // La animación de entrada se aplica SOLO a las filas visibles al
  // abrir (las 8 primeras). Antes se aplicaba a todas, y como las
  // posteriores llevaban el retardo máximo (400 ms), al desplazarse
  // cada fila nueva aparecía en blanco durante ese tiempo antes de
  // dibujarse — se veía como tirones y la lista se sentía pesada.
  // Las filas de más abajo ya no "entran" animadas: simplemente
  // están ahí cuando llegas a ellas, que es lo esperable al
  // desplazar.
  const Row = index < 8 ? Animated.View : View;
  const rowProps = index < 8 ? { entering: FadeInDown.delay(index * 50).duration(280) } : {};
  return (
    <View className="px-5">
      <Row {...rowProps}>
        <PressableScale
          onPress={() => onPress(tx.id, Boolean(transferGroup))}
          // El contorno se ve poco, sobre todo de noche: la tarjeta
          // es slate-900 y el fondo de la pantalla TAMBIÉN, así que
          // lo único que las separaba era un borde casi del mismo
          // color. Se sube medio píxel de grosor y se aclara el
          // color un tono en cada tema.
          className={`flex-row items-center gap-3 bg-white dark:bg-noche-2 rounded-2xl p-3 border-[1.5px] mb-2.5 ${
            marcada
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950"
              : "border-slate-200 dark:border-noche-borde"
          }`}
          style={softShadow}
        >
          {selectMode &&
            (marcada ? (
              <CheckCircle2 size={22} color="#059669" />
            ) : (
              <Circle size={22} color="#cbd5e1" />
            ))}
          {/* SU PROPIO DIBUJO SI LO TIENE. Ver Transaction.icono: lo trae un pago del
              calendario, y la categoria sigue mandando en las cuentas. */}
          <IconBadge
            Icon={isTransfer ? ArrowRightLeft : tx.icono && !esFoto(tx.icono) ? iconoDe(tx.icono) : c.icon}
            color={isTransfer ? "#2563eb" : tx.iconColor ?? c.color}
            image={isTransfer ? undefined : esFoto(tx.icono ?? "") ? tx.icono : c.image}
          />
          {isTransfer ? <SpaceTransferAmounts
            title={title}
            sentLabel={t(tx.internalTransfer === "family" ? "transfer.sentToFamily" : "transfer.sentToBox")}
            returnedLabel={t("transfer.returned")}
            sent={transferGroup?.sent ?? (tx.type === "expense" ? tx.amount : 0)}
            returned={transferGroup?.returned ?? (tx.type === "income" ? tx.amount : 0)}
            consumed={transferGroup?.consumed}
            consumedLabel={t("transfer.consumed")}
            format={fmt}
          /> : <><View className="flex-1 min-w-0">
            <Text
              className="text-base font-bold"
              style={{ color: oscuro ? "#f1f5f9" : "#0f172a" }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="mt-0.5 text-[11px]" style={{ color: oscuro ? "#94a3b8" : "#64748b" }} numberOfLines={1}>
              {`${fmtDate(tx.date, monthNames)}${tx.time ? ` · ${tx.time}` : ""}`}
            </Text>
          </View>
          <View className="items-end self-stretch justify-start">
            <Text
              className={`text-base font-extrabold ${tx.type === "expense" ? "text-rose-500" : "text-emerald-600"}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {tx.type === "expense" ? "-" : "+"}{fmt(tx.amount)}
            </Text>
            {!repeatsCategory ? (
              <Text className="mt-0.5 text-[11px] font-semibold" style={{ color: oscuro ? "#cbd5e1" : "#475569" }} numberOfLines={1}>
                {t(c.label)}
              </Text>
            ) : null}
            <View className="mt-1"><EtiquetaMetodo metodo={tx.method} t={t} oscuro={oscuro} /></View>
          </View></>}
        </PressableScale>
      </Row>
    </View>
  );
});

export default function Home({
  month,
  setMonth,
  budget,
  spent: _spent,
  income: _income,
  prevBalance,
  transactions,
  onOpenDetail,
  onBulkDelete,
}: {
  userName: string;
  month: Month;
  setMonth: (m: Month) => void;
  budget: number;
  spent: number;
  income: number;
  prevBalance: number;
  transactions: Transaction[];
  onOpenDetail: (id: number) => void;
  onBulkDelete: (ids: number[]) => void;
}) {
  const {
    ready,
    fmt: formatAmount,
    t,
    userCurrency,
    userLanguage,
    showToast,
    monthNames,
    monthLabel,
    setBudgetForCurrentMonth,
    carryoverActive,
    resetCarryover,
    restoreCarryover,
    pagosProgramados,
    marcarPagoDelMes,
    visualStyle,
  } = useAppData();
  const { avisoPagoId, avisoMes, avisoTap } = useLocalSearchParams<{
    avisoPagoId?: string; avisoMes?: string; avisoTap?: string;
  }>();
  const peachOlive = visualStyle === "peachOlive";
  const { height: viewportHeight } = useWindowDimensions();
  const [confirmResetCarryover, setConfirmResetCarryover] = useState(false);
  const [confirmRestoreCarryover, setConfirmRestoreCarryover] = useState(false);
  // El cálculo vive en utils/finances.ts y no aquí. Reportes enseña el mismo
  // "Disponible", y con la fórmula copiada en dos sitios bastaría con tocar
  // una para que las dos pantallas mostraran saldos distintos del mismo mes.
  const mk = monthKey(month.y, month.m);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [hideBalance, setHideBalance] = useState(false);
  // El ojo oculta todos los importes de Inicio sin cambiar los datos.
  const fmt = useCallback((amount: number) => hideBalance ? "• • • • • •" : formatAmount(amount), [hideBalance, formatAmount]);
  const [collapsedPreviousBalanceMonths, setCollapsedPreviousBalanceMonths] = useState<string[]>([]);
  const archivoPendiente = usePendingImport();
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);
  const [ahoraAvisos, setAhoraAvisos] = useState(() => Date.now());
  const [avisosVistos, setAvisosVistos] = useState<string[]>([]);
  const [estadoAvisosCargado, setEstadoAvisosCargado] = useState(false);
  const [estadoExportacionInicialCargado, setEstadoExportacionInicialCargado] = useState(false);
  const [ultimoIntentoExportacion, setUltimoIntentoExportacion] = useState<UltimoIntento | null>(null);
  const [avisoCalendarioSeleccionado, setAvisoCalendarioSeleccionado] = useState<{
    pago: PagoProgramado;
    mes: string;
    estado: EstadoDelPago;
  } | null>(null);
  const rotacionCampana = useSharedValue(0);
  const rotacionCampanaEstilo = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotacionCampana.value}deg` }],
  }));
  const avisosNuevosAnteriores = useRef<Set<string> | null>(null);
  const reducirMovimiento = useReduceMotion();
  const ultimoAvisoTelefono = useRef<string | null>(null);
  const showToastAvisoRef = useRef(showToast);
  showToastAvisoRef.current = showToast;

  useEffect(() => {
    if (!ready || typeof avisoPagoId !== "string" || typeof avisoMes !== "string"
      || typeof avisoTap !== "string" || ultimoAvisoTelefono.current === avisoTap) return;
    ultimoAvisoTelefono.current = avisoTap;
    const pago = /^\d{4}-(0[1-9]|1[0-2])$/.test(avisoMes)
      ? paymentForCalendarNotification(pagosProgramados, avisoPagoId, avisoMes) : null;
    if (pago) {
      setAvisosAbiertos(true);
      setAvisoCalendarioSeleccionado({ pago, mes: avisoMes, estado: estadoEn(pago, avisoMes, new Date()) });
    } else {
      showToastAvisoRef.current(t("home.notificationUnavailable"));
    }
    router.setParams({ avisoPagoId: undefined, avisoMes: undefined, avisoTap: undefined });
  }, [ready, avisoPagoId, avisoMes, avisoTap, pagosProgramados, t]);

  useEffect(() => {
    let active = true;
    loadJSON<string[]>(STORAGE_KEYS.homeNotificationSeen, [])
      .then((ids) => { if (active) setAvisosVistos(Array.isArray(ids) ? ids : []); })
      .finally(() => { if (active) setEstadoAvisosCargado(true); });
    return () => { active = false; };
  }, []);

  // La notificación de Android puede llegar con Inicio abierto. Al recibirla
  // actualizamos la hora y el indicador sin esperar a que la persona cambie de pantalla.
  useEffect(() => {
    const listener = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.calendarioPagos === true || data?.screen === "export-result") {
        setAhoraAvisos(Date.now());
      }
      if (data?.screen === "export-result") {
        ultimoIntentoEnFondo()
          .then(setUltimoIntentoExportacion)
          .catch(() => setUltimoIntentoExportacion(null));
      }
    });
    return () => listener.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setAhoraAvisos(Date.now());
    ultimoIntentoEnFondo()
      .then((attempt) => { if (active) setUltimoIntentoExportacion(attempt); })
      .catch(() => { if (active) setUltimoIntentoExportacion(null); })
      .finally(() => { if (active) setEstadoExportacionInicialCargado(true); });
    return () => { active = false; };
  }, []));

  async function alternarAvisos() {
    const abrir = !avisosAbiertos;
    setAvisosAbiertos(abrir);
    if (!abrir) {
      setAvisoCalendarioSeleccionado(null);
      return;
    }
    try {
      // Se vuelve a leer al abrir la campana: la exportación puede haber acabado
      // mientras Inicio seguía abierto.
      setUltimoIntentoExportacion(await ultimoIntentoEnFondo());
    } catch {
      setUltimoIntentoExportacion(null);
    }
  }

  function cerrarAvisos() {
    setAvisosAbiertos(false);
    setAvisoCalendarioSeleccionado(null);
  }

  function confirmarAvisoCalendario() {
    const aviso = avisoCalendarioSeleccionado;
    if (!aviso) return;
    const { pago, mes } = aviso;
    marcarPagoDelMes(pago.id, mes, true);
    showToast(
      pago.tipo === "pago"
        ? pago.monto != null
          ? t("home.notificationExpenseDone", { nombre: pago.nombre, monto: fmt(pago.monto) })
          : t("home.notificationExpenseDoneWithoutAmount", { nombre: pago.nombre })
        : pago.tipo === "ingreso"
          ? pago.monto != null
            ? t("home.notificationIncomeDone", { nombre: pago.nombre, monto: fmt(pago.monto) })
            : t("home.notificationIncomeDoneWithoutAmount", { nombre: pago.nombre })
          : t("home.notificationReminderDone", { nombre: pago.nombre })
    );
    setAvisoCalendarioSeleccionado(null);
  }

  function editarAvisoCalendario() {
    const id = avisoCalendarioSeleccionado?.pago.id;
    if (!id) return;
    setAvisoCalendarioSeleccionado(null);
    setAvisosAbiertos(false);
    irUnaVez(`/calendario/nuevo?id=${id}`);
  }

  function startEditBudget() {
    setBudgetInput(String(budget));
    setEditingBudget(true);
  }
  function saveBudgetInline() {
    const issue = amountInputError(budgetInput, userCurrency);
    if (issue) { showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")); return; }
    setBudgetForCurrentMonth(parseAmountInput(budgetInput, userCurrency));
    setEditingBudget(false);
  }
  function togglePreviousBalance() {
    setCollapsedPreviousBalanceMonths((current) =>
      current.includes(mk) ? current.filter((key) => key !== mk) : [...current, mk]
    );
  }
  const monthTx = useMemo(
    () =>
      transactions
        // Un método de pago describe cómo se pagó; no puede hacer desaparecer
        // el gasto ni cambiar el saldo solo en Inicio.
        .filter((t) => t.date.startsWith(mk))
        .sort(compararMovimientos),
    [transactions, mk]
  );
  const availableMonths = useMemo(
    () => Array.from(new Set(
      transactions
        .map((transaction) => transaction.date.slice(0, 7))
        .filter((key) => /^\d{4}-\d{2}$/.test(key)),
    )).sort().reverse(),
    [transactions],
  );
  // El primer mes no ofrece ocultar un saldo que todavía no existe. Basta con
  // que haya actividad anterior, un saldo arrastrado o que el usuario haya
  // cerrado la puerta de este mes para que la tarjeta tenga sentido.
  const hasPreviousBalanceHistory =
    prevBalance !== 0 || carryoverActive || availableMonths.some((key) => key < mk);
  const showPreviousBalanceCard =
    hasPreviousBalanceHistory && !collapsedPreviousBalanceMonths.includes(mk);
  const mainSpent = useMemo(() => monthTx.filter((t) => t.type === "expense" && !t.internalTransfer).reduce((sum,t)=>sum+t.amount,0), [monthTx]);
  const mainIncome = useMemo(() => monthTx.filter((t) => t.type === "income" && !t.internalTransfer).reduce((sum,t)=>sum+t.amount,0), [monthTx]);
  const transfersOut = useMemo(() => monthTx.filter((t) => t.type === "expense" && t.internalTransfer).reduce((sum,t)=>sum+t.amount,0), [monthTx]);
  const transfersIn = useMemo(() => monthTx.filter((t) => t.type === "income" && t.internalTransfer).reduce((sum,t)=>sum+t.amount,0), [monthTx]);
  const compactMonthRows = useMemo(() => {
    const acrossMonths = new Map(compactPersonalTransferRows(transactions)
      .flatMap(row => row.transferGroup ? [[row.transferGroup.key, row.transferGroup] as const] : []));
    return compactPersonalTransferRows(monthTx).map(row => row.transferGroup
      ? { ...row, transferGroup: acrossMonths.get(row.transferGroup.key) || row.transferGroup }
      : row);
  }, [monthTx, transactions]);
  const [recentFilter, setRecentFilter] = useState<"income" | "expense" | null>(null);
  const visibleRecentRows = useMemo(() => recentFilter
    ? compactMonthRows.filter(row => !row.item.internalTransfer && row.item.type === recentFilter)
    : compactMonthRows, [compactMonthRows, recentFilter]);
  // Estas cifras no pertenecen a un mes: muestran el neto que Personal ha
  // transferido a cada tipo de espacio. Toda salida enlazada nació al elegir
  // "Desde Personal" y toda entrada enlazada es una devolución; el dinero
  // externo no crea una mitad en Personal y por eso no entra en la cuenta.
  const available = availablePersonalBalance({ budget, prevBalance, income: mainIncome, spent: mainSpent, transfersOut, transfersIn });
  const pct = budgetUsed({ budget, prevBalance, income: mainIncome, spent: mainSpent }) * 100;
  const visiblePct = Math.max(0, Math.min(100, pct));
  const progressColor = pct >= 100 ? "#fb7185" : pct >= 80 ? "#fbbf24" : peachOlive ? "#65764a" : "#6ee7b7";
  const previousActionText = peachOlive ? "#4338ca" : "#eef2ff";
  const previousActionBackground = peachOlive ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.12)";
  const previousActionBorder = peachOlive ? "#c7d2fe" : "rgba(224,231,255,0.62)";

  /**
   * ¿HAY ALGO QUE PAGAR YA? Se mantiene separado de lo que es solo próximo.
   *
   * Solo lo VENCIDO y lo de HOY. Un recibo que vence en cinco días no es una urgencia, y si
   * el punto se encendiera con él estaría encendido casi siempre — que es exactamente lo que
   * pasaba antes, cuando era fijo, y por eso no significaba nada.
   */
  const hayPagosUrgentes = useMemo(() => {
    const hoy = new Date(ahoraAvisos);
    const mesAhora = mesDe(hoy);
    return pagosProgramados.some((p) => {
      if (p.tipo === "recordatorio") return false;
      const e = estadoEn(p, mesAhora, hoy);
      if (e === "vencido") return true;
      return e === "pendiente" && fechaEnElMes(p, mesAhora).slice(8) === String(hoy.getDate()).padStart(2, "0");
    });
  }, [pagosProgramados, ahoraAvisos]);
  const avisosCalendario = useMemo(() => {
    const hoy = new Date(ahoraAvisos);
    const mesAhora = mesDe(hoy);
    return pagosDelMes(pagosProgramados, mesAhora)
      .map((p) => ({ pago: p, mes: mesAhora, estado: estadoEn(p, mesAhora, hoy) }))
      .filter(({ estado }) => estado !== "pagado")
      .sort((a, b) => fechaEnElMes(a.pago, mesAhora).localeCompare(fechaEnElMes(b.pago, mesAhora)));
  }, [pagosProgramados, ahoraAvisos]);
  const exportacionVisible = ultimoIntentoExportacion &&
    shouldShowHomeExportResult(ultimoIntentoExportacion.resultado, ultimoIntentoExportacion.automatico)
      ? ultimoIntentoExportacion
      : null;
  // La campana informa solo del último intento real. La próxima fecha sigue
  // estando en Exportación automática, no como si el archivo ya hubiera llegado.
  const estadoNotificaciones = summarizeHomeNotifications({
    hasUrgentPayments: hayPagosUrgentes,
    hasPendingImport: Boolean(archivoPendiente),
    hasExportResult: Boolean(exportacionVisible),
  });
  const candidatosNoLeidos = useMemo(() => {
    const candidatos = avisosCalendario.map(({ pago, mes }) => ({
      id: `calendario:${pago.id}:${mes}`,
      arrivedAt: cuandoAvisar(pago, mes)?.getTime() ?? Number.MAX_SAFE_INTEGER,
    }));
    if (archivoPendiente) {
      candidatos.push({ id: `importacion:${archivoPendiente.uri}`, arrivedAt: 0 });
    }
    if (exportacionVisible) {
      candidatos.push({ id: `exportacion:${exportacionVisible.cuando}`, arrivedAt: exportacionVisible.cuando });
    }
    return candidatos;
  }, [avisosCalendario, archivoPendiente, exportacionVisible]);
  const idsNoLeidos = useMemo(
    () => unreadHomeNotificationIds(candidatosNoLeidos, avisosVistos, ahoraAvisos),
    [candidatosNoLeidos, avisosVistos, ahoraAvisos],
  );
  const numeroNoLeidos = estadoAvisosCargado ? idsNoLeidos.length : 0;
  const hayNotificaciones = numeroNoLeidos > 0;

  useEffect(() => {
    if (!ready || !estadoAvisosCargado || !estadoExportacionInicialCargado) return;
    const anteriores = avisosNuevosAnteriores.current;
    avisosNuevosAnteriores.current = new Set(idsNoLeidos);
    if (reducirMovimiento) {
      cancelAnimation(rotacionCampana);
      rotacionCampana.value = 0;
      return;
    }
    // La primera lectura contiene avisos anteriores, no llegadas nuevas.
    if (!anteriores) return;
    const nuevos = idsNoLeidos.filter(id => !anteriores.has(id)).length;
    if (nuevos <= 0) return;
    const secuencia = [];
    for (let i = 0; i < Math.min(nuevos, 5); i++) {
      secuencia.push(
        withTiming(-15, { duration: 45, reduceMotion: ReduceMotion.System }),
        withTiming(15, { duration: 65, reduceMotion: ReduceMotion.System }),
        withTiming(-11, { duration: 45, reduceMotion: ReduceMotion.System }),
        withTiming(11, { duration: 55, reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: 55, reduceMotion: ReduceMotion.System }),
      );
    }
    rotacionCampana.value = withSequence(...secuencia);
  }, [ready, estadoAvisosCargado, estadoExportacionInicialCargado, idsNoLeidos, reducirMovimiento, rotacionCampana]);

  useEffect(() => {
    if (!avisosAbiertos || !estadoAvisosCargado || idsNoLeidos.length === 0) return;
    const actualizados = mergeSeenHomeNotificationIds(avisosVistos, idsNoLeidos);
    if (actualizados.length === avisosVistos.length) return;
    setAvisosVistos(actualizados);
    void saveJSONNow(STORAGE_KEYS.homeNotificationSeen, actualizados);
  }, [avisosAbiertos, estadoAvisosCargado, idsNoLeidos, avisosVistos]);

  const [selectMode, setSelectMode] = useState(false);
  const [confirmandoBorrarTodo, setConfirmandoBorrarTodo] = useState(false);
  const [confirmandoSeleccionados, setConfirmandoSeleccionados] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const movimientosBorrablesDelMes = useMemo(() => monthTx.filter((m) => !m.internalTransfer), [monthTx]);
  const seleccionadosBorrables = useMemo(() => selected.filter((id) =>
    movimientosBorrablesDelMes.some((tx) => tx.id === id)
  ), [selected, movimientosBorrablesDelMes]);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const balanceColors = peachOlive ? balanceGradientForVisualStyle(visualStyle) : SALDO_VERDE;

  function shiftMonth(d: number) {
    let m = month.m + d;
    let y = month.y;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth({ y, m });
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected([]);
  }
  const toggleSelected = useCallback((id: number) => {
    if (transactions.find((item) => item.id === id)?.internalTransfer) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, [transactions]);

  /* Un Set en vez de un array: preguntar "¿está marcado este?" pasa de recorrer la lista
     entera a mirar una sola vez. Con dos marcados da igual; con el mes lleno, no. */
  const marcadas = useMemo(() => new Set(selected), [selected]);

  const alTocarFila = useCallback(
    (id: number, grouped: boolean) => {
      if (selectMode) toggleSelected(id);
      else if (grouped) irUnaVez({ pathname: "/(tabs)/history", params: { transfer: "1" } });
      else onOpenDetail(id);
    },
    [selectMode, onOpenDetail, toggleSelected]
  );

  const dibujarFila = useCallback(
    ({ item: row, index }: { item: ReturnType<typeof compactPersonalTransferRows<Transaction>>[number]; index: number }) => (
      <FilaMovimiento
        tx={row.item}
        index={index}
        marcada={marcadas.has(row.item.id)}
        selectMode={selectMode}
        oscuro={colorScheme === "dark"}
        fmt={fmt}
        t={t}
        monthNames={monthNames}
        onPress={alTocarFila}
        transferGroup={row.transferGroup}
      />
    ),
    [marcadas, selectMode, colorScheme, fmt, t, monthNames, alTocarFila]
  );
  function confirmBulkDelete() {
    onBulkDelete(seleccionadosBorrables);
    setSelected([]);
    setSelectMode(false);
    setConfirmandoSeleccionados(false);
  }

  /**
   * BORRAR TODO EL MES, desde el modo de selección (12/08/2026).
   *
   * Pedido suyo después de importar dos veces el mismo archivo y quedarse con dieciséis
   * movimientos: quitarlos de uno en uno era el único camino.
   *
   * VA CON UN CARTEL DE CONFIRMACIÓN Y NO SE PUEDE DESHACER, así que el cartel dice CUÁNTOS y
   * DE QUÉ MES. "¿Borrar todo?" a secas no da para decidir nada; "¿Borrar los 16 movimientos de
   * diciembre 2025?" sí — y sobre todo deja ver si uno está en el mes que cree.
   *
   * Solo borra los del mes que se está viendo, que es lo que hay en la lista de abajo. Borrar
   * meses que no se ven sería otra cosa y mucho más grave.
   */
  function borrarTodoElMes() {
    onBulkDelete(movimientosBorrablesDelMes.map((m) => m.id));
    setSelected([]);
    setSelectMode(false);
    setConfirmandoBorrarTodo(false);
  }

  return (
    <View className="flex-1 bg-white dark:bg-noche">
      {/* PARTE FIJA
          El mes, el presupuesto y el resumen se quedan quietos:
          antes formaban la cabecera de la lista y se iban hacia arriba al
          desplazar, así que para llegar a los movimientos había que pasarlos
          todos, y para volver a mirar el saldo había que subir otra vez.
          Ahora solo se desliza la lista, por debajo. */}
      <View style={{ paddingTop: insets.top + 6 }}>
        <View className="px-5 pt-2.5 pb-2 flex-row items-center justify-between">
          <View className="h-10 w-10" />

          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => shiftMonth(-1)}
              className="w-7 h-9 items-center justify-center"
            >
              <ChevronLeft size={18} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
            </TouchableOpacity>
            <MonthSelector month={month} months={availableMonths} monthNames={monthNames} onChange={setMonth} showMovementCount />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => shiftMonth(1)}
              className="w-7 h-9 items-center justify-center"
            >
              <ChevronRight size={18} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={numeroNoLeidos > 0
              ? t("home.openNotificationsCount", { count: numeroNoLeidos })
              : t("home.openNotifications")}
            onPress={alternarAvisos}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
          >
            <Animated.View style={rotacionCampanaEstilo}>
              <Bell size={19} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
            </Animated.View>
            {hayNotificaciones ? (
              <View className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 border-2 border-white dark:border-noche items-center justify-center">
                <Text className="text-[9px] leading-[11px] font-extrabold text-white">
                  {numeroNoLeidos > 9 ? "9+" : numeroNoLeidos}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <SpaceSwitcher active="personal" />

        <LinearGradient
          colors={[...balanceColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          // La esquina, el recorte y el contorno salen de SALDO_TARJETA, compartido
          // con la tarjeta del saldo del Panorama en Reportes. Y van por "style",
          // no por clases: Tailwind solo genera las clases que encuentra leyendo
          // app/, screens/ y components/, así que un "rounded-[32px]" escrito en
          // constants/ no existe y la esquina desaparece sin ningún error. Ya pasó.
          // Ver la nota en constants/style.
          className="mx-5 px-5 py-3.5"
          style={SALDO_TARJETA}
        >
          <View className="flex-row items-center justify-between">
            <Text className={`text-sm font-bold ${peachOlive ? "text-emerald-800" : "text-emerald-100"}`}>
              {editingBudget ? t("home.monthlyBudget") : t("home.availableBalance")}
            </Text>
            {!editingBudget && (
              <TouchableOpacity
                onPress={() => setHideBalance((v) => !v)}
                accessibilityRole="switch"
                accessibilityLabel={t(hideBalance ? "home.showAmounts" : "home.hideAmounts")}
                accessibilityState={{ checked: hideBalance }}
                hitSlop={8}
                className="h-7 w-7 items-center justify-center"
              >
                {hideBalance ? (
                  <EyeOff size={16} color={peachOlive ? "#526b43" : "#d1fae5"} />
                ) : (
                  <Eye size={16} color={peachOlive ? "#526b43" : "#d1fae5"} />
                )}
              </TouchableOpacity>
            )}
          </View>
          {editingBudget ? (
            <View className="mt-1 flex-row items-center gap-2">
              <TextInput
                disableFullscreenUI
                value={budgetInput}
                onChangeText={(v) => setBudgetInput(sanitizeAmountInput(v, userCurrency))}
                keyboardType="decimal-pad"
                autoFocus
                className={`flex-1 border-b border-white/40 py-0.5 text-2xl font-extrabold ${peachOlive ? "text-slate-900" : "text-white"}`}
              />
              <TouchableOpacity
                onPress={saveBudgetInline}
                className="h-[40px] w-[40px] items-center justify-center rounded-full bg-white/25"
              >
                <Check size={20} color={peachOlive ? "#526b43" : "#ffffff"} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditingBudget(false)}
                className="h-[40px] w-[40px] items-center justify-center rounded-full bg-white/15"
              >
                <X size={20} color={peachOlive ? "#526b43" : "#ffffff"} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="mt-0.5 flex-row items-center">
                <Text
                  className={`min-w-0 flex-1 text-3xl font-extrabold tracking-tight ${peachOlive ? "text-slate-900" : "text-white"}`}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.62}
                >
                  {hideBalance ? "• • • • • •" : fmt(available)}
                </Text>
              </View>
              <View className="mt-2">
                <View className="flex-row items-center justify-between gap-3">
                  <Text numberOfLines={1} className={`min-w-0 flex-1 text-base font-bold ${peachOlive ? "text-emerald-800" : "text-emerald-100"}`}>
                    {t("home.monthlyBudget")}
                  </Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className={`max-w-[48%] text-sm font-extrabold ${peachOlive ? "text-slate-900" : "text-white"}`}>
                    {formatBudgetDisplay(hideBalance, budget, fmt)}
                  </Text>
                </View>
                <View
                  className="mt-2 h-2 overflow-hidden rounded-full"
                  style={{ backgroundColor: peachOlive ? "rgba(101, 118, 74, 0.16)" : "rgba(255, 255, 255, 0.27)" }}
                >
                  {!hideBalance && <View style={{ width: `${visiblePct}%`, height: "100%", borderRadius: 999, backgroundColor: progressColor }} />}
                </View>
                <View className="mt-2 flex-row items-stretch gap-2">
                  <PressableScale
                    onPress={startEditBudget}
                    accessibilityRole="button"
                    accessibilityLabel={t("home.setMonthlyBudget")}
                    containerStyle={hasPreviousBalanceHistory
                      ? { flexGrow: 1, flexBasis: 0, minHeight: 68 }
                      : { width: "100%", minHeight: 48 }}
                    className={`w-full items-center justify-center rounded-xl border-[1.5px] border-indigo-200 bg-indigo-100 px-4 py-2 ${hasPreviousBalanceHistory ? "min-h-[68px]" : "min-h-[48px]"}`}
                  >
                    <Text className={`text-center font-bold text-indigo-900 ${hasPreviousBalanceHistory ? "text-[14px] leading-[17px]" : "text-[15px] leading-[19px]"}`}>
                      {t(hasPreviousBalanceHistory ? "home.defineBudgetCompact" : "home.setMonthlyBudget")}
                    </Text>
                  </PressableScale>
                  {hasPreviousBalanceHistory ? (
                    <PressableScale
                      onPress={togglePreviousBalance}
                      accessibilityRole="button"
                      accessibilityLabel={t(showPreviousBalanceCard ? "home.hidePreviousBalance" : "home.showPreviousBalance")}
                      containerStyle={{ flexGrow: 1, flexBasis: 0, minHeight: 68 }}
                      className="min-h-[68px] w-full flex-row items-center justify-center gap-2 rounded-xl border-[1.5px] px-3 py-2"
                      style={{ backgroundColor: previousActionBackground, borderColor: previousActionBorder }}
                    >
                      {showPreviousBalanceCard ? (
                        <EyeOff size={18} color={previousActionText} />
                      ) : (
                        <Eye size={18} color={previousActionText} />
                      )}
                      <Text className="min-w-0 flex-1 text-center text-[14px] font-bold leading-[17px]" style={{ color: previousActionText }}>
                        {t(showPreviousBalanceCard ? "home.hidePreviousBalanceCompact" : "home.showPreviousBalanceCompact")}
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              </View>
            </>
          )}
        </LinearGradient>

        {MOSTRAR_TARJETA_CREDITO && (
          <TouchableOpacity
            onPress={() => irUnaVez("/credit")}
            className="mx-5 mt-3 flex-row items-center justify-between rounded-2xl border-[1.5px] border-teal-200 bg-teal-50 dark:bg-noche-2 dark:border-teal-800 px-4 py-3"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-teal-600">
                <CreditCard size={19} color="#fff" />
              </View>
              <View>
                <Text className="font-extrabold text-teal-900 dark:text-teal-100">Tarjeta de crédito</Text>
                <Text className="text-[11px] text-teal-700 dark:text-teal-300">Cuotas, fechas y pagos</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#0f766e" />
          </TouchableOpacity>
        )}

        {/* ESTADO DE CUENTA QUE LLEGÓ Y NO SE LLEGÓ A ABRIR.
            Es la red de seguridad de "Compartir → Fino". Si por lo que sea
            la pantalla de importar no se abrió sola, el archivo NO se pierde
            en silencio: aparece aquí con su nombre y se abre de un toque.
            Antes, cuando algo fallaba, la app se quedaba en Inicio sin decir
            nada y no había forma de saber si el archivo había llegado. */}
        {archivoPendiente && (
          <TouchableOpacity
            onPress={() =>
              irUnaVez({
                pathname: "/import",
                params: { uri: archivoPendiente.uri, name: archivoPendiente.name },
              })
            }
            className="mx-5 mt-3 flex-row items-center gap-3 rounded-2xl border-[1.5px] border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3"
          >
            <FileUp size={19} color="#059669" />
            <View className="flex-1">
              <Text className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
                {t("home.incomingFileTitle")}
              </Text>
              <Text className="text-[11px] text-emerald-700 dark:text-emerald-300" numberOfLines={1}>
                {archivoPendiente.name}
              </Text>
            </View>
            <ChevronRight size={18} color="#059669" />
          </TouchableOpacity>
        )}

        <Animated.View layout={LinearTransition.duration(240)} className="px-5 mt-3 gap-2.5">
          {showPreviousBalanceCard ? <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(180)} style={{ width: "100%" }}>
            <PressableScale
              className="bg-teal-50 dark:bg-teal-950/30 rounded-2xl px-3 py-1.5 border-[1.5px] border-teal-300 dark:border-teal-800 justify-center"
              style={[softShadow, { minHeight: 58 }]}
            >
              <View className="flex-row items-center gap-2 mb-0">
                <Text className="text-base">🕒</Text>
                <Text className="flex-1 text-sm text-teal-800 dark:text-teal-200 font-bold" numberOfLines={2}>
                  {t("home.previousBalance")}
                </Text>
                {carryoverActive ? (
                  <TouchableOpacity
                    onPress={() => setConfirmRestoreCarryover(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("home.restoreCarryoverConfirm")}
                    hitSlop={6}
                    className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900 items-center justify-center border-[1.5px] border-emerald-400 dark:border-emerald-600"
                  >
                    <RotateCcw size={18} strokeWidth={2.5} color="#047857" />
                  </TouchableOpacity>
                ) : prevBalance !== 0 ? (
                  <TouchableOpacity
                    onPress={() => setConfirmResetCarryover(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("home.resetCarryoverConfirm")}
                    hitSlop={6}
                    className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 items-center justify-center border-[1.5px] border-rose-400 dark:border-rose-700"
                  >
                    <Eraser size={18} strokeWidth={2.5} color="#be123c" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text
                className={`text-lg font-extrabold ${prevBalance >= 0 ? "" : "text-rose-500"}`}
                style={prevBalance >= 0 ? { color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" } : undefined}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {fmt(prevBalance)}
              </Text>
            </PressableScale>
          </Animated.View> : null}
          {(mainSpent > 0 || mainIncome > 0) && (
            <View className="flex-row gap-2.5">
              {mainSpent > 0 ? <Animated.View entering={FadeInDown.delay(1 * 70).duration(300)} style={{ flex: 1, minWidth: 0 }}>
                <PressableScale
                  className="bg-rose-50 dark:bg-noche-2 rounded-2xl px-3 py-2 border-[1.5px] border-rose-100 dark:border-noche-borde justify-center"
                  style={[softShadow, { minHeight: 68 }]}
                >
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <ArrowDown size={18} color="#f43f5e" strokeWidth={2.6} />
                    <Text className="flex-1 text-base text-slate-600 dark:text-slate-200 font-semibold" numberOfLines={1}>
                      {t("home.spent")}
                    </Text>
                  </View>
                  <Text
                    className="text-lg font-extrabold text-rose-500"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {fmt(mainSpent)}
                  </Text>
                </PressableScale>
              </Animated.View> : null}
              {mainIncome > 0 ? <Animated.View entering={FadeInDown.delay(mainSpent > 0 ? 2 * 70 : 1 * 70).duration(300)} style={{ flex: 1, minWidth: 0 }}>
                <PressableScale
                  className="bg-emerald-50 dark:bg-noche-2 rounded-2xl px-3 py-2 border-[1.5px] border-emerald-100 dark:border-noche-borde justify-center"
                  style={[softShadow, { minHeight: 68 }]}
                >
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <ArrowUp size={18} color="#059669" strokeWidth={2.6} />
                    <Text className="flex-1 text-base text-slate-600 dark:text-slate-200 font-semibold" numberOfLines={1}>
                      {t("home.income")}
                    </Text>
                  </View>
                  <Text
                    className="text-lg font-extrabold text-emerald-600"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {fmt(mainIncome)}
                  </Text>
                </PressableScale>
              </Animated.View> : null}
            </View>
          )}
        </Animated.View>

        <View className="px-4 mt-3 mb-2 flex-row items-center justify-between gap-3">
          {selectMode ? (
            <>
              <Text
                className="font-extrabold text-base"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              >
                {t(selected.length > 1 ? "home.selectedCountPlural" : "home.selectedCount", {
                  count: selected.length,
                })}
              </Text>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => setConfirmandoSeleccionados(true)}
                  disabled={seleccionadosBorrables.length === 0}
                  className={`w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950 items-center justify-center ${
                    seleccionadosBorrables.length === 0 ? "opacity-40" : ""
                  }`}
                >
                  <Trash2 size={21} color="#f43f5e" />
                </TouchableOpacity>
                {/* BORRAR TODO. Se enseña solo si hay algo que borrar. */}
                {movimientosBorrablesDelMes.length > 0 && (
                  <TouchableOpacity onPress={() => setConfirmandoBorrarTodo(true)} hitSlop={6}>
                    <Text className="text-base font-bold text-rose-500">{t("home.deleteAll")}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={toggleSelectMode}>
                  <Text className="text-base font-bold text-emerald-600">{t("common.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <MovementAllButton label={t("home.recentTransactions")} activeFilter={recentFilter !== null} onPress={() => setRecentFilter(null)} />
              <View className="flex-row items-center gap-2"><TouchableOpacity accessibilityRole="button" accessibilityLabel={t("home.filterIncome")} accessibilityState={{ selected: recentFilter === "income" }} onPress={() => setRecentFilter("income")} className={`h-10 w-10 items-center justify-center rounded-xl ${recentFilter === "income" ? "bg-emerald-200" : "bg-emerald-50"}`}><ArrowUp size={19} color="#047857" strokeWidth={2.6} /></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={t("home.filterExpense")} accessibilityState={{ selected: recentFilter === "expense" }} onPress={() => setRecentFilter("expense")} className={`h-10 w-10 items-center justify-center rounded-xl ${recentFilter === "expense" ? "bg-rose-200" : "bg-rose-50"}`}><ArrowDown size={19} color="#be123c" strokeWidth={2.6} /></TouchableOpacity></View>
              {monthTx.length > 0 && (
                <TouchableOpacity onPress={toggleSelectMode} className="min-h-10 flex-row items-center gap-1.5">
                  <ListChecks size={18} color="#059669" />
                  <Text className="text-[15px] font-bold text-emerald-600">{t("common.select")}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      <FlatList
        data={visibleRecentRows}
        keyExtractor={(row) => row.key}
        // flex-1: ocupa todo lo que sobra bajo la parte fija. Sin esto, la
        // lista se estira solo hasta donde llegue su contenido y con pocos
        // movimientos deja un hueco raro.
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 112 }}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        renderItem={dibujarFila}
        extraData={marcadas}
        ListEmptyComponent={
          <View className="px-5">
            <View className="items-center py-10 bg-white dark:bg-noche-2 rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-noche-borde">
              <Text className="text-slate-500 dark:text-slate-300 text-sm">{t("home.noTransactions")}</Text>
            </View>
          </View>
        }
      />

      <ConfirmDialog
        visible={confirmResetCarryover}
        // Se nombra el mes en concreto ("¿Empezar de cero desde Agosto
        // 2026?") en vez de "este mes": el botón actúa sobre el mes que se
        // está viendo, y equivocarse de mes cambia el resultado por
        // completo, así que conviene que quede a la vista antes de
        // confirmar.
        title={t("home.resetCarryoverTitle", { month: monthLabel })}
        message={t("home.resetCarryoverMessage", { month: monthLabel })}
        confirmLabel={t("home.resetCarryoverConfirm")}
        cancelLabel={t("common.cancel")}
        danger={false}
        onCancel={() => setConfirmResetCarryover(false)}
        onConfirm={() => {
          setConfirmResetCarryover(false);
          resetCarryover();
        }}
      />

      <ConfirmDialog
        visible={confirmRestoreCarryover}
        title={t("home.restoreCarryoverTitle", { month: monthLabel })}
        message={t("home.restoreCarryoverMessage", { month: monthLabel })}
        confirmLabel={t("home.restoreCarryoverConfirm")}
        cancelLabel={t("common.cancel")}
        danger={false}
        onCancel={() => setConfirmRestoreCarryover(false)}
        onConfirm={() => {
          setConfirmRestoreCarryover(false);
          restoreCarryover();
        }}
      />

      {/* BORRAR TODO EL MES. Ver borrarTodoElMes: el cartel dice CUÁNTOS y DE QUÉ MES, porque
          esto no se puede deshacer y "¿borrar todo?" a secas no da para decidir nada. */}
      <ConfirmDialog
        visible={confirmandoBorrarTodo}
        title={t("home.deleteAllTitle", { count: movimientosBorrablesDelMes.length, month: monthLabel })}
        message={t("home.deleteAllMessage")}
        confirmLabel={t("home.deleteAllConfirm")}
        cancelLabel={t("common.cancel")}
        danger
        onCancel={() => setConfirmandoBorrarTodo(false)}
        onConfirm={borrarTodoElMes}
      />
      <ConfirmDialog
        visible={confirmandoSeleccionados}
        title={t("home.deleteSelectedTitle", { count: seleccionadosBorrables.length })}
        message={t("home.deleteSelectedMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onCancel={() => setConfirmandoSeleccionados(false)}
        onConfirm={confirmBulkDelete}
      />

      <Modal
        transparent
        animationType="slide"
        statusBarTranslucent
        visible={avisosAbiertos}
        onRequestClose={cerrarAvisos}
      >
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            className="absolute inset-0 bg-black/45"
            onPress={cerrarAvisos}
          />
          <View
            className="rounded-t-[28px] border-t border-slate-200 bg-white px-5 pt-3 dark:border-noche-borde dark:bg-noche-2"
            style={{ maxHeight: viewportHeight * 0.8, paddingBottom: Math.max(insets.bottom + 12, 24) }}
          >
            <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-slate-300 dark:bg-slate-600" />
            <View className="mb-3 flex-row items-center justify-between">
              {avisoCalendarioSeleccionado ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t("common.back")}
                  onPress={() => setAvisoCalendarioSeleccionado(null)}
                  className="h-10 flex-row items-center gap-1"
                >
                  <ChevronLeft size={20} color={colorScheme === "dark" ? "#cbd5e1" : "#475569"} />
                  <Text className="text-base font-extrabold text-slate-900 dark:text-white">{t("home.calendarNoticeDetails")}</Text>
                </TouchableOpacity>
              ) : (
                <Text className="text-lg font-extrabold text-slate-900 dark:text-white">{t("home.notifications")}</Text>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                onPress={cerrarAvisos}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-noche-3"
              >
                <X size={19} color={colorScheme === "dark" ? "#cbd5e1" : "#475569"} />
              </TouchableOpacity>
            </View>

            {avisoCalendarioSeleccionado ? (() => {
            const { pago, mes, estado } = avisoCalendarioSeleccionado;
            const fecha = fechaEnElMes(pago, mes);
            const fechaVisible = fechaCompletaParaAviso(fecha, userLanguage);
            const fechaKey = pago.tipo === "pago"
              ? "home.notificationExpenseDate"
              : pago.tipo === "ingreso"
                ? "home.notificationIncomeDate"
                : "home.notificationReminderDate";
            return (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
                <Text numberOfLines={2} className="text-base font-bold text-slate-900 dark:text-white">{pago.nombre}</Text>
                {pago.monto != null ? <Text className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{fmt(pago.monto)}</Text> : null}
                <Text className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {t(fechaKey, { fecha: fechaVisible })}
                </Text>
                <Text className={`mt-1 text-sm font-semibold ${estado === "pagado" ? "text-emerald-700 dark:text-emerald-300" : estado === "vencido" ? "text-rose-600 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {t(estado === "pagado" ? "home.notificationAlreadyDone" : estado === "vencido" ? "home.notificationOverdue" : "home.notificationPending")}
                </Text>
                <View className="mt-5 flex-row gap-3">
                  <TouchableOpacity accessibilityRole="button" onPress={editarAvisoCalendario} className="h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-noche-borde dark:bg-noche-3">
                    <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("common.edit")}</Text>
                  </TouchableOpacity>
                  {estado !== "pagado" ? <TouchableOpacity accessibilityRole="button" onPress={confirmarAvisoCalendario} className="h-12 flex-1 items-center justify-center rounded-xl bg-emerald-600">
                    <Text className="text-sm font-bold text-white">
                      {pago.tipo === "pago"
                        ? t("calendario.yaPague")
                        : pago.tipo === "ingreso"
                          ? t("home.notificationMarkReceived")
                          : t("home.notificationMarkReminderDone")}
                    </Text>
                  </TouchableOpacity> : null}
                </View>
              </ScrollView>
            );
          })() : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {avisosCalendario.map(({ pago, mes, estado }) => {
                const fecha = fechaEnElMes(pago, mes);
                const fechaVisible = fechaCompletaParaAviso(fecha, userLanguage);
                const fechaKey = pago.tipo === "pago"
                  ? "home.notificationExpenseDate"
                  : pago.tipo === "ingreso"
                    ? "home.notificationIncomeDate"
                    : "home.notificationReminderDate";
                const tonoVencido = estado === "vencido";
                return (
                  <TouchableOpacity
                    key={`${pago.id}:${mes}`}
                    accessibilityRole="button"
                    onPress={() => setAvisoCalendarioSeleccionado({ pago, mes, estado })}
                    className={`mb-2 flex-row items-center gap-3 rounded-xl p-3 ${tonoVencido ? "bg-rose-50 dark:bg-rose-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}
                  >
                    <CalendarDays size={19} color={tonoVencido ? "#e11d48" : "#d97706"} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-sm font-bold text-slate-900 dark:text-white">{pago.nombre}</Text>
                      <Text numberOfLines={2} className={`text-xs ${tonoVencido ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
                        {t(fechaKey, { fecha: fechaVisible })}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      {pago.monto != null ? <Text className="text-xs font-extrabold text-slate-800 dark:text-white">{fmt(pago.monto)}</Text> : null}
                      <Text className={`text-[10px] font-bold ${tonoVencido ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
                        {t(tonoVencido ? "home.notificationOverdue" : "home.notificationPending")}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={tonoVencido ? "#e11d48" : "#d97706"} />
                  </TouchableOpacity>
                );
              })}
              {archivoPendiente ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    cerrarAvisos();
                    irUnaVez({ pathname: "/import", params: { uri: archivoPendiente.uri, name: archivoPendiente.name } });
                  }}
                  className="mb-2 flex-row items-center gap-3 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30"
                >
                  <FileUp size={19} color="#2563eb" />
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold text-slate-900 dark:text-white">{t("home.pendingImport")}</Text>
                    <Text numberOfLines={1} className="text-xs text-blue-700 dark:text-blue-300">{archivoPendiente.name}</Text>
                  </View>
                  <ChevronRight size={17} color="#2563eb" />
                </TouchableOpacity>
              ) : null}
              {exportacionVisible ? (
                <View className={`mb-2 flex-row items-center gap-3 rounded-xl p-3 ${exportacionVisible.resultado === "hecho" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-rose-50 dark:bg-rose-950/30"}`}>
                  <FileUp size={19} color={exportacionVisible.resultado === "hecho" ? "#059669" : "#e11d48"} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm font-bold text-slate-900 dark:text-white">
                      {exportacionVisible.resultado === "hecho"
                        ? t("home.exportSaved")
                        : exportacionVisible.resultado === "sin-movimientos"
                          ? t("home.exportNoFile")
                          : t("home.exportFailed")}
                    </Text>
                    <Text numberOfLines={1} className="text-xs text-slate-600 dark:text-slate-300">
                      {new Date(exportacionVisible.cuando).toLocaleString()}
                      {exportacionVisible.archivo ? ` · ${exportacionVisible.archivo}` : ""}
                    </Text>
                    {exportacionVisible.resultado !== "hecho" ? (
                      <Text numberOfLines={2} className="text-xs text-rose-700 dark:text-rose-300">
                        {t(`schedExport.res.${exportacionVisible.resultado}`)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {!estadoNotificaciones.hasAnythingToShow && avisosCalendario.length === 0 ? (
                <Text className="py-5 text-center text-sm text-slate-500 dark:text-slate-400">{t("home.noPendingNotifications")}</Text>
              ) : null}
            </ScrollView>
          )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
