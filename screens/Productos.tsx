import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Package, Plus, Trash2, Check, EyeOff } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import { crearProducto, productoRepetido, type Producto } from "@/utils/negocio";

/**
 * Los productos de un negocio, con su precio.
 *
 * MODO NEGOCIO V1, PASO 3 (07/08/2026). Lo pedido: crear, editar, eliminar, activar/desactivar
 * y definir precio. El ejemplo que dio: Broster S/15, Salchipapa S/12, Hamburguesa S/10,
 * Gaseosa S/5.
 *
 * SIN INVENTARIO NI STOCK, a propósito: *"Por ahora NO crear inventario ni control de stock.
 * Solo necesitamos producto + precio"*.
 *
 * POR QUÉ "ACTIVO" Y NO SOLO BORRAR
 *
 * Porque son dos cosas distintas y se confunden. La gaseosa que se acabó hoy no se borra: se
 * desactiva, deja de salir al vender, y mañana vuelve con su precio. Borrarla y volver a
 * crearla haría perder el precio y —lo que importa— la dejaría fuera de cualquier cuenta de
 * "cuánta gaseosa se vendió" en V2.
 */
export default function Productos({
  negocioId,
  onBack,
}: {
  negocioId: string;
  onBack: () => void;
}) {
  const { t, fmt, negocios, productos, guardarProducto, quitarProducto, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  const negocio = negocios.find((n) => n.id === negocioId);
  /** Los de ESTE negocio. Los del resto no se tocan ni se ven. */
  const mios = useMemo(
    () => productos.filter((p) => p.negocioId === negocioId),
    [productos, negocioId]
  );

  const [enEdicion, setEnEdicion] = useState<Producto | null>(null);
  /**
   * El precio se escribe como TEXTO, no como número.
   *
   * Guardado como número, escribir "12." o "12,5" se convertiría a medias mientras se teclea y
   * el campo daría saltos bajo el dedo. Se convierte una sola vez, al guardar.
   */
  const [precioTexto, setPrecioTexto] = useState("");
  const [borrando, setBorrando] = useState<string | null>(null);

  function abrirNuevo() {
    setBorrando(null);
    setEnEdicion(crearProducto(negocioId, "", 0));
    setPrecioTexto("");
  }

  function abrirEdicion(p: Producto) {
    setBorrando(null);
    setEnEdicion(p);
    setPrecioTexto(String(p.precio));
  }

  function guardar() {
    if (!enEdicion) return;
    const nombre = enEdicion.nombre.trim();
    if (!nombre) {
      showToast(t("productos.faltaNombre"));
      return;
    }
    // Dos productos con el mismo nombre no se pueden distinguir al vender: se toca uno al azar
    // y las cuentas de "cuánto Broster salió" quedan repartidas entre los dos.
    if (productoRepetido(productos, negocioId, nombre, enEdicion.id)) {
      showToast(t("productos.repetido"));
      return;
    }
    // La coma también vale: en Perú se escribe "12,50" tanto como "12.50", y rechazarlo sería
    // rechazar la forma en que la mitad de la gente escribe un precio.
    const precio = Number(precioTexto.replace(",", "."));
    if (!Number.isFinite(precio) || precio <= 0) {
      showToast(t("productos.faltaPrecio"));
      return;
    }
    // A dos decimales: un precio con cola de coma flotante acaba impreso en un total.
    guardarProducto({ ...enEdicion, nombre, precio: Math.round(precio * 100) / 100 });
    setEnEdicion(null);
    showToast(t("productos.guardado"));
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-noche"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>
          {negocio?.nombre ?? t("productos.title")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-start gap-3 mb-5">
          <View className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-noche-2 items-center justify-center">
            <Package size={18} color="#059669" />
          </View>
          <Text className="flex-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {t("productos.subtitle")}
          </Text>
        </View>

        {enEdicion && (
          <View
            className="rounded-2xl p-4 mb-5 bg-white dark:bg-noche-2 border-[1.5px] border-emerald-300 dark:border-emerald-700"
            style={CARD_SHADOW}
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {t("productos.nombre")}
            </Text>
            <TextInput
              value={enEdicion.nombre}
              onChangeText={(v) => setEnEdicion({ ...enEdicion, nombre: v })}
              placeholder={t("productos.nombrePlaceholder")}
              placeholderTextColor="#94a3b8"
              maxLength={30}
              className="border-[1.5px] border-slate-200 dark:border-noche-borde rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-noche-2"
            />

            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1.5">
              {t("productos.precio")}
            </Text>
            <TextInput
              value={precioTexto}
              onChangeText={setPrecioTexto}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              maxLength={9}
              className="border-[1.5px] border-slate-200 dark:border-noche-borde rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-noche-2"
            />

            <View className="flex-row gap-2.5 mt-5">
              <TouchableOpacity
                onPress={() => setEnEdicion(null)}
                className="flex-1 py-3 rounded-xl items-center bg-slate-100 dark:bg-noche-2"
              >
                <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
                  {t("nuevaCat.cancelar")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={guardar}
                className="flex-1 py-3 rounded-xl items-center bg-emerald-600 flex-row justify-center gap-1.5"
              >
                <Check size={14} color="#ffffff" />
                <Text className="text-xs font-bold text-white">{t("negocios.guardar")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mios.length === 0 && !enEdicion ? (
          <View className="rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-noche-borde p-6 items-center">
            <Package size={26} color="#94a3b8" />
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200 mt-3">
              {t("productos.vacioTitulo")}
            </Text>
            <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 text-center mt-1">
              {t("productos.vacioTexto")}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {mios.map((p) => (
              <View
                key={p.id}
                className="rounded-2xl p-4 bg-white dark:bg-noche-2 border-[1.5px] border-slate-200 dark:border-noche-borde"
                style={CARD_SHADOW}
              >
                <View className="flex-row items-center gap-3">
                  {/* EL DIBUJO SOLO CUANDO DICE ALGO, Y AQUÍ SOLO LO DICE APAGADO.
                      Estaban el ojo abierto Y el interruptor encendido, uno al lado del otro,
                      contando lo mismo dos veces — y el ojo no se puede tocar, así que además
                      invitaba a tocarlo. Apagado sí aporta: es lo que explica de un vistazo por
                      qué ese producto no sale al vender. */}
                  {!p.activo && (
                    <View className="w-10 h-10 rounded-2xl items-center justify-center bg-slate-100 dark:bg-noche-2">
                      <EyeOff size={16} color="#94a3b8" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text
                      className={`text-sm font-bold ${
                        p.activo ? "text-slate-900 dark:text-slate-100" : "text-slate-400"
                      }`}
                      numberOfLines={1}
                    >
                      {p.nombre}
                    </Text>
                    <Text
                      className={`text-[11px] mt-0.5 ${
                        p.activo ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {fmt(p.precio)}
                      {!p.activo ? ` · ${t("productos.desactivado")}` : ""}
                    </Text>
                  </View>
                  {/* Activar y desactivar SIN abrir nada: es lo que se hace a diario cuando se
                      acaba un producto, y meterlo dentro de "editar" lo esconde. */}
                  <Toggle
                    on={p.activo}
                    onChange={(v: boolean) => guardarProducto({ ...p, activo: v })}
                  />
                </View>

                {borrando === p.id ? (
                  <View className="mt-3 pt-3 border-t-[1.5px] border-slate-100 dark:border-noche-borde">
                    {/* LO QUE NO PASA, DICHO. Sin esto, quien borre un producto puede pensar
                        que se le van las ventas de la semana, y no se le van. */}
                    <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                      {t("productos.borrarAviso")}
                    </Text>
                    <View className="flex-row gap-2.5 mt-3">
                      <TouchableOpacity
                        onPress={() => setBorrando(null)}
                        className="flex-1 py-2.5 rounded-xl items-center bg-slate-100 dark:bg-noche-2"
                      >
                        <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                          {t("nuevaCat.cancelar")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          quitarProducto(p.id);
                          setBorrando(null);
                          showToast(t("productos.borrado"));
                        }}
                        className="flex-1 py-2.5 rounded-xl items-center bg-rose-500"
                      >
                        <Text className="text-[11px] font-bold text-white">
                          {t("negocios.borrarSi")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      onPress={() => abrirEdicion(p)}
                      className="flex-1 py-2.5 rounded-xl items-center bg-slate-100 dark:bg-noche-2"
                    >
                      <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                        {t("negocios.editar")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setBorrando(p.id)}
                      className="w-11 py-2.5 rounded-xl items-center justify-center bg-rose-50 dark:bg-rose-900/20"
                    >
                      <Trash2 size={14} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {!enEdicion && (
          <TouchableOpacity
            onPress={abrirNuevo}
            className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 mt-5"
          >
            <Plus size={16} color="#ffffff" />
            <Text className="text-sm font-bold text-white">{t("productos.crear")}</Text>
          </TouchableOpacity>
        )}

        {mios.length > 0 && (
          <View className="rounded-2xl bg-slate-50 dark:bg-noche-2 p-4 mt-5">
            <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              {t("productos.proximoPaso")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
