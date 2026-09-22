import { SpaceTotals, SpacePaymentMethod, SpaceFilterReset, type MovementFilter } from "@/components/SpaceMovementControls";
import { methodLabel } from "@/constants/i18n";
import BackButton from "@/components/BackButton";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import { useAppData } from "@/contexts/AppDataContext";
import { parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { horaDe } from "@/utils/format";
import { canCloseLinkedSpace, canSpendFromSpace, canUndoContribution, isTrustedLegacyFamilyContribution, minimumContributionAmount, orphanedPersonalTransferIds, returnableToPersonal } from "@/utils/linkedTransfers";
import { nextId } from "@/utils/id";
import { auth } from "@/utils/firebase";
import { irUnaVez, safeBack } from "@/utils/nav";
import {
  actualizarMovimientoFamilia, borrarMovimientoFamilia, cargarFamiliaActiva, crearFamilia, crearInvitacionFamilia, listarFamilias,
  guardarMovimientoFamilia, listarMiembrosFamilia, listarMovimientosFamilia, vincularMovimientoPersonalFamilia,
  cerrarFamilia, observarCierreFamilia, quitarMiembroFamilia, renombrarFamilia, salirDeFamilia, unirseAFamilia, type EspacioFamilia, type MiembroFamilia,
  type MovimientoFamilia,
} from "@/utils/cloudFamilia";
import { ArrowDown, ArrowLeftRight, ArrowUp, Check, ListChecks, MoreVertical, Plus, RefreshCw, Trash2, UserMinus, UserPlus, UsersRound, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const fechaHoy = () => new Date().toLocaleDateString("sv-SE");

type FamiliaEnMemoria = {
  familia: EspacioFamilia | null;
  miembros: MiembroFamilia[];
  movimientos: MovimientoFamilia[];
};

// Familia vive en Firebase, pero no debe volver a aparecer vacía cada vez que
// se cambia de espacio. Esta copia dura únicamente mientras Fino está abierto;
// al entrar se enseña al instante y después se valida silenciosamente en nube.
const familiaEnMemoria = new Map<string, FamiliaEnMemoria>();

export default function Family() {
  const { t, fmt, userName, showToast, isPremium, disponible, transactions, addOrUpdateTransaction, deleteLinkedTransferTransaction, repairLinkedTransferTransactions } = useAppData();
  const insets = useSafeAreaInsets();
  const uidAlAbrir = auth.currentUser?.uid ?? "";
  const copiaInicial = uidAlAbrir ? familiaEnMemoria.get(uidAlAbrir) : undefined;
  const [familia, setFamilia] = useState<EspacioFamilia | null>(copiaInicial?.familia ?? null);
  const [familias, setFamilias] = useState<EspacioFamilia[]>(copiaInicial?.familia ? [copiaInicial.familia] : []);
  const [saldosFamilias, setSaldosFamilias] = useState<Record<string, number>>({});
  const [origenesFamilias, setOrigenesFamilias] = useState<Record<string, "personal" | "externo">>({});
  const [verTodas, setVerTodas] = useState(false);
  const [miembros, setMiembros] = useState<MiembroFamilia[]>(copiaInicial?.miembros ?? []);
  const [movimientos, setMovimientos] = useState<MovimientoFamilia[]>(copiaInicial?.movimientos ?? []);
  // La reconciliación de Personal debe conocer los movimientos de TODAS las
  // familias. Mirar solo la activa hacía que una transferencia válida de otra
  // familia se interpretara como huérfana y se borrara de Personal.
  const [movimientosFamilias, setMovimientosFamilias] = useState<Record<string, MovimientoFamilia[]>>({});
  const [familiasSincronizadas, setFamiliasSincronizadas] = useState(false);
  const [cargando, setCargando] = useState(!copiaInicial);
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<"crear" | "unir" | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [montoInicial, setMontoInicial] = useState("");
  const [origenInicial, setOrigenInicial] = useState<"personal" | "externo">("externo");
  const [invitacion, setInvitacion] = useState("");
  const [tipo, setTipo] = useState<"ingreso" | "gasto" | null>(null);
  const [monto, setMonto] = useState("");
  const [method, setMethod] = useState("cash");
  const [origenDinero, setOrigenDinero] = useState<"personal" | "externo">("externo");
  const [filter, setFilter] = useState<MovementFilter>(null);
  const [movementLimit, setMovementLimit] = useState(60);
  const [descripcion, setDescripcion] = useState("");
  const [editandoAporteId, setEditandoAporteId] = useState<string | null>(null);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [verMiembros, setVerMiembros] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const actionLock = useRef(false);
  // Evita dos reparaciones mientras Firestore confirma el nuevo vínculo.
  const legacyRepairIds = useRef(new Set<string>());
  const reloadId = useRef(0);
  const tRef = useRef(t);
  const toastRef = useRef(showToast);
  tRef.current = t;
  toastRef.current = showToast;

  const recargar = useCallback(async (preferida?: string) => {
    const pedido = ++reloadId.current;
    const uid = auth.currentUser?.uid;
    if (!uid) { setCargando(false); return; }
    setFamiliasSincronizadas(false);
    try {
      const [lista, activaLegacy] = await Promise.all([listarFamilias(uid), cargarFamiliaActiva(uid)]);
      if (pedido !== reloadId.current) return;
      setFamilias(lista);
      const saldos = await Promise.all(lista.map(async item => {
        const movimientosDeFamilia = await listarMovimientosFamilia(item.id);
        const ultimoIngreso = movimientosDeFamilia.find(movimiento => movimiento.tipo === "ingreso");
        return [item.id, movimientosDeFamilia, {
          saldo: movimientosDeFamilia.reduce((total, movimiento) => total + (movimiento.tipo === "ingreso" ? movimiento.monto : -movimiento.monto), 0),
          origen: ultimoIngreso?.personalTransactionId != null ? "personal" as const : "externo" as const,
          tieneIngreso: Boolean(ultimoIngreso),
        }] as const;
      }));
      if (pedido !== reloadId.current) return;
      setSaldosFamilias(Object.fromEntries(saldos.map(([id, , info]) => [id, info.saldo])));
      setOrigenesFamilias(Object.fromEntries(saldos.filter(([, , info]) => info.tieneIngreso).map(([id, , info]) => [id, info.origen])));
      setMovimientosFamilias(Object.fromEntries(saldos.map(([id, items]) => [id, items])));
      setFamiliasSincronizadas(true);
      const activa = lista.find(item => item.id === (preferida || familiaEnMemoria.get(uid)?.familia?.id || activaLegacy?.id)) || lista[0] || null;
      setFamilia(activa);
      if (activa) {
        const [people, movements] = await Promise.all([listarMiembrosFamilia(activa.id), listarMovimientosFamilia(activa.id)]);
        if (pedido !== reloadId.current) return;
        setMiembros(people); setMovimientos(movements);
        familiaEnMemoria.set(uid, { familia: activa, miembros: people, movimientos: movements });
      } else {
        setMiembros([]); setMovimientos([]);
        familiaEnMemoria.set(uid, { familia: null, miembros: [], movimientos: [] });
      }
    } catch { toastRef.current(tRef.current("family.connectionError")); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || cargando) return;
    familiaEnMemoria.set(uid, { familia, miembros, movimientos });
  }, [cargando, familia, miembros, movimientos]);
  const familiaId = familia?.id;
  useEffect(() => setMovementLimit(60), [familiaId, filter]);
  useEffect(() => {
    if (!familiaId) return;
    return observarCierreFamilia(familiaId, () => {
      setFamilia(null); setMovimientos([]); setMiembros([]); setTipo(null);
      setInvitacion(""); setEditandoNombre(false); setFilter(null);
      setVerTodas(true); void recargar();
    }, () => toastRef.current(tRef.current("family.connectionError")));
  }, [familiaId]);
  const saldo = useMemo(() => movimientos.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0), [movimientos]);
  const resumen = useMemo(() => movimientos.reduce(
    (total, item) => ({
      ingresos: total.ingresos + (item.tipo === "ingreso" ? item.monto : 0),
      gastos: total.gastos + (item.tipo === "gasto" ? item.monto : 0),
    }),
    { ingresos: 0, gastos: 0 },
  ), [movimientos]);
  const visibles = movimientos.filter(item => !filter || item.tipo === filter);
  const owner = familia?.ownerUid === auth.currentUser?.uid;
  const devolvibleAPersonal = returnableToPersonal(movimientos, auth.currentUser?.uid);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || cargando || !familiasSincronizadas) return;
    const todosLosMovimientos = Object.values(movimientosFamilias).flat();
    const validMovementIds = todosLosMovimientos
      .filter(item => item.personalOwnerUid === uid && item.personalTransactionId != null)
      .map(item => item.id);
    const orphanIds = orphanedPersonalTransferIds(transactions, "family", validMovementIds, true);
    const nombresPorFamilia = new Map(familias.map(item => [item.id, item.nombre]));
    const upserts = todosLosMovimientos.flatMap(item => {
      if (item.personalOwnerUid !== uid || item.personalTransactionId == null) return [];
      const esRetorno = item.tipo === "gasto" && (item.personalReturnAmount || 0) > 0;
      const nombreFamilia = nombresPorFamilia.get(Object.entries(movimientosFamilias).find(([, items]) => items.some(movimiento => movimiento.id === item.id))?.[0] || "") || "Familia";
      const canonical = { id: item.personalTransactionId, type: esRetorno ? "income" as const : "expense" as const, amount: esRetorno ? item.personalReturnAmount! : item.monto, category: "otros", date: item.fecha, time: horaDe(item.creadoEn), method: "transfer", description: esRetorno ? t("family.returnFrom", { name: nombreFamilia }) : t("family.transferTo", { name: nombreFamilia }), notes: "", origin: "manual" as const, internalTransfer: "family" as const, internalTransferLink: item.id };
      const current = transactions.find(tx => tx.id === item.personalTransactionId);
      // Un ID ya presente no basta: una versión antigua podía dejar una
      // contraparte incompleta. Solo se corrige si no representa este mismo
      // enlace y así se evita reescribir en cada render.
      if (current?.internalTransfer === "family" && current.internalTransferLink === item.id && current.type === canonical.type && current.amount === canonical.amount) return [];
      return [canonical];
    });
    if (upserts.length || orphanIds.length) repairLinkedTransferTransactions(upserts, orphanIds);
    // Migración segura de aportes anteriores a los vínculos dobles. No se
    // adivina por el importe: exige texto generado por Fino, transferencia y
    // que el movimiento pertenezca a esta misma cuenta.
    // Un integrante también puede haber aportado desde su propio Personal. La
    // comprobación exige que sea quien creó el movimiento; no hace falta que
    // además sea el dueño de toda la familia.
    if (!familia) return;
    const legacy = movimientos.filter(item =>
      isTrustedLegacyFamilyContribution(item, uid) && !legacyRepairIds.current.has(item.id),
    );
    for (const item of legacy) {
      legacyRepairIds.current.add(item.id);
      const personalId = nextId();
      void vincularMovimientoPersonalFamilia(familia.id, item.id, personalId, uid)
        .then(() => {
          repairLinkedTransferTransactions([{
            id: personalId, type: "expense", amount: item.monto, category: "otros", date: item.fecha,
            time: horaDe(item.creadoEn), method: "transfer", description: t("family.transferTo", { name: familia.nombre }),
            notes: "", origin: "manual", internalTransfer: "family", internalTransferLink: item.id,
          }]);
          void recargar();
        })
        .catch(() => {
          legacyRepairIds.current.delete(item.id);
          toastRef.current(tRef.current("family.connectionError"));
        });
    }
  }, [cargando, familia, familias, familiasSincronizadas, movimientos, movimientosFamilias, owner, recargar, repairLinkedTransferTransactions, t, transactions]);

  async function ejecutar(action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setOcupado(true);
    try { await action(); }
    catch { showToast(t("family.connectionError")); }
    finally { actionLock.current = false; setOcupado(false); }
  }

  const crear = () => ejecutar(async () => {
    if (!isPremium) { irUnaVez("/premium"); return; }
    const uid = auth.currentUser?.uid; const value = nombre.trim().slice(0, 35);
    const initial = parseAmountInput(montoInicial);
    if (!uid || !value || (origenInicial === "personal" && initial > disponible)) {
      if (origenInicial === "personal" && initial > disponible) showToast(t("family.notEnoughPersonal"));
      return;
    }
    const nueva = await crearFamilia(uid, userName || t("family.member"), value);
    if (initial > 0) {
      const personalTransactionId = origenInicial === "personal" ? nextId() : undefined;
      const movementId = await guardarMovimientoFamilia(nueva.id, uid, {
        tipo: "ingreso", monto: initial,
        descripcion: t(origenInicial === "personal" ? "family.initialFromPersonal" : "family.initialExternal"),
        fecha: fechaHoy(), method: origenInicial === "personal" ? "transfer" : "cash",
        ...(personalTransactionId != null ? { personalTransactionId, personalOwnerUid: uid } : {}),
      });
      if (origenInicial === "personal") {
        addOrUpdateTransaction({
          id: personalTransactionId!, type: "expense", amount: initial, category: "otros", date: fechaHoy(),
          time: horaDe(Date.now()), method: "transfer", description: t("family.transferTo", { name: value }),
          notes: "", origin: "manual", internalTransfer: "family", internalTransferLink: movementId,
        });
      }
    }
    setModo(null); setNombre(""); setMontoInicial(""); setOrigenInicial("externo"); setVerTodas(false); await recargar(nueva.id); showToast(t("family.created"));
  });

  const unir = () => ejecutar(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || codigo.length !== 8) return;
    try {
      const nueva = await unirseAFamilia(uid, userName || t("family.member"), codigo);
      setModo(null); setCodigo(""); setVerTodas(false); await recargar(nueva.id); showToast(t("family.joined"));
    } catch { showToast(t("family.invalidCode")); }
  });

  const invitar = () => ejecutar(async () => {
    const uid = auth.currentUser?.uid; if (!uid || !familia || !owner) return;
    if (!isPremium) { irUnaVez("/premium"); return; }
    setInvitacion(await crearInvitacionFamilia(uid, familia.id));
  });

  const guardarNombre = () => ejecutar(async () => {
    const value = nuevoNombre.trim().slice(0, 35);
    if (!familia || !owner || !value) return;
    await renombrarFamilia(familia.id, value);
    setFamilia({ ...familia, nombre: value });
    setEditandoNombre(false);
    setNuevoNombre("");
    showToast(t("family.renamed"));
  });

  const guardar = () => ejecutar(async () => {
    const uid = auth.currentUser?.uid; const value = parseAmountInput(monto);
    if (!uid || !familia || !tipo || !(value > 0)) return;
    const aporteEditado = editandoAporteId ? movimientos.find(item => item.id === editandoAporteId) : undefined;
    if (aporteEditado?.personalTransactionId != null) {
      const minimo = minimumContributionAmount(movimientos, aporteEditado, uid);
      if (value < minimo - 0.005) { showToast(t("family.contributionUsed")); return; }
      if (value - aporteEditado.monto > disponible) { showToast(t("family.notEnoughPersonal")); return; }
      await actualizarMovimientoFamilia(familia.id, aporteEditado.id, value, descripcion || aporteEditado.descripcion);
      const personal = transactions.find(tx => tx.id === aporteEditado.personalTransactionId);
      if (personal) addOrUpdateTransaction({ ...personal, amount: value });
      setMonto(""); setDescripcion(""); setEditandoAporteId(null); setTipo(null); await recargar();
      return;
    }
    const desdePersonal = tipo === "ingreso" && owner && origenDinero === "personal";
    if (desdePersonal && value > disponible) { showToast(t("family.notEnoughPersonal")); return; }
    if (tipo === "gasto" && !canSpendFromSpace(movimientos, value)) { showToast(t("family.notEnoughSpace")); return; }
    const personalTransactionId = desdePersonal ? nextId() : undefined;
    const movementId = await guardarMovimientoFamilia(familia.id, uid, { tipo, monto: value, descripcion: descripcion.trim().slice(0, 60) || (tipo === "ingreso" ? t(desdePersonal ? "family.initialFromPersonal" : "family.externalMoney") : ""), fecha: fechaHoy(), method: personalTransactionId != null ? "transfer" : method, ...(personalTransactionId != null ? { personalTransactionId, personalOwnerUid: uid } : {}) });
    if (personalTransactionId != null) addOrUpdateTransaction({ id: personalTransactionId, type: "expense", amount: value, category: "otros", date: fechaHoy(), time: horaDe(Date.now()), method: "transfer", description: t("family.transferTo", { name: familia.nombre }), notes: "", origin: "manual", internalTransfer: "family", internalTransferLink: movementId });
    setMonto(""); setDescripcion(""); setOrigenDinero("externo"); setTipo(null); await recargar(); showToast(t("family.movementSaved"));
  });

  const borrar = (item: MovimientoFamilia) => ejecutar(async () => { if (familia) {
    if (item.tipo === "ingreso" && item.personalTransactionId != null && !canUndoContribution(movimientos, item, item.personalOwnerUid)) { showToast(t("family.contributionUsed")); return; }
    await borrarMovimientoFamilia(familia.id, item.id);
    if (item.personalOwnerUid === auth.currentUser?.uid && item.personalTransactionId != null) deleteLinkedTransferTransaction(item.personalTransactionId); await recargar();
  } });
  const salir = () => ejecutar(async () => {
    const uid = auth.currentUser?.uid; if (!uid || !familia || owner) return;
    await salirDeFamilia(uid, familia.id); setFamilia(null); setMiembros([]); setMovimientos([]); showToast(t("family.left"));
  });
  const devolverAPersonal = () => ejecutar(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !familia || devolvibleAPersonal <= 0) return;
    const personalId = nextId();
    const movementId = await guardarMovimientoFamilia(familia.id, uid, { tipo: "gasto", monto: devolvibleAPersonal, descripcion: t("family.returnToPersonal"), fecha: fechaHoy(), method: "transfer", personalTransactionId: personalId, personalOwnerUid: uid, personalReturnAmount: devolvibleAPersonal });
    addOrUpdateTransaction({ id: personalId, type: "income", amount: devolvibleAPersonal, category: "otros", date: fechaHoy(), time: horaDe(Date.now()), method: "transfer", description: t("family.returnFrom", { name: familia.nombre }), notes: "", origin: "manual", internalTransfer: "family", internalTransferLink: movementId });
    await recargar();
  });
  const quitar = (member: MiembroFamilia) => {
    if (!familia || !owner || member.rol === "owner") return;
    Alert.alert(t("family.removeMember"), member.nombre, [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void ejecutar(async () => { await quitarMiembroFamilia(familia.id, member.uid); setMiembros(items => items.filter(item => item.uid !== member.uid)); }) }]);
  };

  const confirmarCierre = () => {
    if (!owner || ocupado || !familia) return;
    if (!canCloseLinkedSpace(movimientos)) { showToast(t("family.closeBalance")); return; }
    const id = familia.id;
    Alert.alert(t("family.close"), t("family.closeWarning"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("family.close"), style: "destructive", onPress: () => void ejecutar(async () => {
        const uid = auth.currentUser?.uid; if (!uid) return;
        await cerrarFamilia(uid, id);
        setFamilia(null); setMiembros([]); setMovimientos([]); setTipo(null); setInvitacion("");
        showToast(t("family.closed"));
      }) },
    ]);
  };
  const seleccionar = (id: string) => setSeleccionados(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const borrarSeleccionados = (ids = seleccionados) => ejecutar(async () => {
    if (!familia || !ids.length) return;
    const items = movimientos.filter(item => ids.includes(item.id));
    if (items.some(item => item.tipo === "ingreso" && item.personalTransactionId != null && !canUndoContribution(movimientos, item, item.personalOwnerUid))) {
      showToast(t("family.contributionUsed")); return;
    }
    for (const item of items) {
      await borrarMovimientoFamilia(familia.id, item.id);
      if (item.personalOwnerUid === auth.currentUser?.uid && item.personalTransactionId != null) deleteLinkedTransferTransaction(item.personalTransactionId);
    }
    setSeleccionados([]); setSeleccionando(false); await recargar();
  });
  const confirmarBorrarTodo = () => {
    if (!visibles.length) return;
    Alert.alert("Borrar todos los movimientos", `Se eliminarán los ${visibles.length} movimientos que se muestran. Esta acción no se puede deshacer.`, [
      { text: t("common.cancel"), style: "cancel" },
      { text: "Borrar todo", style: "destructive", onPress: () => void borrarSeleccionados(visibles.map(item => item.id)) },
    ]);
  };

  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center justify-between px-5 pb-3"><BackButton onPress={safeBack} /><Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("family.title")}</Text><TouchableOpacity onPress={() => void recargar()} className="h-10 w-10 items-center justify-center"><RefreshCw size={18} color="#64748b" /></TouchableOpacity></View>
    <SpaceSwitcher active="family" />
    <ScrollView
      className="flex-1 px-5"
      contentContainerStyle={{ paddingBottom: 36 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      scrollEventThrottle={160}
      onScroll={({ nativeEvent }) => {
        const cercaDelFinal = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 240;
        if (cercaDelFinal && movementLimit < visibles.length) setMovementLimit(limit => Math.min(limit + 60, visibles.length));
      }}
    >
      {cargando ? <Text className="py-8 text-center text-slate-500">{t("common.loading")}</Text> : !auth.currentUser ? <Text className="mt-6 text-center text-slate-600 dark:text-slate-300">{t("family.loginRequired")}</Text> : verTodas ? <>
        <Text className="mt-3 text-sm text-slate-600 dark:text-slate-300">Crea o únete a varias familias y cambia entre ellas cuando quieras.</Text>
        <View className="mt-3 flex-row gap-3"><TouchableOpacity onPress={() => isPremium ? setModo("crear") : irUnaVez("/premium")} className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${isPremium ? "bg-emerald-600" : "bg-amber-500"}`}><Plus size={18} color="#fff" /><Text className="font-bold text-white">{isPremium ? t("family.create") : t("family.createPremium")}</Text></TouchableOpacity><TouchableOpacity onPress={() => setModo("unir")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-noche-2"><UserPlus size={18} color="#0d9488" /><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.join")}</Text></TouchableOpacity></View>
        {modo ? <View className="mt-3 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><TextInput disableFullscreenUI autoFocus value={modo === "crear" ? nombre : codigo} onChangeText={modo === "crear" ? setNombre : value => setCodigo(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8))} maxLength={modo === "crear" ? 35 : 8} placeholder={t(modo === "crear" ? "family.namePlaceholder" : "family.codePlaceholder")} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-slate-900 dark:text-slate-100" />{modo === "crear" ? <><TextInput disableFullscreenUI value={montoInicial} onChangeText={value => setMontoInicial(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder={t("family.initialAmount")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" /><View className="mt-2 flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenInicial(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenInicial === origin ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "family.fromPersonal" : "family.externalMoney")}</Text></TouchableOpacity>)}</View>{origenInicial === "personal" ? <Text className="mt-1 text-[11px] text-slate-500">{t("family.personalAvailable", { amount: fmt(disponible) })}</Text> : null}</> : null}<View className="mt-3 flex-row gap-2"><TouchableOpacity onPress={() => setModo(null)} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100"><X size={19} color="#64748b" /></TouchableOpacity><TouchableOpacity onPress={modo === "crear" ? crear : unir} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Check size={19} color="#fff" /></TouchableOpacity></View></View> : null}
        <View className="mt-3 gap-3">{familias.map(item => <TouchableOpacity key={item.id} onPress={() => { setFamilia(item); setVerTodas(false); void recargar(item.id); }} className="min-h-[94px] flex-row rounded-2xl border-[1.5px] border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30"><View className="w-12 items-center justify-center"><View className="h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900"><UsersRound size={24} color="#059669" /></View></View><View className="ml-2 flex-1 justify-center"><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} className="text-[16px] font-extrabold leading-5 text-slate-900 dark:text-slate-100">{item.nombre}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} className="mt-1 text-[17px] font-extrabold leading-5 text-emerald-700 dark:text-emerald-300">{fmt(saldosFamilias[item.id] ?? 0)}</Text>{origenesFamilias[item.id] ? <Text numberOfLines={1} className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-300">{t(origenesFamilias[item.id] === "personal" ? "family.fromPersonal" : "family.externalMoney")}</Text> : null}</View><View className="w-9 items-center justify-center"><ArrowLeftRight size={20} color="#059669" /></View></TouchableOpacity>)}</View>
        {!familias.length && !modo ? <Text className="py-8 text-center text-sm text-slate-500">Aún no tienes familias.</Text> : null}
      </> : !familia ? <>
        <View className="mt-3 items-center rounded-3xl border-[1.5px] border-emerald-200 bg-emerald-50 px-5 py-6 dark:border-emerald-800 dark:bg-emerald-950/30"><View className="h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600"><UsersRound size={27} color="#fff" /></View><Text className="mt-3 text-center text-lg font-extrabold text-slate-900 dark:text-slate-100">{t("family.startTitle")}</Text><Text className="mt-1 text-center text-sm leading-5 text-slate-600 dark:text-slate-300">{t("family.startBody")}</Text></View>
        <View className="mt-4 flex-row gap-3"><TouchableOpacity onPress={() => isPremium ? setModo("crear") : irUnaVez("/premium")} className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${isPremium ? "bg-emerald-600" : "bg-amber-500"}`}><Plus size={18} color="#fff" /><Text className="font-bold text-white">{isPremium ? t("family.create") : t("family.createPremium")}</Text></TouchableOpacity><TouchableOpacity onPress={() => setModo("unir")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-noche-2"><UserPlus size={18} color="#0d9488" /><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.join")}</Text></TouchableOpacity></View>
        {modo ? <View className="mt-4 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><TextInput disableFullscreenUI autoFocus value={modo === "crear" ? nombre : codigo} onChangeText={modo === "crear" ? setNombre : value => setCodigo(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8))} maxLength={modo === "crear" ? 35 : 8} autoCapitalize={modo === "crear" ? "sentences" : "characters"} placeholder={t(modo === "crear" ? "family.namePlaceholder" : "family.codePlaceholder")} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-slate-900 dark:text-slate-100" />{modo === "crear" ? <><TextInput disableFullscreenUI value={montoInicial} onChangeText={value => setMontoInicial(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder={t("family.initialAmount")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" /><Text className="mb-1 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("family.moneyOrigin")}</Text><View className="flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenInicial(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenInicial === origin ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "family.fromPersonal" : "family.externalMoney")}</Text></TouchableOpacity>)}</View>{origenInicial === "personal" ? <Text className="mt-1 text-[11px] text-slate-500">{t("family.personalAvailable", { amount: fmt(disponible) })}</Text> : null}</> : null}<View className="mt-3 flex-row gap-2"><TouchableOpacity onPress={() => { setModo(null); setMontoInicial(""); }} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><X size={19} color="#64748b" /></TouchableOpacity><TouchableOpacity onPress={modo === "crear" ? crear : unir} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Check size={19} color="#fff" /></TouchableOpacity></View></View> : null}
      </> : <>
        <TouchableOpacity onPress={() => { setVerTodas(true); setModo(null); }} className="mt-2 flex-row items-center self-start gap-1 rounded-xl px-1 py-2"><ArrowLeftRight size={16} color="#059669" /><Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Ver todas las familias</Text></TouchableOpacity>
        <View className="mt-2 rounded-3xl bg-emerald-600 px-4 py-3"><View className="flex-row items-center"><Text numberOfLines={1} className="flex-1 text-base font-bold text-emerald-100">{familia.nombre}</Text>{owner ? <TouchableOpacity accessibilityLabel="Opciones de familia" onPress={() => irUnaVez({ pathname: "/family-settings", params: { familyId: familia.id } })} className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-700"><MoreVertical size={20} color="#fff" /></TouchableOpacity> : null}</View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58} className="text-[26px] font-extrabold leading-8 text-white">{fmt(saldo)}</Text><Text className="text-xs leading-4 text-emerald-100">{t("family.sharedBalance")}</Text><SpaceTotals income={resumen.ingresos} expense={resumen.gastos} filter={filter} onFilter={setFilter} format={fmt} /></View>
        <View className="mt-3 flex-row gap-3"><TouchableOpacity onPress={() => { setOrigenDinero("externo"); setTipo("ingreso"); }} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-100"><ArrowUp size={18} color="#047857" /><Text className="font-bold text-emerald-700">{t("boxes.income")}</Text></TouchableOpacity><TouchableOpacity onPress={() => setTipo("gasto")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-rose-100"><ArrowDown size={18} color="#be123c" /><Text className="font-bold text-rose-700">{t("boxes.expense")}</Text></TouchableOpacity></View>
        {tipo ? <View className="mt-3 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><TextInput disableFullscreenUI value={monto} onChangeText={value => setMonto(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" /><TextInput disableFullscreenUI value={descripcion} onChangeText={setDescripcion} maxLength={60} placeholder={t("boxes.description")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-slate-900 dark:text-slate-100" />{tipo === "ingreso" && owner ? <><Text className="mb-1 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("family.moneyOrigin")}</Text><View className="flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenDinero(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenDinero === origin ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "family.fromPersonal" : "family.externalMoney")}</Text></TouchableOpacity>)}</View>{origenDinero === "personal" ? <Text className="mt-1 text-[11px] text-slate-500">{t("family.personalAvailable", { amount: fmt(disponible) })}</Text> : null}</> : null}{tipo !== "ingreso" || !owner || origenDinero === "externo" ? <SpacePaymentMethod value={method} onChange={setMethod} disabled={ocupado} /> : null}<View className="mt-3 flex-row gap-2"><TouchableOpacity onPress={() => setTipo(null)} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text></TouchableOpacity><TouchableOpacity onPress={guardar} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Text className="font-bold text-white">{t("common.save")}</Text></TouchableOpacity></View></View> : null}
        {devolvibleAPersonal > 0 ? <TouchableOpacity disabled={ocupado} onPress={() => void devolverAPersonal()} className="mt-3 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.returnAmount", { amount: fmt(devolvibleAPersonal) })}</Text></TouchableOpacity> : null}
        {Math.abs(saldo) < 0.005 && owner ? <TouchableOpacity onPress={() => { setOrigenDinero("externo"); setTipo("ingreso"); }} className="mt-3 min-h-11 items-center justify-center rounded-xl bg-emerald-600"><Text className="font-bold text-white">{t("boxes.addMoney")}</Text></TouchableOpacity> : null}
        <View className="mb-2 mt-5 flex-row items-center justify-between">
          {seleccionando ? <>
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{seleccionados.length} {seleccionados.length === 1 ? "seleccionado" : "seleccionados"}</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity accessibilityLabel="Eliminar seleccionados" disabled={!seleccionados.length || ocupado} onPress={() => void borrarSeleccionados()} className={`h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950 ${!seleccionados.length || ocupado ? "opacity-40" : ""}`}><Trash2 size={19} color="#f43f5e" /></TouchableOpacity>
              <TouchableOpacity onPress={confirmarBorrarTodo} hitSlop={6}><Text className="text-sm font-bold text-rose-500">Borrar todo</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setSeleccionando(false); setSeleccionados([]); }} hitSlop={6}><Text className="text-sm font-bold text-emerald-600">{t("common.cancel")}</Text></TouchableOpacity>
            </View>
          </> : <>
            <Text className="font-extrabold text-slate-900 dark:text-slate-100">{t("family.history")}</Text>
            <View className="flex-row items-center gap-2">{owner ? <TouchableOpacity onPress={() => void invitar()} className="h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><UserPlus size={18} color="#0d9488" /></TouchableOpacity> : null}<TouchableOpacity onPress={() => { setSeleccionando(true); setSeleccionados([]); }} className="flex-row items-center gap-1"><ListChecks size={16} color="#059669" /><Text className="text-sm font-bold text-emerald-600">Seleccionar</Text></TouchableOpacity></View>
          </>}
        </View>
        {invitacion ? <View className="mb-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950"><Text className="text-xs text-slate-600 dark:text-slate-300">{t("family.shareCode")}</Text><Text selectable className="mt-1 text-center text-2xl font-extrabold tracking-[4px] text-emerald-700 dark:text-emerald-300">{invitacion}</Text><Text className="mt-1 text-center text-[11px] text-slate-500">Mantén presionado el código para copiarlo.</Text></View> : null}
        <SpaceFilterReset filter={filter} onReset={() => setFilter(null)} />
        {visibles.length === 0 ? <Text className="py-5 text-center text-sm text-slate-500">{t(filter ? "spaces.noResults" : "family.noMovements")}</Text> : visibles.slice(0, movementLimit).map(item => {
          return <TouchableOpacity key={item.id} disabled={!seleccionando} onPress={() => seleccionar(item.id)} className={`mb-2 flex-row items-center rounded-2xl border-[1.5px] p-3 dark:border-noche-borde ${seleccionados.includes(item.id) ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200"}`}>
            <View className={`h-9 w-9 items-center justify-center rounded-xl ${item.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"}`}>{item.tipo === "ingreso" ? <ArrowUp size={17} color="#047857" /> : <ArrowDown size={17} color="#be123c" />}</View>
            <View className="ml-3 flex-1"><Text numberOfLines={1} className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{item.descripcion || t(item.tipo === "ingreso" ? "boxes.income" : "boxes.expense")}</Text><Text className="text-xs text-slate-500">{item.fecha}{item.method ? ` · ${methodLabel(item.method, t)}` : ""}</Text></View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className={`mr-1 max-w-[38%] text-[15px] font-extrabold ${item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>{item.tipo === "ingreso" ? "+" : "-"}{fmt(item.monto)}</Text>
            {seleccionando ? <View className={`ml-2 h-5 w-5 rounded-full border-2 ${seleccionados.includes(item.id) ? "border-teal-600 bg-teal-600" : "border-slate-400"}`} /> : null}
          </TouchableOpacity>;
        })}
      </>}
    </ScrollView>
  </View>;
}
