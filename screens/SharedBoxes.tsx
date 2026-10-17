import { SpaceOverviewTotals, type MovementFilter } from "@/components/SpaceMovementControls";
import SpaceMovementSheet from "@/components/SpaceMovementSheet";
import { validSpaceDate } from "@/components/SpaceMovementFields";
import SpaceTransferAmounts from "@/components/SpaceTransferAmounts";
import MovementDateHeader from "@/components/MovementDateHeader";
import { movementRowsByDay, startsMovementDay, linkedMovementRowTime } from "@/utils/movementDates";
import SpaceInvitationSheet from "@/components/SpaceInvitationSheet";
import SpaceMembersSheet from "@/components/SpaceMembersSheet";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import MovementAllButton from "@/components/MovementAllButton";
import ContentReportButton from "@/components/ContentReportButton";
import { methodLabel } from "@/constants/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";
import LegalAcceptancePanel from "@/components/LegalAcceptancePanel";
import { fmt as formatAmount, horaDe } from "@/utils/format";
import { currencySymbolFor } from "@/constants/currencies";
import { auth } from "@/utils/firebase";
import { irUnaVez } from "@/utils/nav";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { disponiblePersonalEnFecha } from "@/utils/finances";
import { nextId } from "@/utils/id";
import { spaceErrorKey } from "@/utils/spaceErrors";
import { availableRecentMovementTypes } from "@/utils/recentMovementFilters";
import { balanceOfSpace, canCloseLinkedSpace, canSpendFromSpace, canUndoContribution, compactLinkedTransferRows, isLinkedSpaceReturn, isLinkedSpaceTransfer, linkedTransferLedger, minimumContributionAmount, movementIdsForCompactRow, orphanedPersonalTransferIds, planSpaceMovementDeletion, returnableToPersonal, settlePersonalTransfers } from "@/utils/linkedTransfers";
import { captureAccountTask, type AccountTaskWait } from "@/utils/accountTask";
import { getAccountStorageSession } from "@/utils/storage";
import { beginFamilyMutation, familyMutationPending, familyMutationVersion, observeFamilyMutation } from "@/utils/familyMutation";
import { withImmediateRemoval } from "@/utils/immediateRemoval";
import { spaceDeletionNotice } from "@/utils/spaceDeletionNotice";
import { actualizarAportePersonal, borrarAportePersonal } from "@/utils/personalContribution";
import { devolverAportePersonal } from "@/utils/personalReturn";
import { ArrowDown, ArrowLeftRight, ArrowRightLeft, ArrowUp, Check, ListChecks, LogOut, Pencil, Plus, RefreshCw, Trash2, UserPlus, UsersRound, X } from "lucide-react-native";
import { borrarMovimientoCajaCompartida, cerrarCajaCompartida, confirmarCajaAbierta, crearInvitacionCaja, escucharMovimientosCaja, guardarMovimientoCajaCompartida, listarMiembrosCaja, observarCierreCaja, quitarMiembroCaja, renombrarCajaCompartida, salirDeCaja, type CajaCompartida, type MiembroCajaCompartida, type MovimientoCajaCompartida } from "@/utils/cloudCajasCompartidas";

type SharedBoxesProps = { initialBox: CajaCompartida; initialInvitation?: string; onAllBoxes: (removedId?: string) => void };
const fechaHoy = () => new Date().toLocaleDateString("sv-SE");

export default function SharedBoxes(props: SharedBoxesProps) {
  useAppData();
  const uid = auth.currentUser?.uid ?? "";
  return <SharedBoxesForAccount key={`${uid}:${getAccountStorageSession()}:${props.initialBox.id}`} uid={uid} {...props} />;
}

function SharedBoxesForAccount({ uid, initialBox, initialInvitation, onAllBoxes }: SharedBoxesProps & { uid: string }) {
  const { t, monthNames, userCurrency, isPremium, showToast, budgets, carryoverCleared, transactions, recordPersonalReturn, deleteLinkedTransferTransaction, repairLinkedTransferTransactions } = useAppData();
  const saldoPersonalEn = (fecha: string) => disponiblePersonalEnFecha(fecha, budgets, transactions, carryoverCleared);
  const insets = useSafeAreaInsets();
  const [caja, setCaja] = useState<CajaCompartida | null>(initialBox);
  const [editandoNombreCaja, setEditandoNombreCaja] = useState(false);
  const [nombreCajaEditado, setNombreCajaEditado] = useState("");
  const [movimientos, setMovimientos] = useState<MovimientoCajaCompartida[]>([]);
  const [miembros, setMiembros] = useState<MiembroCajaCompartida[]>([]);
  const [modo, setModo] = useState<"ingreso" | "gasto" | null>(null);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("salario");
  const [movementDate, setMovementDate] = useState(fechaHoy());
  const [notes, setNotes] = useState("");
  const [origenDinero, setOrigenDinero] = useState<"externo" | "personal">("externo");
  const pendingDebit = useRef<{ confirm: () => Promise<boolean> } | null>(null);
  const [filter, setFilter] = useState<MovementFilter>(null);
  const [seleccionando, setSeleccionando] = useState(false);
  const [movementLimit, setMovementLimit] = useState(60);
  const [invitacion, setInvitacion] = useState(initialInvitation ?? "");
  const [invitacionVisible, setInvitacionVisible] = useState(Boolean(initialInvitation));
  const [preparandoInvitacion, setPreparandoInvitacion] = useState(false);
  const [verMiembros, setVerMiembros] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actualizandoCaja, setActualizandoCaja] = useState(false);
  const [cajasOcultas, setCajasOcultas] = useState(new Set<string>());
  const [movimientosOcultos, setMovimientosOcultos] = useState(new Set<string>());
  const [cargandoCaja, setCargandoCaja] = useState(true);
  const [errorCargaCaja, setErrorCargaCaja] = useState(false);
  const borradosConfirmados = useRef(new Map<string, Set<string>>());
  const [editandoAporteId, setEditandoAporteId] = useState<string | null>(null);
  const modoSuspendido = useRef<"ingreso" | "gasto" | null>(null);
  const lock = useRef(false);
  const moneyLock = useRef(false);
  const cierresPendientes = useRef(new Set<string>());
  const cierresConfirmados = useRef(new Set<string>());
  const accountSession = useRef(getAccountStorageSession()).current;
  const mounted = useRef(true);
  const selectedBoxId = useRef(caja?.id);
  const cajaId = caja?.id;
  const cajaLista = !!caja && !cargandoCaja && !errorCargaCaja;
  selectedBoxId.current = caja?.id;
  const movementEpoch = useRef(0);
  const confirmedSource = useRef<{ boxId: string; epoch: number } | null>(null);
  const loadedBoxId = useRef<string | undefined>(undefined);
  const [movimientosConfirmados, setMovimientosConfirmados] = useState(false);
  const [subscriptionRevision, setSubscriptionRevision] = useState(0);
  useEffect(() => {
    mounted.current = true;
    const pending = cierresPendientes.current, confirmed = cierresConfirmados.current;
    return () => { mounted.current = false; movementEpoch.current += 1; pending.clear(); confirmed.clear(); };
  }, []);
  const errorRef = useRef((error?: unknown) => {});
  errorRef.current = (error?: unknown) => showToast(t(error instanceof Error && error.message === "personal-save-failed"
    ? "settings.backupMovementConflict" : spaceErrorKey(error)));
  const moneda = caja?.currency || userCurrency;
  const fmt = (amount: number) => formatAmount(amount, currencySymbolFor(moneda), moneda);
  useEffect(() => observeFamilyMutation(uid, accountSession, () => {
    if (!mounted.current || getAccountStorageSession() !== accountSession) return;
    confirmedSource.current = null;
    setMovimientosConfirmados(false);
    setActualizandoCaja(false);
    setSubscriptionRevision(value => value + 1);
  }, "box"), [uid, accountSession]);
  useEffect(() => {
    const epoch = ++movementEpoch.current;
    confirmedSource.current = null;
    setMovimientosConfirmados(false);
    if (!cajaId || familyMutationPending(uid, accountSession, "box")) return;
    // Actualizar la misma Caja conserva sus filas; otra Caja nunca las hereda.
    if (loadedBoxId.current !== cajaId) { setMovimientos([]); setMiembros([]); setCargandoCaja(true); }
    setErrorCargaCaja(false);
    const boxId = cajaId;
    let active = true, snapshotRevision = 0;
    const moneyVersion = familyMutationVersion(uid, accountSession, "box");
    const task = captureAccountTask(uid, () => mounted.current && active && getAccountStorageSession() === accountSession
      && movementEpoch.current === epoch && selectedBoxId.current === boxId
      && moneyVersion === familyMutationVersion(uid, accountSession, "box") && !familyMutationPending(uid, accountSession, "box"));
    void task.wait(() => listarMiembrosCaja(boxId)).then(items => {
      if (task.current()) setMiembros(items);
    }).catch(error => { if (task.current()) errorRef.current(error); });
    const stop = escucharMovimientosCaja(boxId, (items, confirmado) => {
      if (!task.current()) return;
      const revision = ++snapshotRevision;
      loadedBoxId.current = boxId;
      confirmedSource.current = null;
      const borrados = borradosConfirmados.current.get(boxId);
      const visibles = items.filter(item => !borrados?.has(item.id));
      if (confirmado && borrados) for (const id of borrados) {
        if (!items.some(item => item.id === id)) borrados.delete(id);
      }
      setMovimientosConfirmados(false); setMovimientos(visibles); setCargandoCaja(false); setErrorCargaCaja(false);
      if (!confirmado || moneyLock.current) return;
      void task.wait(() => confirmarCajaAbierta(boxId)).then(abierta => {
        if (!task.current() || revision !== snapshotRevision || moneyLock.current || !abierta) return;
        confirmedSource.current = { boxId, epoch };
        setMovimientosConfirmados(true);
        setActualizandoCaja(false);
      }).catch(error => { if (task.current() && revision === snapshotRevision) { setActualizandoCaja(false); errorRef.current(error); } });
    }, error => {
      if (!task.current()) return;
      snapshotRevision += 1; confirmedSource.current = null;
      setMovimientosConfirmados(false); setCargandoCaja(false); setActualizandoCaja(false); setErrorCargaCaja(loadedBoxId.current !== boxId); errorRef.current(error);
    });
    return () => { active = false; stop(); };
  }, [accountSession, cajaId, subscriptionRevision, uid]);
  useEffect(() => setMovementLimit(60), [caja?.id, filter]);
  useEffect(() => { setVerMiembros(false); setSeleccionando(false); }, [caja?.id]);
  useEffect(() => { if (!caja) onAllBoxes(initialBox.id); }, [initialBox, caja, onAllBoxes]);
  useEffect(() => {
    setEditandoNombreCaja(false);
    setNombreCajaEditado(caja?.nombre ?? "");
  }, [caja?.id, caja?.nombre]);
  useEffect(() => {
    if (!cajaId) return;
    const boxId = cajaId;
    let active = true;
    const task = captureAccountTask(uid, () => mounted.current && active && selectedBoxId.current === boxId && getAccountStorageSession() === accountSession);
    const stop = observarCierreCaja(boxId, () => {
      if (!task.current()) return;
      if (cierresPendientes.current.has(boxId)) return;
      movementEpoch.current += 1; confirmedSource.current = null;
      setCaja(null); setMovimientos([]); setMiembros([]);
    }, error => { if (task.current()) errorRef.current(error); });
    return () => { active = false; stop(); };
  }, [accountSession, cajaId, uid]);
  const ingresos = movimientos.filter(item => !isLinkedSpaceTransfer(item) && item.tipo === "ingreso").reduce((sum, item) => sum + item.monto, 0);
  const gastos = movimientos.filter(item => !isLinkedSpaceTransfer(item) && item.tipo === "gasto").reduce((sum, item) => sum + item.monto, 0);
  const transferLedger = useMemo(() => linkedTransferLedger(movimientos), [movimientos]);
  const visibles = movimientos.filter(item => !filter
    || (filter === "transferencia" ? isLinkedSpaceTransfer(item) : !isLinkedSpaceTransfer(item) && item.tipo === filter));
  const recentMovementTypes = availableRecentMovementTypes(movimientos);
  const filasVisibles = movementRowsByDay(visibles.filter(item => !movimientosOcultos.has(item.id)), item => item.fecha, dayItems => filter
    ? dayItems.map(item => ({ key: `movement:${item.id}`, item, transferGroup: undefined }))
    : compactLinkedTransferRows(dayItems));
  const owner = caja?.ownerUid === uid;
  const saldo = movimientos.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0);
  const devolvibleAPersonal = returnableToPersonal(movimientos, uid);
  useEffect(() => {
    const source = confirmedSource.current;
    if (!caja || !uid || !movimientosConfirmados || moneyLock.current || !mounted.current
      || auth.currentUser?.uid !== uid || getAccountStorageSession() !== accountSession
      || familyMutationPending(uid, accountSession, "box")
      || source?.boxId !== caja.id || source.epoch !== movementEpoch.current) return;
    const validMovementIds = movimientos.filter(item => item.personalOwnerUid === uid && item.personalTransactionId != null).map(item => item.id);
    const conciliables = transactions.filter(tx => !tx.internalTransferSettled && tx.internalTransferSpaceId === caja.id);
    const orphanIds = orphanedPersonalTransferIds(conciliables, "box", validMovementIds, true);
    const upserts = movimientos.flatMap(item => {
      if (item.personalOwnerUid !== uid || item.personalTransactionId == null) return [];
      const esRetorno = item.tipo === "gasto" && (item.personalReturnAmount || 0) > 0;
      const allocations = esRetorno ? transferLedger.allocationsByReturnId.get(item.id) || [] : undefined;
      const canonical = { id: item.personalTransactionId, type: esRetorno ? "income" as const : "expense" as const, amount: esRetorno ? item.personalReturnAmount! : item.monto, category: "otros", date: item.fecha, time: horaDe(item.creadoEn), method: "transfer", description: esRetorno ? t("boxes.returnFrom", { name: caja.nombre }) : t("boxes.transferTo", { name: caja.nombre }), notes: "", origin: "manual" as const, internalTransfer: "box" as const, internalTransferLink: item.id, internalTransferSpaceId: caja.id, internalTransferSpaceName: caja.nombre, ...(allocations ? { internalTransferAllocations: allocations } : {}) };
      const current = transactions.find(tx => tx.id === item.personalTransactionId);
      if (current?.internalTransfer === "box" && current.internalTransferLink === item.id
        && current.type === canonical.type && current.amount === canonical.amount
        && current.internalTransferSpaceId === caja.id && current.internalTransferSpaceName === caja.nombre
        && JSON.stringify(current.internalTransferAllocations || []) === JSON.stringify(allocations || [])) return [];
      return [canonical];
    });
    if (upserts.length || orphanIds.length) repairLinkedTransferTransactions(upserts, orphanIds);
  }, [accountSession, caja, movimientos, movimientosConfirmados, repairLinkedTransferTransactions, t, transactions, transferLedger, uid]);
  function limpiar() {
    modoSuspendido.current = null; setModo(null); setNombre(""); setMonto("");
    setEditandoAporteId(null); setNotes(""); setCategory("salario"); setMovementDate(fechaHoy()); setOrigenDinero("externo"); setMethod("cash");
  }
  function volverACajas() {
    if (lock.current) return;
    onAllBoxes();
  }
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (lock.current) return true;
      if (invitacionVisible) { setInvitacionVisible(false); setInvitacion(""); }
      else if (verMiembros) setVerMiembros(false);
      else if (modo) limpiar();
      else onAllBoxes();
      return true;
    });
    return () => subscription.remove();
  }, [onAllBoxes, invitacionVisible, verMiembros, modo]));
  async function ejecutar(action: (wait: AccountTaskWait) => Promise<void>, financial = true) {
    if (lock.current) return;
    const task = captureAccountTask(uid, () => mounted.current && getAccountStorageSession() === accountSession);
    if (!task.current()) return;
    lock.current = true; setBusy(true);
    let started = false;
    let finishMutation: (() => void) | undefined;
    const wait: AccountTaskWait = work => {
      if (!started && financial) {
        finishMutation = beginFamilyMutation(uid, accountSession, "box");
        started = true; moneyLock.current = true; movementEpoch.current += 1; confirmedSource.current = null;
        setMovimientosConfirmados(false);
      }
      return task.wait(work);
    };
    try { await action(wait); } catch (error) { if (task.current()) errorRef.current(error); }
    finally {
      finishMutation?.();
      moneyLock.current = false; lock.current = false;
      if (task.current()) {
        setBusy(false);
        if (started && !cierresPendientes.current.size) setSubscriptionRevision(value => value + 1);
      }
    }
  }
  const invitar = () => ejecutar(async wait => {
    if (!uid || !caja || !owner) return;
    if (!isPremium) { irUnaVez("/premium"); return; }
    // Plegar siempre la edición. Si falla la petición no reabrir el formulario:
    // el borrador queda guardado en estado y el usuario decide si lo recupera.
    if (modo === "ingreso" || modo === "gasto") modoSuspendido.current = modo;
    setModo(null);
    setEditandoNombreCaja(false);
    setSeleccionando(false);
    setInvitacion(""); setInvitacionVisible(true); setPreparandoInvitacion(true);
    // Crear un código no modifica movimientos: no vaciar ni recargar su lista.
    try { setInvitacion(await wait(() => crearInvitacionCaja(uid, caja.id))); }
    catch (error) { setInvitacionVisible(false); throw error; }
    finally { setPreparandoInvitacion(false); }
  }, false);
  const guardar = () => ejecutar(async wait => {
    if (!uid) return;
    if (pendingDebit.current) {
      if (!await wait(pendingDebit.current.confirm)) throw new Error("personal-save-failed");
      pendingDebit.current = null; limpiar(); return;
    }
    if (caja && (modo === "ingreso" || modo === "gasto")) {
      const issue = amountInputError(monto, moneda);
      if (issue) { showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")); return; }
      const valor = parseAmountInput(monto, moneda); if (valor <= 0) return;
      if (!validSpaceDate(movementDate)) { showToast(t("common.validDateYmd")); return; }
      const aporteEditado = editandoAporteId ? movimientos.find(item => item.id === editandoAporteId) : undefined;
      if (aporteEditado?.personalTransactionId != null) {
        const minimo = minimumContributionAmount(movimientos, aporteEditado, uid);
        if (valor < minimo - 0.005) { showToast(t("boxes.contributionUsed")); return; }
        if (valor - aporteEditado.monto > saldoPersonalEn(aporteEditado.fecha)) { showToast(t("boxes.notEnoughPersonal")); return; }
        await wait(() => actualizarAportePersonal("box", caja.id, aporteEditado.id, valor, nombre || aporteEditado.descripcion));
        const personal = transactions.find(tx => tx.id === aporteEditado.personalTransactionId);
        if (personal && !await wait(() => repairLinkedTransferTransactions([{ ...personal, amount: valor }]))) throw new Error("personal-save-failed");
        setEditandoAporteId(null); limpiar(); return;
      }
      if (modo === "gasto" && !canSpendFromSpace(movimientos, valor)) { showToast(t("boxes.notEnoughSpace")); return; }
      const desdePersonal = modo === "ingreso" && owner && origenDinero === "personal";
      if (desdePersonal && moneda !== userCurrency) { showToast(t("spaces.currencyMismatch")); return; }
      if (desdePersonal && valor > saldoPersonalEn(movementDate)) { showToast(t("boxes.notEnoughPersonal")); return; }
      const personalTransactionId = desdePersonal ? nextId() : undefined;
      const movementId = await wait(() => guardarMovimientoCajaCompartida(caja.id, uid, {
        tipo: modo, monto: valor, descripcion: nombre.trim().slice(0, 60), fecha: movementDate,
        ...(desdePersonal ? {} : { category }), notes: notes.trim(), method: desdePersonal ? "transfer" : method,
        ...(personalTransactionId != null ? { personalTransactionId, personalOwnerUid: uid } : {}),
      }));
      if (personalTransactionId != null) {
        const debit = { id: personalTransactionId, type: "expense", amount: valor, category: "otros", date: movementDate,
          time: horaDe(Date.now()), method: "transfer", description: t("boxes.transferTo", { name: caja.nombre }), notes: notes.trim(),
          origin: "manual", internalTransfer: "box", internalTransferLink: movementId, internalTransferSpaceId: caja.id, internalTransferSpaceName: caja.nombre } as const;
        pendingDebit.current = { confirm: () => repairLinkedTransferTransactions([debit]) };
        if (!await wait(pendingDebit.current.confirm)) throw new Error("personal-save-failed");
        pendingDebit.current = null;
      }
    }
    limpiar();
  });
  const borrar = (item: MovimientoCajaCompartida) => ejecutar(async wait => {
    if (!caja) return;
    if (!owner && item.creadoPor !== uid) { showToast(t("boxes.onlyOwnDelete")); return; }
    if (item.tipo === "ingreso" && item.personalTransactionId != null && !canUndoContribution(movimientos, item, item.personalOwnerUid)) { showToast(t("boxes.contributionUsed")); return; }
    const saldoDespues = balanceOfSpace(movimientos) - (item.tipo === "ingreso" ? item.monto : -item.monto);
    if (saldoDespues < -0.005) { showToast(t("boxes.notEnoughSpace")); return; }
    await withImmediateRemoval([item.id], setMovimientosOcultos,
      () => mounted.current && getAccountStorageSession() === accountSession, async () => {
    await wait(async () => {
      if (item.personalTransactionId != null) await borrarAportePersonal("box", caja.id, item.id);
      else await borrarMovimientoCajaCompartida(caja.id, item.id);
      if (auth.currentUser?.uid !== uid || getAccountStorageSession() !== accountSession) throw new Error("account-task-obsolete");
      if (item.personalOwnerUid === uid && item.personalTransactionId != null
        && !await deleteLinkedTransferTransaction(item.personalTransactionId)) throw new Error("personal-save-failed");
    });
    const borrados = borradosConfirmados.current.get(caja.id) ?? new Set<string>();
    borrados.add(item.id); borradosConfirmados.current.set(caja.id, borrados);
    setMovimientos(items => items.filter(row => row.id !== item.id));
    });
  });
  const devolverAPersonal = () => ejecutar(async wait => {
    if (!uid || !caja || devolvibleAPersonal <= 0) return;
    if (caja.currency !== userCurrency) { showToast(t("spaces.currencyMismatch")); return; }
    await wait(async () => recordPersonalReturn(await devolverAportePersonal({ kind: "box", spaceId: caja.id, amount: devolvibleAPersonal,
      currency: userCurrency, fecha: new Date().toLocaleDateString("sv-SE"), description: t("boxes.returnToPersonal") })));
  });
  const borrarGrupo = (ids: string[]) => ejecutar(async wait => {
    if (!caja || !ids.length) return;
    const selected = movimientos.filter(item => ids.includes(item.id));
    if (selected.some(item => item.personalOwnerUid ? item.personalOwnerUid !== uid : !owner && item.creadoPor !== uid)) { showToast(t("boxes.onlyOwnDelete")); return; }
    const plan = planSpaceMovementDeletion(movimientos, ids);
    if (!plan.ok) { showToast(t(plan.reason === "contribution-used" ? "boxes.contributionUsed" : "boxes.notEnoughSpace")); return; }
    await withImmediateRemoval(plan.items.map(item => item.id), setMovimientosOcultos,
      () => mounted.current && getAccountStorageSession() === accountSession, async () => {
        for (const item of plan.items) {
          await wait(async () => {
            if (item.personalTransactionId != null) await borrarAportePersonal("box", caja.id, item.id);
            else await borrarMovimientoCajaCompartida(caja.id, item.id);
            if (auth.currentUser?.uid !== uid || getAccountStorageSession() !== accountSession) throw new Error("account-task-obsolete");
            if (item.personalOwnerUid === uid && item.personalTransactionId != null && !await deleteLinkedTransferTransaction(item.personalTransactionId)) throw new Error("personal-save-failed");
          });
          const deleted = borradosConfirmados.current.get(caja.id) ?? new Set<string>();
          deleted.add(item.id); borradosConfirmados.current.set(caja.id, deleted);
          setMovimientos(items => items.filter(row => row.id !== item.id));
        }
      });
  });
  function confirmarBorrado(ids: string[]) {
    if (busy) return;
    const selected = movimientos.filter(item => ids.includes(item.id));
    if (!selected.length) return;
    const notice = spaceDeletionNotice(selected, t, fmt);
    Alert.alert(notice.title, notice.message, [
      { text: t("common.cancel"), style: "cancel" },
      { text: notice.action, style: "destructive", onPress: () => {
        if (selected.length === 1) void borrar(selected[0]);
        else void borrarGrupo(ids);
      } },
    ]);
  }
  const salir = () => { if (!uid || !caja || owner) return; Alert.alert(t("boxes.leave"), t("boxes.leaveWarning"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("boxes.leave"), style: "destructive", onPress: () => void ejecutar(async wait => { await wait(() => salirDeCaja(uid, caja.id)); setCaja(null); }) }]); };
  const quitar = (member: MiembroCajaCompartida) => { if (!caja || !owner || member.rol === "owner") return; Alert.alert(t("boxes.removeMember"), member.nombre, [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void ejecutar(async wait => { await wait(() => quitarMiembroCaja(caja.id, member.uid)); setMiembros(items => items.filter(item => item.uid !== member.uid)); }) }]); };
  const guardarNombreCaja = () => {
    if (!caja || !owner || busy) return;
    const nombreNuevo = nombreCajaEditado.trim().slice(0, 30);
    if (!nombreNuevo) { showToast(t("boxes.nameRequired")); return; }
    if (nombreNuevo === caja.nombre) { setEditandoNombreCaja(false); return; }
    void ejecutar(async wait => {
      await wait(() => renombrarCajaCompartida(caja.id, nombreNuevo));
      const actualizada = { ...caja, nombre: nombreNuevo };
      setCaja(actualizada);
      setNombreCajaEditado(nombreNuevo);
      setEditandoNombreCaja(false);
      showToast(t("boxes.renamed"));
    });
  };
  const cerrar = () => {
    if (!uid || !caja || !owner) return;
    if (!canCloseLinkedSpace(movimientos)) { showToast(t("boxes.closeBalance")); return; }
    Alert.alert(t("boxes.close"), t("boxes.closeWarning"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("boxes.close"), style: "destructive", onPress: () => void ejecutar(async wait => {
      const boxId = caja.id;
      await withImmediateRemoval([boxId], setCajasOcultas,
        () => mounted.current && getAccountStorageSession() === accountSession, async () => {
      cierresPendientes.current.add(boxId);
      if (!cierresConfirmados.current.has(boxId)) {
        try {
          await wait(() => cerrarCajaCompartida(uid, boxId));
          cierresConfirmados.current.add(boxId);
        } catch (error) { cierresPendientes.current.delete(boxId); throw error; }
      }
      if (auth.currentUser?.uid !== uid) return;
      if (!await wait(() => repairLinkedTransferTransactions(settlePersonalTransfers(transactions, "box", boxId)))) throw new Error("personal-save-failed");
      cierresPendientes.current.delete(boxId);
      setCaja(null);
      });
    }) }]);
  };
  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center justify-between px-5 pb-3"><BackButton onPress={volverACajas} /><Text className="text-base font-bold text-slate-900 dark:text-white">{t("boxes.title")}</Text><TouchableOpacity accessibilityLabel={t("common.refresh")} accessibilityState={{ busy: actualizandoCaja }} disabled={busy || actualizandoCaja} onPress={() => { setActualizandoCaja(true); setSubscriptionRevision(value => value + 1); }} className="h-10 w-10 items-center justify-center">{actualizandoCaja && !preparandoInvitacion ? <ActivityIndicator accessibilityLabel={t("common.loading")} size="small" color="#059669" /> : <RefreshCw size={18} color="#64748b" />}</TouchableOpacity></View>
    <SpaceSwitcher active="boxes" />
    <ScrollView
      className="px-4"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ paddingBottom: 32 }}
      scrollEventThrottle={160}
      onScroll={({ nativeEvent }) => {
        const cercaDelFinal = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 240;
        if (cercaDelFinal && movementLimit < filasVisibles.length) setMovementLimit(limit => Math.min(limit + 60, filasVisibles.length));
      }}
    >
      <LegalAcceptancePanel />
      {!uid ? <Text className="text-slate-600 dark:text-slate-200">{t("boxes.loginRequired")}</Text> : <>
        {!caja || cajasOcultas.has(caja.id) ? null : cargandoCaja ? <View accessibilityRole="progressbar" className="items-center gap-2 py-8"><ActivityIndicator color="#059669" /><Text className="text-sm text-slate-600 dark:text-slate-300">{t("common.loading")}</Text></View> : errorCargaCaja ? <Text accessibilityLiveRegion="polite" className="py-8 text-center text-slate-600 dark:text-slate-300">{t("family.connectionError")}</Text> : <>
          <View className="mb-2 mt-1 flex-row items-center justify-between">
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={volverACajas} className="flex-row items-center gap-1 rounded-xl px-1 py-2"><ArrowLeftRight size={16} color="#059669" /><Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t("boxes.all")}</Text></TouchableOpacity>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t("family.members")}: ${miembros.length || "…"}`} disabled={!miembros.length} onPress={() => setVerMiembros(true)} className="h-10 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 dark:bg-emerald-950"><UsersRound size={17} color="#059669" /><Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t("family.members")}</Text><Text className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">{miembros.length || "…"}</Text></TouchableOpacity>
              {owner ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.inviteAccessibility")} disabled={busy} onPress={() => void invitar()} className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950"><UserPlus size={19} color="#059669" /></TouchableOpacity> : null}
            </View>
          </View>
          <View className="rounded-3xl bg-teal-600 px-4 py-3">
            <View className="min-h-9 flex-row items-center gap-2">
              {editandoNombreCaja && owner ? <>
                <TextInput disableFullscreenUI autoFocus editable={!busy} value={nombreCajaEditado} onChangeText={setNombreCajaEditado} onSubmitEditing={guardarNombreCaja} returnKeyType="done" maxLength={30} selectTextOnFocus placeholder={t("boxes.namePlaceholder")} placeholderTextColor="#a7f3d0" className="h-9 min-w-0 flex-1 rounded-xl bg-emerald-700/70 px-3 text-base font-bold text-white" />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.save")} disabled={busy} onPress={guardarNombreCaja} className="h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Check size={18} color="#fff" /></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.cancel")} disabled={busy} onPress={() => { setEditandoNombreCaja(false); setNombreCajaEditado(caja.nombre); }} className="h-9 w-9 items-center justify-center rounded-xl bg-white/20"><X size={17} color="#fff" /></TouchableOpacity>
              </> : <>
                <Text className="flex-1 text-base font-bold text-white" numberOfLines={1}>{caja.nombre}</Text>
                {owner && !invitacionVisible && !busy ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.editName")} disabled={busy} onPress={() => { if (nombreCajaEditado === caja.nombre) setNombreCajaEditado(caja.nombre); setEditandoNombreCaja(true); }} className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-700">
                  <Pencil size={16} color="#fff" />
                </TouchableOpacity> : null}
              </>}
            </View>
            <Text adjustsFontSizeToFit minimumFontScale={0.58} numberOfLines={1} className="text-[26px] font-extrabold leading-8 text-white">{fmt(saldo)}</Text>
          </View>
          {devolvibleAPersonal > 0 ? <TouchableOpacity disabled={busy} onPress={() => void devolverAPersonal()} className="mt-2 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{t("boxes.returnAmount", { amount: fmt(devolvibleAPersonal) })}</Text></TouchableOpacity> : null}
          <View className="mt-2 flex-row justify-between">
            <TouchableOpacity style={{ width: owner ? "48%" : "100%", height: 40 }} accessibilityRole="button" disabled={busy} onPress={() => {
              const resume = modoSuspendido.current;
              if (resume) { modoSuspendido.current = null; setModo(resume); }
              else { limpiar(); setEditandoAporteId(null); setModo("ingreso"); }
            }} className="flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2"><Plus size={16} color="#fff" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-[13px] font-extrabold text-white">{t("boxes.addMoney")}</Text></TouchableOpacity>
            {owner ? <TouchableOpacity style={{ width: "48%", height: 40 }} accessibilityRole="button" accessibilityLabel={t("boxes.close")} disabled={busy} onPress={cerrar} className="flex-row items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 dark:border-rose-900 dark:bg-rose-950"><X size={15} color="#e11d48" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-[13px] font-extrabold text-rose-700 dark:text-rose-300">{t("boxes.close")}</Text></TouchableOpacity> : null}
          </View>
          <SpaceOverviewTotals income={ingresos} expense={gastos} filter={filter} onFilter={setFilter} format={fmt} />
          <View className="mb-2 mt-5 flex-row items-center gap-1">
            <MovementAllButton label={t("boxes.history")} activeFilter={filter !== null} onPress={() => setFilter(null)} />
            {recentMovementTypes.income ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.filterIncome")} accessibilityState={{ selected: filter === "ingreso" }} onPress={() => setFilter("ingreso")} className={`h-10 w-10 items-center justify-center rounded-xl ${filter === "ingreso" ? "bg-emerald-200" : "bg-emerald-50"}`}><ArrowUp size={19} color="#047857" strokeWidth={2.6} /></TouchableOpacity> : null}
            {recentMovementTypes.expense ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.filterExpense")} accessibilityState={{ selected: filter === "gasto" }} onPress={() => setFilter("gasto")} className={`h-10 w-10 items-center justify-center rounded-xl ${filter === "gasto" ? "bg-rose-200" : "bg-rose-50"}`}><ArrowDown size={19} color="#be123c" strokeWidth={2.6} /></TouchableOpacity> : null}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.selectMovements")} accessibilityState={{ expanded: seleccionando }} onPress={() => setSeleccionando(value => !value)} className="min-h-10 flex-row items-center gap-1 px-1"><ListChecks size={18} color="#059669" /><Text className="text-[15px] font-bold text-emerald-600">{t(seleccionando ? "common.cancel" : "common.select")}</Text></TouchableOpacity>
          </View>
        </>}
        {cajaLista && filasVisibles.length === 0 ? <Text className="py-3 text-sm text-slate-500">{t("spaces.noResults")}</Text> : null}
        {cajaLista && caja ? filasVisibles.slice(0, movementLimit).map((row, index) => {
          const { key, item, transferGroup } = row;
          const rowTime = linkedMovementRowTime(row);
          const idsDeFila = movementIdsForCompactRow(row, visibles);
          const puedeBorrar = movimientos.filter(move => idsDeFila.includes(move.id)).every(move => move.personalOwnerUid ? move.personalOwnerUid === uid : owner || move.creadoPor === uid);
          const puedeEditarAporte = item.tipo === "ingreso" && item.personalOwnerUid === uid && item.personalTransactionId != null;
          const transferencia = isLinkedSpaceTransfer(item);
          const retorno = isLinkedSpaceReturn(item);
          return <View key={key}>
            {startsMovementDay(filasVisibles, index, row => row.item.fecha) ? <MovementDateHeader date={item.fecha} monthNames={monthNames} /> : null}
            <View className="mb-2 flex-row items-center rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde">
              {transferencia ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("transfer.filter")} disabled={!transferGroup} onPress={() => setFilter("transferencia")} className="h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950"><ArrowRightLeft size={17} color="#2563eb" /></TouchableOpacity> : <View className={`h-9 w-9 items-center justify-center rounded-xl ${item.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"}`}>{item.tipo === "ingreso" ? <ArrowUp size={17} color="#047857" /> : <ArrowDown size={17} color="#be123c" />}</View>}
              {transferencia ? <View className="ml-3 flex-1"><SpaceTransferAmounts title={caja.nombre} sentLabel={t("boxes.receivedFromPersonal")} returnedLabel={t("boxes.returnedToPersonal")} sent={transferGroup?.sent ?? (retorno ? 0 : item.monto)} returned={transferGroup?.returned ?? (retorno ? item.monto : 0)} format={fmt} />{rowTime ? <Text className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">{rowTime}</Text> : null}</View> : <><View className="ml-3 flex-1"><Text numberOfLines={1} className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{item.descripcion || t(item.tipo === "ingreso" ? "boxes.income" : "boxes.expense")}</Text><Text className="text-xs text-slate-500 dark:text-slate-300">{[rowTime, item.method ? methodLabel(item.method, t) : ""].filter(Boolean).join(" · ")}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className={`mr-2 max-w-[38%] text-[15px] font-extrabold ${item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>{item.tipo === "ingreso" ? "+" : "-"}{fmt(item.monto)}</Text></>}
              {seleccionando ? <View className="flex-row items-center"><ContentReportButton key={`${caja.id}:${item.id}`} target={transferencia ? { kind: "box", spaceId: caja.id, targetType: "space", targetId: caja.id, expectedText: caja.nombre.slice(0, 120), expectedUid: caja.ownerUid } : { kind: "box", spaceId: caja.id, targetType: "movement", targetId: item.id, expectedText: item.descripcion.slice(0, 120), expectedUid: item.creadoPor }} />{!transferGroup && puedeEditarAporte ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.editContribution")} onPress={() => { setEditandoAporteId(item.id); setModo("ingreso"); setMonto(String(item.monto)); setNombre(item.descripcion); setCategory(item.category || "otros"); setNotes(item.notes || ""); setMovementDate(item.fecha); setMethod(item.method || "cash"); setOrigenDinero("personal"); }} className="h-9 w-9 items-center justify-center"><Pencil size={15} color="#0d9488" /></TouchableOpacity> : null}{puedeBorrar ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(transferencia ? "spaces.cancelTransfer" : "common.delete")} onPress={() => confirmarBorrado(idsDeFila)} className="h-9 w-9 items-center justify-center"><Trash2 size={15} color="#e11d48" /></TouchableOpacity> : null}</View> : null}
            </View>
          </View>;
        }) : null}
        {cajaLista && caja && !owner ? <TouchableOpacity onPress={salir} className="mt-3 min-h-11 flex-row items-center justify-center gap-2"><LogOut size={17} color="#e11d48" /><Text className="font-bold text-rose-600">{t("boxes.leave")}</Text></TouchableOpacity> : null}
      </>}
    </ScrollView>
    <SpaceMovementSheet visible={(modo === "ingreso" || modo === "gasto") && !invitacionVisible} type={modo === "ingreso" || modo === "gasto" ? modo : null} onType={next => { setModo(next); setCategory(next === "ingreso" ? "salario" : "otros"); }} onClose={() => { if (!busy) limpiar(); }} onSave={() => void guardar()} amount={monto} onAmount={value => setMonto(sanitizeSafeAmountInput(value, moneda))} description={nombre} onDescription={setNombre} method={method} onMethod={setMethod} currency={moneda} category={category} onCategory={setCategory} date={movementDate} onDate={setMovementDate} notes={notes} onNotes={setNotes} origin={owner ? origenDinero : undefined} onOrigin={owner ? setOrigenDinero : undefined} availableText={owner ? t("boxes.personalAvailable", { amount: formatAmount(saldoPersonalEn(movementDate), currencySymbolFor(userCurrency), userCurrency) }) : undefined} disabled={busy} />
    <SpaceInvitationSheet code={invitacion} kind="box" visible={invitacionVisible} loading={preparandoInvitacion} onClose={() => { setInvitacionVisible(false); setInvitacion(""); }} />
    {caja ? <SpaceMembersSheet familyName={caja.nombre} members={miembros} visible={verMiembros} canManage={owner} onRemove={quitar} onClose={() => setVerMiembros(false)} reportSpace={{ kind: "box", spaceId: caja.id, ownerUid: caja.ownerUid }} /> : null}
  </View>;
}
