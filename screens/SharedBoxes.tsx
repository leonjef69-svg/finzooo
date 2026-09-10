import { SpaceTotals, SpacePaymentMethod, SpaceFilterReset, type MovementFilter } from "@/components/SpaceMovementControls";
import { methodLabel } from "@/constants/i18n";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";
import { fmt as formatAmount, horaDe } from "@/utils/format";
import { currencySymbolFor } from "@/constants/currencies";
import { auth } from "@/utils/firebase";
import { irUnaVez, safeBack } from "@/utils/nav";
import { parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { nextId } from "@/utils/id";
import { LogOut, Trash2, UserMinus, UsersRound } from "lucide-react-native";
import { borrarMovimientoCajaCompartida, cerrarCajaCompartida, crearInvitacionCaja, escucharMovimientosCaja, guardarMovimientoCajaCompartida, listarCajasCompartidas, listarMiembrosCaja, observarCierreCaja, quitarMiembroCaja, salirDeCaja, unirseACaja, type CajaCompartida, type MiembroCajaCompartida, type MovimientoCajaCompartida } from "@/utils/cloudCajasCompartidas";

export default function SharedBoxes() {
  const { t, userCurrency, isPremium, userName, showToast, addOrUpdateTransaction, deleteLinkedTransferTransaction } = useAppData();
  const insets = useSafeAreaInsets();
  const { join } = useLocalSearchParams<{ join?: string }>();
  const [cajas, setCajas] = useState<CajaCompartida[]>([]);
  const [caja, setCaja] = useState<CajaCompartida | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCajaCompartida[]>([]);
  const [miembros, setMiembros] = useState<MiembroCajaCompartida[]>([]);
  const [modo, setModo] = useState<"unir" | "ingreso" | "gasto" | null>(join === "1" ? "unir" : null);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [method, setMethod] = useState("cash");
  const [filter, setFilter] = useState<MovementFilter>(null);
  const [codigo, setCodigo] = useState("");
  const [invitacion, setInvitacion] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const errorRef = useRef(() => {});
  errorRef.current = () => showToast(t("family.connectionError"));
  const uid = auth.currentUser?.uid;
  const moneda = caja?.currency || userCurrency;
  const fmt = (amount: number) => formatAmount(amount, currencySymbolFor(moneda), moneda);
  useEffect(() => {
    let active = true;
    if (uid) void listarCajasCompartidas(uid).then(items => { if (active) setCajas(items); }).catch(() => { if (active) errorRef.current(); });
    return () => { active = false; };
  }, [uid]);
  useEffect(() => {
    setMovimientos([]); setMiembros([]);
    if (!caja) return;
    void listarMiembrosCaja(caja.id).then(setMiembros).catch(() => errorRef.current());
    return escucharMovimientosCaja(caja.id, setMovimientos, () => errorRef.current());
  }, [caja]);
  useEffect(() => {
    if (!caja) return;
    return observarCierreCaja(caja.id, () => { setCajas(items => items.filter(item => item.id !== caja.id)); setCaja(null); setMovimientos([]); setMiembros([]); }, () => errorRef.current());
  }, [caja]);
  const ingresos = movimientos.filter(item => item.tipo === "ingreso").reduce((sum, item) => sum + item.monto, 0);
  const gastos = movimientos.filter(item => item.tipo === "gasto").reduce((sum, item) => sum + item.monto, 0);
  const visibles = movimientos.filter(item => !filter || item.tipo === filter);
  const owner = caja?.ownerUid === uid;
  const saldo = ingresos - gastos;
  const aportadoDesdePersonal = movimientos.reduce((sum, item) => {
    if (item.personalOwnerUid !== uid) return sum;
    if (item.tipo === "ingreso" && item.personalTransactionId != null) return sum + item.monto;
    return sum - (item.personalReturnAmount || 0);
  }, 0);
  const devolvibleAPersonal = owner ? Math.max(0, Math.min(saldo, aportadoDesdePersonal)) : 0;
  function limpiar() { setModo(null); setNombre(""); setMonto(""); setCodigo(""); }
  async function ejecutar(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); } catch { errorRef.current(); }
    finally { lock.current = false; setBusy(false); }
  }
  const guardar = () => ejecutar(async () => {
    if (!uid) return;
    if (modo === "unir") {
      if (codigo.length !== 8) return;
      const nueva = await unirseACaja(uid, userName, codigo);
      setCajas(items => [nueva, ...items.filter(item => item.id !== nueva.id)]); setCaja(nueva);
    } else if (caja && (modo === "ingreso" || modo === "gasto")) {
      const valor = parseAmountInput(monto); if (valor <= 0) return;
      await guardarMovimientoCajaCompartida(caja.id, uid, { tipo: modo, monto: valor, descripcion: nombre.trim(), fecha: new Date().toLocaleDateString("sv-SE"), method });
    }
    limpiar();
  });
  const borrar = (item: MovimientoCajaCompartida) => ejecutar(async () => {
    if (!caja) return;
    await borrarMovimientoCajaCompartida(caja.id, item.id);
    if (item.personalOwnerUid === uid && item.personalTransactionId != null) deleteLinkedTransferTransaction(item.personalTransactionId);
  });
  const devolverAPersonal = () => ejecutar(async () => {
    if (!uid || !caja || devolvibleAPersonal <= 0) return;
    const personalId = nextId();
    await guardarMovimientoCajaCompartida(caja.id, uid, {
      tipo: "gasto", monto: devolvibleAPersonal, descripcion: t("boxes.returnToPersonal"),
      fecha: new Date().toLocaleDateString("sv-SE"), method: "transfer",
      personalTransactionId: personalId, personalOwnerUid: uid, personalReturnAmount: devolvibleAPersonal,
    });
    addOrUpdateTransaction({ id: personalId, type: "income", amount: devolvibleAPersonal, category: "otros", date: new Date().toLocaleDateString("sv-SE"), time: horaDe(Date.now()), method: "transfer", description: t("boxes.returnFrom", { name: caja.nombre }), notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: caja.id });
  });
  const salir = () => { if (!uid || !caja || owner) return; Alert.alert(t("boxes.leave"), t("boxes.leaveWarning"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("boxes.leave"), style: "destructive", onPress: () => void ejecutar(async () => { await salirDeCaja(uid, caja.id); setCajas(items => items.filter(item => item.id !== caja.id)); setCaja(null); }) }]); };
  const quitar = (member: MiembroCajaCompartida) => { if (!caja || !owner || member.rol === "owner") return; Alert.alert(t("boxes.removeMember"), member.nombre, [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void ejecutar(async () => { await quitarMiembroCaja(caja.id, member.uid); setMiembros(items => items.filter(item => item.uid !== member.uid)); }) }]); };
  const cerrar = () => {
    if (!uid || !caja || !owner) return;
    if (Math.abs(saldo) > 0.000001) { showToast(t("boxes.closeBalance")); return; }
    Alert.alert(t("boxes.close"), t("boxes.closeWarning"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("boxes.close"), style: "destructive", onPress: () => void ejecutar(async () => { await cerrarCajaCompartida(uid, caja.id); setCajas(items => items.filter(item => item.id !== caja.id)); setCaja(null); }) }]);
  };
  function boton(label: string, action: () => void) {
    return <TouchableOpacity disabled={busy} onPress={action} className="min-h-12 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3"><Text className="text-sm font-bold text-white">{label}</Text></TouchableOpacity>;
  }
  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center gap-3 px-4 pb-3"><BackButton onPress={() => { if (caja) { setCaja(null); limpiar(); setInvitacion(""); } else safeBack(); }} /><Text className="text-base font-bold text-slate-900 dark:text-white">{t("boxes.shared")}</Text></View>
    <ScrollView className="px-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      {!uid ? <Text className="text-slate-600 dark:text-slate-200">{t("boxes.loginRequired")}</Text> : <>
        {!caja ? <>
          <View className="mb-3 flex-row gap-2">{boton(t("boxes.join"), () => { limpiar(); setModo("unir"); })}</View>
          {cajas.map(item => <TouchableOpacity key={item.id} onPress={() => { limpiar(); setCaja(item); }} className="mb-2 rounded-2xl border border-slate-200 p-4 dark:border-noche-borde"><Text className="text-base font-bold text-slate-900 dark:text-white">{item.nombre}</Text></TouchableOpacity>)}
        </> : <>
          <View className="rounded-2xl bg-emerald-600 p-4"><Text className="text-base font-bold text-white">{caja.nombre}</Text><Text adjustsFontSizeToFit numberOfLines={1} className="text-[26px] font-extrabold text-white">{fmt(saldo)}</Text><SpaceTotals income={ingresos} expense={gastos} filter={filter} onFilter={setFilter} format={fmt} /></View>
          <View className="my-3 flex-row gap-2">{boton(t("boxes.income"), () => { limpiar(); setModo("ingreso"); })}{boton(t("boxes.expense"), () => { limpiar(); setModo("gasto"); })}</View>
          {caja.ownerUid === uid ? <TouchableOpacity disabled={busy} onPress={() => { if (!isPremium) { irUnaVez("/premium"); return; } void ejecutar(async () => setInvitacion(await crearInvitacionCaja(uid, caja.id))); }} className="min-h-12 items-center justify-center"><Text className="text-sm font-bold text-teal-700 dark:text-teal-300">{t("family.invite")}</Text></TouchableOpacity> : null}
          {invitacion ? <TouchableOpacity onPress={() => void Share.share({ message: invitacion })} className="rounded-xl bg-emerald-50 p-3"><Text selectable className="text-center text-xl font-bold text-emerald-800">{invitacion}</Text><Text className="text-center text-sm text-slate-600">{t("family.codeExpires")}</Text></TouchableOpacity> : null}
          {devolvibleAPersonal > 0 ? <TouchableOpacity disabled={busy} onPress={() => void devolverAPersonal()} className="mt-2 min-h-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950"><Text className="font-bold text-teal-700 dark:text-teal-300">{t("boxes.returnAmount", { amount: fmt(devolvibleAPersonal) })}</Text></TouchableOpacity> : null}
          <View className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-noche-borde"><View className="flex-row items-center gap-2"><UsersRound size={17} color="#0d9488" /><Text className="font-bold text-slate-900 dark:text-white">{t("family.members")} · {miembros.length}</Text></View>{miembros.map(member => <View key={member.uid} className="mt-2 flex-row items-center"><Text numberOfLines={1} className="flex-1 text-sm text-slate-700 dark:text-slate-200">{member.nombre}{member.rol === "owner" ? " · ★" : ""}</Text>{owner && member.rol !== "owner" ? <TouchableOpacity accessibilityLabel={t("boxes.removeMember")} onPress={() => quitar(member)} className="h-9 w-9 items-center justify-center"><UserMinus size={16} color="#e11d48" /></TouchableOpacity> : null}</View>)}</View>
        </>}
        {modo ? <View className="my-3 gap-2 rounded-2xl border border-slate-200 p-3 dark:border-noche-borde">
          <TextInput disableFullscreenUI editable={!busy} value={modo === "unir" ? codigo : nombre} onChangeText={value => modo === "unir" ? setCodigo(value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8)) : setNombre(value)} maxLength={modo === "unir" ? 8 : 60} placeholder={t(modo === "unir" ? "family.codePlaceholder" : "boxes.description")} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border border-teal-400 px-3 text-base text-slate-900 dark:text-white" />
          {modo !== "unir" ? <TextInput disableFullscreenUI editable={!busy} value={monto} onChangeText={value => setMonto(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border border-teal-400 px-3 text-lg text-slate-900 dark:text-white" /> : null}
          {modo === "ingreso" || modo === "gasto" ? <SpacePaymentMethod value={method} onChange={setMethod} disabled={busy} /> : null}
          <View className="flex-row gap-2">{boton(t("common.cancel"), limpiar)}{boton(busy ? t("common.loading") : t("common.save"), guardar)}</View>
        </View> : null}
        <SpaceFilterReset filter={filter} onReset={() => setFilter(null)} />
        {caja && visibles.length === 0 ? <Text className="py-3 text-sm text-slate-500">{t("spaces.noResults")}</Text> : null}
        {caja ? visibles.map(item => { const puedeBorrar = item.personalOwnerUid ? item.personalOwnerUid === uid : owner || item.creadoPor === uid; return <View key={item.id} className="mb-2 rounded-xl border border-slate-200 p-3 dark:border-noche-borde"><View className="flex-row items-center gap-2"><View className="flex-1"><View className="flex-row gap-3"><Text numberOfLines={1} className="flex-1 text-base font-bold text-slate-900 dark:text-white">{item.descripcion || t(item.tipo === "ingreso" ? "boxes.income" : "boxes.expense")}</Text><Text numberOfLines={1} adjustsFontSizeToFit className="max-w-[50%] text-base font-bold text-teal-600">{item.tipo === "ingreso" ? "+" : "-"}{fmt(item.monto)}</Text></View><Text className="text-xs text-slate-500">{item.fecha}{item.method ? ` · ${methodLabel(item.method, t)}` : ""}</Text></View>{puedeBorrar ? <TouchableOpacity accessibilityLabel={t("common.delete")} onPress={() => void borrar(item)} className="h-9 w-9 items-center justify-center"><Trash2 size={15} color="#e11d48" /></TouchableOpacity> : <View className="h-9 w-9" />}</View></View>; }) : null}
        {caja && !owner ? <TouchableOpacity onPress={salir} className="mt-3 min-h-11 flex-row items-center justify-center gap-2"><LogOut size={17} color="#e11d48" /><Text className="font-bold text-rose-600">{t("boxes.leave")}</Text></TouchableOpacity> : null}
        {caja && owner ? <TouchableOpacity onPress={cerrar} className="mt-3 min-h-11 flex-row items-center justify-center gap-2"><Trash2 size={17} color="#e11d48" /><Text className="font-bold text-rose-600">{t("boxes.close")}</Text></TouchableOpacity> : null}
      </>}
    </ScrollView>
  </View>;
}
