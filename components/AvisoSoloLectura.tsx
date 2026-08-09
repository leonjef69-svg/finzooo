import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Eye } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";

/**
 * "Puedes ver lo tuyo, pero no cambiarlo." La barra que lo explica.
 *
 * SIN ESTO, EL MODO SOLO LECTURA ES UN FALLO. Alguien entra a su negocio, toca "Gasto", no pasa
 * nada, y lo único que puede pensar es que la app está rota. La diferencia entre una limitación
 * y un fallo es que la limitación se dice — es la misma lección de la pantalla de exportar y de
 * la del Modo Negocio.
 *
 * Y LLEVA LA SALIDA AL LADO. Un aviso que explica lo que no se puede hacer y no dice cómo
 * arreglarlo deja a la persona igual de atascada, solo que informada.
 */
export default function AvisoSoloLectura() {
  const { t } = useAppData();
  return (
    <View className="rounded-2xl bg-amber-50 dark:bg-slate-800 border-[1.5px] border-amber-400 p-4 mb-4 flex-row gap-2.5">
      <Eye size={15} color="#d97706" />
      <View className="flex-1">
        <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
          {t("candado.soloVerTitulo")}
        </Text>
        <Text className="text-[11px] leading-5 text-slate-600 dark:text-slate-300 mt-1">
          {t("candado.soloVerTexto")}
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/premium")}
          className="mt-2.5 py-2.5 rounded-xl items-center bg-slate-900 dark:bg-white"
        >
          <Text className="text-[11px] font-extrabold text-white dark:text-slate-900">
            {t("candado.verPremium")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
