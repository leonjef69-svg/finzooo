import BackButton from "@/components/BackButton";
import { auth } from "@/utils/firebase";
import { listarFamilias, cerrarFamilia, listarMiembrosFamilia, quitarMiembroFamilia, renombrarFamilia, type EspacioFamilia, type MiembroFamilia } from "@/utils/cloudFamilia";
import { safeBack } from "@/utils/nav";
import { Check, UserMinus, UsersRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "@/contexts/AppDataContext";
import { useLocalSearchParams } from "expo-router";

/** Administración aislada: el menú de Familia no debe alterar su pantalla de movimientos. */
export default function FamilySettings() {
  const { t, showToast } = useAppData();
  const insets = useSafeAreaInsets();
  const [familia, setFamilia] = useState<EspacioFamilia | null>(null);
  const [miembros, setMiembros] = useState<MiembroFamilia[]>([]);
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(true);
  const uid = auth.currentUser?.uid ?? "";
  const { familyId } = useLocalSearchParams<{ familyId?: string }>();
  const owner = familia?.ownerUid === uid;

  useEffect(() => {
    let active = true;
    setCargando(true);
    setFamilia(null);
    setMiembros([]);
    void (async () => {
      if (!uid) { if (active) setCargando(false); return; }
      const listaFamilias = await listarFamilias(uid).catch(() => []);
      const actual = familyId ? listaFamilias.find(item => item.id === familyId) ?? null : listaFamilias[0] ?? null;
      if (!active) return;
      if (!actual) { setCargando(false); return; }
      const lista = await listarMiembrosFamilia(actual.id).catch(() => []);
      if (!active) return;
      setFamilia(actual); setNombre(actual.nombre); setMiembros(lista); setCargando(false);
    })();
    return () => { active = false; };
  }, [familyId, uid]);

  const guardarNombre = async () => {
    if (!familia || !owner) return;
    const limpio = nombre.trim();
    if (!limpio) return;
    try {
      await renombrarFamilia(familia.id, limpio);
      setFamilia(prev => prev ? { ...prev, nombre: limpio } : prev);
      showToast(t("family.renamed"));
    } catch { showToast(t("family.connectionError")); }
  };
  const quitar = (miembro: MiembroFamilia) => Alert.alert(t("family.removeMember"), miembro.nombre, [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.delete"), style: "destructive", onPress: () => void (async () => {
      if (!familia) return;
      try {
        await quitarMiembroFamilia(familia.id, miembro.uid);
        setMiembros(actual => actual.filter(item => item.uid !== miembro.uid));
      } catch { showToast(t("family.connectionError")); }
    })() },
  ]);
  const cerrar = () => Alert.alert(t("family.close"), t("family.closeWarning"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("family.close"), style: "destructive", onPress: () => void (async () => {
      if (!familia) return;
      try { await cerrarFamilia(uid, familia.id); safeBack(); }
      catch (error) {
        const code = (error as { code?: string }).code;
        showToast(t(code === "functions/failed-precondition" ? "family.closeBalance" : "family.connectionError"));
      }
    })() },
  ]);

  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center px-5 pb-4"><BackButton onPress={safeBack} /><Text className="ml-3 flex-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">{t("family.manageTitle")}</Text></View>
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
      {cargando ? <Text className="py-8 text-center text-slate-500">{t("common.loading")}</Text> : !familia ? <Text className="py-8 text-center text-slate-500">{t("family.noActive")}</Text> : <>
        <Text className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">{t("family.editName")}</Text>
        <View className="flex-row rounded-2xl border-[1.5px] border-slate-200 p-2 dark:border-noche-borde"><TextInput disableFullscreenUI value={nombre} onChangeText={setNombre} editable={owner} maxLength={35} className="h-11 flex-1 px-3 text-base font-bold text-slate-900 dark:text-slate-100" /><TouchableOpacity disabled={!owner} onPress={() => void guardarNombre()} className="h-11 w-11 items-center justify-center rounded-xl bg-emerald-600"><Check size={20} color="#fff" /></TouchableOpacity></View>
        <View className="mt-6 flex-row items-center gap-2"><UsersRound size={19} color="#0d9488" /><Text className="text-base font-extrabold text-slate-900 dark:text-slate-100">{t("family.members")} · {miembros.length}</Text></View>
        <View className="mt-2 rounded-2xl border-[1.5px] border-slate-200 p-2 dark:border-noche-borde">{miembros.map(item => <View key={item.uid} className="min-h-12 flex-row items-center border-b border-slate-100 px-2 last:border-b-0 dark:border-noche-borde"><Text className="flex-1 font-semibold text-slate-800 dark:text-slate-100">{item.nombre}{item.rol === "owner" ? ` · ${t("common.administrator")}` : ""}</Text>{owner && item.rol !== "owner" ? <TouchableOpacity accessibilityLabel={t("family.removeMember")} onPress={() => quitar(item)} className="h-10 w-10 items-center justify-center"><UserMinus size={18} color="#e11d48" /></TouchableOpacity> : null}</View>)}</View>
        {owner ? <TouchableOpacity onPress={cerrar} className="mt-6 min-h-12 items-center justify-center rounded-2xl border-[1.5px] border-rose-200 bg-rose-50"><Text className="font-bold text-rose-600">{t("family.close")}</Text></TouchableOpacity> : null}
      </>}
    </ScrollView>
  </View>;
}
