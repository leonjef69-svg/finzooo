import { SpaceOverviewTotals, type MovementFilter } from "@/components/SpaceMovementControls";
import { methodLabel } from "@/constants/i18n";
import BackButton from "@/components/BackButton";
import MovementAllButton from "@/components/MovementAllButton";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import SpaceTransferAmounts from "@/components/SpaceTransferAmounts";
import SpaceMovementSheet from "@/components/SpaceMovementSheet";
import PrivateBoxMoneyReview from "@/components/PrivateBoxMoneyReview";
import { validSpaceDate } from "@/components/SpaceMovementFields";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { bajarCajas, CloudCajasConflictError, resolverNombreCaja, subirCajas } from "@/utils/cloudCajas";
import { compartirCajaExistente, crearInvitacionCaja, unirseACaja } from "@/utils/cloudCajasCompartidas";
import {
  CAJAS_VACIAS,
  fusionarCajas,
  nuevoIdCaja,
  saldoCaja,
  siguienteVersionCaja,
  validarCajas,
  diferenciasNombreCajas,
  prepararRevisionNombre,
  conservarRevisionNombre,
  confirmarRevisionNombreLocal,
  type DatosCajas,
  type RevisionNombreCaja,
  type RevisionImporteCaja,
} from "@/utils/cajas";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { horaDe } from "@/utils/format";
import { allocatePersonalReturn, canCloseLinkedSpace, canSpendFromSpace, compactLinkedTransferRows, countSelectedCompactRows, isLinkedSpaceReturn, isLinkedSpaceTransfer, minimumContributionAmount, movementIdsForCompactRow, planSpaceMovementDeletion, returnableToPersonal, settlePersonalTransfers } from "@/utils/linkedTransfers";
import { nextId } from "@/utils/id";
import { irUnaVez, safeBack } from "@/utils/nav";
import { getAccountStorageSession, hasUnreadableLocalData, loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";
import { captureAccountTask } from "@/utils/accountTask";
import { guardarCajasEnMemoria, leerCajasEnMemoria, observarCajasEnMemoria, revisionCajasEnMemoria } from "@/utils/cajasMemoria";
import { assertPrivateBoxMoneyLocalIdle, assertPrivateBoxMoneyLocalMutation } from "@/utils/privateBoxMoneyLocalWrite";
import { cancelarConversionCaja, enlacesCajaConvertida, huellaCaja, nuevoIntentoCaja, retirarCajaConvertida } from "@/utils/boxMigration";
import { spaceErrorKey } from "@/utils/spaceErrors";
import type { Transaction } from "@/types";
import { privateBoxLinksMatch } from "@/utils/privateBoxPersonal";
import { PrivateBoxSyncError, privateBoxCloudResponseCurrent } from "@/utils/privateBoxSync";
import { planPrivateBoxRepair, privateBoxLinkCandidates, resolvePrivateBoxConflict, type PrivateBoxRepairChoice } from "@/utils/privateBoxRepair";
import { compararImporteCaja, confirmarImporteCaja, reintentarImporteCaja, retirarImporteCaja, type PrivateBoxMoneyComparison, type PrivateBoxMoneyPort } from "@/utils/privateBoxMoneyFlow";
import type { MoneySource } from "../functions/src/private-box-money-shared.js";
import { ArrowDown, ArrowLeftRight, ArrowRightLeft, ArrowUp, Boxes, Check, ListChecks, Pencil, Plus, RefreshCw, Trash2, UserPlus, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

// Cambiar de Personal a Familia y volver a Cajas desmonta estas pantallas.
// Conservamos la última copia ya pintada para no reconstruir una pantalla
// vacía en cada cambio. La nube sigue actualizándola en segundo plano.
function fechaLocal(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export default function Cajas() {
  useAppData();
  const uid = auth.currentUser?.uid ?? "";
  return <CajasForAccount key={`${uid}:${getAccountStorageSession()}`} accountUid={uid} />;
}

function CajasForAccount({ accountUid }: { accountUid: string }) {
  const { ready: personalReady, hasOnboarded, t, fmt, showToast, disponible, transactions, deletedTransactionIds, commitPrivateBoxData, commitPrivateBoxMoney, retirePrivateBoxMoney, stagePrivateBoxMoney, readPrivateBoxMoneyLocal, isPremium, userName, userCurrency } = useAppData();
  const insets = useSafeAreaInsets();
  const [datos, setRenderedDatos] = useState<DatosCajas>(() => leerCajasEnMemoria() ?? CAJAS_VACIAS);
  const datosActuales = useRef(datos);
  const [lista, setLista] = useState(true);
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [editandoNombreCaja, setEditandoNombreCaja] = useState(false);
  const [nombreCajaEditado, setNombreCajaEditado] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [montoInicial, setMontoInicial] = useState("");
  const [origenDinero, setOrigenDinero] = useState<"externo" | "personal">("externo");
  const [creando, setCreando] = useState(false);
  const [uniendoCaja, setUniendoCaja] = useState(false);
  const [codigoCaja, setCodigoCaja] = useState("");
  const [cargandoUnion, setCargandoUnion] = useState(false);
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
  const [ready, setReady] = useState(leerCajasEnMemoria() !== null);
  const [cloudReady, setCloudReady] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [seleccionandoCajas, setSeleccionandoCajas] = useState(false);
  const [cajasSeleccionadas, setCajasSeleccionadas] = useState<string[]>([]);
  const accionLocalEnCurso = useRef(false);
  const nubeConfirmadaPara = useRef<string | null>(null);
  const [syncIssue, setSyncIssue] = useState<"boxes.syncFailed" | "boxes.syncConflict" | null>(null);
  const [repairCloudChanged, setRepairCloudChanged] = useState(false);
  const [nameCopies, setNameCopies] = useState<{ local: DatosCajas; remoto: DatosCajas } | null>(null);
  const nameCopiesActual = useRef(nameCopies);
  nameCopiesActual.current = nameCopies;
  const [nameHistory, setNameHistory] = useState(false);
  const [moneyComparison, setRenderedMoneyComparison] = useState<PrivateBoxMoneyComparison | null>(null);
  const moneyComparisonActual = useRef(moneyComparison);
  const setMoneyComparison = useCallback((next: PrivateBoxMoneyComparison | null) => {
    moneyComparisonActual.current = next;
    setRenderedMoneyComparison(next);
  }, []);
  const [moneyBusy, setMoneyBusy] = useState(false);
  const [moneyMessage, setMoneyMessage] = useState<string | null>(null);
  const conversionEnCurso = useRef(false);
  const reparacionIntentada = useRef<{ data: DatosCajas; rows: Transaction[]; refresh: number } | null>(null);
  const [linkReview, setLinkReview] = useState<string | null>(null);
  const [linkLimit, setLinkLimit] = useState(20);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestedRefresh = useRef(refreshVersion);
  requestedRefresh.current = refreshVersion;
  const accountSession = useRef(getAccountStorageSession()).current;
  const mounted = useRef(true);
  const premiumForSync = useRef(isPremium);
  premiumForSync.current = isPremium;
  const personalActuales = useRef(transactions);
  personalActuales.current = transactions;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const cuentaActual = useCallback(() => mounted.current && accountSession !== null
    && accountSession === getAccountStorageSession() && (auth.currentUser?.uid ?? "") === accountUid,
  [accountSession, accountUid]);
  const reportSyncError = useCallback((error: unknown) => {
    if (!cuentaActual()) return;
    setSyncIssue(error instanceof PrivateBoxSyncError || (error instanceof Error && error.message === "cajas-sync-conflict") ? "boxes.syncConflict" : "boxes.syncFailed");
    if (error instanceof CloudCajasConflictError) {
      setNameCopies({ local: datosActuales.current, remoto: error.cajaRemota });
      setCloudReady(false); nubeConfirmadaPara.current = null;
    }
  }, [cuentaActual]);
  const setDatos = useCallback((update: SetStateAction<DatosCajas>) => {
    if (!cuentaActual()) return;
    if (typeof update === "function") assertPrivateBoxMoneyLocalIdle();
    const next = typeof update === "function" ? update(datosActuales.current) : update;
    // Una confirmación idéntica no programa otra subida de la misma lista.
    if (next === datosActuales.current || JSON.stringify(next) === JSON.stringify(datosActuales.current)) return;
    assertPrivateBoxMoneyLocalMutation("boxes", next);
    datosActuales.current = next;
    setRenderedDatos(next);
  }, [cuentaActual]);

  // Un lote que termina tras cerrar y reabrir Cajas avisa a la pantalla nueva.
  // La pantalla que lo inició aplica su propio resultado después del disco.
  useEffect(() => observarCajasEnMemoria(() => {
    if (!cuentaActual() || guardandoRef.current) return;
    const value = leerCajasEnMemoria();
    if (value) { setDatos(value); setReady(true); }
  }), [cuentaActual, setDatos]);

  const repairPlan = useMemo(() => planPrivateBoxRepair(datos, transactions, deletedTransactionIds, accountUid), [datos, transactions, deletedTransactionIds, accountUid]);
  const repairBlocked = !personalReady || !hasOnboarded || !cloudReady || repairPlan.conflicts.length > 0 || repairPlan.upserts.length > 0 || repairPlan.data !== datos;
  const linkCandidates = useMemo(() => linkReview ? privateBoxLinkCandidates(datos, transactions, deletedTransactionIds, linkReview) : [], [datos, transactions, deletedTransactionIds, linkReview]);
  const linkMovement = datos.movimientos.find(row => row.id === linkReview);
  const nameOptions = useMemo(() => nameCopies ? diferenciasNombreCajas(nameCopies.local, nameCopies.remoto) : [], [nameCopies]);
  const pendingNames = (datos.revisionesNombre || []).filter(entry => entry.uid === accountUid && entry.estado === "pendiente");
  const moneyCandidates = useMemo(() => {
    const ids = new Set(repairPlan.conflicts.filter(item => item.selectable).map(item => item.movementId));
    for (const move of nameCopies?.local.movimientos || []) {
      const other = nameCopies?.remoto.movimientos.find(row => row.id === move.id);
      if (other && move.personalTransactionId === other.personalTransactionId && (move.monto !== other.monto || move.fecha !== other.fecha)) ids.add(move.id);
    }
    return datos.movimientos.filter(row => ids.has(row.id) && row.personalTransactionId != null
      && !datos.revisionesImporte?.some(entry => entry.estado === "pendiente" && entry.local.movement.id === row.id));
  }, [datos, repairPlan, nameCopies]);

  function tomarAccionLocal(): boolean {
    if (repairBlocked) { showToast(t("boxes.repairReview")); return false; }
    if (syncIssue === "boxes.syncConflict") { showToast(t("boxes.syncConflict")); return false; }
    if (caja?.sharingPending) { showToast(t("boxes.sharingPending")); return false; }
    if (!cuentaActual() || !ready || compartiendo || cargandoUnion || guardandoRef.current || accionLocalEnCurso.current) return false;
    accionLocalEnCurso.current = true;
    setTimeout(() => { accionLocalEnCurso.current = false; }, 700);
    return true;
  }

  async function guardarCambioCaja(next: DatosCajas, upserts: Transaction[] = [], deleteIds: number[] = [], repair?: true | PrivateBoxRepairChoice): Promise<boolean> {
    if (!cuentaActual() || guardandoRef.current || hasUnreadableLocalData()) return false;
    const before = datosActuales.current;
    guardandoRef.current = true; setGuardando(true);
    try {
      const ok = await commitPrivateBoxData(before, next, upserts, deleteIds, () => cuentaActual() && datosActuales.current === before, setDatos, repair);
      if (ok && repair && cuentaActual()) setRepairCloudChanged(false);
      if (!ok && cuentaActual()) showToast(t("toast.localSaveFailed"));
      return ok && cuentaActual();
    } catch (error) {
      if (cuentaActual()) {
        if (repair && error instanceof Error && error.message === "private-box-source-changed") {
          setRepairCloudChanged(true); showToast(t("boxes.repairCloudChanged"));
        } else showToast(t(error instanceof Error && error.message === "private-box-android-only" ? "boxes.atomicAndroidOnly" : "toast.localSaveFailed"));
      }
      return false;
    } finally {
      guardandoRef.current = false;
      if (cuentaActual()) {
        setGuardando(false);
        // Una consulta que terminó mientras se guardaba fue descartada. No
        // dejar por eso la sincronización Pro detenida hasta cambiar de pantalla.
        if (!cloudReady) setRefreshVersion(value => value + 1);
      }
    }
  }

  useFocusEffect(useCallback(() => {
    let alive = true;
    const requested = refreshVersion;
    const current = () => alive && cuentaActual() && !guardandoRef.current && requestedRefresh.current === requested;
    setCloudReady(false);
    setReady(false);
    setNameCopies(null);
    nubeConfirmadaPara.current = null;
    void (async () => {
      const uid = accountUid;
      try {
      const memoryRevision = revisionCajasEnMemoria();
      const local = await loadJSON<DatosCajas>(STORAGE_KEYS.cajasDinero, CAJAS_VACIAS);
      if (!current()) return;
      if (hasUnreadableLocalData()) throw new Error("cajas-local-unreadable");
      const memoria = leerCajasEnMemoria();
      const checked = validarCajas(local);
      const visible = memoryRevision !== revisionCajasEnMemoria() && memoria ? validarCajas(memoria)
        : memoria ? fusionarCajas(checked, validarCajas(memoria)) : checked;
      guardarCajasEnMemoria(visible);
      setDatos(visible);
      setReady(true);

      let remoto: DatosCajas | null = null;
      if (uid && isPremium) {
        const task = captureAccountTask(uid, () => current() && premiumForSync.current);
        try {
          remoto = await task.wait(() => bajarCajas(uid));
          if (task.current()) nubeConfirmadaPara.current = uid;
        } catch (error) {
          // Se puede seguir trabajando localmente, pero no reparar ausencias
          // ni subir encima de una copia que no se pudo consultar.
          if (task.current()) reportSyncError(error);
          return;
        }
      }
      if (!current()) return;
      if (remoto && !privateBoxCloudResponseCurrent(uid, remoto)) return;
      // La referencia incorpora inmediatamente cada cambio local, incluso si
      // React todavía no lo pintó. La nube no sustituye una edición encolada.
      let unidos: DatosCajas;
      try { unidos = remoto ? fusionarCajas(datosActuales.current, remoto) : datosActuales.current; }
      catch (error) {
        if (remoto && (error as { message?: string })?.message === "cajas-sync-conflict" && current()) setNameCopies({ local: datosActuales.current, remoto });
        throw error;
      }
      setDatos(unidos);
      guardarCajasEnMemoria(unidos);
      void saveJSON(STORAGE_KEYS.cajasDinero, unidos);
      setCloudReady(true);
      setSyncIssue(null);
      } catch (error) {
        if (current()) {
          nubeConfirmadaPara.current = null;
          setCloudReady(false); reportSyncError(error);
        }
      }
    })();
    return () => { alive = false; };
  }, [accountUid, cuentaActual, isPremium, refreshVersion, reportSyncError, setDatos]));

  useEffect(() => {
    if (!cuentaActual() || !ready || datos !== datosActuales.current || guardandoRef.current || hasUnreadableLocalData()) return;
    guardarCajasEnMemoria(datos);
    void saveJSON(STORAGE_KEYS.cajasDinero, datos);
    const uid = accountUid;
    if (!cloudReady || repairBlocked || !uid || !isPremium || compartiendo || guardando || nubeConfirmadaPara.current !== uid) return;
    let active = true;
    const task = captureAccountTask(uid, () => active && cuentaActual() && !guardandoRef.current && premiumForSync.current);
    const timer = setTimeout(() => {
      if (!task.current()) return;
      void subirCajas(uid, datos, error => { if (task.current()) reportSyncError(error); }, saved => {
        if (task.current() && !hasUnreadableLocalData()) setDatos(current => fusionarCajas(current, saved));
      })
        .then(ok => { if (ok && task.current()) setSyncIssue(null); });
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [accountUid, cuentaActual, datos, ready, cloudReady, repairBlocked, compartiendo, guardando, isPremium, reportSyncError, setDatos]);

  const caja = datos.cajas.find((item) => item.id === cajaId);
  useEffect(() => {
    setEditandoNombreCaja(false);
    setNombreCajaEditado(caja?.nombre ?? "");
  }, [cajaId, caja?.nombre]);
  useEffect(() => setMovementLimit(60), [cajaId, filter]);
  const movimientos = useMemo(
    () => datos.movimientos.filter((item) => item.cajaId === cajaId).sort((a, b) => b.creadoEn - a.creadoEn),
    [cajaId, datos.movimientos],
  );
  const resumen = useMemo(() => movimientos.reduce(
    (total, item) => ({
      ingresos: total.ingresos + (!isLinkedSpaceTransfer(item) && item.tipo === "ingreso" ? item.monto : 0),
      gastos: total.gastos + (!isLinkedSpaceTransfer(item) && item.tipo === "gasto" ? item.monto : 0),
    }),
    { ingresos: 0, gastos: 0 },
  ), [movimientos]);
  const saldoActual = caja ? saldoCaja(caja.id, datos.movimientos) : 0;
  const devolvibleAPersonal = returnableToPersonal(movimientos);

  // Recuperación comprobada: Personal, Caja y marcas se guardan juntos.
  useEffect(() => {
    if (!cuentaActual() || !personalReady || !hasOnboarded || !ready || !cloudReady || guardando || (isPremium && nubeConfirmadaPara.current !== accountUid)
      || guardandoRef.current || compartiendo || repairPlan.conflicts.length || hasUnreadableLocalData()
      || (repairPlan.upserts.length === 0 && repairPlan.data === datos)) return;
    const prior = reparacionIntentada.current;
    if (prior?.data === datos && prior.rows === transactions && prior.refresh === refreshVersion) return;
    reparacionIntentada.current = { data: datos, rows: transactions, refresh: refreshVersion };
    void guardarCambioCaja(repairPlan.data, repairPlan.upserts, [], true);
  }, [accountUid, cuentaActual, datos, transactions, repairPlan, refreshVersion, personalReady, hasOnboarded, ready, cloudReady, guardando, compartiendo, isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  function revisarTransferencias() {
    const issue = repairPlan.conflicts.find(item => item.selectable) || repairPlan.conflicts[0];
    if (!issue || !cuentaActual() || guardandoRef.current) return;
    if (issue.reason === "invalid") {
      Alert.alert(t("boxes.repairReview"), t("boxes.repairInvalidDetails"), [{ text: t("common.close") }]); return;
    }
    const move = datos.movimientos.find(item => item.id === issue.movementId);
    const personal = transactions.find(item => item.id === issue.personalId);
    if (!issue.selectable || !move || !personal) {
      const linkable = repairPlan.conflicts.find(item => item.movementId && privateBoxLinkCandidates(datos, transactions, deletedTransactionIds, item.movementId).length > 0);
      if (linkable?.movementId) { setLinkLimit(20); setLinkReview(linkable.movementId); return; }
      Alert.alert(t("boxes.repairReview"), t(issue.reason === "settled" ? "boxes.repairClosedDetails" : "boxes.repairUncertain"), [{ text: t("common.close") }]);
      return;
    }
    if (premiumForSync.current) { void consultarImporteCaja(move.id); return; }
    const before = datosActuales.current, beforeRows = transactions;
    const apply = async (from: "personal" | "box") => {
      if (!cuentaActual() || before !== datosActuales.current || beforeRows !== personalActuales.current || guardandoRef.current || premiumForSync.current !== isPremium
        || !cloudReady || (isPremium && nubeConfirmadaPara.current !== accountUid) || syncIssue === "boxes.syncConflict") return;
      try {
        const choice = { movementId: move.id, from };
        const plan = resolvePrivateBoxConflict(before, beforeRows, deletedTransactionIds, accountUid, choice);
        if (await guardarCambioCaja(plan.data, plan.upserts, [], choice)) showToast(t("boxes.repairSaved"));
      } catch {
        if (cuentaActual()) showToast(t("boxes.repairUnsafe"));
      }
    };
    Alert.alert(t("boxes.repairReview"), t("boxes.repairChoose", { name: datos.cajas.find(item => item.id === move.cajaId)?.nombre || "",
      personal: fmt(personal.amount), personalDate: personal.date, box: fmt(move.monto), boxDate: move.fecha }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("boxes.repairUsePersonal"), onPress: () => void apply("personal") },
      { text: t("boxes.repairUseBox"), onPress: () => void apply("box") },
    ]);
  }

  function moneyPort(): PrivateBoxMoneyPort {
    return { current: () => cuentaActual() && personalReady && hasOnboarded && !hasUnreadableLocalData(),
      premium: () => premiumForSync.current, boxes: () => datosActuales.current, local: readPrivateBoxMoneyLocal,
      stage: (before, entry, lease, current) => stagePrivateBoxMoney(before, entry, lease, current, setDatos),
      commit: (before, entry, ack, lease, current) => commitPrivateBoxMoney(before, entry, ack, lease, current, setDatos),
      retire: (before, entry, ack, lease, current) => retirePrivateBoxMoney(before, entry, ack, lease, current, setDatos) };
  }

  async function trabajarImporteCaja(work: () => Promise<boolean | PrivateBoxMoneyComparison>, recovery = false, retiring = false): Promise<void> {
    if (!cuentaActual() || !ready || !personalReady || !hasOnboarded || guardandoRef.current || compartiendo || cargandoUnion) return;
    if (!premiumForSync.current && !recovery) { setMoneyMessage(t("boxes.moneyNeedsPro")); return; }
    if (Platform.OS !== "android") { setMoneyMessage(t("boxes.atomicAndroidOnly")); return; }
    guardandoRef.current = true; setGuardando(true); setMoneyBusy(true); setMoneyMessage(null);
    try {
      const result = await work();
      if (!cuentaActual()) return;
      if (typeof result === "object") setMoneyComparison(result);
      else if (result) { setMoneyComparison(null); setMoneyMessage(t(retiring ? "boxes.moneyRetired" : "boxes.moneySaved")); showToast(t(retiring ? "boxes.moneyRetired" : "boxes.moneySaved")); }
      else setMoneyMessage(t("boxes.moneyPending"));
    } catch (error) {
      if (!cuentaActual()) return;
      const value = error as { message?: string; code?: string; details?: { reason?: string } };
      const reason = value.details?.reason || value.message || "";
      const pro = reason === "cajas-money-needs-pro" || reason === "money-premium-required";
      const changed = /changed|invalid|negative-balance|return-conflict|obsolete/.test(reason);
      if (changed) setMoneyComparison(null);
      setMoneyMessage(t(reason === "money-review-retired" ? "boxes.moneyRetireReady" : retiring && changed ? "boxes.moneyRetireBlocked" : pro ? "boxes.moneyNeedsPro" : reason === "cajas-money-history-full" ? "boxes.moneyHistoryFull"
        : changed ? "boxes.moneyChanged" : "boxes.moneyPending"));
    } finally {
      guardandoRef.current = false;
      if (cuentaActual()) { setGuardando(false); setMoneyBusy(false); setRefreshVersion(value => value + 1); }
    }
  }

  async function consultarImporteCaja(movementId: string): Promise<void> {
    await trabajarImporteCaja(() => compararImporteCaja(accountUid, movementId, moneyPort()));
  }

  function elegirImporteCaja(chosen: MoneySource) {
    const comparison = moneyComparisonActual.current;
    const choice = comparison?.choices.find(value => value.source === chosen && value.usable);
    if (!comparison || !choice || guardandoRef.current || !cuentaActual()) return;
    Alert.alert(t("boxes.moneyReview"), t(comparison.replaces ? "boxes.moneyReviewAgainConfirm" : "boxes.moneyConfirm", { amount: fmt(choice.amount), date: choice.date }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.save"), onPress: () => {
        if (comparison !== moneyComparisonActual.current) return;
        void trabajarImporteCaja(() => confirmarImporteCaja(comparison, chosen, moneyPort()));
      } },
    ]);
  }

  async function recuperarImporteCaja(entry: RevisionImporteCaja): Promise<void> {
    await trabajarImporteCaja(() => reintentarImporteCaja(accountUid, entry, moneyPort()), true);
  }

  function pedirRetirarImporteCaja(entry: RevisionImporteCaja): void {
    if (guardandoRef.current || !cuentaActual()) return;
    Alert.alert(t("boxes.moneyRetireAction"), t("boxes.moneyRetireConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("boxes.moneyRetireAction"), onPress: () => void trabajarImporteCaja(() => retirarImporteCaja(accountUid, entry, moneyPort()), true, true) },
    ]);
  }

  async function revisarImporteCajaDeNuevo(entry: RevisionImporteCaja): Promise<void> {
    await trabajarImporteCaja(() => compararImporteCaja(accountUid, entry.local.movement.id, moneyPort(), entry.id));
  }

  function confirmarEnlaceHeredado(personalId: number) {
    const before = datosActuales.current, beforeRows = personalActuales.current;
    const movementId = linkReview;
    if (!movementId || !cuentaActual() || guardandoRef.current || !personalReady || !cloudReady) return;
    const candidate = privateBoxLinkCandidates(before, beforeRows, deletedTransactionIds, movementId).find(row => row.id === personalId);
    if (!candidate) { showToast(t("boxes.repairUnsafe")); return; }
    const premiumBefore = premiumForSync.current;
    Alert.alert(t("boxes.repairLinkTitle"), t("boxes.repairLinkConfirm", { description: candidate.description, amount: fmt(candidate.amount), date: candidate.date }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("boxes.repairLinkAction"), onPress: async () => {
        if (!cuentaActual() || before !== datosActuales.current || beforeRows !== personalActuales.current || premiumBefore !== premiumForSync.current
          || guardandoRef.current || compartiendo || (isPremium && nubeConfirmadaPara.current !== accountUid) || syncIssue === "boxes.syncConflict") return;
        try {
          const choice = { movementId, personalId, from: "link" as const };
          const plan = resolvePrivateBoxConflict(before, beforeRows, deletedTransactionIds, accountUid, choice);
          if (await guardarCambioCaja(plan.data, plan.upserts, [], choice)) { setLinkReview(null); showToast(t("boxes.repairSaved")); }
        } catch { if (cuentaActual()) showToast(t("boxes.repairUnsafe")); }
      } },
    ]);
  }

  async function reintentarNombreCaja(entry: RevisionNombreCaja) {
    if (!cuentaActual() || !ready || compartiendo || guardandoRef.current || entry.uid !== accountUid) return;
    if (!isPremium) { showToast(t("boxes.nameNeedsPro")); return; }
    const task = captureAccountTask(accountUid, cuentaActual);
    if (!task.current() || hasUnreadableLocalData()) return;
    const before = datosActuales.current;
    const retained = before.revisionesNombre?.find(value => value.id === entry.id);
    if (!retained || JSON.stringify(retained) !== JSON.stringify(entry)) return;
    guardandoRef.current = true; setGuardando(true);
    try {
      const result = await task.wait(() => resolverNombreCaja(accountUid, entry));
      if (before !== datosActuales.current || !premiumForSync.current || hasUnreadableLocalData()
        || result.uid !== accountUid || result.id !== entry.id || result.boxId !== entry.boxId || result.nombre !== entry.elegido.nombre || result.version !== entry.elegido.updatedAt) throw new Error("cajas-name-changed");
      const next = confirmarRevisionNombreLocal(before, entry, accountUid);
      if (!await commitPrivateBoxData(before, next, [], [], () => task.current() && datosActuales.current === before, setDatos)) {
        if (task.current()) showToast(t("toast.localSaveFailed")); return;
      }
      if (task.current()) { setNameCopies(null); showToast(t("boxes.nameResolved")); setRefreshVersion(value => value + 1); }
    } catch (error) {
      if (task.current()) showToast(t(error instanceof Error && error.message === "cajas-name-changed" ? "boxes.nameChanged" : "boxes.namePending"));
    } finally { guardandoRef.current = false; if (task.current()) setGuardando(false); }
  }

  function elegirNombreCaja(boxId: string, usar: "local" | "nube") {
    const copies = nameCopies, before = datosActuales.current;
    if (!copies || !cuentaActual() || !ready || guardandoRef.current || compartiendo || copies.local !== before) return;
    const pair = nameOptions.find(item => item.local.id === boxId);
    if (!pair) return;
    Alert.alert(t("boxes.nameReview"), t("boxes.nameConfirm", { local: pair.local.nombre, cloud: pair.remoto.nombre,
      chosen: usar === "local" ? pair.local.nombre : pair.remoto.nombre }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.save"), onPress: async () => {
        if (!cuentaActual() || before !== datosActuales.current || copies !== nameCopiesActual.current || !premiumForSync.current || guardandoRef.current || compartiendo) return;
        if (before.revisionesNombre?.some(entry => entry.boxId === boxId && entry.estado === "pendiente")) { showToast(t("boxes.namePending")); return; }
        try {
          const entry = prepararRevisionNombre(before, copies.remoto, accountUid, nuevoIdCaja("nombre"), boxId, usar);
          // Primero confirma las dos copias en disco. Si falla, no envía nada.
          if (!await guardarCambioCaja(conservarRevisionNombre(before, entry))) return;
          await reintentarNombreCaja(entry);
        } catch (error) {
          if (cuentaActual()) showToast(t(error instanceof Error && error.message === "cajas-name-history-full" ? "boxes.nameHistoryFull" : "boxes.nameChanged"));
        }
      } },
    ]);
  }

  const visibles = movimientos.filter(item => !filter
    || (filter === "transferencia" ? isLinkedSpaceTransfer(item) : !isLinkedSpaceTransfer(item) && item.tipo === filter));
  const filasVisibles = filter
    ? visibles.map(item => ({ key: `movement:${item.id}`, item, transferGroup: undefined }))
    : compactLinkedTransferRows(visibles);
  const filasSeleccionadas = countSelectedCompactRows(filasVisibles, visibles, seleccionados);
  function sacarDePersonal(valor: number, destino: string, spaceId: string, link: string, date = fechaLocal()): Transaction {
    const id = nextId();
    return {
      id, type: "expense", amount: valor, category: "otros", date,
      time: horaDe(Date.now()), method: "transfer", description: t("boxes.transferTo", { name: destino }),
      notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: link,
      internalTransferSpaceId: spaceId, internalTransferSpaceName: destino,
    };
  }

  async function crearCaja() {
    const nombre = nuevoNombre.trim().slice(0, 30);
    if (!nombre) return;
    const issue = amountInputError(montoInicial, userCurrency);
    if (issue) { showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")); return; }
    const nueva = { id: nuevoIdCaja("caja"), nombre, creadaEn: Date.now() };
    const inicial = parseAmountInput(montoInicial, userCurrency);
    if (origenDinero === "personal" && inicial > disponible) {
      showToast(t("boxes.notEnoughPersonal"));
      return;
    }
    if (!tomarAccionLocal()) return;
    const movimientoId = nuevoIdCaja("mov");
    const personal = inicial > 0 && origenDinero === "personal"
      ? sacarDePersonal(inicial, nombre, nueva.id, movimientoId)
      : undefined;
    const antes = datosActuales.current;
    const next = {
      ...antes,
      cajas: [...antes.cajas, nueva],
      movimientos: inicial > 0 ? [...antes.movimientos, {
        id: movimientoId, cajaId: nueva.id, tipo: "ingreso", monto: inicial,
        descripcion: t(origenDinero === "personal" ? "boxes.initialFromPersonal" : "boxes.initialExternal"),
        method: origenDinero === "personal" ? "transfer" : "cash", fecha: fechaLocal(), creadoEn: Date.now(), personalTransactionId: personal?.id,
      }] : antes.movimientos,
    } satisfies DatosCajas;
    if (!await guardarCambioCaja(next, personal ? [personal] : [])) return;
    setNuevoNombre("");
    setMontoInicial("");
    setOrigenDinero("externo");
    setCreando(false);
    setCajaId(nueva.id);
    setLista(false);
    showToast(t("boxes.saved"));
  }

  function guardarNombreCaja() {
    if (!caja || editandoAporteId != null) return;
    const nombreNuevo = nombreCajaEditado.trim().slice(0, 30);
    if (!nombreNuevo) { showToast(t("boxes.nameRequired")); return; }
    if (nombreNuevo === caja.nombre) { setEditandoNombreCaja(false); return; }
    if (!tomarAccionLocal()) return;
    setDatos(antes => ({
      ...antes,
      cajas: antes.cajas.map(item => item.id === caja.id ? { ...item, nombre: nombreNuevo, updatedAt: siguienteVersionCaja(item) } : item),
    }));
    setEditandoNombreCaja(false);
    showToast(t("boxes.renamed"));
  }

  async function unirseACajaCompartida() {
    const uid = auth.currentUser?.uid;
    const codigo = codigoCaja.trim().toUpperCase();
    if (!uid) { showToast(t("boxes.loginRequired")); return; }
    if (codigo.length !== 8 || cargandoUnion) return;
    const task = captureAccountTask(accountUid, cuentaActual);
    if (!task.current()) return;
    setCargandoUnion(true);
    try {
      const unida = await task.wait(() => unirseACaja(uid, userName || t("family.member"), codigo));
      setUniendoCaja(false);
      setCodigoCaja("");
      irUnaVez({ pathname: "/shared-boxes", params: { boxId: unida.id } });
    } catch (error) {
      if (task.current()) showToast(t(spaceErrorKey(error, true)));
    } finally {
      if (task.current()) setCargandoUnion(false);
    }
  }

  async function guardarMovimiento() {
    if (!caja || !anotando) return;
    const issue = amountInputError(monto, userCurrency);
    if (issue) { showToast(t(issue === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")); return; }
    const valor = parseAmountInput(monto, userCurrency);
    if (!(valor > 0)) return;
    if (!validSpaceDate(movementDate)) { showToast(t("common.validDateYmd")); return; }
    const aporteEditado = editandoAporteId ? movimientos.find(item => item.id === editandoAporteId) : undefined;
    if (aporteEditado?.personalTransactionId != null) {
      const minimo = minimumContributionAmount(movimientos, aporteEditado);
      if (valor < minimo - 0.005) { showToast(t("boxes.contributionUsed")); return; }
      if (valor - aporteEditado.monto > disponible) { showToast(t("boxes.notEnoughPersonal")); return; }
      if (!tomarAccionLocal()) return;
      const personal = transactions.find(tx => tx.id === aporteEditado.personalTransactionId);
      if (!personal) { showToast(t("boxes.syncConflict")); return; }
      const antes = datosActuales.current;
      const next = { ...antes, movimientos: antes.movimientos.map(item => item.id === aporteEditado.id ? { ...item, monto: valor, descripcion: descripcion.trim().slice(0, 60) || item.descripcion, updatedAt: siguienteVersionCaja(item) } : item) };
      if (!await guardarCambioCaja(next, [{ ...personal, amount: valor }])) return;
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
    const personal = anotando === "ingreso" && origenDinero === "personal"
      ? sacarDePersonal(valor, caja.nombre, caja.id, movimientoId, movementDate)
      : undefined;
    const movimiento = {
      id: movimientoId,
      cajaId: caja.id,
      tipo: anotando,
      method: anotando === "ingreso" && origenDinero === "personal" ? "transfer" : method,
      monto: valor,
      descripcion: descripcion.trim().slice(0, 60) || (anotando === "ingreso" ? t(origenDinero === "personal" ? "boxes.fromPersonal" : "boxes.externalMoney") : ""),
      ...(personal == null ? { category } : {}),
      notes: notes.trim(),
      fecha: movementDate,
      creadoEn: Date.now(),
      personalTransactionId: personal?.id,
    };
    const antes = datosActuales.current;
    if (!await guardarCambioCaja({ ...antes, movimientos: [...antes.movimientos, movimiento] }, personal ? [personal] : [])) return;
    setMonto("");
    setDescripcion("");
    setNotes("");
    setMovementDate(fechaLocal());
    setOrigenDinero("externo");
    setEditandoAporteId(null);
    setAnotando(null);
    showToast(t("boxes.movementSaved"));
  }

  async function borrarSeleccionados(ids = seleccionados) {
    if (repairBlocked) { showToast(t("boxes.repairReview")); return; }
    if (syncIssue === "boxes.syncConflict") { showToast(t("boxes.syncConflict")); return; }
    if (caja?.sharingPending) { showToast(t("boxes.sharingPending")); return; }
    if (!cuentaActual() || !ready || compartiendo || guardandoRef.current) return;
    const plan = planSpaceMovementDeletion(movimientos, ids);
    if (!plan.ok) {
      if (plan.reason === "empty") return;
      showToast(t(plan.reason === "contribution-used" ? "boxes.contributionUsed" : "boxes.notEnoughSpace"));
      return;
    }
    {
      // El plan protege lo consumido; el guardado retira ambas mitades y
      // sus marcas de borrado juntas, sin llamar al servidor compartido.
      const idsBorrados = new Set(plan.items.map(item => item.id));
      const antes = datosActuales.current;
      if (!await guardarCambioCaja({ ...antes, movimientos: antes.movimientos.filter(item => !idsBorrados.has(item.id)), movimientosBorrados: [...new Set([...antes.movimientosBorrados, ...idsBorrados])] }, [], plan.items.flatMap(item => item.personalTransactionId == null ? [] : [item.personalTransactionId]))) return;
    }
    setSeleccionados([]); setSeleccionando(false);
  }
  function confirmarBorrarTodo() {
    if (!visibles.length) return;
    const messageKey = visibles.some(isLinkedSpaceTransfer) ? "spaces.deleteLinkedMovementsMessage" : "spaces.deleteMovementsMessage";
    Alert.alert(t("spaces.deleteMovementsTitle"), t(messageKey, { count: visibles.length }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.deleteAll"), style: "destructive", onPress: () => void borrarSeleccionados(visibles.map(item => item.id)) },
    ]);
  }
  async function borrarCajas(ids = cajasSeleccionadas) {
    if (repairBlocked) { showToast(t("boxes.repairReview")); return false; }
    if (syncIssue === "boxes.syncConflict") { showToast(t("boxes.syncConflict")); return false; }
    if (!cuentaActual() || !ready || compartiendo || guardandoRef.current) return false;
    const candidatas = datos.cajas.filter(item => ids.includes(item.id));
    if (!candidatas.length) return false;
    if (candidatas.some(item => item.sharingPending)) { showToast(t("boxes.sharingPending")); return false; }
    if (candidatas.some(item => !canCloseLinkedSpace(datos.movimientos.filter(movement => movement.cajaId === item.id)))) {
      showToast(t("boxes.closeBalance"));
      return false;
    }
    const idsMovimientos = datos.movimientos.filter(item => ids.includes(item.cajaId)).map(item => item.id);
    const settled = candidatas.flatMap(item => settlePersonalTransfers(transactions, "box", item.id));
    const antes = datosActuales.current;
    if (!await guardarCambioCaja({
      ...antes,
      cajas: antes.cajas.filter(item => !ids.includes(item.id)),
      movimientos: antes.movimientos.filter(item => !ids.includes(item.cajaId)),
      cajasBorradas: [...new Set([...antes.cajasBorradas, ...ids])],
      movimientosBorrados: [...new Set([...antes.movimientosBorrados, ...idsMovimientos])],
    }, settled)) return false;
    setCajasSeleccionadas([]); setSeleccionandoCajas(false);
    return true;
  }
  function cerrarCajaActual() {
    if (!caja || !ready) return;
    if (!canCloseLinkedSpace(movimientos)) { showToast(t("boxes.closeBalance")); return; }
    const cajaIdActual = caja.id;
    Alert.alert(t("boxes.close"), t("boxes.deleteWarning"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("boxes.close"), style: "destructive", onPress: async () => {
        if (!await borrarCajas([cajaIdActual])) return;
        setCajaId(null);
        setLista(true);
      } },
    ]);
  }
  function confirmarBorrarTodasLasCajas() {
    if (!datos.cajas.length) return;
    Alert.alert(t("boxes.deleteAllTitle"), t("boxes.deleteAllMessage", { count: datos.cajas.length, amount: fmt(0) }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.deleteAll"), style: "destructive", onPress: () => borrarCajas(datos.cajas.map(item => item.id)) },
    ]);
  }

  async function devolverAPersonal() {
    if (!caja || devolvibleAPersonal <= 0) return;
    if (!tomarAccionLocal()) return;
    const movimientoId = nuevoIdCaja("mov");
    const personalId = nextId();
    const allocations = allocatePersonalReturn(movimientos, devolvibleAPersonal);
    const antes = datosActuales.current;
    await guardarCambioCaja({ ...antes, movimientos: [...antes.movimientos, { id: movimientoId, cajaId: caja.id, tipo: "gasto", monto: devolvibleAPersonal, descripcion: t("boxes.returnToPersonal"), method: "transfer", fecha: fechaLocal(), creadoEn: Date.now(), personalTransactionId: personalId, personalReturnAmount: devolvibleAPersonal }] }, [{ id: personalId, type: "income", amount: devolvibleAPersonal, category: "otros", date: fechaLocal(), time: horaDe(Date.now()), method: "transfer", description: t("boxes.returnFrom", { name: caja.nombre }), notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: movimientoId, internalTransferSpaceId: caja.id, internalTransferSpaceName: caja.nombre, internalTransferAllocations: allocations }]);
  }

  async function compartirCaja() {
    if (repairBlocked && !caja?.sharingPending) { showToast(t("boxes.repairReview")); return; }
    const uid = auth.currentUser?.uid;
    if (!uid || !caja || compartiendo || conversionEnCurso.current || guardandoRef.current) return;
    if (!isPremium && !caja.sharingPending) { irUnaVez("/premium"); return; }
    const hasLinkedMoney = movimientos.some(row => row.personalTransactionId != null)
      || transactions.some(row => row.internalTransfer === "box" && row.internalTransferSpaceId === caja.id);
    // Bloquear ANTES de copiar en Firebase, no después de publicar el destino.
    if (hasLinkedMoney && Platform.OS !== "android") { showToast(t("boxes.atomicAndroidOnly")); return; }
    if (!privateBoxLinksMatch(datosActuales.current, transactions, caja.id)) {
      reportSyncError(new Error("cajas-sync-conflict")); return;
    }
    const task = captureAccountTask(accountUid, cuentaActual);
    if (!task.current() || !ready || hasUnreadableLocalData()) return;
    conversionEnCurso.current = true; setCompartiendo(true);
    try {
      let pendingBox = caja;
      if (!caja.sharingPending) {
        const before = datosActuales.current;
        pendingBox = { ...caja, sharingPending: true, sharingAttempt: nuevoIntentoCaja() };
        if (!await guardarCambioCaja({ ...before, cajas: before.cajas.map(box => box.id === caja.id ? pendingBox : box) })) return;
      }
      const compartida = await task.wait(() => compartirCajaExistente(uid, userName || t("family.member"), pendingBox, movimientos, userCurrency, isPremium));
      const currentData = datosActuales.current;
      const currentBox = currentData.cajas.find(box => box.id === caja.id);
      if (!currentBox) throw new Error("cajas-sync-conflict");
      const currentDigest = await task.wait(() => huellaCaja(currentBox, currentData.movimientos.filter(row => row.cajaId === caja.id), userCurrency));
      if (currentDigest !== compartida.conversion.digest || currentData !== datosActuales.current || hasUnreadableLocalData()) throw new Error("cajas-sync-conflict");
      const enlacesMigrados = enlacesCajaConvertida(transactions, compartida.conversion);
      // Solo después de terminar toda la copia se retira la versión privada.
      // Los débitos enlazados de Personal se conservan porque ahora apuntan a
      // los mismos movimientos dentro de la caja compartida.
      if (!await guardarCambioCaja(retirarCajaConvertida(currentData, compartida.conversion), enlacesMigrados)) {
        reportSyncError(new Error("cajas-sync-conflict")); return;
      }
      setCajaId(null); setLista(true);
      let codigo: string | undefined;
      try { codigo = await task.wait(() => crearInvitacionCaja(uid, compartida.id)); }
      catch { if (task.current()) showToast(t("boxes.invitationRetry")); }
      if (task.current()) irUnaVez({ pathname: "/shared-boxes", params: { boxId: compartida.id, ...(codigo ? { invitation: codigo } : {}) } });
    } catch (error) {
      if (task.current()) {
        const original = error instanceof Error && error.message === "cajas-sharing-unconfirmed" ? error.cause : error;
        const reason = (original as { details?: { reason?: string } })?.details?.reason;
        if (reason === "migration-too-many-attempts") { showToast(t("boxes.sharingLimit")); return; }
        if (!isPremium && (reason === "migration-not-owner" || reason === "migration-premium-required")) { irUnaVez("/premium"); return; }
        if ((error instanceof Error && ["cajas-sync-conflict", "cajas-sharing-unconfirmed"].includes(error.message)) || (typeof reason === "string" && reason.startsWith("migration-"))) reportSyncError(new Error("cajas-sync-conflict"));
        else showToast(t(spaceErrorKey(error)));
      }
    }
    finally { if (task.current()) { conversionEnCurso.current = false; setCompartiendo(false); } }
  }

  async function cancelarCompartirCaja() {
    const uid = auth.currentUser?.uid;
    if (!uid || !caja?.sharingPending || compartiendo || conversionEnCurso.current || guardandoRef.current || cargandoUnion) return;
    const task = captureAccountTask(accountUid, cuentaActual);
    if (!task.current() || !ready || hasUnreadableLocalData()) return;
    const before = datosActuales.current;
    const originalBox = before.cajas.find(box => box.id === caja.id);
    if (!originalBox?.sharingPending) return;
    const rows = before.movimientos.filter(row => row.cajaId === caja.id);
    conversionEnCurso.current = true; setCompartiendo(true);
    try {
      const receipt = await task.wait(() => cancelarConversionCaja(uid, originalBox, rows, userCurrency));
      if (before !== datosActuales.current || hasUnreadableLocalData()) throw new Error("cajas-sync-conflict");
      if (receipt) {
        // Cancelar no devuelve dinero de una copia que YA fue publicada.
        if (!privateBoxLinksMatch(before, transactions, caja.id)) throw new Error("cajas-sync-conflict");
        if (!await guardarCambioCaja(retirarCajaConvertida(before, receipt), enlacesCajaConvertida(transactions, receipt))) return;
        setCajaId(null); setLista(true);
        showToast(t("boxes.alreadyShared"));
        irUnaVez({ pathname: "/shared-boxes", params: { boxId: receipt.targetId } });
      } else {
        const next = { ...before, cajas: before.cajas.map(box => {
          if (box.id !== caja.id) return box;
          const clean = { ...box }; delete clean.sharingPending; delete clean.sharingAttempt; return clean;
        }) };
        if (!await guardarCambioCaja(next)) return;
        showToast(t("boxes.sharingCancelled"));
      }
      setSyncIssue(null); setRefreshVersion(value => value + 1);
    } catch (error) {
      if (task.current()) showToast(t((error as { details?: { reason?: string } })?.details?.reason === "migration-too-many-attempts" ? "boxes.sharingLimit" : "boxes.cancelUnconfirmed"));
    } finally { if (task.current()) { conversionEnCurso.current = false; setCompartiendo(false); } }
  }

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pb-3">
        <BackButton onPress={safeBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("boxes.title")}</Text>
        <TouchableOpacity accessibilityLabel={t("common.refresh")} disabled={compartiendo || cargandoUnion || guardando} onPress={() => setRefreshVersion(value => value + 1)} className="h-10 w-10 items-center justify-center"><RefreshCw size={18} color="#64748b" /></TouchableOpacity>
      </View>
      <SpaceSwitcher active="boxes" />
      <Modal transparent visible={moneyBusy} animationType="fade" onRequestClose={() => undefined}>
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View accessibilityViewIsModal className="w-full rounded-2xl bg-white p-6 dark:bg-noche">
            <ActivityIndicator size="large" color="#059669" />
            <Text accessibilityLiveRegion="polite" className="mt-4 text-center text-sm text-slate-900 dark:text-slate-100">{t("boxes.moneyWorking")}</Text>
          </View>
        </View>
      </Modal>
      {syncIssue ? <Text accessibilityLiveRegion="polite" className="px-5 pb-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{t(syncIssue)}</Text> : null}
      {repairCloudChanged ? <Text accessibilityLiveRegion="polite" className="px-5 pb-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{t("boxes.repairCloudChanged")}</Text> : null}
      {ready && cloudReady && repairPlan.conflicts.length > 0 ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.repairReview")} disabled={guardando || compartiendo || (syncIssue === "boxes.syncConflict" && !isPremium)} onPress={revisarTransferencias} className="mx-5 mb-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
        <Text accessibilityLiveRegion="polite" className="text-xs leading-5 text-amber-800 dark:text-amber-200">{t("boxes.repairNotice", { count: repairPlan.conflicts.length })}</Text>
        <Text className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-200">{t("boxes.repairReview")}</Text>
      </TouchableOpacity> : null}

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
        {ready ? <PrivateBoxMoneyReview comparison={moneyComparison} reviews={(datos.revisionesImporte || []).filter(entry => entry.uid === accountUid)}
          candidates={moneyCandidates} message={moneyMessage} busy={guardando || compartiendo || cargandoUnion} premium={isPremium} t={t}
          compare={id => void consultarImporteCaja(id)} choose={elegirImporteCaja} retry={entry => void recuperarImporteCaja(entry)}
          retire={pedirRetirarImporteCaja}
          reviewAgain={entry => void revisarImporteCajaDeNuevo(entry)}
          cancel={() => { if (guardandoRef.current) return; setMoneyComparison(null); setMoneyMessage(null); }} /> : null}
        {ready && nameOptions.length > 0 ? <View className="mb-3 rounded-xl border border-amber-200 p-3 dark:border-amber-800">
          <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("boxes.nameReview")}</Text>
          <Text className="my-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{t("boxes.nameHelp")}</Text>
          {nameOptions.slice(0, 20).map(pair => <View key={pair.local.id} className="mb-3">
            <Text className="text-xs leading-5 text-slate-900 dark:text-slate-100">{t("boxes.nameVersions", { local: pair.local.nombre, cloud: pair.remoto.nombre })}</Text>
            <View className="mt-2 gap-2">
              <TouchableOpacity accessibilityRole="button" disabled={guardando || !isPremium} onPress={() => elegirNombreCaja(pair.local.id, "local")} className="min-h-11 justify-center rounded-lg bg-amber-50 px-3 dark:bg-amber-950"><Text className="font-bold text-amber-800 dark:text-amber-200">{t("boxes.nameUseLocal")}</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={guardando || !isPremium} onPress={() => elegirNombreCaja(pair.local.id, "nube")} className="min-h-11 justify-center rounded-lg bg-amber-50 px-3 dark:bg-amber-950"><Text className="font-bold text-amber-800 dark:text-amber-200">{t("boxes.nameUseCloud")}</Text></TouchableOpacity>
            </View>
          </View>)}
        </View> : null}
        {ready && pendingNames.length > 0 ? <View className="mb-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
          <Text className="text-xs leading-5 text-amber-800 dark:text-amber-200">{t("boxes.namePending")}</Text>
          {pendingNames.map(entry => <TouchableOpacity key={entry.id} accessibilityRole="button" disabled={guardando} onPress={() => void reintentarNombreCaja(entry)} className="min-h-11 justify-center"><Text className="font-bold text-amber-800 dark:text-amber-200">{t("boxes.nameRetry", { name: entry.elegido.nombre })}</Text></TouchableOpacity>)}
        </View> : null}
        {ready && (datos.revisionesNombre?.length ?? 0) > 0 ? <View className="mb-3">
          <TouchableOpacity accessibilityRole="button" onPress={() => setNameHistory(value => !value)} className="min-h-11 justify-center"><Text className="font-bold text-slate-600 dark:text-slate-300">{t("boxes.nameHistory")}</Text></TouchableOpacity>
          {nameHistory ? datos.revisionesNombre?.filter(entry => entry.uid === accountUid).map(entry => <Text key={entry.id} className="mb-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{t("boxes.nameVersions", { local: entry.local.nombre, cloud: entry.remoto.nombre })}</Text>) : null}
        </View> : null}
        {linkReview && ready && personalReady && cloudReady ? <View className="mb-4 rounded-xl border border-amber-200 p-3 dark:border-amber-800">
          <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("boxes.repairLinkTitle")}</Text>
          {linkMovement ? <Text className="mt-2 text-xs leading-5 text-slate-900 dark:text-slate-100">{t("boxes.repairLinkFor", { name: datos.cajas.find(box => box.id === linkMovement.cajaId)?.nombre || "", description: linkMovement.descripcion, amount: fmt(linkMovement.monto), date: linkMovement.fecha })}</Text> : null}
          <Text className="my-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{t("boxes.repairLinkHelp")}</Text>
          {linkCandidates.slice(0, linkLimit).map(row => <TouchableOpacity key={row.id} accessibilityRole="button" disabled={guardando || compartiendo || syncIssue === "boxes.syncConflict"} onPress={() => confirmarEnlaceHeredado(row.id)} className="mb-2 min-h-12 rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
            <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.description}</Text>
            <Text className="mt-1 text-xs text-slate-600 dark:text-slate-300">{fmt(row.amount)} · {row.date}{row.time ? ` · ${row.time}` : ""}</Text>
          </TouchableOpacity>)}
          {linkCandidates.length === 0 ? <Text className="mb-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{t("boxes.repairUncertain")}</Text> : null}
          {linkCandidates.length > linkLimit ? <TouchableOpacity accessibilityRole="button" onPress={() => setLinkLimit(value => value + 20)} className="min-h-11 justify-center"><Text className="font-bold text-amber-800 dark:text-amber-200">{t("common.show")}</Text></TouchableOpacity> : null}
          <TouchableOpacity accessibilityRole="button" disabled={guardando} onPress={() => setLinkReview(null)} className="min-h-11 justify-center"><Text className="font-bold text-slate-600 dark:text-slate-300">{t("common.cancel")}</Text></TouchableOpacity>
        </View> : null}
        {!ready ? <Text className="py-8 text-center text-slate-500">{t("common.loading")}</Text> : lista || !caja ? (
          <>
            <Text className="mb-3 mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">{t("boxes.subtitle")}</Text>
            <View className="mb-3 flex-row gap-3">
              <TouchableOpacity onPress={() => setCreando(true)} className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600"><Plus size={18} color="#fff" /><Text className="font-bold text-white">{t("family.create")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setUniendoCaja(value => !value); setCodigoCaja(""); }} className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"><UserPlus size={18} color="#0d9488" /><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.join")}</Text></TouchableOpacity>
            </View>
            {uniendoCaja ? <View className="mb-3 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde">
              <TextInput
                disableFullscreenUI
                autoFocus
                editable={!cargandoUnion}
                value={codigoCaja}
                onChangeText={value => setCodigoCaja(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8))}
                onSubmitEditing={() => void unirseACajaCompartida()}
                returnKeyType="done"
                maxLength={8}
                autoCapitalize="characters"
                placeholder={t("family.codePlaceholder")}
                placeholderTextColor="#94a3b8"
                className="h-11 rounded-xl border-[1.5px] border-emerald-400 px-4 text-slate-900 dark:text-slate-100"
              />
              <View className="mt-2 flex-row gap-2">
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.cancel")} disabled={cargandoUnion} onPress={() => { setUniendoCaja(false); setCodigoCaja(""); }} className="min-h-10 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><X size={19} color="#64748b" /></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.save")} disabled={cargandoUnion || codigoCaja.length !== 8} onPress={() => void unirseACajaCompartida()} className={`min-h-10 flex-1 items-center justify-center rounded-xl ${cargandoUnion || codigoCaja.length !== 8 ? "bg-emerald-300" : "bg-emerald-600"}`}><Check size={19} color="#fff" /></TouchableOpacity>
              </View>
            </View> : null}
            {datos.cajas.length > 0 ? <View className="mb-2 flex-row items-center justify-between">
              {seleccionandoCajas ? <>
                <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{cajasSeleccionadas.length} {cajasSeleccionadas.length === 1 ? "seleccionada" : "seleccionadas"}</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity accessibilityLabel={t("common.deleteSelected")} disabled={!cajasSeleccionadas.length} onPress={() => borrarCajas()} className={`h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950 ${!cajasSeleccionadas.length ? "opacity-40" : ""}`}><Trash2 size={19} color="#f43f5e" /></TouchableOpacity>
                  <TouchableOpacity onPress={confirmarBorrarTodasLasCajas} hitSlop={6}><Text className="text-sm font-bold text-rose-500">{t("home.deleteAll")}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => { setSeleccionandoCajas(false); setCajasSeleccionadas([]); }} hitSlop={6}><Text className="text-sm font-bold text-emerald-600">{t("common.cancel")}</Text></TouchableOpacity>
                </View>
              </> : <>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("boxes.myBoxes")}</Text>
                <TouchableOpacity accessibilityLabel={t("common.select")} onPress={() => { setSeleccionandoCajas(true); setCajasSeleccionadas([]); }} className="flex-row items-center gap-1"><ListChecks size={16} color="#059669" /><Text className="text-sm font-bold text-emerald-600">{t("common.select")}</Text></TouchableOpacity>
              </>}
            </View> : null}
            {datos.cajas.map((item) => (
              <TouchableOpacity
                key={item.id}
                disabled={guardando || (!seleccionandoCajas && creando)}
                onPress={() => seleccionandoCajas ? setCajasSeleccionadas(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]) : (setCajaId(item.id), setLista(false))}
                className={`mb-2 min-h-[76px] flex-row items-center rounded-2xl border-[1.5px] bg-white px-3 py-2 dark:bg-noche-2 ${cajasSeleccionadas.includes(item.id) ? "border-teal-500 bg-teal-50 dark:border-teal-500 dark:bg-teal-950" : "border-slate-200 dark:border-noche-borde"}`}
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Boxes size={19} color="#0d9488" /></View>
                <View className="ml-2.5 flex-1">
                  <Text numberOfLines={1} className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100">{item.nombre}</Text>
                  <Text className="mt-0.5 text-[13px] font-bold text-teal-700 dark:text-teal-300">{fmt(saldoCaja(item.id, datos.movimientos))}</Text>
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
                <TextInput disableFullscreenUI editable={!guardando} value={nuevoNombre} onChangeText={setNuevoNombre} maxLength={30} autoFocus placeholder={t("boxes.namePlaceholder")} placeholderTextColor="#94a3b8" className="h-12 flex-1 rounded-xl border-[1.5px] border-teal-400 px-4 text-slate-900 dark:text-slate-100" />
                <TouchableOpacity accessibilityLabel={t("common.save")} accessibilityState={{ busy: guardando }} disabled={guardando} onPress={crearCaja} className="h-12 w-12 items-center justify-center rounded-xl bg-emerald-600"><Check size={20} color="#fff" /></TouchableOpacity>
                <TouchableOpacity accessibilityLabel={t("common.cancel")} disabled={guardando} onPress={() => setCreando(false)} className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><X size={20} color="#64748b" /></TouchableOpacity>
                </View>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("boxes.initialAmount")}</Text>
                <TextInput disableFullscreenUI editable={!guardando} value={montoInicial} onChangeText={value => setMontoInicial(sanitizeSafeAmountInput(value, userCurrency))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border border-teal-400 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" />
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("boxes.moneyOrigin")}</Text>
                <View className="flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} disabled={guardando} onPress={() => setOrigenDinero(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenDinero === origin ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "boxes.fromPersonal" : "boxes.externalMoney")}</Text></TouchableOpacity>)}</View>
                {origenDinero === "personal" ? <Text className="text-[11px] text-slate-500">{t("boxes.personalAvailable", { amount: fmt(disponible) })}</Text> : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View className="mb-2 mt-1 flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setLista(true)} className="flex-row items-center gap-2 py-2"><ArrowLeftRight size={16} color="#0d9488" /><Text className="text-xs font-bold text-teal-700 dark:text-teal-300">{t("boxes.all")}</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.inviteAccessibility")} disabled={compartiendo || guardando} onPress={() => void compartirCaja()} className="h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950">
                <UserPlus size={19} color="#0d9488" />
              </TouchableOpacity>
            </View>
            {caja.sharingPending ? <View className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
              <Text accessibilityLiveRegion="polite" className="text-xs leading-5 text-amber-900 dark:text-amber-100">{t("boxes.sharingPending")}</Text>
              <View className="mt-2 flex-row gap-2">
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: compartiendo }} disabled={compartiendo || guardando} onPress={() => void compartirCaja()} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-teal-600 px-2"><Text className="text-xs font-bold text-white">{t("boxes.retrySharing")}</Text></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: compartiendo }} disabled={compartiendo || guardando} onPress={() => void cancelarCompartirCaja()} className="min-h-11 flex-1 items-center justify-center rounded-xl border border-amber-400 px-2"><Text className="text-xs font-bold text-amber-900 dark:text-amber-100">{t("boxes.cancelSharing")}</Text></TouchableOpacity>
              </View>
            </View> : null}
            <View className="rounded-3xl bg-teal-600 px-4 py-3">
              <View className="flex-row items-center gap-2">
                {editandoNombreCaja ? <>
                  <TextInput disableFullscreenUI autoFocus value={nombreCajaEditado} onChangeText={setNombreCajaEditado} onSubmitEditing={guardarNombreCaja} returnKeyType="done" maxLength={30} selectTextOnFocus placeholder={t("boxes.namePlaceholder")} placeholderTextColor="#99f6e4" className="h-9 min-w-0 flex-1 rounded-xl bg-teal-700/70 px-3 text-base font-bold text-white" />
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.save")} onPress={guardarNombreCaja} className="h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Check size={18} color="#fff" /></TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={() => { setEditandoNombreCaja(false); setNombreCajaEditado(caja.nombre); }} className="h-9 w-9 items-center justify-center rounded-xl bg-white/20"><X size={17} color="#fff" /></TouchableOpacity>
                </> : <>
                  <Text numberOfLines={1} className="flex-1 text-base font-bold text-teal-100">{caja.nombre}</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.editName")} onPress={() => { setNombreCajaEditado(caja.nombre); setEditandoNombreCaja(true); }} className="h-9 w-9 items-center justify-center rounded-xl bg-teal-700">
                    <Pencil size={16} color="#fff" />
                  </TouchableOpacity>
                </>}
              </View>
              <Text className="text-[26px] font-extrabold leading-8 text-white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{fmt(saldoActual)}</Text>
            </View>
            {devolvibleAPersonal > 0 ? <TouchableOpacity disabled={guardando} onPress={devolverAPersonal} className="mt-2 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{t("boxes.returnAmount", { amount: fmt(devolvibleAPersonal) })}</Text></TouchableOpacity> : null}
            <View className="mt-2 flex-row justify-between">
              <TouchableOpacity style={{ width: "48%", height: 40 }} accessibilityRole="button" disabled={!ready || guardando} onPress={() => { setMonto(""); setDescripcion(""); setNotes(""); setOrigenDinero("externo"); setCategory("salario"); setMovementDate(fechaLocal()); setMethod("cash"); setAnotando("ingreso"); }} className="flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2">
                <Plus size={16} color="#fff" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-[13px] font-extrabold text-white">{t("boxes.addMoney")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ width: "48%", height: 40 }} accessibilityRole="button" accessibilityLabel={t("boxes.close")} disabled={!ready || guardando} onPress={cerrarCajaActual} className="flex-row items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 dark:border-rose-900 dark:bg-rose-950">
                <X size={15} color="#e11d48" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-[13px] font-extrabold text-rose-700 dark:text-rose-300">{t("boxes.close")}</Text>
              </TouchableOpacity>
            </View>
            <SpaceOverviewTotals income={resumen.ingresos} expense={resumen.gastos} filter={filter} onFilter={setFilter} format={fmt} />
            <SpaceMovementSheet visible={Boolean(anotando)} type={anotando} onType={next => { setAnotando(next); setCategory(next === "ingreso" ? "salario" : "otros"); }} onClose={() => { if (!guardandoRef.current) { setAnotando(null); setEditandoAporteId(null); } }} onSave={guardarMovimiento} amount={monto} onAmount={value => setMonto(sanitizeSafeAmountInput(value, userCurrency))} description={descripcion} onDescription={setDescripcion} method={method} onMethod={setMethod} currency={userCurrency} category={category} onCategory={setCategory} date={movementDate} onDate={setMovementDate} notes={notes} onNotes={setNotes} origin={origenDinero} onOrigin={setOrigenDinero} availableText={t("boxes.personalAvailable", { amount: fmt(disponible) })} disabled={!ready || guardando} />
            <View className={`mb-2 mt-5 ${seleccionando ? "flex-row items-center justify-between" : "flex-row items-center gap-1"}`}>
              {seleccionando ? <>
                <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{filasSeleccionadas} {filasSeleccionadas === 1 ? "seleccionado" : "seleccionados"}</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity accessibilityLabel={t("common.deleteSelected")} disabled={!seleccionados.length} onPress={() => borrarSeleccionados()} className={`h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950 ${!seleccionados.length ? "opacity-40" : ""}`}><Trash2 size={19} color="#f43f5e" /></TouchableOpacity>
                  <TouchableOpacity onPress={confirmarBorrarTodo} hitSlop={6}><Text className="text-sm font-bold text-rose-500">{t("home.deleteAll")}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => { setSeleccionando(false); setSeleccionados([]); }} hitSlop={6}><Text className="text-sm font-bold text-emerald-600">{t("common.cancel")}</Text></TouchableOpacity>
                </View>
              </> : <>
                <MovementAllButton label={t("boxes.history")} activeFilter={filter !== null} onPress={() => setFilter(null)} />
                <View className="flex-row items-center gap-1">
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.filterIncome")} accessibilityState={{ selected: filter === "ingreso" }} onPress={() => setFilter("ingreso")} className={`h-10 w-10 items-center justify-center rounded-xl ${filter === "ingreso" ? "bg-emerald-200" : "bg-emerald-50"}`}><ArrowUp size={19} color="#047857" strokeWidth={2.6} /></TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("boxes.filterExpense")} accessibilityState={{ selected: filter === "gasto" }} onPress={() => setFilter("gasto")} className={`h-10 w-10 items-center justify-center rounded-xl ${filter === "gasto" ? "bg-rose-200" : "bg-rose-50"}`}><ArrowDown size={19} color="#be123c" strokeWidth={2.6} /></TouchableOpacity>
                </View>
                <TouchableOpacity accessibilityLabel={t("boxes.selectMovements")} onPress={() => { setSeleccionando(true); setSeleccionados([]); }} className="min-h-10 flex-row items-center gap-1 px-1"><ListChecks size={18} color="#059669" /><Text className="text-[15px] font-bold text-emerald-600">{t("common.select")}</Text></TouchableOpacity>
              </>}
            </View>
            {filasVisibles.length === 0 ? <Text className="py-5 text-center text-sm text-slate-500">{t(filter ? "spaces.noResults" : "boxes.noMovements")}</Text> : filasVisibles.slice(0, movementLimit).map(({ key, item, transferGroup }) => {
              const transferencia = isLinkedSpaceTransfer(item);
              const retorno = isLinkedSpaceReturn(item);
              const idsDeFila = movementIdsForCompactRow({ key, item, transferGroup }, visibles);
              const filaSeleccionada = idsDeFila.length > 0 && idsDeFila.every(id => seleccionados.includes(id));
              return <TouchableOpacity key={key} disabled={!seleccionando} onPress={() => setSeleccionados(prev => filaSeleccionada ? prev.filter(id => !idsDeFila.includes(id)) : [...new Set([...prev, ...idsDeFila])])} className={`mb-2 flex-row items-center rounded-2xl border-[1.5px] p-3 dark:border-noche-borde ${filaSeleccionada ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200"}`}>
                <View className={`h-9 w-9 items-center justify-center rounded-xl ${transferencia ? "bg-blue-100 dark:bg-blue-950" : item.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"}`}>{transferencia ? <ArrowRightLeft size={17} color="#2563eb" /> : item.tipo === "ingreso" ? <ArrowUp size={17} color="#047857" /> : <ArrowDown size={17} color="#be123c" />}</View>
                {transferencia ? <View className="ml-3 flex-1"><SpaceTransferAmounts title={caja.nombre} sentLabel={t("boxes.receivedFromPersonal")} returnedLabel={t("boxes.returnedToPersonal")} sent={transferGroup?.sent ?? (retorno ? 0 : item.monto)} returned={transferGroup?.returned ?? (retorno ? item.monto : 0)} format={fmt} /></View> : <><View className="ml-3 flex-1"><Text className="text-[15px] font-bold text-slate-800 dark:text-slate-100" numberOfLines={1}>{item.descripcion || (item.tipo === "ingreso" ? t("boxes.income") : t("boxes.expense"))}</Text><Text className="text-xs text-slate-500">{item.fecha}{item.method ? ` · ${methodLabel(item.method, t)}` : ""}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className={`mr-2 max-w-[38%] text-[15px] font-extrabold ${item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>{item.tipo === "ingreso" ? "+" : "-"}{fmt(item.monto)}</Text></>}
                {seleccionando ? <View className={`ml-2 h-5 w-5 rounded-full border-2 ${filaSeleccionada ? "border-teal-600 bg-teal-600" : "border-slate-400"}`} /> : null}
              </TouchableOpacity>;
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
