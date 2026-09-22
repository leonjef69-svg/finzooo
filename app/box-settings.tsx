import BackButton from "@/components/BackButton";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { fusionarCajas, normalizarCajas, saldoCaja, type DatosCajas } from "@/utils/cajas";
import { bajarCajas, subirCajas } from "@/utils/cloudCajas";
import { safeBack } from "@/utils/nav";
import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";
import { Check } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Administración aislada: editar/cerrar una caja no despliega bloques dentro de sus movimientos. */
export default function BoxSettings() {
  const { t, showToast } = useAppData();
  const { boxId } = useLocalSearchParams<{ boxId?: string }>();
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState<DatosCajas | null>(null);
  const [nombre, setNombre] = useState("");
  const caja = datos?.cajas.find(item => item.id === boxId);

  useEffect(() => { void (async () => {
    const local = normalizarCajas(await loadJSON<DatosCajas>(STORAGE_KEYS.cajasDinero, { cajas: [], movimientos: [], cajasBorradas: [], movimientosBorrados: [] }));
    const remoto = auth.currentUser ? await bajarCajas(auth.currentUser.uid).catch(() => null) : null;
    const actual = remoto ? fusionarCajas(local, remoto) : local;
    setDatos(actual); setNombre(actual.cajas.find(item => item.id === boxId)?.nombre ?? "");
  })(); }, [boxId]);

  const persistir = async (siguiente: DatosCajas) => {
    await saveJSON(STORAGE_KEYS.cajasDinero, siguiente);
    if (auth.currentUser) await subirCajas(auth.currentUser.uid, siguiente);
    setDatos(siguiente);
  };
  const guardar = async () => {
    if (!datos || !caja || !nombre.trim()) return;
    await persistir({ ...datos, cajas: datos.cajas.map(item => item.id === caja.id ? { ...item, nombre: nombre.trim().slice(0, 30) } : item) });
    showToast("Nombre actualizado.");
  };
  const eliminar = () => {
    if (!datos || !caja) return;
    if (Math.abs(saldoCaja(caja.id, datos.movimientos)) > 0.000001) { showToast(t("boxes.closeBalance")); return; }
    Alert.alert(t("boxes.delete"), t("boxes.deleteWarning"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("boxes.delete"), style: "destructive", onPress: () => void (async () => {
        const ids = datos.movimientos.filter(item => item.cajaId === caja.id).map(item => item.id);
        await persistir({ ...datos, cajas: datos.cajas.filter(item => item.id !== caja.id), movimientos: datos.movimientos.filter(item => item.cajaId !== caja.id), cajasBorradas: [...new Set([...datos.cajasBorradas, caja.id])], movimientosBorrados: [...new Set([...datos.movimientosBorrados, ...ids])] });
        safeBack();
      })() },
    ]);
  };

  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center px-5 pb-4"><BackButton onPress={safeBack} /><Text className="ml-3 flex-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">Administrar caja</Text></View>
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
      {!datos ? <Text className="py-8 text-center text-slate-500">Cargando…</Text> : !caja ? <Text className="py-8 text-center text-slate-500">La caja ya no existe.</Text> : <>
        <Text className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Editar nombre</Text>
        <View className="flex-row rounded-2xl border-[1.5px] border-slate-200 p-2 dark:border-noche-borde"><TextInput disableFullscreenUI value={nombre} onChangeText={setNombre} maxLength={30} className="h-11 flex-1 px-3 text-base font-bold text-slate-900 dark:text-slate-100" /><TouchableOpacity onPress={() => void guardar()} className="h-11 w-11 items-center justify-center rounded-xl bg-teal-600"><Check size={20} color="#fff" /></TouchableOpacity></View>
        <TouchableOpacity onPress={eliminar} className="mt-6 min-h-12 items-center justify-center rounded-2xl border-[1.5px] border-rose-200 bg-rose-50"><Text className="font-bold text-rose-600">{t("boxes.delete")}</Text></TouchableOpacity>
      </>}
    </ScrollView>
  </View>;
}
