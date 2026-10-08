import { SpaceOverviewTotals, type MovementFilter } from "@/components/SpaceMovementControls";
import { methodLabel } from "@/constants/i18n";
import { currencySymbolFor } from "@/constants/currencies";
import BackButton from "@/components/BackButton";
import LegalAcceptancePanel from "@/components/LegalAcceptancePanel";
import MovementAllButton from "@/components/MovementAllButton";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import SpaceTransferAmounts from "@/components/SpaceTransferAmounts";
import SpaceMovementSheet from "@/components/SpaceMovementSheet";
import SpaceInvitationSheet from "@/components/SpaceInvitationSheet";
import SpaceMembersSheet from "@/components/SpaceMembersSheet";
import ContentReportButton from "@/components/ContentReportButton";
import { validSpaceDate } from "@/components/SpaceMovementFields";
import { useAppData } from "@/contexts/AppDataContext";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { disponiblePersonalEnFecha } from "@/utils/finances";
import { fmt as formatAmount, horaDe } from "@/utils/format";
import { canCloseLinkedSpace, canSpendFromSpace, countSelectedCompactRows, compactLinkedTransferRows, isLinkedSpaceReturn, isLinkedSpaceTransfer, isTrustedLegacyFamilyContribution, linkedTransferLedger, minimumContributionAmount, movementIdsForCompactRow, orphanedPersonalTransferIds, planSpaceMovementDeletion, returnableToPersonal, settlePersonalTransfers } from "@/utils/linkedTransfers";
import { nextId } from "@/utils/id";
import { auth } from "@/utils/firebase";
import { irUnaVez, safeBack } from "@/utils/nav";
import { actualizarAportePersonal, borrarAportePersonal } from "@/utils/personalContribution";
import { devolverAportePersonal } from "@/utils/personalReturn";
import { spaceErrorKey } from "@/utils/spaceErrors";
import { captureAccountTask, type AccountTaskWait } from "@/utils/accountTask";
import { getAccountStorageSession } from "@/utils/storage";
import {
  borrarMovimientoFamilia, cargarFamiliaActiva, cerrarFamilia, crearFamilia, crearInvitacionFamilia, listarFamilias,
  guardarMovimientoFamilia, listarMiembrosFamilia, listarMovimientosFamilia, quitarMiembroFamilia, renombrarFamilia, vincularMovimientoPersonalFamilia,
  observarCierreFamilia, salirDeFamilia, unirseAFamilia, type EspacioFamilia, type MiembroFamilia,
  type MovimientoFamilia,
} from "@/utils/cloudFamilia";
import { ArrowDown, ArrowLeftRight, ArrowRightLeft, ArrowUp, Check, ListChecks, LogOut, Pencil, Plus, RefreshCw, Trash2, UserPlus, UsersRound, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

const fechaHoy = () => new Date().toLocaleDateString("sv-SE");

type FamiliaEnMemoria = {
  familia: EspacioFamilia | null;
  miembros: MiembroFamilia[];
  movimientos: MovimientoFamilia[];
};

type FamilyActionWait = AccountTaskWait & { reload: (preferred?: string) => Promise<void> };

// Familia vive en Firebase, pero no debe volver a aparecer vacía cada vez que
// se cambia de espacio. Esta copia dura únicamente mientras Fino está abierto;
// al entrar se enseña al instante y después se valida silenciosamente en nube.
const familiaEnMemoria = new Map<string, FamiliaEnMemoria>();

export default function Family() {
  // La pantalla no conserva listas/formularios de la cuenta que acaba de salir.
  useAppData();
  const uid = auth.currentUser?.uid ?? "";
  return <FamilyForAccount key={`${uid}:${getAccountStorageSession()}`} accountUid={uid} />;
}

function FamilyForAccount({ accountUid }: { accountUid: string }) {
  const { t, fmt, userCurrency, userName, showToast, isPremium, budgets, carryoverCleared, transactions, addOrUpdateTransaction, recordPersonalReturn, deleteLinkedTransferTransaction, repairLinkedTransferTransactions } = useAppData();
  const insets = useSafeAreaInsets();
  const uidAlAbrir = auth.currentUser?.uid ?? "";
  const copiaInicial = uidAlAbrir ? familiaEnMemoria.get(uidAlAbrir) : undefined;
  const [familia, setFamilia] = useState<EspacioFamilia | null>(copiaInicial?.familia ?? null);
  const [familias, setFamilias] = useState<EspacioFamilia[]>(copiaInicial?.familia ? [copiaInicial.familia] : []);
  const [saldosFamilias, setSaldosFamilias] = useState<Record<string, number>>({});
  // Entrar desde Personal debe llevar al selector de familias, no abrir
  // automáticamente la última familia activa. La persona elige el espacio
  // que quiere consultar en cada entrada.
  const [verTodas, setVerTodas] = useState(true);
  const [seleccionandoFamilias, setSeleccionandoFamilias] = useState(false);
  const [familiasSeleccionadas, setFamiliasSeleccionadas] = useState<string[]>([]);
  const [miembros, setMiembros] = useState<MiembroFamilia[]>(copiaInicial?.miembros ?? []);
  const [movimientos, setMovimientos] = useState<MovimientoFamilia[]>(copiaInicial?.movimientos ?? []);
  // La reconciliación de Personal debe conocer los movimientos de TODAS las
  // familias. Mirar solo la activa hacía que una transferencia válida de otra
  // familia se interpretara como huérfana y se borrara de Personal.
  const [movimientosFamilias, setMovimientosFamilias] = useState<Record<string, MovimientoFamilia[]>>({});
  const [familiasSincronizadas, setFamiliasSincronizadas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<"crear" | "unir" | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [montoInicial, setMontoInicial] = useState("");
  const [origenInicial, setOrigenInicial] = useState<"personal" | "externo">("externo");
  const [invitacion, setInvitacion] = useState("");
  const [verMiembros, setVerMiembros] = useState(false);
  const [editandoNombreFamilia, setEditandoNombreFamilia] = useState(false);
  const [nombreFamiliaEditado, setNombreFamiliaEditado] = useState("");
  const [tipo, setTipo] = useState<"ingreso" | "gasto" | null>(null);
  const [monto, setMonto] = useState("");
  const [method, setMethod] = useState("cash");
  const [origenDinero, setOrigenDinero] = useState<"personal" | "externo">("externo");
  const [filter, setFilter] = useState<MovementFilter>(null);
  const [movementLimit, setMovementLimit] = useState(60);
  const [descripcion, setDescripcion] = useState("");
  const [category, setCategory] = useState("otros");
  const [movementDate, setMovementDate] = useState(fechaHoy());
  const [notes, setNotes] = useState("");
  const saldoPersonalEn = useCallback((fecha: string) =>
    disponiblePersonalEnFecha(fecha, budgets, transactions, carryoverCleared),
  [budgets, transactions, carryoverCleared]);
  const hoyEnPantalla = fechaHoy();
  const disponibleHoy = useMemo(() => saldoPersonalEn(hoyEnPantalla), [saldoPersonalEn, hoyEnPantalla]);
  const disponibleMovimiento = useMemo(() => saldoPersonalEn(movementDate), [saldoPersonalEn, movementDate]);
  const disponible = modo === "crear" ? disponibleHoy : disponibleMovimiento;
  const fmtFamilia = useCallback((amount: number) => {
    const currency = familia?.currency || userCurrency;
    return formatAmount(amount, currencySymbolFor(currency), currency);
  }, [familia?.currency, userCurrency]);
  const fmtFamiliaLista = useCallback((amount: number, currency: string) =>
    formatAmount(amount, currencySymbolFor(currency), currency), []);
  const [editandoAporteId, setEditandoAporteId] = useState<string | null>(null);
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const actionLock = useRef(false);
  // Evita dos reparaciones mientras Firestore confirma el nuevo vínculo.
  const legacyRepairIds = useRef(new Set<string>());
  const reloadId = useRef(0);
  const accountSession = useRef(getAccountStorageSession()).current;
  const confirmedReload = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; reloadId.current += 1; };
  }, []);
  const tRef = useRef(t);
  const toastRef = useRef(showToast);
  tRef.current = t;
  toastRef.current = showToast;

  const recargar = useCallback(async (preferida?: string) => {
    const pedido = ++reloadId.current;
    const uid = accountUid;
    const task = captureAccountTask(uid, () => mounted.current && pedido === reloadId.current && getAccountStorageSession() === accountSession);
    if (!task.current()) { if (!uid && mounted.current) setCargando(false); return; }
    setFamiliasSincronizadas(false);
    try {
      const [lista, activaLegacy] = await task.wait(() => Promise.all([listarFamilias(uid), cargarFamiliaActiva(uid)]));
      const saldos = await task.wait(() => Promise.all(lista.map(async item => {
        const movimientosDeFamilia = await task.wait(() => listarMovimientosFamilia(item.id, true));
        return [item.id, movimientosDeFamilia, {
          saldo: movimientosDeFamilia.reduce((total, movimiento) => total + (movimiento.tipo === "ingreso" ? movimiento.monto : -movimiento.monto), 0),
        }] as const;
      })));
      const activa = lista.find(item => item.id === (preferida || familiaEnMemoria.get(uid)?.familia?.id || activaLegacy?.id)) || lista[0] || null;
      const movements = activa ? saldos.find(([id]) => id === activa.id)?.[1] ?? [] : [];
      const people = activa ? await task.wait(() => listarMiembrosFamilia(activa.id)) : [];
      if (!task.current()) return;
      confirmedReload.current = pedido;
      // Publicar juntos los datos completos: nunca reconciliar una mitad nueva
      // de la lista con movimientos/miembros de la consulta anterior.
      setFamilias(lista);
      setSaldosFamilias(Object.fromEntries(saldos.map(([id, , info]) => [id, info.saldo])));
      setMovimientosFamilias(Object.fromEntries(saldos.map(([id, items]) => [id, items])));
      setFamilia(activa);
      setMiembros(people); setMovimientos(movements);
      setFamiliasSincronizadas(true);
      familiaEnMemoria.set(uid, { familia: activa, miembros: people, movimientos: movements });
    } catch { if (task.current()) toastRef.current(tRef.current("family.connectionError")); }
    finally { if (task.current()) setCargando(false); }
  }, [accountSession, accountUid]);

  useFocusEffect(useCallback(() => {
    void recargar();
    return () => { reloadId.current += 1; setFamiliasSincronizadas(false); };
  }, [recargar]));
  const familiaId = familia?.id;
  useEffect(() => {
    setVerMiembros(false);
    setEditandoNombreFamilia(false);
    setNombreFamiliaEditado(familia?.nombre ?? "");
  }, [familia?.id, familia?.nombre]);
  useEffect(() => setMovementLimit(60), [familiaId, filter]);
  useEffect(() => {
    if (!familiaId) return;
    let active = true;
    const task = captureAccountTask(accountUid, () => mounted.current && active && getAccountStorageSession() === accountSession);
    const stop = observarCierreFamilia(familiaId, () => {
      if (!task.current()) return;
      setFamilia(null); setMovimientos([]); setMiembros([]); setTipo(null);
      setInvitacion(""); setFilter(null);
      setVerTodas(true); void recargar();
    }, () => { if (task.current()) toastRef.current(tRef.current("family.connectionError")); });
    return () => { active = false; stop(); };
  }, [accountSession, accountUid, familiaId, recargar]);
  const saldo = useMemo(() => movimientos.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0), [movimientos]);
  const resumen = useMemo(() => movimientos.reduce(
    (total, item) => ({
      ingresos: total.ingresos + (!isLinkedSpaceTransfer(item) && item.tipo === "ingreso" ? item.monto : 0),
      gastos: total.gastos + (!isLinkedSpaceTransfer(item) && item.tipo === "gasto" ? item.monto : 0),
    }),
    { ingresos: 0, gastos: 0 },
  ), [movimientos]);
  const visibles = movimientos.filter(item => !filter
    || (filter === "transferencia" ? isLinkedSpaceTransfer(item) : !isLinkedSpaceTransfer(item) && item.tipo === filter));
  const filasVisibles = filter
    ? visibles.map(item => ({ key: `movement:${item.id}`, item, transferGroup: undefined }))
    : compactLinkedTransferRows(visibles);
  const filasSeleccionadas = countSelectedCompactRows(filasVisibles, visibles, seleccionados);
  const owner = familia?.ownerUid === auth.currentUser?.uid;
  const devolvibleAPersonal = returnableToPersonal(movimientos, auth.currentUser?.uid);

  useEffect(() => {
    const uid = accountUid;
    const revision = reloadId.current;
    const task = captureAccountTask(uid, () => mounted.current && revision === reloadId.current && !actionLock.current && getAccountStorageSession() === accountSession);
    if (!task.current() || cargando || !familiasSincronizadas || confirmedReload.current !== revision) return;
    const todosLosMovimientos = Object.values(movimientosFamilias).flat();
    const validMovementIds = todosLosMovimientos
      .filter(item => item.personalOwnerUid === uid && item.personalTransactionId != null)
      .map(item => item.id);
    // Una Familia cerrada ya no aparece en la lista activa. Su aporte gastado
    // no se borra de Personal: hacerlo devolvería dinero que ya no existe.
    const familiasActivas = new Set(familias.map(item => item.id));
    const conciliables = transactions.filter(tx => !tx.internalTransferSettled
      && !!tx.internalTransferSpaceId && familiasActivas.has(tx.internalTransferSpaceId));
    const orphanIds = orphanedPersonalTransferIds(conciliables, "family", validMovementIds, true);
    const nombresPorFamilia = new Map(familias.map(item => [item.id, item.nombre]));
    const upserts = todosLosMovimientos.flatMap(item => {
      if (item.personalOwnerUid !== uid || item.personalTransactionId == null) return [];
      const esRetorno = item.tipo === "gasto" && (item.personalReturnAmount || 0) > 0;
      const familiaDelMovimiento = Object.entries(movimientosFamilias).find(([, items]) => items.some(movimiento => movimiento.id === item.id));
      const spaceId = familiaDelMovimiento?.[0] || "";
      const nombreFamilia = nombresPorFamilia.get(spaceId) || "Familia";
      const allocations = esRetorno
        ? linkedTransferLedger(familiaDelMovimiento?.[1] || [], uid).allocationsByReturnId.get(item.id) || []
        : undefined;
      const canonical = {
        id: item.personalTransactionId, type: esRetorno ? "income" as const : "expense" as const,
        amount: esRetorno ? item.personalReturnAmount! : item.monto, category: "otros", date: item.fecha,
        time: horaDe(item.creadoEn), method: "transfer",
        description: esRetorno ? t("family.returnFrom", { name: nombreFamilia }) : t("family.transferTo", { name: nombreFamilia }),
        notes: "", origin: "manual" as const, internalTransfer: "family" as const, internalTransferLink: item.id,
        internalTransferSpaceId: spaceId, internalTransferSpaceName: nombreFamilia,
        ...(allocations ? { internalTransferAllocations: allocations } : {}),
      };
      const current = transactions.find(tx => tx.id === item.personalTransactionId);
      // Un ID ya presente no basta: una versión antigua podía dejar una
      // contraparte incompleta. Solo se corrige si no representa este mismo
      // enlace y así se evita reescribir en cada render.
      if (current?.internalTransfer === "family"
        && current.internalTransferLink === item.id
        && current.type === canonical.type
        && current.amount === canonical.amount
        && current.internalTransferSpaceId === spaceId
        && current.internalTransferSpaceName === nombreFamilia
        && JSON.stringify(current.internalTransferAllocations || []) === JSON.stringify(allocations || [])) return [];
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
      void task.wait(() => vincularMovimientoPersonalFamilia(familia.id, item.id, personalId, uid))
        .then(() => {
          if (!task.current()) return;
          repairLinkedTransferTransactions([{
            id: personalId, type: "expense", amount: item.monto, category: "otros", date: item.fecha,
            time: horaDe(item.creadoEn), method: "transfer", description: t("family.transferTo", { name: familia.nombre }),
            notes: "", origin: "manual", internalTransfer: "family", internalTransferLink: item.id,
            internalTransferSpaceId: familia.id, internalTransferSpaceName: familia.nombre,
          }]);
          void recargar();
        })
        .catch(() => {
          legacyRepairIds.current.delete(item.id);
          if (task.current()) toastRef.current(tRef.current("family.connectionError"));
        });
    }
  }, [accountSession, accountUid, cargando, familia, familias, familiasSincronizadas, movimientos, movimientosFamilias, ocupado, owner, recargar, repairLinkedTransferTransactions, t, transactions]);

  async function ejecutar(action: (wait: FamilyActionWait) => Promise<void>, onError?: (error: unknown) => void) {
    if (actionLock.current) return;
    const task = captureAccountTask(accountUid, () => mounted.current && getAccountStorageSession() === accountSession);
    if (!task.current()) return;
    actionLock.current = true;
    setOcupado(true);
    let mutationRevision: number | undefined;
    async function guarded<T>(work: () => Promise<T>): Promise<T> {
      // Invalidar antes de enviar, no después de recibir: una lectura iniciada
      // antes del borrado no puede restaurarlo durante la espera del servidor.
      mutationRevision = ++reloadId.current;
      setFamiliasSincronizadas(false);
      try { return await task.wait(work); }
      finally {
        // También descartar una actualización manual/foco recibida mientras
        // el servidor aún estaba procesando la modificación.
        if (task.current()) {
          mutationRevision = ++reloadId.current;
          setFamiliasSincronizadas(false);
        }
      }
    }
    const wait = Object.assign(guarded, { reload: (preferred?: string) => task.wait(() => recargar(preferred)) });
    try { await action(wait); }
    catch (error) {
      if (!task.current()) return;
      if (onError) onError(error);
      else showToast(t(spaceErrorKey(error)));
    }
    finally {
      actionLock.current = false;
      if (task.current()) {
        setOcupado(false);
        if (mutationRevision !== undefined && mutationRevision === reloadId.current) void recargar();
      }
    }
  }

  const crear = () => ejecutar(async wait => {
    if (!isPremium) { irUnaVez("/premium"); return; }
    const issue = amountInputError(montoInicial, userCurrency);
    if (issue) { showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")); return; }
    const uid = auth.currentUser?.uid; const value = nombre.trim().slice(0, 35);
    const initial = parseAmountInput(montoInicial, userCurrency);
    const disponibleAlCrear = saldoPersonalEn(fechaHoy());
    if (!uid || !value || (origenInicial === "personal" && initial > disponibleAlCrear)) {
      if (origenInicial === "personal" && initial > disponibleAlCrear) showToast(t("family.notEnoughPersonal"));
      return;
    }
    const personalTransactionId = initial > 0 && origenInicial === "personal" ? nextId() : undefined;
    const movimientoInicial = initial > 0 ? {
      tipo: "ingreso" as const,
      monto: initial,
      descripcion: t(origenInicial === "personal" ? "family.initialFromPersonal" : "family.initialExternal"),
      fecha: fechaHoy(),
      method: origenInicial === "personal" ? "transfer" : "cash",
      ...(personalTransactionId != null ? { personalTransactionId, personalOwnerUid: uid } : {}),
    } : undefined;
    const nueva = await wait(() => crearFamilia(uid, userName || t("family.member"), value, userCurrency, movimientoInicial));
    if (personalTransactionId != null && nueva.movimientoInicialId) {
      addOrUpdateTransaction({
        id: personalTransactionId, type: "expense", amount: initial, category: "otros", date: fechaHoy(),
        time: horaDe(Date.now()), method: "transfer", description: t("family.transferTo", { name: value }),
        notes: "", origin: "manual", internalTransfer: "family", internalTransferLink: nueva.movimientoInicialId,
        internalTransferSpaceId: nueva.id, internalTransferSpaceName: value,
      });
    }
    setModo(null); setNombre(""); setMontoInicial(""); setOrigenInicial("externo"); setVerTodas(false); await wait.reload(nueva.id); showToast(t("family.created"));
  });

  const unir = () => ejecutar(async wait => {
    const uid = auth.currentUser?.uid;
    if (!uid || codigo.length !== 8) return;
    const nueva = await wait(() => unirseAFamilia(uid, userName || t("family.member"), codigo));
    setModo(null); setCodigo(""); setVerTodas(false); await wait.reload(nueva.id); showToast(t("family.joined"));
  });

  const invitar = () => ejecutar(async wait => {
    const uid = auth.currentUser?.uid; if (!uid || !familia || !owner) return;
    if (!isPremium) { irUnaVez("/premium"); return; }
    setInvitacion(await wait(() => crearInvitacionFamilia(uid, familia.id)));
  });
  const guardarNombreFamilia = () => {
    if (!familia || !owner || ocupado) return;
    const nombreNuevo = nombreFamiliaEditado.trim().slice(0, 35);
    if (!nombreNuevo) { showToast(t("family.nameRequired")); return; }
    if (nombreNuevo === familia.nombre) { setEditandoNombreFamilia(false); return; }
    void ejecutar(async wait => {
      await wait(() => renombrarFamilia(familia.id, nombreNuevo));
      const familiaActualizada = { ...familia, nombre: nombreNuevo };
      setFamilia(familiaActualizada);
      setFamilias(actuales => actuales.map(item => item.id === familia.id ? familiaActualizada : item));
      const uid = auth.currentUser?.uid;
      if (uid) {
        const cache = familiaEnMemoria.get(uid);
        if (cache?.familia?.id === familia.id) familiaEnMemoria.set(uid, { ...cache, familia: familiaActualizada });
      }
      setNombreFamiliaEditado(nombreNuevo);
      setEditandoNombreFamilia(false);
      showToast(t("family.renamed"));
    });
  };
  const quitarMiembro = (miembro: MiembroFamilia) => {
    if (!familia || !owner || miembro.rol === "owner") return;
    Alert.alert(t("family.removeMember"), miembro.nombre, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void ejecutar(async wait => {
        await wait(() => quitarMiembroFamilia(familia.id, miembro.uid));
        setMiembros(actuales => actuales.filter(item => item.uid !== miembro.uid));
      }) },
    ]);
  };
  const guardar = () => ejecutar(async wait => {
    const issue = amountInputError(monto, familia?.currency || userCurrency);
    if (issue) { showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")); return; }
    const uid = auth.currentUser?.uid; const value = parseAmountInput(monto, familia?.currency || userCurrency);
    if (!uid || !familia || !tipo || !(value > 0)) return;
    if (!validSpaceDate(movementDate)) { showToast(t("common.validDateYmd")); return; }
    const aporteEditado = editandoAporteId ? movimientos.find(item => item.id === editandoAporteId) : undefined;
    if (aporteEditado?.personalTransactionId != null) {
      const minimo = minimumContributionAmount(movimientos, aporteEditado, uid);
      if (value < minimo - 0.005) { showToast(t("family.contributionUsed")); return; }
      if (value - aporteEditado.monto > saldoPersonalEn(aporteEditado.fecha)) { showToast(t("family.notEnoughPersonal")); return; }
      await wait(() => actualizarAportePersonal("family", familia.id, aporteEditado.id, value, descripcion || aporteEditado.descripcion));
      const personal = transactions.find(tx => tx.id === aporteEditado.personalTransactionId);
      if (personal) addOrUpdateTransaction({ ...personal, amount: value }, true);
      setMonto(""); setDescripcion(""); setEditandoAporteId(null); setTipo(null); await wait.reload();
      return;
    }
    const desdePersonal = tipo === "ingreso" && owner && origenDinero === "personal";
    if (desdePersonal && familia.currency !== userCurrency) { showToast(t("spaces.currencyMismatch")); return; }
    if (desdePersonal && value > saldoPersonalEn(movementDate)) { showToast(t("family.notEnoughPersonal")); return; }
    if (tipo === "gasto" && !canSpendFromSpace(movimientos, value)) { showToast(t("family.notEnoughSpace")); return; }
    const personalTransactionId = desdePersonal ? nextId() : undefined;
    const movementId = await wait(() => guardarMovimientoFamilia(familia.id, uid, { tipo, monto: value, descripcion: descripcion.trim().slice(0, 60) || (tipo === "ingreso" ? t(desdePersonal ? "family.initialFromPersonal" : "family.externalMoney") : ""), ...(desdePersonal ? {} : { category }), notes: notes.trim(), fecha: movementDate, method: personalTransactionId != null ? "transfer" : method, ...(personalTransactionId != null ? { personalTransactionId, personalOwnerUid: uid } : {}) }));
    if (personalTransactionId != null) addOrUpdateTransaction({ id: personalTransactionId, type: "expense", amount: value, category: "otros", date: movementDate, time: horaDe(Date.now()), method: "transfer", description: t("family.transferTo", { name: familia.nombre }), notes: notes.trim(), origin: "manual", internalTransfer: "family", internalTransferLink: movementId, internalTransferSpaceId: familia.id, internalTransferSpaceName: familia.nombre });
    setMonto(""); setDescripcion(""); setNotes(""); setMovementDate(fechaHoy()); setOrigenDinero("externo"); setTipo(null); await wait.reload(); showToast(t("family.movementSaved"));
  });

  const devolverAPersonal = () => ejecutar(async wait => {
    const uid = auth.currentUser?.uid;
    if (!uid || !familia || devolvibleAPersonal <= 0) return;
    if (familia.currency !== userCurrency) { showToast(t("spaces.currencyMismatch")); return; }
    const receipt = await wait(() => devolverAportePersonal({ kind: "family", spaceId: familia.id, amount: devolvibleAPersonal,
      currency: userCurrency, fecha: fechaHoy(), description: t("family.returnToPersonal") }));
    if (!recordPersonalReturn(receipt)) return;
    await wait.reload();
  });
  const salir = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !familia || owner) return;
    const familyId = familia.id;
    Alert.alert(t("family.leave"), t("family.leaveWarning"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("family.leave"), style: "destructive", onPress: () => void ejecutar(async wait => {
        await wait(() => salirDeFamilia(uid, familyId));
        setFamilia(null); setMiembros([]); setMovimientos([]); setTipo(null); setInvitacion("");
        setVerTodas(true); await wait.reload(); showToast(t("family.left"));
      }) },
    ]);
  };
  const seleccionarFamilia = (item: EspacioFamilia) => {
    if (item.ownerUid !== auth.currentUser?.uid) {
      showToast(t("family.deleteOwnerOnly"));
      return;
    }
    setFamiliasSeleccionadas(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
  };
  const confirmarBorrarFamilias = () => {
    const actuales = familias.filter(item => familiasSeleccionadas.includes(item.id));
    const uid = auth.currentUser?.uid;
    if (!uid || !actuales.length) return;
    if (actuales.some(item => item.ownerUid !== uid)) {
      showToast(t("family.deleteOwnerOnly"));
      return;
    }
    if (actuales.some(item => !canCloseLinkedSpace(movimientosFamilias[item.id] || []))) {
      showToast(t("family.closeBalance"));
      return;
    }
    Alert.alert(t("family.deleteSelectedTitle"), t("family.deleteSelectedMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void ejecutar(async wait => {
        for (const item of actuales) {
          await wait(() => cerrarFamilia(uid, item.id));
          if (auth.currentUser?.uid !== uid) return;
          repairLinkedTransferTransactions(settlePersonalTransfers(transactions, "family", item.id));
        }
        setFamiliasSeleccionadas([]);
        setSeleccionandoFamilias(false);
        await wait.reload();
      }, error => {
        const code = (error as { code?: string })?.code;
        showToast(t(code === "functions/failed-precondition" ? "family.closeBalance" : spaceErrorKey(error)));
      }) },
    ]);
  };
  const cerrarFamiliaActiva = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !familia || !owner || ocupado) return;
    if (!canCloseLinkedSpace(movimientos)) { showToast(t("family.closeBalance")); return; }
    const familyId = familia.id;
    Alert.alert(t("family.close"), t("family.closeWarning"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("family.close"), style: "destructive", onPress: () => void ejecutar(async wait => {
        await wait(() => cerrarFamilia(uid, familyId));
        if (auth.currentUser?.uid !== uid) return;
        repairLinkedTransferTransactions(settlePersonalTransfers(transactions, "family", familyId));
        setFamilia(null); setMiembros([]); setMovimientos([]); setTipo(null); setInvitacion("");
        setVerTodas(true); await wait.reload(); showToast(t("family.closed"));
      }, error => {
        const code = (error as { code?: string })?.code;
        showToast(t(code === "functions/failed-precondition" ? "family.closeBalance" : spaceErrorKey(error)));
      }) },
    ]);
  };
  const borrarSeleccionados = (ids = seleccionados) => ejecutar(async wait => {
    if (!familia || !ids.length) return;
    const currentUid = auth.currentUser?.uid;
    const solicitados = movimientos.filter(item => ids.includes(item.id));
    const items = solicitados.filter(item => owner || item.creadoPor === currentUid);
    if (items.length !== solicitados.length) {
      showToast(t("family.onlyOwnDelete"));
      return;
    }
    const plan = planSpaceMovementDeletion(movimientos, ids);
    if (!plan.ok) {
      if (plan.reason === "empty") return;
      showToast(t(plan.reason === "contribution-used" ? "family.contributionUsed" : "family.notEnoughSpace"));
      return;
    }
    for (const item of plan.items) {
      if (item.personalTransactionId != null) await wait(() => borrarAportePersonal("family", familia.id, item.id));
      else await wait(() => borrarMovimientoFamilia(familia.id, item.id));
      if (item.personalOwnerUid === auth.currentUser?.uid && item.personalTransactionId != null) deleteLinkedTransferTransaction(item.personalTransactionId);
    }
    setSeleccionados([]); setSeleccionando(false); await wait.reload();
  });
  const confirmarBorrarTodo = () => {
    const currentUid = auth.currentUser?.uid;
    const borrables = owner ? visibles : visibles.filter(item => item.creadoPor === currentUid);
    if (!borrables.length) { showToast(t("family.onlyOwnDelete")); return; }
    const messageKey = borrables.some(isLinkedSpaceTransfer) ? "spaces.deleteLinkedMovementsMessage" : "spaces.deleteMovementsMessage";
    Alert.alert(t("spaces.deleteMovementsTitle"), t(messageKey, { count: borrables.length }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.deleteAll"), style: "destructive", onPress: () => void borrarSeleccionados(borrables.map(item => item.id)) },
    ]);
  };

  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center justify-between px-5 pb-3"><BackButton onPress={safeBack} /><Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("family.title")}</Text><TouchableOpacity accessibilityLabel={t("common.refresh")} onPress={() => void recargar()} className="h-10 w-10 items-center justify-center"><RefreshCw size={18} color="#64748b" /></TouchableOpacity></View>
    <SpaceSwitcher active="family" />
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
      <LegalAcceptancePanel />
      {cargando ? <Text className="py-8 text-center text-slate-500">{t("common.loading")}</Text> : !auth.currentUser ? <Text className="mt-6 text-center text-slate-600 dark:text-slate-300">{t("family.loginRequired")}</Text> : verTodas ? <>
        <Text className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t("family.listHelp")}</Text>
        <View className="mt-3 flex-row gap-3"><TouchableOpacity onPress={() => isPremium ? setModo("crear") : irUnaVez("/premium")} className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${isPremium ? "bg-emerald-600" : "bg-amber-500"}`}><Plus size={18} color="#fff" /><Text className="font-bold text-white">{isPremium ? t("family.create") : t("family.createPremium")}</Text></TouchableOpacity><TouchableOpacity onPress={() => setModo("unir")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-noche-2"><UserPlus size={18} color="#0d9488" /><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.join")}</Text></TouchableOpacity></View>
        {modo ? <View className="mt-3 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><TextInput disableFullscreenUI autoFocus value={modo === "crear" ? nombre : codigo} onChangeText={modo === "crear" ? setNombre : value => setCodigo(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8))} maxLength={modo === "crear" ? 35 : 8} placeholder={t(modo === "crear" ? "family.namePlaceholder" : "family.codePlaceholder")} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-slate-900 dark:text-slate-100" />{modo === "crear" ? <><TextInput disableFullscreenUI value={montoInicial} onChangeText={value => setMontoInicial(sanitizeSafeAmountInput(value, userCurrency))} keyboardType="decimal-pad" placeholder={t("family.initialAmount")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" /><View className="mt-2 flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenInicial(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenInicial === origin ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "family.fromPersonal" : "family.externalMoney")}</Text></TouchableOpacity>)}</View>{origenInicial === "personal" ? <Text className="mt-1 text-[11px] text-slate-500">{t("family.personalAvailable", { amount: fmt(disponible) })}</Text> : null}</> : null}<View className="mt-3 flex-row gap-2"><TouchableOpacity accessibilityLabel={t("common.cancel")} onPress={() => setModo(null)} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100"><X size={19} color="#64748b" /></TouchableOpacity><TouchableOpacity accessibilityLabel={t("common.save")} onPress={modo === "crear" ? crear : unir} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Check size={19} color="#fff" /></TouchableOpacity></View></View> : null}
        {familias.length > 0 ? <View className="mb-2 mt-4 flex-row items-center justify-between">
          {seleccionandoFamilias ? <>
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{familiasSeleccionadas.length} {t("family.selectedLabel")}</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity accessibilityLabel={t("family.deleteSelectedAccessibility")} disabled={!familiasSeleccionadas.length || ocupado} onPress={confirmarBorrarFamilias} className={`h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950 ${!familiasSeleccionadas.length || ocupado ? "opacity-40" : ""}`}><Trash2 size={19} color="#f43f5e" /></TouchableOpacity>
              <TouchableOpacity onPress={() => { setSeleccionandoFamilias(false); setFamiliasSeleccionadas([]); }} hitSlop={6}><Text className="text-sm font-bold text-emerald-600">{t("common.cancel")}</Text></TouchableOpacity>
            </View>
          </> : <>
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{t("family.all")}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.select")} onPress={() => { setSeleccionandoFamilias(true); setFamiliasSeleccionadas([]); }} className="min-h-10 flex-row items-center gap-1"><ListChecks size={18} color="#059669" /><Text className="text-[15px] font-bold text-emerald-600">{t("common.select")}</Text></TouchableOpacity>
          </>}
        </View> : null}
        <View className="mt-1 gap-2">{familias.map(item => {
          const selected = familiasSeleccionadas.includes(item.id);
          const puedeAdministrar = item.ownerUid === auth.currentUser?.uid;
          return <TouchableOpacity key={item.id} onPress={() => seleccionandoFamilias ? seleccionarFamilia(item) : (setFamilia(item), setVerTodas(false), void recargar(item.id))} className={`min-h-[78px] flex-row rounded-2xl border-[1.5px] px-3 py-2 ${selected ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"} ${seleccionandoFamilias && !puedeAdministrar ? "opacity-50" : ""}`}><View className="w-10 items-center justify-center"><View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900"><UsersRound size={21} color="#059669" /></View></View><View className="ml-2 flex-1 justify-center"><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} className="text-[16px] font-extrabold leading-5 text-slate-900 dark:text-slate-100">{item.nombre}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} className="mt-0.5 text-[17px] font-extrabold leading-5 text-emerald-700 dark:text-emerald-300">{fmtFamiliaLista(saldosFamilias[item.id] ?? 0, item.currency)}</Text></View><View className="w-9 items-center justify-center">{seleccionandoFamilias ? selected ? <Check size={21} color="#0d9488" strokeWidth={3} /> : <View className="h-5 w-5 rounded-full border-2 border-slate-400" /> : <ArrowLeftRight size={20} color="#059669" />}</View></TouchableOpacity>;
        })}</View>
        {!familias.length && !modo ? <Text className="py-8 text-center text-sm text-slate-500">{t("family.empty")}</Text> : null}
      </> : !familia ? <>
        <View className="mt-3 items-center rounded-3xl border-[1.5px] border-emerald-200 bg-emerald-50 px-5 py-6 dark:border-emerald-800 dark:bg-emerald-950/30"><View className="h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600"><UsersRound size={27} color="#fff" /></View><Text className="mt-3 text-center text-lg font-extrabold text-slate-900 dark:text-slate-100">{t("family.startTitle")}</Text><Text className="mt-1 text-center text-sm leading-5 text-slate-600 dark:text-slate-300">{t("family.startBody")}</Text></View>
        <View className="mt-4 flex-row gap-3"><TouchableOpacity onPress={() => isPremium ? setModo("crear") : irUnaVez("/premium")} className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${isPremium ? "bg-emerald-600" : "bg-amber-500"}`}><Plus size={18} color="#fff" /><Text className="font-bold text-white">{isPremium ? t("family.create") : t("family.createPremium")}</Text></TouchableOpacity><TouchableOpacity onPress={() => setModo("unir")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-noche-2"><UserPlus size={18} color="#0d9488" /><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.join")}</Text></TouchableOpacity></View>
        {modo ? <View className="mt-4 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><TextInput disableFullscreenUI autoFocus value={modo === "crear" ? nombre : codigo} onChangeText={modo === "crear" ? setNombre : value => setCodigo(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8))} maxLength={modo === "crear" ? 35 : 8} autoCapitalize={modo === "crear" ? "sentences" : "characters"} placeholder={t(modo === "crear" ? "family.namePlaceholder" : "family.codePlaceholder")} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-slate-900 dark:text-slate-100" />{modo === "crear" ? <><TextInput disableFullscreenUI value={montoInicial} onChangeText={value => setMontoInicial(sanitizeSafeAmountInput(value, userCurrency))} keyboardType="decimal-pad" placeholder={t("family.initialAmount")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" /><Text className="mb-1 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("family.moneyOrigin")}</Text><View className="flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenInicial(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenInicial === origin ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "family.fromPersonal" : "family.externalMoney")}</Text></TouchableOpacity>)}</View>{origenInicial === "personal" ? <Text className="mt-1 text-[11px] text-slate-500">{t("family.personalAvailable", { amount: fmt(disponible) })}</Text> : null}</> : null}<View className="mt-3 flex-row gap-2"><TouchableOpacity accessibilityLabel={t("common.cancel")} onPress={() => { setModo(null); setMontoInicial(""); }} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><X size={19} color="#64748b" /></TouchableOpacity><TouchableOpacity accessibilityLabel={t("common.save")} onPress={modo === "crear" ? crear : unir} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Check size={19} color="#fff" /></TouchableOpacity></View></View> : null}
      </> : <>
        <View className="mt-2 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => { setVerTodas(true); setModo(null); }} className="flex-row items-center gap-1 rounded-xl px-1 py-2">
            <ArrowLeftRight size={16} color="#059669" />
            <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t("family.all")}</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t("family.members")}: ${miembros.length}`} onPress={() => setVerMiembros(true)} className="h-10 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 dark:bg-emerald-950">
              <UsersRound size={17} color="#059669" />
              <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t("family.members")}</Text>
              <Text className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">{miembros.length}</Text>
            </TouchableOpacity>
            {owner ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("family.inviteAccessibility")} disabled={ocupado} onPress={() => void invitar()} className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950">
              <UserPlus size={19} color="#059669" />
            </TouchableOpacity> : null}
          </View>
        </View>
        <View className="mt-2 rounded-3xl bg-emerald-600 px-4 py-3">
          <View className="flex-row items-center gap-2">
            {editandoNombreFamilia && owner ? <>
              <TextInput disableFullscreenUI autoFocus editable={!ocupado} value={nombreFamiliaEditado} onChangeText={setNombreFamiliaEditado} onSubmitEditing={guardarNombreFamilia} returnKeyType="done" maxLength={35} selectTextOnFocus placeholder={t("family.namePlaceholder")} placeholderTextColor="#a7f3d0" className="h-9 min-w-0 flex-1 rounded-xl bg-emerald-700/70 px-3 text-base font-bold text-white" />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.save")} disabled={ocupado} onPress={guardarNombreFamilia} className="h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Check size={18} color="#fff" /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.cancel")} disabled={ocupado} onPress={() => { setEditandoNombreFamilia(false); setNombreFamiliaEditado(familia.nombre); }} className="h-9 w-9 items-center justify-center rounded-xl bg-white/20"><X size={17} color="#fff" /></TouchableOpacity>
            </> : <>
              <Text numberOfLines={1} className="flex-1 text-base font-bold text-emerald-100">{familia.nombre}</Text>
              {owner ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("family.editName")} disabled={ocupado} onPress={() => { setNombreFamiliaEditado(familia.nombre); setEditandoNombreFamilia(true); }} className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-700">
                <Pencil size={16} color="#fff" />
              </TouchableOpacity> : null}
            </>}
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58} className="text-[26px] font-extrabold leading-8 text-white">{fmtFamilia(saldo)}</Text>
          <Text className="text-xs leading-4 text-emerald-100">{t("family.sharedBalance")}</Text>
        </View>
        {devolvibleAPersonal > 0 ? <TouchableOpacity disabled={ocupado} onPress={() => void devolverAPersonal()} className="mt-2 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.returnAmount", { amount: fmtFamilia(devolvibleAPersonal) })}</Text></TouchableOpacity> : null}
        <View className={`mt-2 flex-row ${owner ? "justify-between" : ""}`}>
          <TouchableOpacity style={{ width: owner ? "48%" : "100%", height: 40 }} accessibilityRole="button" disabled={ocupado} onPress={() => { setMonto(""); setDescripcion(""); setNotes(""); setOrigenDinero("externo"); setCategory("salario"); setMovementDate(fechaHoy()); setMethod("cash"); setTipo("ingreso"); }} className="flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2">
            <Plus size={16} color="#fff" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-[13px] font-extrabold text-white">{t("boxes.addMoney")}</Text>
          </TouchableOpacity>
          {owner ? <TouchableOpacity style={{ width: "48%", height: 40 }} accessibilityRole="button" accessibilityLabel={t("family.close")} disabled={ocupado} onPress={cerrarFamiliaActiva} className="flex-row items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 dark:border-rose-900 dark:bg-rose-950">
            <X size={15} color="#e11d48" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-[13px] font-extrabold text-rose-700 dark:text-rose-300">{t("family.close")}</Text>
          </TouchableOpacity> : null}
        </View>
        <SpaceOverviewTotals income={resumen.ingresos} expense={resumen.gastos} filter={filter} onFilter={setFilter} format={fmtFamilia} />
        <SpaceMovementSheet visible={Boolean(tipo)} type={tipo} onType={next => { setTipo(next); setCategory(next === "ingreso" ? "salario" : "otros"); }} onClose={() => setTipo(null)} onSave={() => void guardar()} amount={monto} onAmount={value => setMonto(sanitizeSafeAmountInput(value, familia?.currency || userCurrency))} description={descripcion} onDescription={setDescripcion} method={method} onMethod={setMethod} currency={familia?.currency || userCurrency} category={category} onCategory={setCategory} date={movementDate} onDate={setMovementDate} notes={notes} onNotes={setNotes} origin={owner ? origenDinero : undefined} onOrigin={owner ? setOrigenDinero : undefined} availableText={owner ? t("family.personalAvailable", { amount: fmt(disponible) }) : undefined} disabled={ocupado} />
        <View className={`mb-2 mt-5 ${seleccionando ? "flex-row items-center justify-between" : "flex-row items-center gap-1"}`}>
          {seleccionando ? <>
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{filasSeleccionadas} {filasSeleccionadas === 1 ? "seleccionado" : "seleccionados"}</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity accessibilityLabel={t("common.deleteSelected")} disabled={!seleccionados.length || ocupado} onPress={() => void borrarSeleccionados()} className={`h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950 ${!seleccionados.length || ocupado ? "opacity-40" : ""}`}><Trash2 size={19} color="#f43f5e" /></TouchableOpacity>
              <TouchableOpacity onPress={confirmarBorrarTodo} hitSlop={6}><Text className="text-sm font-bold text-rose-500">{t("home.deleteAll")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setSeleccionando(false); setSeleccionados([]); }} hitSlop={6}><Text className="text-sm font-bold text-emerald-600">{t("common.cancel")}</Text></TouchableOpacity>
            </View>
          </> : <>
            <MovementAllButton label={t("family.history")} activeFilter={filter !== null} onPress={() => setFilter(null)} />
            <View className="flex-row items-center gap-1">
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("family.filterIncome")} accessibilityState={{ selected: filter === "ingreso" }} onPress={() => setFilter("ingreso")} className={`h-10 w-10 items-center justify-center rounded-xl ${filter === "ingreso" ? "bg-emerald-200" : "bg-emerald-50"}`}><ArrowUp size={19} color="#047857" strokeWidth={2.6} /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("family.filterExpense")} accessibilityState={{ selected: filter === "gasto" }} onPress={() => setFilter("gasto")} className={`h-10 w-10 items-center justify-center rounded-xl ${filter === "gasto" ? "bg-rose-200" : "bg-rose-50"}`}><ArrowDown size={19} color="#be123c" strokeWidth={2.6} /></TouchableOpacity>
            </View>
            <TouchableOpacity accessibilityLabel={t("family.selectMovements")} onPress={() => { setSeleccionando(true); setSeleccionados([]); }} className="min-h-10 flex-row items-center gap-1 px-1"><ListChecks size={18} color="#059669" /><Text className="text-[15px] font-bold text-emerald-600">{t("common.select")}</Text></TouchableOpacity>
          </>}
        </View>
        {filasVisibles.length === 0 ? <Text className="py-5 text-center text-sm text-slate-500">{t(filter ? "spaces.noResults" : "family.noMovements")}</Text> : filasVisibles.slice(0, movementLimit).map(({ key, item, transferGroup }) => {
          const transferencia = isLinkedSpaceTransfer(item);
          const retorno = isLinkedSpaceReturn(item);
          const idsDeFila = movementIdsForCompactRow({ key, item, transferGroup }, visibles);
          const filaSeleccionada = idsDeFila.length > 0 && idsDeFila.every(id => seleccionados.includes(id));
          return <TouchableOpacity key={key} disabled={!seleccionando} accessible={seleccionando} accessibilityRole={seleccionando ? "checkbox" : undefined} accessibilityState={{ checked: filaSeleccionada, disabled: !seleccionando }} onPress={() => setSeleccionados(prev => filaSeleccionada ? prev.filter(id => !idsDeFila.includes(id)) : [...new Set([...prev, ...idsDeFila])])} className={`mb-2 flex-row items-center rounded-2xl border-[1.5px] p-3 dark:border-noche-borde ${filaSeleccionada ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200"}`}>
            <View className={`h-9 w-9 items-center justify-center rounded-xl ${transferencia ? "bg-blue-100 dark:bg-blue-950" : item.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"}`}>{transferencia ? <ArrowRightLeft size={17} color="#2563eb" /> : item.tipo === "ingreso" ? <ArrowUp size={17} color="#047857" /> : <ArrowDown size={17} color="#be123c" />}</View>
            {transferencia ? <View className="ml-3 flex-1"><SpaceTransferAmounts title={familia.nombre} sentLabel={t("boxes.receivedFromPersonal")} returnedLabel={t("boxes.returnedToPersonal")} sent={transferGroup?.sent ?? (retorno ? 0 : item.monto)} returned={transferGroup?.returned ?? (retorno ? item.monto : 0)} format={fmtFamilia} /></View> : <><View className="ml-3 flex-1"><Text numberOfLines={1} className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{item.descripcion || t(item.tipo === "ingreso" ? "boxes.income" : "boxes.expense")}</Text><Text className="text-xs text-slate-500">{item.fecha}{item.method ? ` · ${methodLabel(item.method, t)}` : ""}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className={`mr-1 max-w-[38%] text-[15px] font-extrabold ${item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>{item.tipo === "ingreso" ? "+" : "-"}{fmtFamilia(item.monto)}</Text></>}
            {!seleccionando ? <ContentReportButton key={`${familia.id}:${item.id}`} target={transferencia
              ? { kind: "family", spaceId: familia.id, targetType: "space", targetId: familia.id, expectedText: familia.nombre.slice(0, 120), expectedUid: familia.ownerUid }
              : { kind: "family", spaceId: familia.id, targetType: "movement", targetId: item.id, expectedText: item.descripcion.slice(0, 120), expectedUid: item.creadoPor }} /> : null}
            {seleccionando ? <View className={`ml-2 h-5 w-5 rounded-full border-2 ${filaSeleccionada ? "border-teal-600 bg-teal-600" : "border-slate-400"}`} /> : null}
          </TouchableOpacity>;
        })}
        {!owner ? <TouchableOpacity disabled={ocupado} onPress={salir} className="mt-3 min-h-11 flex-row items-center justify-center gap-2"><LogOut size={17} color="#e11d48" /><Text className="font-bold text-rose-600">{t("family.leave")}</Text></TouchableOpacity> : null}
      </>}
    </ScrollView>
    <SpaceInvitationSheet code={invitacion} visible={Boolean(invitacion)} onClose={() => setInvitacion("")} />
    {familia ? <SpaceMembersSheet familyName={familia.nombre} members={miembros} visible={verMiembros} canManage={owner} onRemove={quitarMiembro} onClose={() => setVerMiembros(false)} reportSpace={{ kind: "family", spaceId: familia.id, ownerUid: familia.ownerUid }} /> : null}
  </View>;
}
