import { useMemo, useState } from "react";
import { irUnaVez } from "@/utils/nav";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Minus, Package, Plus, ShoppingBag } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import { CARD_SHADOW } from "@/constants/style";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { fmt as fmtConSimbolo } from "@/utils/format";
import {
  ahoraDelNegocio,
  crearVenta,
  totalDeLineas,
  type LineaDeVenta,
  type MetodoDeVenta,
} from "@/utils/negocio";

/**
 * REGISTRAR UNA VENTA (Modo Negocio V1, paso 4, 08/08/2026).
 *
 * Se hace con el cliente delante, así que se hace en toques: se tocan los productos, se toca
 * cómo pagó, y se registra. Nada que escribir.
 *
 * EL TOTAL NO SE TECLEA NI SE ESCRIBE A MANO EN NINGÚN SITIO. Sale de totalDeLineas(), la
 * misma función que guarda la venta, así que el número que se ve antes de registrar y el que
 * queda guardado no pueden ser distintos. Un total que no cuadra con sus líneas es un número
 * que nadie puede explicar.
 *
 * SOLO LOS PRODUCTOS ACTIVOS: la gaseosa que se acabó se desactiva y deja de salir aquí. Ese
 * es todo el sentido de "desactivar" frente a "borrar".
 */
export default function NuevaVenta({
  negocioId,
  onBack,
}: {
  negocioId: string;
  onBack: () => void;
}) {
  const { t, negocios, productos, guardarVenta, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  const negocio = negocios.find((n) => n.id === negocioId);
  const dinero = (n: number) => fmtConSimbolo(n, currencySymbolFor(negocio?.moneda ?? ""));

  /** Los de este negocio y activos. Los desactivados no salen: ver arriba. */
  const disponibles = useMemo(
    () => productos.filter((p) => p.negocioId === negocioId && p.activo),
    [productos, negocioId]
  );

  /** Cuántos van de cada producto. Vacío al empezar. */
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [metodo, setMetodo] = useState<MetodoDeVenta>("efectivo");

  function sumar(id: string, cuanto: number) {
    setCantidades((antes) => {
      const nueva = (antes[id] ?? 0) + cuanto;
      const copia = { ...antes };
      // Bajar a cero es quitarlo, no dejar un cero puesto: una línea de "0 × Broster" en una
      // venta no significa nada y habría que acordarse de filtrarla en cada sitio.
      if (nueva <= 0) delete copia[id];
      else copia[id] = nueva;
      return copia;
    });
  }

  /**
   * LAS LÍNEAS DE LA VENTA, CON EL NOMBRE Y EL PRECIO COPIADOS.
   *
   * No se guarda solo el id del producto: si mañana sube el Broster de 15 a 18, esta venta
   * tiene que seguir diciendo 15. Un total histórico que se mueve solo no hay forma de
   * explicarlo en una app de dinero.
   */
  const lineas: LineaDeVenta[] = useMemo(
    () =>
      disponibles
        .filter((p) => (cantidades[p.id] ?? 0) > 0)
        .map((p) => ({
          productoId: p.id,
          nombre: p.nombre,
          precio: p.precio,
          cantidad: cantidades[p.id],
        })),
    [disponibles, cantidades]
  );
  const total = totalDeLineas(lineas);

  function registrar() {
    if (lineas.length === 0) {
      showToast(t("venta.faltaProducto"));
      return;
    }
    // LA FECHA Y LA HORA DEL CELULAR, no las de Londres. Ver ahoraDelNegocio.
    const { fecha, hora } = ahoraDelNegocio();
    guardarVenta(crearVenta({ negocioId, lineas, metodo, fecha, hora }));
    showToast(t("venta.registrada"));
    onBack();
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-noche"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>
          {t("venta.title")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-start gap-3 mb-5">
          <View className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-noche-2 items-center justify-center">
            <ShoppingBag size={18} color="#059669" />
          </View>
          <Text className="flex-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {t("venta.subtitle")}
          </Text>
        </View>

        {disponibles.length === 0 ? (
          /* SIN PRODUCTOS ACTIVOS NO SE PUEDE VENDER, y se dice con la salida delante: quien
             llega aquí y ve una lista vacía no tiene por qué saber que los productos se ponen
             en otra pantalla. */
          <View className="rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-noche-borde p-6 items-center">
            <Package size={26} color="#94a3b8" />
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200 mt-3">
              {t("venta.vacioTitulo")}
            </Text>
            <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 text-center mt-1">
              {t("venta.vacioTexto")}
            </Text>
            <TouchableOpacity
              onPress={() => irUnaVez({ pathname: "/negocio/productos", params: { id: negocioId } })}
              className="flex-row items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-emerald-600 mt-4"
            >
              <Package size={14} color="#ffffff" />
              <Text className="text-xs font-bold text-white">{t("negocios.productos")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-3">
            {disponibles.map((p) => {
              const cuantos = cantidades[p.id] ?? 0;
              return (
                <View
                  key={p.id}
                  className={`rounded-2xl p-4 bg-white dark:bg-noche-2 border-[1.5px] ${
                    cuantos > 0
                      ? "border-emerald-300 dark:border-emerald-700"
                      : "border-slate-200 dark:border-noche-borde"
                  }`}
                  style={CARD_SHADOW}
                >
                  <View className="flex-row items-center gap-3">
                    {/* TOCAR EL PRODUCTO SUMA UNO. Es lo que se hace cien veces al día, y
                        obligar a apuntar al "+" chiquito para cada unidad es pelear con el
                        dedo mientras hay alguien esperando. */}
                    <TouchableOpacity onPress={() => sumar(p.id, 1)} className="flex-1">
                      <Text
                        className="text-sm font-bold text-slate-900 dark:text-slate-100"
                        numberOfLines={1}
                      >
                        {p.nombre}
                      </Text>
                      <Text className="text-[11px] text-emerald-600 mt-0.5">{dinero(p.precio)}</Text>
                    </TouchableOpacity>

                    <View className="flex-row items-center gap-2">
                      {/* El "−" solo aparece cuando hay algo que quitar: un botón que no puede
                          hacer nada se toca igual y parece roto. */}
                      {cuantos > 0 && (
                        <TouchableOpacity
                          onPress={() => sumar(p.id, -1)}
                          className="w-9 h-9 rounded-xl items-center justify-center bg-slate-100 dark:bg-noche-2"
                        >
                          <Minus size={14} color="#64748b" />
                        </TouchableOpacity>
                      )}
                      <Text
                        className={`text-sm font-extrabold w-6 text-center ${
                          cuantos > 0 ? "text-slate-900 dark:text-slate-100" : "text-slate-300"
                        }`}
                      >
                        {cuantos}
                      </Text>
                      <TouchableOpacity
                        onPress={() => sumar(p.id, 1)}
                        className="w-9 h-9 rounded-xl items-center justify-center bg-emerald-600"
                      >
                        <Plus size={14} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {cuantos > 0 && (
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      {cuantos} × {dinero(p.precio)} = {dinero(totalDeLineas([
                        { productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: cuantos },
                      ]))}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {disponibles.length > 0 && (
          <>
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-6 mb-2.5">
              {t("venta.metodoTitulo")}
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
                        : "bg-white dark:bg-noche-2 border-slate-200 dark:border-noche-borde"
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

            {/* EL TOTAL, GRANDE Y CALCULADO. Es lo que se le dice al cliente en voz alta. */}
            <View className="rounded-2xl p-5 bg-emerald-600 mt-6" style={CARD_SHADOW}>
              <Text className="text-[11px] font-bold text-emerald-50">{t("venta.total")}</Text>
              <Text className="text-3xl font-extrabold text-white mt-1.5">{dinero(total)}</Text>
            </View>

            <TouchableOpacity
              onPress={registrar}
              className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 dark:bg-slate-100 mt-4"
            >
              <Check size={16} color="#ffffff" />
              <Text className="text-sm font-bold text-white dark:text-slate-900">
                {t("venta.registrar")}
              </Text>
            </TouchableOpacity>

            {/* LO QUE PASA DESPUÉS, DICHO ANTES: en V1 esta venta y el Yape que la cobró son
                dos apuntes distintos, y el panel puede enseñar la misma plata dos veces. Se
                dice aquí y en el panel, porque es donde se mira el número. */}
            <View className="rounded-2xl bg-slate-50 dark:bg-noche-2 p-4 mt-4">
              <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                {t("venta.avisoYape")}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Las formas de cobrar, en el orden en que se usan en un mostrador de Perú. */
const METODOS: MetodoDeVenta[] = ["efectivo", "yape", "plin", "transferencia", "tarjeta", "otro"];
