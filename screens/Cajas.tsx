import { SpaceTotals, SpacePaymentMethod, SpaceFilterReset, type MovementFilter } from "@/components/SpaceMovementControls";
import { methodLabel } from "@/constants/i18n";
import BackButton from "@/components/BackButton";
import SpaceSwitcher from "@/components/SpaceSwitcher";
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
import { nextId } from "@/utils/id";
import { irUnaVez, safeBack } from "@/utils/nav";
import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";
import { ArrowDown, ArrowLeftRight, ArrowUp, Boxes, Check, Plus, Trash2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Share, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function fechaLocal(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export default function Cajas() {
  const { t, fmt, showToast, disponible, addOrUpdateTransaction, deleteTransaction, isPremium, userName, userCurrency } = useAppData();
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState<DatosCajas>(CAJAS_VACIAS);
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
  const [descripcion, setDescripcion] = useState("");
  const [borrandoCaja, setBorrandoCaja] = useState(false);
  const [ready, setReady] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const local = await loadJSON<DatosCajas>(STORAGE_KEYS.cajasDinero, CAJAS_VACIAS);
      const uid = auth.currentUser?.uid;
      const remoto = uid ? await bajarCajas(uid) : null;
      const unidos = remoto ? fusionarCajas(local, remoto) : local;
      if (!alive) return;
      setDatos(unidos);
      setReady(true);
      void saveJSON(STORAGE_KEYS.cajasDinero, unidos);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void saveJSON(STORAGE_KEYS.cajasDinero, datos);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const timer = setTimeout(() => { void subirCajas(uid, datos); }, 700);
    return () => clearTimeout(timer);
  }, [datos, ready]);

  const caja = datos.cajas.find((item) => item.id === cajaId);
  const movimientos = useMemo(
    () => datos.movimientos.filter((item) => item.cajaId === cajaId).sort((a, b) => b.creadoEn - a.creadoEn),
    [cajaId, datos.movimientos],
  );
  const resumen = useMemo(() => movimientos.reduce(
    (total, item) => ({
      ingresos: total.ingresos + (item.tipo === "ingreso" ? item.monto : 0),
      gastos: total.gastos + (item.tipo === "gasto" ? item.monto : 0),
    }),
    { ingresos: 0, gastos: 0 },
  ), [movimientos]);
  const saldoActual = caja ? saldoCaja(caja.id, datos.movimientos) : 0;
  const aportadoDesdePersonal = movimientos.reduce((sum, item) => {
    if (item.tipo === "ingreso" && item.personalTransactionId != null) return sum + item.monto;
    return sum - (item.personalReturnAmount || 0);
  }, 0);
  const devolvibleAPersonal = Math.max(0, Math.min(saldoActual, aportadoDesdePersonal));

  const visibles = movimientos.filter(item => !filter || item.tipo === filter);
  function sacarDePersonal(valor: number, destino: string, link: string): number {
    const id = nextId();
    addOrUpdateTransaction({
      id, type: "expense", amount: valor, category: "otros", date: fechaLocal(),
      time: horaDe(Date.now()), method: "transfer", description: t("boxes.transferTo", { name: destino }),
      notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: link,
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
    const movimientoId = nuevoIdCaja("mov");
    const personalTransactionId = inicial > 0 && origenDinero === "personal"
      ? sacarDePersonal(inicial, nombre, movimientoId)
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
    if (anotando === "ingreso" && origenDinero === "personal" && valor > disponible) {
      showToast(t("boxes.notEnoughPersonal"));
      return;
    }
    const movimientoId = nuevoIdCaja("mov");
    const personalTransactionId = anotando === "ingreso" && origenDinero === "personal"
      ? sacarDePersonal(valor, caja.nombre, movimientoId)
      : undefined;
    const movimiento = {
      id: movimientoId,
      cajaId: caja.id,
      tipo: anotando,
      method: anotando === "ingreso" && origenDinero === "personal" ? "transfer" : method,
      monto: valor,
      descripcion: descripcion.trim().slice(0, 60) || (anotando === "ingreso" ? t(origenDinero === "personal" ? "boxes.fromPersonal" : "boxes.externalMoney") : ""),
      fecha: fechaLocal(),
      creadoEn: Date.now(),
      personalTransactionId,
    };
    setDatos((antes) => ({ ...antes, movimientos: [...antes.movimientos, movimiento] }));
    setMonto("");
    setDescripcion("");
    setOrigenDinero("externo");
    setAnotando(null);
    showToast(t("boxes.movementSaved"));
  }

  function borrarMovimiento(id: string) {
    const movimiento = datos.movimientos.find((item) => item.id === id);
    if (movimiento?.personalTransactionId != null) deleteTransaction(movimiento.personalTransactionId);
    setDatos((antes) => ({
      ...antes,
      movimientos: antes.movimientos.filter((item) => item.id !== id),
      movimientosBorrados: [...new Set([...antes.movimientosBorrados, id])],
    }));
  }

  function borrarCaja() {
    if (!caja) return;
    if (Math.abs(saldoActual) > 0.000001) { showToast(t("boxes.closeBalance")); setBorrandoCaja(false); return; }
    const idsMovimientos = datos.movimientos.filter((item) => item.cajaId === caja.id).map((item) => item.id);
    setDatos((antes) => ({
      ...antes,
      cajas: antes.cajas.filter((item) => item.id !== caja.id),
      movimientos: antes.movimientos.filter((item) => item.cajaId !== caja.id),
      cajasBorradas: [...new Set([...antes.cajasBorradas, caja.id])],
      movimientosBorrados: [...new Set([...antes.movimientosBorrados, ...idsMovimientos])],
    }));
    setCajaId(null);
    setLista(true);
    setBorrandoCaja(false);
    showToast(t("boxes.deleted"));
  }

  function devolverAPersonal() {
    if (!caja || devolvibleAPersonal <= 0) return;
    const movimientoId = nuevoIdCaja("mov");
    const personalId = nextId();
    setDatos(antes => ({ ...antes, movimientos: [...antes.movimientos, { id: movimientoId, cajaId: caja.id, tipo: "gasto", monto: devolvibleAPersonal, descripcion: t("boxes.returnToPersonal"), method: "transfer", fecha: fechaLocal(), creadoEn: Date.now(), personalTransactionId: personalId, personalReturnAmount: devolvibleAPersonal }] }));
    addOrUpdateTransaction({ id: personalId, type: "income", amount: devolvibleAPersonal, category: "otros", date: fechaLocal(), time: horaDe(Date.now()), method: "transfer", description: t("boxes.returnFrom", { name: caja.nombre }), notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: movimientoId });
  }

  async function compartirCaja() {
    const uid = auth.currentUser?.uid;
    if (!uid || !caja || compartiendo) return;
    if (!isPremium) { irUnaVez("/premium"); return; }
    setCompartiendo(true);
    try {
      const compartida = await compartirCajaExistente(uid, userName || t("family.member"), caja, movimientos, userCurrency);
      const codigo = await crearInvitacionCaja(uid, compartida.id);
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
      await Share.share({ message: t("boxes.shareMessage", { name: caja.nombre, code: codigo }) });
      irUnaVez("/shared-boxes");
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

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
        {!ready ? <Text className="py-8 text-center text-slate-500">{t("common.loading")}</Text> : lista || !caja ? (
          <>
            <Text className="mb-3 mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">{t("boxes.subtitle")}</Text>
            <TouchableOpacity onPress={() => irUnaVez("/shared-boxes?join=1")} className="mb-3 min-h-12 items-center justify-center rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-950"><Text className="text-base font-bold text-emerald-700 dark:text-emerald-300">{t("boxes.join")}</Text></TouchableOpacity>
            {datos.cajas.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => { setCajaId(item.id); setLista(false); }}
                className="mb-3 flex-row items-center rounded-2xl border-[1.5px] border-slate-200 bg-white p-4 dark:border-noche-borde dark:bg-noche-2"
              >
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950"><Boxes size={20} color="#0d9488" /></View>
                <View className="ml-3 flex-1">
                  <Text className="font-extrabold text-slate-900 dark:text-slate-100">{item.nombre}</Text>
                  <Text className="mt-0.5 text-xs font-bold text-teal-700 dark:text-teal-300">{fmt(saldoCaja(item.id, datos.movimientos))}</Text>
                </View>
                <ArrowLeftRight size={17} color="#64748b" />
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
            ) : (
              <TouchableOpacity onPress={() => setCreando(true)} className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600"><Plus size={19} color="#fff" /><Text className="font-extrabold text-white">{t("boxes.create")}</Text></TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setLista(true)} className="mb-2 mt-1 flex-row items-center gap-2 py-2"><ArrowLeftRight size={16} color="#0d9488" /><Text className="text-xs font-bold text-teal-700 dark:text-teal-300">{t("boxes.all")}</Text></TouchableOpacity>
            <View className="rounded-3xl bg-teal-600 px-4 py-3">
              <Text className="text-base font-bold text-teal-100">{caja.nombre}</Text>
              <Text className="text-[26px] font-extrabold leading-8 text-white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{fmt(saldoActual)}</Text>
              <SpaceTotals income={resumen.ingresos} expense={resumen.gastos} filter={filter} onFilter={setFilter} format={fmt} />
            </View>
            <View className="mt-3 flex-row gap-3">
              <TouchableOpacity onPress={() => { setOrigenDinero("externo"); setAnotando("ingreso"); }} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-100"><ArrowUp size={18} color="#047857" /><Text className="font-bold text-emerald-700">{t("boxes.income")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setAnotando("gasto")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-rose-100"><ArrowDown size={18} color="#be123c" /><Text className="font-bold text-rose-700">{t("boxes.expense")}</Text></TouchableOpacity>
            </View>
            {anotando ? (
              <View className="mt-3 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde">
                <Text className="mb-2 text-sm font-extrabold text-slate-800 dark:text-slate-100">{anotando === "ingreso" ? t("boxes.newIncome") : t("boxes.newExpense")}</Text>
                <TextInput disableFullscreenUI value={monto} onChangeText={(value) => setMonto(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" />
                <TextInput disableFullscreenUI value={descripcion} onChangeText={setDescripcion} maxLength={60} placeholder={t("boxes.description")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-slate-900 dark:text-slate-100" />
                {anotando === "ingreso" ? <><Text className="mb-1 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("boxes.moneyOrigin")}</Text><View className="flex-row gap-2">{(["externo", "personal"] as const).map(origin => <TouchableOpacity key={origin} onPress={() => setOrigenDinero(origin)} className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${origenDinero === origin ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200 dark:border-noche-borde"}`}><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(origin === "personal" ? "boxes.fromPersonal" : "boxes.externalMoney")}</Text></TouchableOpacity>)}</View>{origenDinero === "personal" ? <Text className="mt-1 text-[11px] text-slate-500">{t("boxes.personalAvailable", { amount: fmt(disponible) })}</Text> : null}</> : null}
                {anotando !== "ingreso" || origenDinero === "externo" ? <SpacePaymentMethod value={method} onChange={setMethod} /> : null}
                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity onPress={() => setAnotando(null)} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={guardarMovimiento} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Text className="font-bold text-white">{t("common.save")}</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
            {devolvibleAPersonal > 0 ? <TouchableOpacity onPress={devolverAPersonal} className="mt-3 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{t("boxes.returnAmount", { amount: fmt(devolvibleAPersonal) })}</Text></TouchableOpacity> : null}
            <Text className="mb-2 mt-5 font-extrabold text-slate-900 dark:text-slate-100">{t("boxes.history")}</Text>
            <SpaceFilterReset filter={filter} onReset={() => setFilter(null)} />
            {visibles.length === 0 ? <Text className="py-5 text-center text-sm text-slate-500">{t(filter ? "spaces.noResults" : "boxes.noMovements")}</Text> : visibles.map((item) => (
              <View key={item.id} className="mb-2 flex-row items-center rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde">
                <View className={`h-9 w-9 items-center justify-center rounded-xl ${item.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"}`}>{item.tipo === "ingreso" ? <ArrowUp size={17} color="#047857" /> : <ArrowDown size={17} color="#be123c" />}</View>
                <View className="ml-3 flex-1"><Text className="text-[15px] font-bold text-slate-800 dark:text-slate-100" numberOfLines={1}>{item.descripcion || (item.tipo === "ingreso" ? t("boxes.income") : t("boxes.expense"))}</Text><Text className="text-xs text-slate-500">{item.fecha}{item.method ? ` · ${methodLabel(item.method, t)}` : ""}</Text></View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className={`mr-2 max-w-[38%] text-[15px] font-extrabold ${item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>{item.tipo === "ingreso" ? "+" : "-"}{fmt(item.monto)}</Text>
                <TouchableOpacity accessibilityLabel={t("common.delete")} onPress={() => borrarMovimiento(item.id)} className="h-10 w-10 items-center justify-center"><Trash2 size={17} color="#e11d48" /></TouchableOpacity>
              </View>
            ))}
            {borrandoCaja ? (
              <View className="mt-5 rounded-2xl bg-rose-50 p-3"><Text className="text-xs text-rose-700">{t("boxes.deleteWarning")}</Text><View className="mt-3 flex-row gap-2"><TouchableOpacity onPress={() => setBorrandoCaja(false)} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-white"><Text className="font-bold text-slate-600">{t("common.cancel")}</Text></TouchableOpacity><TouchableOpacity onPress={borrarCaja} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-rose-600"><Text className="font-bold text-white">{t("common.delete")}</Text></TouchableOpacity></View></View>
            ) : <TouchableOpacity onPress={() => setBorrandoCaja(true)} className="mt-5 min-h-11 flex-row items-center justify-center gap-2"><Trash2 size={17} color="#e11d48" /><Text className="font-bold text-rose-600">{t("boxes.delete")}</Text></TouchableOpacity>}
            {auth.currentUser ? <TouchableOpacity disabled={compartiendo} onPress={() => void compartirCaja()} className="mt-2 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{compartiendo ? t("common.loading") : `${t("boxes.share")}${isPremium ? "" : " · Premium"}`}</Text></TouchableOpacity> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
