import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, TrendingDown, TrendingUp } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import { ahoraDelNegocio, crearMovimientoNegocio, type MetodoDeVenta } from "@/utils/negocio";

/**
 * ANOTAR PLATA QUE ENTRA O SALE DE LA CAJA (Modo Negocio V1, paso 4, 08/08/2026).
 *
 * Lo de todos los días en un negocio y que no es una venta: la compra de pollo, el gas, el
 * alquiler. Y al revés, plata que entra sin ser una venta de la carta.
 *
 * POR QUÉ TAMBIÉN "INGRESO" Y NO SOLO GASTOS
 *
 * Porque el panel tiene una línea para eso y, sin esta pantalla, sería un número que nunca
 * puede cambiar — justo la clase de promesa vacía que se ha estado limpiando. Y porque pasa:
 * un adelanto, la devolución de un proveedor, plata que se mete a la caja para el sencillo.
 *
 * EL GASTO NO TOCA NADA DE LO PERSONAL. Va a la caja de este negocio y a ningún otro sitio:
 * es toda la idea del Modo Negocio, y aquí es donde se rompería sin querer.
 */
export default function MovimientoNegocio({
  negocioId,
  onBack,
}: {
  negocioId: string;
  onBack: () => void;
}) {
  const { t, negocios, guardarMovimientoNegocio, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  const negocio = negocios.find((n) => n.id === negocioId);

  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  /**
   * EL MONTO SE ESCRIBE COMO TEXTO, igual que el precio de un producto y por lo mismo:
   * guardado como número, escribir "12." o "12,5" se convertiría a medias mientras se teclea y
   * el campo daría saltos bajo el dedo. Se convierte una sola vez, al guardar.
   */
  const [montoTexto, setMontoTexto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [metodo, setMetodo] = useState<MetodoDeVenta>("efectivo");

  function guardar() {
    // La coma vale como el punto: en Perú se escribe "12,50" tanto como "12.50", y rechazarlo
    // sería rechazar la forma en que la mitad de la gente escribe una cantidad.
    const monto = Number(montoTexto.replace(",", "."));
    if (!Number.isFinite(monto) || monto <= 0) {
      showToast(t("caja.faltaMonto"));
      return;
    }
    const { fecha, hora } = ahoraDelNegocio();
    guardarMovimientoNegocio(
      crearMovimientoNegocio({
        negocioId,
        tipo,
        monto,
        metodo,
        descripcion,
        fecha,
        hora,
        // A MANO, y dicho aquí: el automático es el Yape que se capturará solo en el paso
        // siguiente. El panel los enseña distinto porque no son lo mismo.
        origen: "manual",
      })
    );
    showToast(tipo === "gasto" ? t("caja.gastoGuardado") : t("caja.ingresoGuardado"));
    onBack();
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>
          {negocio?.nombre ?? t("caja.title")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xs leading-5 text-slate-500 dark:text-slate-300 mb-5">
          {t("caja.subtitle")}
        </Text>

        {/* SALE O ENTRA. Es lo primero porque cambia el sentido de todo lo demás, y va con dos
            botones grandes y no con un interruptor: un interruptor no dice qué es cada lado. */}
        <View className="flex-row gap-2.5">
          <TouchableOpacity
            onPress={() => setTipo("gasto")}
            className={`flex-1 py-3.5 rounded-2xl items-center flex-row justify-center gap-2 border-[1.5px] ${
              tipo === "gasto"
                ? "bg-rose-500 border-rose-500"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            }`}
          >
            <TrendingDown size={15} color={tipo === "gasto" ? "#ffffff" : "#94a3b8"} />
            <Text
              className={`text-xs font-bold ${
                tipo === "gasto" ? "text-white" : "text-slate-600 dark:text-slate-200"
              }`}
            >
              {t("caja.gasto")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTipo("ingreso")}
            className={`flex-1 py-3.5 rounded-2xl items-center flex-row justify-center gap-2 border-[1.5px] ${
              tipo === "ingreso"
                ? "bg-emerald-600 border-emerald-600"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            }`}
          >
            <TrendingUp size={15} color={tipo === "ingreso" ? "#ffffff" : "#94a3b8"} />
            <Text
              className={`text-xs font-bold ${
                tipo === "ingreso" ? "text-white" : "text-slate-600 dark:text-slate-200"
              }`}
            >
              {t("caja.ingreso")}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          className="rounded-2xl p-4 mt-5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
          style={CARD_SHADOW}
        >
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            {t("caja.monto")}
          </Text>
          <TextInput
            value={montoTexto}
            onChangeText={setMontoTexto}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            maxLength={9}
            className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
          />

          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1.5">
            {t("caja.descripcion")}
          </Text>
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder={t("caja.descripcionPlaceholder")}
            placeholderTextColor="#94a3b8"
            maxLength={40}
            className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
          />

          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-4 mb-2.5">
            {tipo === "gasto" ? t("caja.metodoGasto") : t("venta.metodoTitulo")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {METODOS.map((m) => {
              const puesto = metodo === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMetodo(m)}
                  className={`px-3 py-2 rounded-xl border-[1.5px] ${
                    puesto
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      puesto ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {t(`venta.metodo.${m}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          onPress={guardar}
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 dark:bg-slate-100 mt-5"
        >
          <Check size={16} color="#ffffff" />
          <Text className="text-sm font-bold text-white dark:text-slate-900">
            {t("negocios.guardar")}
          </Text>
        </TouchableOpacity>

        {/* QUE ESTO NO TOCA LO PERSONAL, DICHO. Es lo que la persona necesita saber para
            fiarse: la compra de pollo no le va a aparecer entre los gastos de casa. */}
        <View className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 mt-4">
          <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            {t("caja.avisoSeparado")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** Las mismas formas de pagar que en una venta: una caja se llena y se vacía por los mismos sitios. */
const METODOS: MetodoDeVenta[] = ["efectivo", "yape", "plin", "transferencia", "tarjeta", "otro"];
