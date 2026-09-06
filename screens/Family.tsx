import BackButton from "@/components/BackButton";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import { useAppData } from "@/contexts/AppDataContext";
import { parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { auth } from "@/utils/firebase";
import { irUnaVez, safeBack } from "@/utils/nav";
import {
  borrarMovimientoFamilia, cargarFamiliaActiva, crearFamilia, crearInvitacionFamilia,
  guardarMovimientoFamilia, listarMiembrosFamilia, listarMovimientosFamilia,
  renombrarFamilia, salirDeFamilia, unirseAFamilia, type EspacioFamilia, type MiembroFamilia,
  type MovimientoFamilia,
} from "@/utils/cloudFamilia";
import { ArrowDown, ArrowUp, Check, LogOut, Pencil, Plus, RefreshCw, Trash2, UserPlus, UsersRound, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const fechaHoy = () => new Date().toISOString().slice(0, 10);

export default function Family() {
  const { t, fmt, userName, showToast, isPremium } = useAppData();
  const insets = useSafeAreaInsets();
  const [familia, setFamilia] = useState<EspacioFamilia | null>(null);
  const [miembros, setMiembros] = useState<MiembroFamilia[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFamilia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<"crear" | "unir" | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [invitacion, setInvitacion] = useState("");
  const [tipo, setTipo] = useState<"ingreso" | "gasto" | null>(null);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const tRef = useRef(t);
  const toastRef = useRef(showToast);
  tRef.current = t;
  toastRef.current = showToast;

  const recargar = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setCargando(false); return; }
    try {
      const activa = await cargarFamiliaActiva(uid);
      setFamilia(activa);
      if (activa) {
        const [people, movements] = await Promise.all([listarMiembrosFamilia(activa.id), listarMovimientosFamilia(activa.id)]);
        setMiembros(people); setMovimientos(movements);
      } else { setMiembros([]); setMovimientos([]); }
    } catch { toastRef.current(tRef.current("family.connectionError")); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);
  const saldo = useMemo(() => movimientos.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0), [movimientos]);
  const resumen = useMemo(() => movimientos.reduce(
    (total, item) => ({
      ingresos: total.ingresos + (item.tipo === "ingreso" ? item.monto : 0),
      gastos: total.gastos + (item.tipo === "gasto" ? item.monto : 0),
    }),
    { ingresos: 0, gastos: 0 },
  ), [movimientos]);
  const owner = familia?.ownerUid === auth.currentUser?.uid;

  async function ejecutar(action: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    try { await action(); }
    catch { showToast(t("family.connectionError")); }
    finally { setOcupado(false); }
  }

  const crear = () => ejecutar(async () => {
    if (!isPremium) { irUnaVez("/premium"); return; }
    const uid = auth.currentUser?.uid; const value = nombre.trim().slice(0, 35);
    if (!uid || !value) return;
    await crearFamilia(uid, userName || t("family.member"), value);
    setModo(null); setNombre(""); await recargar(); showToast(t("family.created"));
  });

  const unir = () => ejecutar(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || codigo.length !== 8) return;
    try {
      await unirseAFamilia(uid, userName || t("family.member"), codigo);
      setModo(null); setCodigo(""); await recargar(); showToast(t("family.joined"));
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
    await guardarMovimientoFamilia(familia.id, uid, { tipo, monto: value, descripcion: descripcion.trim().slice(0, 60), fecha: fechaHoy() });
    setMonto(""); setDescripcion(""); setTipo(null); await recargar(); showToast(t("family.movementSaved"));
  });

  const borrar = (id: string) => ejecutar(async () => { if (familia) { await borrarMovimientoFamilia(familia.id, id); await recargar(); } });
  const salir = () => ejecutar(async () => {
    const uid = auth.currentUser?.uid; if (!uid || !familia || owner) return;
    await salirDeFamilia(uid, familia.id); setFamilia(null); setMiembros([]); setMovimientos([]); showToast(t("family.left"));
  });

  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center justify-between px-5 pb-3"><BackButton onPress={safeBack} /><Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("family.title")}</Text><TouchableOpacity onPress={() => void recargar()} className="h-10 w-10 items-center justify-center"><RefreshCw size={18} color="#64748b" /></TouchableOpacity></View>
    <SpaceSwitcher active="family" />
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
      {cargando ? <Text className="py-8 text-center text-slate-500">{t("common.loading")}</Text> : !auth.currentUser ? <Text className="mt-6 text-center text-slate-600 dark:text-slate-300">{t("family.loginRequired")}</Text> : !familia ? <>
        <View className="mt-3 items-center rounded-3xl border-[1.5px] border-emerald-200 bg-emerald-50 px-5 py-6 dark:border-emerald-800 dark:bg-emerald-950/30"><View className="h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600"><UsersRound size={27} color="#fff" /></View><Text className="mt-3 text-center text-lg font-extrabold text-slate-900 dark:text-slate-100">{t("family.startTitle")}</Text><Text className="mt-1 text-center text-sm leading-5 text-slate-600 dark:text-slate-300">{t("family.startBody")}</Text></View>
        <View className="mt-4 flex-row gap-3"><TouchableOpacity onPress={() => isPremium ? setModo("crear") : irUnaVez("/premium")} className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${isPremium ? "bg-emerald-600" : "bg-amber-500"}`}><Plus size={18} color="#fff" /><Text className="font-bold text-white">{isPremium ? t("family.create") : t("family.createPremium")}</Text></TouchableOpacity><TouchableOpacity onPress={() => setModo("unir")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-noche-2"><UserPlus size={18} color="#0d9488" /><Text className="font-bold text-teal-700 dark:text-teal-300">{t("family.join")}</Text></TouchableOpacity></View>
        {modo ? <View className="mt-4 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><TextInput disableFullscreenUI autoFocus value={modo === "crear" ? nombre : codigo} onChangeText={modo === "crear" ? setNombre : value => setCodigo(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8))} maxLength={modo === "crear" ? 35 : 8} autoCapitalize={modo === "crear" ? "sentences" : "characters"} placeholder={t(modo === "crear" ? "family.namePlaceholder" : "family.codePlaceholder")} placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-emerald-400 px-4 text-slate-900 dark:text-slate-100" /><View className="mt-3 flex-row gap-2"><TouchableOpacity onPress={() => setModo(null)} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><X size={19} color="#64748b" /></TouchableOpacity><TouchableOpacity onPress={modo === "crear" ? crear : unir} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Check size={19} color="#fff" /></TouchableOpacity></View></View> : null}
      </> : <>
        <View className="mt-2 rounded-3xl bg-emerald-600 px-4 py-3"><View className="flex-row items-center"><View className="flex-1">{editandoNombre ? <TextInput disableFullscreenUI autoFocus value={nuevoNombre} onChangeText={setNuevoNombre} maxLength={35} selectTextOnFocus className="h-9 rounded-xl bg-white px-3 text-base font-bold text-slate-900" /> : <Text numberOfLines={1} className="text-base font-bold text-emerald-100">{familia.nombre}</Text>}</View>{owner ? editandoNombre ? <View className="ml-2 flex-row"><TouchableOpacity accessibilityLabel={t("common.save")} onPress={guardarNombre} className="h-9 w-9 items-center justify-center rounded-xl bg-white"><Check size={18} color="#059669" /></TouchableOpacity><TouchableOpacity accessibilityLabel={t("common.cancel")} onPress={() => { setEditandoNombre(false); setNuevoNombre(""); }} className="ml-1 h-9 w-9 items-center justify-center rounded-xl bg-emerald-700"><X size={18} color="#fff" /></TouchableOpacity></View> : <TouchableOpacity accessibilityLabel={t("family.editName")} onPress={() => { setNuevoNombre(familia.nombre); setEditandoNombre(true); }} className="ml-2 h-9 w-9 items-center justify-center rounded-xl bg-emerald-700"><Pencil size={17} color="#fff" /></TouchableOpacity> : null}</View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58} className="text-[26px] font-extrabold leading-8 text-white">{fmt(saldo)}</Text><Text className="text-xs leading-4 text-emerald-100">{t("family.sharedBalance")}</Text><View className="mt-1.5 flex-row border-t border-emerald-400/60 pt-1.5"><View className="flex-1"><Text className="text-xs font-semibold leading-4 text-emerald-100">{t("boxes.income")}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className="text-sm font-extrabold leading-5 text-white">{fmt(resumen.ingresos)}</Text></View><View className="mx-3 h-8 w-px bg-emerald-400/70" /><View className="flex-1"><Text className="text-xs font-semibold leading-4 text-emerald-100">{t("boxes.expense")}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className="text-sm font-extrabold leading-5 text-white">{fmt(resumen.gastos)}</Text></View></View></View>
        <View className="mt-3 flex-row gap-3"><TouchableOpacity onPress={() => setTipo("ingreso")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-100"><ArrowUp size={18} color="#047857" /><Text className="font-bold text-emerald-700">{t("boxes.income")}</Text></TouchableOpacity><TouchableOpacity onPress={() => setTipo("gasto")} className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-rose-100"><ArrowDown size={18} color="#be123c" /><Text className="font-bold text-rose-700">{t("boxes.expense")}</Text></TouchableOpacity></View>
        {tipo ? <View className="mt-3 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><TextInput disableFullscreenUI value={monto} onChangeText={value => setMonto(sanitizeSafeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" className="h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-lg font-bold text-slate-900 dark:text-slate-100" /><TextInput disableFullscreenUI value={descripcion} onChangeText={setDescripcion} maxLength={60} placeholder={t("boxes.description")} placeholderTextColor="#94a3b8" className="mt-2 h-12 rounded-xl border-[1.5px] border-slate-200 px-4 text-slate-900 dark:text-slate-100" /><View className="mt-3 flex-row gap-2"><TouchableOpacity onPress={() => setTipo(null)} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text></TouchableOpacity><TouchableOpacity onPress={guardar} className="min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600"><Text className="font-bold text-white">{t("common.save")}</Text></TouchableOpacity></View></View> : null}
        <View className="mt-4 rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><View className="flex-row items-center justify-between"><Text className="font-extrabold text-slate-900 dark:text-slate-100">{t("family.members")} · {miembros.length}</Text>{owner ? <TouchableOpacity onPress={invitar} className="min-h-10 flex-row items-center gap-1 rounded-xl bg-teal-50 px-3 dark:bg-teal-950"><UserPlus size={16} color="#0d9488" /><Text className="text-xs font-bold text-teal-700 dark:text-teal-300">{isPremium ? t("family.invite") : t("family.invitePremium")}</Text></TouchableOpacity> : null}</View>{invitacion ? <View className="mt-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950"><Text className="text-xs text-slate-600 dark:text-slate-300">{t("family.shareCode")}</Text><Text selectable className="mt-1 text-center text-2xl font-extrabold tracking-[4px] text-emerald-700 dark:text-emerald-300">{invitacion}</Text><Text className="mt-1 text-center text-[11px] text-slate-500">{t("family.codeExpires")}</Text></View> : null}<View className="mt-2 flex-row flex-wrap gap-2">{miembros.map(item => <View key={item.uid} className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-noche-2"><Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.nombre}{item.rol === "owner" ? " · ★" : ""}</Text></View>)}</View></View>
        <Text className="mb-2 mt-5 font-extrabold text-slate-900 dark:text-slate-100">{t("family.history")}</Text>
        {movimientos.length === 0 ? <Text className="py-5 text-center text-sm text-slate-500">{t("family.noMovements")}</Text> : movimientos.map(item => <View key={item.id} className="mb-2 flex-row items-center rounded-2xl border-[1.5px] border-slate-200 p-3 dark:border-noche-borde"><View className={`h-9 w-9 items-center justify-center rounded-xl ${item.tipo === "ingreso" ? "bg-emerald-100" : "bg-rose-100"}`}>{item.tipo === "ingreso" ? <ArrowUp size={17} color="#047857" /> : <ArrowDown size={17} color="#be123c" />}</View><View className="ml-3 flex-1"><Text numberOfLines={1} className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{item.descripcion || t(item.tipo === "ingreso" ? "boxes.income" : "boxes.expense")}</Text><Text className="text-xs text-slate-500">{item.fecha}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className={`mr-1 max-w-[38%] text-[15px] font-extrabold ${item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>{item.tipo === "ingreso" ? "+" : "-"}{fmt(item.monto)}</Text><TouchableOpacity onPress={() => void borrar(item.id)} className="h-10 w-10 items-center justify-center"><Trash2 size={16} color="#e11d48" /></TouchableOpacity></View>)}
        {!owner ? <TouchableOpacity onPress={salir} className="mt-5 min-h-11 flex-row items-center justify-center gap-2"><LogOut size={17} color="#e11d48" /><Text className="font-bold text-rose-600">{t("family.leave")}</Text></TouchableOpacity> : null}
      </>}
    </ScrollView>
  </View>;
}
