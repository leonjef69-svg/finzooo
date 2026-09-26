import { SpaceFilteredTotal, SpacePaymentMethod, SpaceFilterReset, SpaceTransferFilter, type MovementFilter } from "@/components/SpaceMovementControls";
import { methodLabel } from "@/constants/i18n";
import BackButton from "@/components/BackButton";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import SpaceActionBar from "@/components/SpaceActionBar";
import SpaceMovementFields, { validSpaceDate } from "@/components/SpaceMovementFields";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { bajarCajas, subirCajas } from "@/utils/cloudCajas";
import { compartirCajaExistente, crearInvitacionCaja } from "@/utils/cloudCajasCompartidas";
import {
  CAJAS_VACIAS,
  fusionarCajas,
  nuevoIdCaja,
  saldoCaja,
  type DatosCajas,
} from "@/utils/cajas";
import { parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { horaDe } from "@/utils/format";
import { allocatePersonalReturn, canSpendFromSpace, canUndoContribution, compactLinkedTransferRows, isLinkedSpaceReturn, isLinkedSpaceTransfer, linkedTransferLedger, minimumContributionAmount, returnableToPersonal } from "@/utils/linkedTransfers";
import { nextId } from "@/utils/id";
import { irUnaVez, safeBack } from "@/utils/nav";
import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";
import { ArrowDown, ArrowLeftRight, ArrowRightLeft, ArrowUp, Boxes, Check, ListChecks, MoreVertical, Plus, Trash2, UserPlus, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

// Cambiar de Personal a Familia y volver a Cajas desmonta estas pantallas.
// Conservamos la última copia ya pintada para no reconstruir una pantalla
// vacía en cada cambio. La nube sigue actualizándola en segundo plano.
let cajasEnMemoria: DatosCajas | null = null;

function fechaLocal(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export default function Cajas() {
  const { t, fmt, showToast, disponible, transactions, addOrUpdateTransaction, deleteLinkedTransferTransaction, repairLinkedTransferTransactions, isPremium, userName, userCurrency } = useAppData();
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState<DatosCajas>(() => cajasEnMemoria ?? CAJAS_VACIAS);
  const [lista, setLista] = useState(true);
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [montoInicial, setMontoInicial] = useState("");
  const [origenDinero, setOrigenDinero] = useState<"externo" | "personal">("externo");
  const [creando, setCreando] = useState(false);
  const [anotando, setAnotando] = useState<"ingreso" | "gasto" | null>(null);
  const [monto, setMonto] = useState("");
  const [method, setMethod] = useState("cash");
  const [filter, setFilter] = useState<MovementFilter>(null);
  const [movementLimit, setMovementLimit] = useState(60);
  const [descripcion, setDescripcion] = useState("");
  const [category, setCategory] = useState("otros");
  const [movementDate, setMovementDate] = useState(fechaLocal());
  const [notes, setNotes] = useState("");
  const [editandoAporteId, setEditandoAporteId] = useState<string | null>(null);
  const [ready, setReady] = useState(cajasEnMemoria !== null);
  const [cloudReady, setCloudReady] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [seleccionandoCajas, setSeleccionandoCajas] = useState(false);
  const [cajasSeleccionadas, setCajasSeleccionadas] = useState<string[]>([]);
  const accionLocalEnCurso = useRef(false);

  function tomarAccionLocal(): boolean {
    if (accionLocalEnCurso.current) return false;
    accionLocalEnCurso.current = true;
    setTimeout(() => { accionLocalEnCurso.current = false; }, 700);
    return true;
  }

  useFocusEffect(useCallback(() => {
    let alive = true;
    setCloudReady(false);
    void (async () => {
      const local = await loadJSON<DatosCajas>(STORAGE_KEYS.cajasDinero, CAJAS_VACIAS);
      if (!alive) return;
      const visible = cajasEnMemoria ? fusionarCajas(local, cajasEnMemoria) : local;
      cajasEnMemoria = visible;
      setDatos(visible);
      setReady(true);

      const uid = auth.currentUser?.uid;
      const remoto = uid ? await bajarCajas(uid).catch(() => null) : null;
      if (!alive) return;
      setDatos(actual => {
        // Si la persona anotó algo mientras llegaba la nube, se fusiona con
        // el estado ACTUAL. Usar `visible` aquí podría borrar ese toque rápido.
        const unidos = remoto ? fusionarCajas(actual, remoto) : actual;
        cajasEnMemoria = unidos;
        void saveJSON(STORAGE_KEYS.cajasDinero, unidos);
        return unidos;
      });
      setCloudReady(true);
    })();
    return () => { alive = false; };
  }, []));

  useEffect(() => {
    cajasEnMemoria = datos;
    if (!ready || !cloudReady) return;
    void saveJSON(STORAGE_KEYS.cajasDinero, datos);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const timer = setTimeout(() => { void subirCajas(uid, datos); }, 700);
    return () => clearTimeout(timer);
  }, [datos, ready, cloudReady]);

  const caja = datos.cajas.find((item) => item.id === cajaId);
  useEffect(() => setMovementLimit(60), [cajaId, filter]);
  const movimientos = useMemo(
    () => datos.movimientos.filter((item) => item.cajaId === cajaId).sort((a, b) => b.creadoEn - a.creadoEn),
    [cajaId, datos.movimientos],
  );
  const transferLedger = useMemo(() => linkedTransferLedger(movimientos), [movimientos]);
  const transferCount = useMemo(() => movimientos.filter(isLinkedSpaceTransfer).length, [movimientos]);
  const resumen = useMemo(() => movimientos.reduce(
    (total, item) => ({
      ingresos: total.ingresos + (!isLinkedSpaceTransfer(item) && item.tipo === "ingreso" ? item.monto : 0),
      gastos: total.gastos + (!isLinkedSpaceTransfer(item) && item.tipo === "gasto" ? item.monto : 0),
    }),
    { ingresos: 0, gastos: 0 },
  ), [movimientos]);
  const saldoActual = caja ? saldoCaja(caja.id, datos.movimientos) : 0;
  const devolvibleAPersonal = returnableToPersonal(movimientos);

  // Repara automáticamente cualquiera de las dos mitades que haya quedado
  // huérfana por un cierre entre ambos guardados.
  useEffect(() => {
    if (!ready) return;
    const movimientosPorId = new Map(datos.movimientos.map(item => [item.id, item]));
    const upserts = datos.movimientos.flatMap(item => {
      if (item.personalTransactionId == null) return [];
      const cajaDelMovimiento = datos.cajas.find(c => c.id === item.cajaId);
      const esRetorno = item.tipo === "gasto" && (item.personalReturnAmount || 0) > 0;
      const itemsCaja = datos.movimientos.filter(movement => movement.cajaId === item.cajaId);
      const allocations = esRetorno ? linkedTransferLedger(itemsCaja).allocationsByReturnId.get(item.id) || [] : undefined;
      const canonical = {
        id: item.personalTransactionId,
        type: esRetorno ? "income" as const : "expense" as const,
        amount: esRetorno ? item.personalReturnAmount! : item.monto,
        category: "otros", date: item.fecha, time: horaDe(item.creadoEn), method: "transfer",
        description: esRetorno ? t("boxes.returnFrom", { name: cajaDelMovimiento?.nombre || "" }) : t("boxes.transferTo", { name: cajaDelMovimiento?.nombre || "" }),
        notes: "", origin: "manual" as const, internalTransfer: "box" as const, internalTransferLink: item.id,
        internalTransferSpaceId: item.cajaId, internalTransferSpaceName: cajaDelMovimiento?.nombre || "Caja",
        ...(allocations ? { internalTransferAllocations: allocations } : {}),
      };
      const current = transactions.find(tx => tx.id === item.personalTransactionId);
      if (current?.internalTransfer === "box" && current.internalTransferLink === item.id
        && current.type === canonical.type && current.amount === canonical.amount
        && current.internalTransferSpaceId === item.cajaId
        && current.internalTransferSpaceName === canonical.internalTransferSpaceName
        && JSON.stringify(current.internalTransferAllocations || []) === JSON.stringify(allocations || [])) return [];
      return [canonical];
    });
    const orphanIds = transactions
      .filter(tx => tx.internalTransfer === "box"
        && tx.internalTransferLink?.startsWith("mov-")
        && (!tx.internalTransferSpaceId || tx.internalTransferSpaceId.startsWith("caja-"))
        && !movimientosPorId.has(tx.internalTransferLink))
      .map(tx => tx.id);
    if (upserts.length || orphanIds.length) repairLinkedTransferTransactions(upserts, orphanIds);
  }, [datos.cajas, datos.movimientos, ready, repairLinkedTransferTransactions, t, transactions]);

  const visibles = movimientos.filter(item => !filter
    || (filter === "transferencia" ? isLinkedSpaceTransfer(item) : !isLinkedSpaceTransfer(item) && item.tipo === filter));
  const filasVisibles = filter
    ? visibles.map(item => ({ key: `movement:${item.id}`, item, transferGroup: undefined }))
    : compactLinkedTransferRows(visibles);
  function sacarDePersonal(valor: number, destino: string, spaceId: string, link: string, date = fechaLocal()): number {
    const id = nextId();
    addOrUpdateTransaction({
      id, type: "expense", amount: valor, category: "otros", date,
      time: horaDe(Date.now()), method: "transfer", description: t("boxes.transferTo", { name: destino }),
      notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: link,
      internalTransferSpaceId: spaceId, internalTransferSpaceName: destino,
    });
    return id;
  }

  function crearCaja() {
    const nombre = nuevoNombre.trim().slice(0, 30);
    if (!nombre) return;
    const nueva = { id: nuevoIdCaja("caja"), nombre, creadaEn: Date.now() };
    const inicial = parseAmountInput(montoInicial);
    if (origenDinero === "personal" && inicial > disponible) {
      showToast(t("boxes.notEnoughPersonal"));
      return;
    }
    if (!tomarAccionLocal()) return;
    const movimientoId = nuevoIdCaja("mov");
    const personalTransactionId = inicial > 0 && origenDinero === "personal"
      ? sacarDePersonal(inicial, nombre, nueva.id, movimientoId)
      : undefined;
    setDatos((antes) => ({
      ...antes,
      cajas: [...antes.cajas, nueva],
      movimientos: inicial > 0 ? [...antes.movimientos, {
        id: movimientoId, cajaId: nueva.id, tipo: "ingreso", monto: inicial,
        descripcion: t(origenDinero === "personal" ? "boxes.initialFromPersonal" : "boxes.initialExternal"),
        method: origenDinero === "personal" ? "transfer" : "cash", fecha: fechaLocal(), creadoEn: Date.now(), personalTransactionId,
      }] : antes.movimientos,
    }));
    setNuevoNombre("");
    setMontoInicial("");
    setOrigenDinero("externo");
    setCreando(false);
    setCajaId(nueva.id);
    setLista(false);
    showToast(t("boxes.saved"));
  }

  function guardarMovimiento() {
    if (!caja || !anotando) return;
    const valor = parseAmountInput(monto);
    if (!(valor > 0)) return;
    if (!validSpaceDate(movementDate)) { showToast("Escribe una fecha válida: AAAA-MM-DD"); return; }
    const aporteEditado = editandoAporteId ? movimientos.find(item => item.id === editandoAporteId) : undefined;
    if (aporteEditado?.personalTransactionId != null) {
      const minimo = minimumContributionAmount(movimientos, aporteEditado);
      if (valor < minimo - 0.005) { showToast(t("boxes.contributionUsed")); return; }
      if (valor - aporteEditado.monto > disponible) { showToast(t("boxes.notEnoughPersonal")); return; }
      if (!tomarAccionLocal()) return;
      const personal = transactions.find(tx => tx.id === aporteEditado.personalTransactionId);
      setDatos(antes => ({ ...antes, movimientos: antes.movimientos.map(item => item.id === aporteEditado.id ? { ...item, monto: valor, descripcion: descripcion.trim().slice(0, 60) || item.descripcion } : item) }));
      if (personal) addOrUpdateTransaction({ ...personal, amount: valor });
      setMonto(""); setDescripcion(""); setEditandoAporteId(null); setAnotando(null);
      showToast(t("boxes.movementSaved"));
      return;
    }
    if (anotando === "ingreso" && origenDinero === "personal" && valor > disponible) {
      showToast(t("boxes.notEnoughPersonal"));
      return;
    }
    if (anotando === "gasto" && !canSpendFromSpace(movimientos, valor)) {
      showToast(t("boxes.notEnoughSpace"));
      return;
    }
    if (!tomarAccionLocal()) return;
    const movimientoId = nuevoIdCaja("mov");
    const personalTransactionId = anotando === "ingreso" && origenDinero === "personal"
      ? sacarDePersonal(valor, caja.nombre, caja.id, movimientoId, movementDate)
      : undefined;
    const movimiento = {
      id: movimientoId,
      cajaId: caja.id,
      tipo: anotando,
      method: anotando === "ingreso" && origenDinero === "personal" ? "transfer" : method,
      monto: valor,
      descripcion: descripcion.trim().slice(0, 60) || (anotando === "ingreso" ? t(origenDinero === "personal" ? "boxes.fromPersonal" : "boxes.externalMoney") : ""),
      ...(personalTransactionId == null ? { category } : {}),
      notes: notes.trim(),
      fecha: movementDate,
      creadoEn: Date.now(),
      personalTransactionId,
    };
    setDatos((antes) => ({ ...antes, movimientos: [...antes.movimientos, movimiento] }));
    setMonto("");
    setDescripcion("");
    setNotes("");
    setMovementDate(fechaLocal());
    setOrigenDinero("externo");
    setEditandoAporteId(null);
    setAnotando(null);
    showToast(t("boxes.movementSaved"));
  }

  function borrarMovimiento(id: string) {
    const movimiento = datos.movimientos.find((item) => item.id === id);
    if (movimiento?.tipo === "ingreso" && movimiento.personalTransactionId != null && !canUndoContribution(movimientos, movimiento)) {
      showToast(t("boxes.contributionUsed"));
      return;
    }
    if (movimiento?.personalTransactionId != null) deleteLinkedTransferTransaction(movimiento.personalTransactionId);
    setDatos((antes) => ({
      ...antes,
      movimientos: antes.movimientos.filter((item) => item.id !== id),
      movimientosBorrados: [...new Set([...antes.movimientosBorrados, id])],
    }));
  }
  function borrarSeleccionados(ids = seleccionados) {
    const items = movimientos.filter(item => ids.includes(item.id));
    if (items.some(item => item.tipo === "ingreso" && item.personalTransactionId != null && !canUndoContribution(movimientos, item))) { showToast(t("boxes.contributionUsed")); return; }
    for (const item of items) borrarMovimiento(item.id);
    setSeleccionados([]); setSeleccionando(false);
  }
  function confirmarBorrarTodo() {
    if (!visibles.length) return;
    Alert.alert("Borrar todos los movimientos", `Se eliminarán los ${visibles.length} movimientos que se muestran. Esta acción no se puede deshacer.`, [
      { text: t("common.cancel"), style: "cancel" },
      { text: "Borrar todo", style: "destructive", onPress: () => borrarSeleccionados(visibles.map(item => item.id)) },
    ]);
  }
  function borrarCajas(ids = cajasSeleccionadas) {
    const candidatas = datos.cajas.filter(item => ids.includes(item.id));
    if (!candidatas.length) return;
    if (candidatas.some(item => Math.abs(saldoCaja(item.id, datos.movimientos)) > 0.000001)) {
      showToast("Primero deja en cero el saldo de cada caja seleccionada.");
      return;
    }
    const idsMovimientos = datos.movimientos.filter(item => ids.includes(item.cajaId)).map(item => item.id);
    setDatos(antes => ({
      ...antes,
      cajas: antes.cajas.filter(item => !ids.includes(item.id)),
      movimientos: antes.movimientos.filter(item => !ids.includes(item.cajaId)),
      cajasBorradas: [...new Set([...antes.cajasBorradas, ...ids])],
      movimientosBorrados: [...new Set([...antes.movimientosBorrados, ...idsMovimientos])],
    }));
    setCajasSeleccionadas([]); setSeleccionandoCajas(false);
  }
  function confirmarBorrarTodasLasCajas() {
    if (!datos.cajas.length) return;
    Alert.alert("Borrar todas las cajas", `Se eliminarán las ${datos.cajas.length} cajas. Solo se pueden borrar cajas con saldo S/ 0.00.`, [
      { text: t("common.cancel"), style: "cancel" },
      { text: "Borrar todo", style: "destructive", onPress: () => borrarCajas(datos.cajas.map(item => item.id)) },
    ]);
  }

  function devolverAPersonal() {
    if (!caja || devolvibleAPersonal <= 0) return;
    if (!tomarAccionLocal()) return;
    const movimientoId = nuevoIdCaja("mov");
    const personalId = nextId();
    const allocations = allocatePersonalReturn(movimientos, devolvibleAPersonal);
    setDatos(antes => ({ ...antes, movimientos: [...antes.movimientos, { id: movimientoId, cajaId: caja.id, tipo: "gasto", monto: devolvibleAPersonal, descripcion: t("boxes.returnToPersonal"), method: "transfer", fecha: fechaLocal(), creadoEn: Date.now(), personalTransactionId: personalId, personalReturnAmount: devolvibleAPersonal }] }));
    addOrUpdateTransaction({ id: personalId, type: "income", amount: devolvibleAPersonal, category: "otros", date: fechaLocal(), time: horaDe(Date.now()), method: "transfer", description: t("boxes.returnFrom", { name: caja.nombre }), notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: movimientoId, internalTransferSpaceId: caja.id, internalTransferSpaceName: caja.nombre, internalTransferAllocations: allocations });
  }

  async function compartirCaja() {
    const uid = auth.currentUser?.uid;
    if (!uid || !caja || compartiendo) return;
    if (!isPremium) { irUnaVez("/premium"); return; }
    setCompartiendo(true);
    try {
      const compartida = await compartirCajaExistente(uid, userName || t("family.member"), caja, movimientos, userCurrency);
      const codigo = await crearInvitacionCaja(uid, compartida.id);
      const idsPersonales = new Set(movimientos.flatMap(item => item.personalTransactionId == null ? [] : [item.personalTransactionId]));
      const enlacesMigrados = transactions
        .filter(item => idsPersonales.has(item.id) && item.internalTransfer === "box")
        .map(item => ({
          ...item,
          internalTransferSpaceId: compartida.id,
          internalTransferSpaceName: compartida.nombre,
        }));
      if (enlacesMigrados.length) repairLinkedTransferTransactions(enlacesMigrados);
      // Solo después de terminar toda la copia se retira la versión privada.
      // Los débitos enlazados de Personal se conservan porque ahora apuntan a
      // los mismos movimientos dentro de la caja compartida.
      const ids = movimientos.map(item => item.id);
      setDatos(antes => ({
        ...antes,
        cajas: antes.cajas.filter(item => item.id !== caja.id),
        movimientos: antes.movimientos.filter(item => item.cajaId !== caja.id),
        cajasBorradas: [...new Set([...antes.cajasBorradas, caja.id])],
        movimientosBorrados: [...new Set([...antes.movimientosBorrados, ...ids])],
      }));
      setCajaId(null); setLista(true);
      // La caja se vuelve compartida antes de crear el código. Se abre con el
      // código ya visible, en vez de lanzar el cuadro antiguo de "Compartir".
      irUnaVez({ pathname: "/shared-boxes", params: { boxId: compartida.id, invitation: codigo } });
    } catch { showToast(t("family.connectionError")); }
    finally { setCompartiendo(false); }
  }

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pb-3">
        <BackButton onPress={safeBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("boxes.title")}</Text>
        <View className="w-10" />
      </View>
      <SpaceSwitcher active="boxes" />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        scrollEventThrottle={160}
        onScroll={({ nativeEvent }) => {
          const cercaDelFinal = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 240;
          if (cercaDelFinal && movementLimit < filasVisibles.length) setMovementLimit(limit => Math.min(limit + 60, filasVisibles.length));
        }}
      >
        {!ready ? <Text className="py-8 text-center text-slate-500">{t("common.loading")}</Text> : lista || !caja ? (
          <>
            <Text className="mb-3 mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">{t("boxes.subtitle")}</Text>
            <View className="mb-3 flex-row gap-3">
              <TouchableOpacity onPress={() => setCreando(true)} className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600"><Plus size={18} color="#fff" /><Text className="font-bold text-white">Crear</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => irUnaVez("/shared-boxes?join=1")} className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"><UserPlus size={18} color="#0d9488" /><Text className="font-bold text-teal-700 dark:text-teal-300">Unirme</Text></TouchableOpacity>
            </View>
            {datos.cajas.length > 0 ? <View className="mb-2 flex-row items-center justify-between">
              {seleccionandoCajas ? <>
                <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{cajasSeleccionadas.length} {cajasSeleccionadas.length === 1 ? "seleccionada" : "seleccionadas"}</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity accessibilityLabel="Eliminar cajas seleccionadas" disabled={!cajasSeleccionadas.length} onPress={() => borrarCajas()} className={`h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950 ${!cajasSeleccionadas.length ? "opacity-40" : ""}`}><Trash2 size={19} color="#f43f5e" /></TouchableOpacity>
                  <TouchableOpacity onPress={confirmarBorrarTodasLasCajas} hitSlop={6}><Text className="text-sm font-bold text-rose-500">Borrar todo</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => { setSeleccionandoCajas(false); setCajasSeleccionadas([]); }} hitSlop={6}><Text className="text-sm font-bold text-emerald-600">{t("common.cancel")}</Text></TouchableOpacity>
                </View>
              </> : <>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">Mis cajas</Text>
                <TouchableOpacity onPress={() => { setSeleccionandoCajas(true); setCajasSeleccionadas([]); }} className="flex-row items-center gap-1"><ListChecks size={16} color="#059669" /><Text className="text-sm font-bold text-emerald-600">Seleccionar</Text></TouchableOpacity>
              </>}
            </View> : null}
            {datos.cajas.map((item) => (
              <TouchableOpacity
                key={item.id}
                disabled={!seleccionandoCajas && creando}
                onPress={() => seleccionandoCajas ? setCajasSeleccionadas(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]) : (setCajaId(item.id), setLista(false))}
                className={`mb-3 min-h-[86px] flex-row items-center rounded-2xl border-[1.5px] bg-white p-4 dark:bg-noche-2 ${cajasSeleccionadas.includes(item.id) ? "border-teal-500 bg-teal-50 dark:border-teal-500 dark:bg-teal-950" : "border-slate-200 dark:border-noche-borde"}`}
              >
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950"><Boxes size={20} color="#0d9488" /></View>
                <View className="ml-3 flex-1">
                  <Text className="font-extrabold text-slate-900 dark:text-slate-100">{item.nombre}</Text>
                  <Text className="mt-0.5 text-xs font-bold text-teal-700 dark:text-teal-300">{fmt(saldoCaja(item.id, datos.movimientos))}</Text>
                </View>
                {seleccionandoCajas ? <View className={`ml-2 h-5 w-5 rounded-full border-2 ${cajasSeleccionadas.includes(item.id) ? "border-teal-600 bg-teal-600" : "border-slate-400"}`} /> : <ArrowLeftRight size={17} color="#64748b" />}
              </TouchableOpacity>
            ))}
            {datos.cajas.length === 0 && !creando ? (
              <View className="items-center rounded-2xl border-[1.5px] border-dashed border-slate-300 px-5 py-7 dark:border-noche-borde">
                <Boxes size={28} color="#94a3b8" />
                <Text className="mt-3 text-center text-sm font-bold text-slate-700 dark:text-slate-200">{t("boxes.empty")}</Text>
              </View>
            ) : null}
            {creando ? (
              <View className="mt-2 gap-2">
                <View className="flex-row items-center gap-2">
                <TextInput disableFullscreenUI value={nuevoNombre} onChangeText={setNuevoNombre} maxLength={30} autoFocus placeholder={t("boxes.namePlaceholder")} placeholderTextColor="#94a3b8" className="h-12 flex-1 rounded-xl border-[1.5px] border-teal-400 px-4 text-slate-900 dark:text-slate-100" />
                <TouchableOpacity onPress={crearCaja} className="h-12 w-12 items-center justify-center rounded-xl bg-emerald-600"><Check size={20} color="#fff" /></TouchableOpacity>
                <TouchableOpacity onPress={() => setCreando(false)} className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><X size={20} color="#64748b" /></TouchableOpacity>
                </View>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("boxes.initialAmount")}</Text>
                <TextInput disableFullscreenUI value={montoInicial} onChangeText={value => setMontoInicial(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border border-teal-400 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" />
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("boxes.moneyOrigin")}</Text>
                <View className="flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenDinero(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenDinero === origin ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "boxes.fromPersonal" : "boxes.externalMoney")}</Text></TouchableOpacity>)}</View>
                {origenDinero === "personal" ? <Text className="text-[11px] text-slate-500">{t("boxes.personalAvailable", { amount: fmt(disponible) })}</Text> : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setLista(true)} className="mb-2 mt-1 flex-row items-center gap-2 py-2"><ArrowLeftRight size={16} color="#0d9488" /><Text className="text-xs font-bold text-teal-700 dark:text-teal-300">{t("boxes.all")}</Text></TouchableOpacity>
            <View className="rounded-3xl bg-teal-600 px-4 py-3">
              <View className="flex-row items-center"><Text className="flex-1 text-base font-bold text-teal-100">{caja.nombre}</Text><TouchableOpacity accessibilityLabel="Opciones de caja" onPress={() => irUnaVez({ pathname: "/box-settings", params: { boxId: caja.id } })} className="h-10 w-10 items-center justify-center rounded-xl bg-teal-700"><MoreVertical size={20} color="#fff" /></TouchableOpacity></View>
              <Text className="text-[26px] font-extrabold leading-8 text-white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{fmt(saldoActual)}</Text>
            </View>
            {devolvibleAPersonal > 0 ? <TouchableOpacity onPress={devolverAPersonal} className="mt-2 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{t("boxes.returnAmount", { amount: fmt(devolvibleAPersonal) })}</Text></TouchableOpacity> : null}
            <Modal visible={Boolean(anotando)} animationType="slide" onRequestClose={() => setAnotando(null)}>
              <ScrollView className="flex-1 bg-white px-5 dark:bg-noche" contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
              <View className="rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde">
                <View className="mb-3 flex-row gap-2"><TouchableOpacity accessibilityLabel="Ingreso" onPress={() => { setAnotando("ingreso"); setCategory("salario"); }} className={`h-11 flex-1 items-center justify-center rounded-xl ${anotando === "ingreso" ? "bg-emerald-600" : "bg-emerald-50"}`}><ArrowUp size={21} color={anotando === "ingreso" ? "#fff" : "#047857"} /></TouchableOpacity><TouchableOpacity accessibilityLabel="Gasto" onPress={() => { setAnotando("gasto"); setCategory("otros"); }} className={`h-11 flex-1 items-center justify-center rounded-xl ${anotando === "gasto" ? "bg-rose-600" : "bg-rose-50"}`}><ArrowDown size={21} color={anotando === "gasto" ? "#fff" : "#be123c"} /></TouchableOpacity></View>
                <TextInput disableFullscreenUI value={monto} onChangeText={(value) => setMonto(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" />
                <TextInput disableFullscreenUI value={descripcion} onChangeText={setDescripcion} maxLength={60} placeholder={t("boxes.description")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-slate-900 dark:text-slate-100" />
                <SpaceMovementFields type={anotando} category={category} onCategory={setCategory} date={movementDate} onDate={setMovementDate} notes={notes} onNotes={setNotes} />
                {anotando === "ingreso" ? <><Text className="mb-1 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("boxes.moneyOrigin")}</Text><View className="flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenDinero(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenDinero === origin ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "boxes.fromPersonal" : "boxes.externalMoney")}</Text></TouchableOpacity>)}</View>{origenDinero === "personal" ? <Text className="mt-1 text-[11px] text-slate-500">{t("boxes.personalAvailable", { amount: fmt(disponible) })}</Text> : null}</> : null}
                {anotando !== "ingreso" || origenDinero === "externo" ? <SpacePaymentMethod value={method} onChange={setMethod} /> : null}
                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity onPress={() => { setAnotando(null); setEditandoAporteId(null); }} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={guardarMovimiento} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Text className="font-bold text-white">{t("common.save")}</Text></TouchableOpacity>
                </View>
              </View>
              </ScrollView>
            </Modal>
            <View className="mb-2 mt-5 flex-row items-center justify-between">
              {seleccionando ? <>
                <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{seleccionados.length} {seleccionados.length === 1 ? "seleccionado" : "seleccionados"}</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity accessibilityLabel="Eliminar seleccionados" disabled={!seleccionados.length} onPress={() => borrarSeleccionados()} className={`h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950 ${!seleccionados.length ? "opacity-40" : ""}`}><Trash2 size={19} color="#f43f5e" /></TouchableOpacity>
                  <TouchableOpacity onPress={confirmarBorrarTodo} hitSlop={6}><Text className="text-sm font-bold text-rose-500">Borrar todo</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => { setSeleccionando(false); setSeleccionados([]); }} hitSlop={6}><Text className="text-sm font-bold text-emerald-600">{t("common.cancel")}</Text></TouchableOpacity>
                </View>
              </> : <>
                <Text className="font-extrabold text-slate-900 dark:text-slate-100">{t("boxes.history")}</Text>
                <View className="flex-row items-center gap-2"><TouchableOpacity accessibilityLabel="Invitar a esta caja" disabled={compartiendo} onPress={() => void compartirCaja()} className="h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><UserPlus size={18} color="#0d9488" /></TouchableOpacity><TouchableOpacity onPress={() => { setSeleccionando(true); setSeleccionados([]); }} className="flex-row items-center gap-1"><ListChecks size={16} color="#059669" /><Text className="text-sm font-bold text-emerald-600">Seleccionar</Text></TouchableOpacity></View>
              </>}
            </View>
            <SpaceFilterReset filter={filter} onReset={() => setFilter(null)} />
            {filter === "ingreso" || filter === "gasto" ? <SpaceFilteredTotal filter={filter} amount={filter === "ingreso" ? resumen.ingresos : resumen.gastos} format={fmt} /> : null}
            <SpaceTransferFilter count={transferCount} filter={filter} onFilter={setFilter} />
            {filasVisibles.length === 0 ? <Text className="py-5 text-center text-sm text-slate-500">{t(filter ? "spaces.noResults" : "boxes.noMovements")}</Text> : filasVisibles.slice(0, movementLimit).map(({ key, item, transferGroup }) => {
              const transferencia = isLinkedSpaceTransfer(item);
              const retorno = isLinkedSpaceReturn(item);
              const estado = transferGroup?.status || (retorno ? "returned" : item.personalTransactionId != null
                ? transferLedger.progressByTransactionId.get(item.personalTransactionId)?.status || "pending"
                : "pending");
              return (
              <TouchableOpacity key={key} disabled={transferGroup ? seleccionando : !seleccionando} onPress={() => transferGroup ? setFilter("transferencia") : setSeleccionados(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])} className={`mb-2 flex-row items-center rounded-2xl border-[1.5px] p-3 dark:border-noche-borde ${seleccionados.includes(item.id) ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200"}`}>
                <View className={`h-9 w-9 items-center justify-center rounded-xl ${transferencia ? "bg-blue-100 dark:bg-blue-950" : item.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"}`}>{transferencia ? <ArrowRightLeft size={17} color="#2563eb" /> : item.tipo === "ingreso" ? <ArrowUp size={17} color="#047857" /> : <ArrowDown size={17} color="#be123c" />}</View>
                <View className="ml-3 flex-1"><Text className="text-[15px] font-bold text-slate-800 dark:text-slate-100" numberOfLines={1}>{transferencia ? `Personal (${caja.nombre})` : item.descripcion || (item.tipo === "ingreso" ? t("boxes.income") : t("boxes.expense"))}</Text><Text className={`text-xs ${transferencia ? "font-semibold text-blue-600 dark:text-blue-300" : "text-slate-500"}`}>{transferGroup ? `Enviado ${fmt(transferGroup.sent)} · Devuelto ${fmt(transferGroup.returned)} · ${t(`transfer.${estado}`)}` : transferencia ? `Transferencia de ${retorno ? caja.nombre : "Personal"} a ${retorno ? "Personal" : caja.nombre} · ${retorno ? "Devuelto" : "Enviado"} · ${item.fecha}` : `${item.fecha}${item.method ? ` · ${methodLabel(item.method, t)}` : ""}`}</Text></View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className={`mr-2 max-w-[38%] text-[15px] font-extrabold ${transferencia ? "text-blue-600 dark:text-blue-300" : item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>{transferGroup ? "↔ " : transferencia ? (retorno ? "↩ " : "→ ") : item.tipo === "ingreso" ? "+" : "-"}{fmt(transferGroup?.pending ?? item.monto)}</Text>
                {seleccionando && !transferGroup ? <View className={`ml-2 h-5 w-5 rounded-full border-2 ${seleccionados.includes(item.id) ? "border-teal-600 bg-teal-600" : "border-slate-400"}`} /> : null}
              </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
      {!lista && caja ? <SpaceActionBar filter={filter} onFilter={setFilter} onAdd={() => { setOrigenDinero("externo"); setCategory("otros"); setMovementDate(fechaLocal()); setAnotando("gasto"); }} /> : null}
    </View>
  );
}
