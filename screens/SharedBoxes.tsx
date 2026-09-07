import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";
import { fmt as formatAmount } from "@/utils/format";
import { currencySymbolFor } from "@/constants/currencies";
import { auth } from "@/utils/firebase";
import { irUnaVez, safeBack } from "@/utils/nav";
import { parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { crearCajaCompartida, crearInvitacionCaja, escucharMovimientosCaja, guardarMovimientoCajaCompartida, listarCajasCompartidas, unirseACaja, type CajaCompartida, type MovimientoCajaCompartida } from "@/utils/cloudCajasCompartidas";

export default function SharedBoxes() {
  const { t, userCurrency, isPremium, userName, showToast } = useAppData();
  const insets = useSafeAreaInsets();
  const [cajas, setCajas] = useState<CajaCompartida[]>([]);
  const [caja, setCaja] = useState<CajaCompartida | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCajaCompartida[]>([]);
  const [modo, setModo] = useState<"crear" | "unir" | "ingreso" | "gasto" | null>(null);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
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
    setMovimientos([]);
    if (!caja) return;
    return escucharMovimientosCaja(caja.id, setMovimientos, () => errorRef.current());
  }, [caja]);
  const ingresos = movimientos.filter(item => item.tipo === "ingreso").reduce((sum, item) => sum + item.monto, 0);
  const gastos = movimientos.filter(item => item.tipo === "gasto").reduce((sum, item) => sum + item.monto, 0);
  function limpiar() { setModo(null); setNombre(""); setMonto(""); setCodigo(""); }
  async function ejecutar(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); } catch { errorRef.current(); }
    finally { lock.current = false; setBusy(false); }
  }
  const guardar = () => ejecutar(async () => {
    if (!uid) return;
    if (modo === "crear") {
      if (!isPremium) { irUnaVez("/premium"); return; }
      if (!nombre.trim()) return;
      const nueva = await crearCajaCompartida(uid, userName, nombre, parseAmountInput(monto), userCurrency);
      setCajas(items => [nueva, ...items]); setCaja(nueva);
    } else if (modo === "unir") {
      if (codigo.length !== 8) return;
      const nueva = await unirseACaja(uid, userName, codigo);
      setCajas(items => [nueva, ...items.filter(item => item.id !== nueva.id)]); setCaja(nueva);
    } else if (caja && (modo === "ingreso" || modo === "gasto")) {
      const valor = parseAmountInput(monto); if (valor <= 0) return;
      await guardarMovimientoCajaCompartida(caja.id, uid, { tipo: modo, monto: valor, descripcion: nombre.trim(), fecha: new Date().toLocaleDateString("sv-SE") });
    }
    limpiar();
  });
  function boton(label: string, action: () => void) {
    return <TouchableOpacity disabled={busy} onPress={action} className="min-h-12 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3"><Text className="text-sm font-bold text-white">{label}</Text></TouchableOpacity>;
  }
  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center gap-3 px-4 pb-3"><BackButton onPress={() => { if (caja) { setCaja(null); limpiar(); setInvitacion(""); } else safeBack(); }} /><Text className="text-base font-bold text-slate-900 dark:text-white">{t("boxes.shared")}</Text></View>
    <ScrollView className="px-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      {!uid ? <Text className="text-slate-600 dark:text-slate-200">{t("boxes.loginRequired")}</Text> : <>
        {!caja ? <>
          <View className="mb-3 flex-row gap-2">{boton(t("family.createPremium"), () => { if (isPremium) { limpiar(); setModo("crear"); } else irUnaVez("/premium"); })}{boton(t("boxes.join"), () => { limpiar(); setModo("unir"); })}</View>
          {cajas.map(item => <TouchableOpacity key={item.id} onPress={() => { limpiar(); setCaja(item); }} className="mb-2 rounded-2xl border border-slate-200 p-4 dark:border-noche-borde"><Text className="text-base font-bold text-slate-900 dark:text-white">{item.nombre}</Text></TouchableOpacity>)}
        </> : <>
          <View className="rounded-2xl bg-emerald-600 p-4"><Text className="text-base font-bold text-white">{caja.nombre}</Text><Text adjustsFontSizeToFit numberOfLines={1} className="text-[26px] font-extrabold text-white">{fmt(ingresos - gastos)}</Text><View className="mt-2 flex-row gap-3"><View className="flex-1"><Text className="text-sm text-white">{t("boxes.income")}</Text><Text adjustsFontSizeToFit numberOfLines={1} className="font-bold text-white">{fmt(ingresos)}</Text></View><View className="flex-1"><Text className="text-sm text-white">{t("boxes.expense")}</Text><Text adjustsFontSizeToFit numberOfLines={1} className="font-bold text-white">{fmt(gastos)}</Text></View></View></View>
          <View className="my-3 flex-row gap-2">{boton(t("boxes.income"), () => { limpiar(); setModo("ingreso"); })}{boton(t("boxes.expense"), () => { limpiar(); setModo("gasto"); })}</View>
          {caja.ownerUid === uid ? <TouchableOpacity disabled={busy} onPress={() => { if (!isPremium) { irUnaVez("/premium"); return; } void ejecutar(async () => setInvitacion(await crearInvitacionCaja(uid, caja.id))); }} className="min-h-12 items-center justify-center"><Text className="text-sm font-bold text-teal-700 dark:text-teal-300">{t("family.invite")}</Text></TouchableOpacity> : null}
          {invitacion ? <TouchableOpacity onPress={() => void Share.share({ message: invitacion })} className="rounded-xl bg-emerald-50 p-3"><Text selectable className="text-center text-xl font-bold text-emerald-800">{invitacion}</Text><Text className="text-center text-sm text-slate-600">{t("family.codeExpires")}</Text></TouchableOpacity> : null}
        </>}
        {modo ? <View className="my-3 gap-2 rounded-2xl border border-slate-200 p-3 dark:border-noche-borde">
          <TextInput disableFullscreenUI editable={!busy} value={modo === "unir" ? codigo : nombre} onChangeText={value => modo === "unir" ? setCodigo(value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8)) : setNombre(value)} maxLength={modo === "unir" ? 8 : modo === "crear" ? 30 : 60} placeholder={t(modo === "unir" ? "family.codePlaceholder" : modo === "crear" ? "boxes.namePlaceholder" : "boxes.description")} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border border-teal-400 px-3 text-base text-slate-900 dark:text-white" />
          {modo !== "unir" ? <><TextInput disableFullscreenUI editable={!busy} value={monto} onChangeText={value => setMonto(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border border-teal-400 px-3 text-lg text-slate-900 dark:text-white" />{modo === "crear" ? <Text className="text-sm text-slate-500">{t("boxes.externalHelp")}</Text> : null}</> : null}
          <View className="flex-row gap-2">{boton(t("common.cancel"), limpiar)}{boton(busy ? t("common.loading") : t("common.save"), guardar)}</View>
        </View> : null}
        {caja ? movimientos.map(item => <View key={item.id} className="mb-2 rounded-xl border border-slate-200 p-3 dark:border-noche-borde"><View className="flex-row gap-3"><Text numberOfLines={1} className="flex-1 text-base font-bold text-slate-900 dark:text-white">{item.descripcion || t(item.tipo === "ingreso" ? "boxes.income" : "boxes.expense")}</Text><Text numberOfLines={1} adjustsFontSizeToFit className="max-w-[50%] text-base font-bold text-teal-600">{item.tipo === "ingreso" ? "+" : "-"}{fmt(item.monto)}</Text></View><Text className="text-xs text-slate-500">{item.fecha}</Text></View>) : null}
      </>}
    </ScrollView>
  </View>;
}
