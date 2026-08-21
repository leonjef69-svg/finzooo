import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Store, Plus, Trash2, Check, X, Package, ChevronRight } from "lucide-react-native";
import BackButton from "@/components/BackButton";
import { CARD_SHADOW } from "@/constants/style";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { crearNegocio, type Negocio } from "@/utils/negocio";

/**
 * Los negocios de la persona: crearlos, verlos y borrarlos.
 *
 * PRIMERA PANTALLA DEL MODO NEGOCIO (V1, paso 2, 07/08/2026).
 *
 * Lo pedido: *"El usuario debe poder crear un negocio"* con nombre, categoría, moneda y
 * estado activo/inactivo. El ejemplo que dio: "Mi Pollería", Restaurante, S/.
 *
 * POR QUÉ ES UNA LISTA Y NO UN SOLO NEGOCIO
 *
 * Porque se pidió *"Selecciona/crea negocio"*, en plural, y porque la forma de los datos ya
 * lo admite. Uno solo obligaría a rehacer esto —y las pantallas de productos y ventas, que
 * cuelgan de un negocio— en cuanto alguien tenga dos.
 */

/** Las categorías de negocio que se ofrecen. Texto libre no: dos formas de escribir
 *  "Restaurante" harían imposible agrupar nada en V2. */
const CATEGORIAS = ["restaurante", "bodega", "belleza", "servicios", "ropa", "otro"] as const;

export default function Negocios({ onBack }: { onBack: () => void }) {
  const { t, negocios, guardarNegocio, quitarNegocio, showToast, userCurrency } = useAppData();
  const insets = useSafeAreaInsets();

  /** El negocio que se está creando o editando, o null si no hay ninguno abierto. */
  const [enEdicion, setEnEdicion] = useState<Negocio | null>(null);
  /**
   * Cuál se está confirmando para borrar.
   *
   * La confirmación va EN LA PROPIA FILA y no en una ventana del sistema, igual que al borrar
   * una categoría: la ventana tapa la pantalla y no deja leer de qué negocio se trata, que es
   * justo el dato que hace dudar o seguir.
   */
  const [borrando, setBorrando] = useState<string | null>(null);

  function abrirNuevo() {
    setBorrando(null);
    setEnEdicion(crearNegocio({ nombre: "", categoria: "restaurante", moneda: userCurrency }));
  }

  function guardar() {
    if (!enEdicion) return;
    const nombre = enEdicion.nombre.trim();
    // Sin nombre no se guarda: una lista con un negocio en blanco no se puede ni tocar para
    // arreglarlo, porque no se sabe cuál es.
    if (!nombre) {
      showToast(t("negocios.faltaNombre"));
      return;
    }
    guardarNegocio({ ...enEdicion, nombre });
    setEnEdicion(null);
    showToast(t("negocios.guardado"));
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-noche"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t("negocios.title")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-start gap-3 mb-5">
          <View className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-noche-2 items-center justify-center">
            <Store size={18} color="#059669" />
          </View>
          <Text className="flex-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {t("negocios.subtitle")}
          </Text>
        </View>

        {/* LA FORMA DE CREAR O EDITAR, EN LA MISMA PANTALLA.
            No en otra: crear un negocio son tres datos, y mandar a otra pantalla para tres
            datos hace perder de vista la lista que se está construyendo. */}
        {enEdicion && (
          <View
            className="rounded-2xl p-4 mb-5 bg-white dark:bg-noche-2 border-[1.5px] border-emerald-300 dark:border-emerald-700"
            style={CARD_SHADOW}
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {t("negocios.nombre")}
            </Text>
            <TextInput
              value={enEdicion.nombre}
              onChangeText={(v) => setEnEdicion({ ...enEdicion, nombre: v })}
              placeholder={t("negocios.nombrePlaceholder")}
              placeholderTextColor="#94a3b8"
              maxLength={30}
              className="border-[1.5px] border-slate-200 dark:border-noche-borde rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-noche-2"
            />

            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1.5">
              {t("negocios.categoria")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIAS.map((c) => {
                const puesta = enEdicion.categoria === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEnEdicion({ ...enEdicion, categoria: c })}
                    className={`px-3 py-2 rounded-xl border-[1.5px] ${
                      puesta
                        ? "bg-emerald-600 border-emerald-600"
                        : "bg-white dark:bg-noche-2 border-slate-200 dark:border-noche-borde"
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold ${
                        puesta ? "text-white" : "text-slate-600 dark:text-slate-200"
                      }`}
                    >
                      {t(`negocios.cat.${c}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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

        {/* LA LISTA. */}
        {negocios.length === 0 && !enEdicion ? (
          /* VACÍA PERO NO MUDA: sin explicación, quien la ve no sabe si está roto o si le
             falta hacer algo. */
          <View className="rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-noche-borde p-6 items-center">
            <Store size={26} color="#94a3b8" />
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200 mt-3">
              {t("negocios.vacioTitulo")}
            </Text>
            <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 text-center mt-1">
              {t("negocios.vacioTexto")}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {negocios.map((n) => (
              <View
                key={n.id}
                className="rounded-2xl p-4 bg-white dark:bg-noche-2 border-[1.5px] border-slate-200 dark:border-noche-borde"
                style={CARD_SHADOW}
              >
                {/* TOCAR EL NEGOCIO ABRE SU PANEL, y se ve que se puede tocar por la flecha.
                    Sin la flecha sería un toque escondido, que es lo que se descartó al
                    editar categorías: quien no lo sepa no encuentra nunca cómo entrar. */}
                <TouchableOpacity
                  onPress={() => router.push(`/negocio/${n.id}`)}
                  className="flex-row items-center gap-3"
                >
                  <View className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-noche-2 items-center justify-center">
                    <Store size={17} color="#059669" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {n.nombre}
                    </Text>
                    {/* EL SÍMBOLO, NO EL CÓDIGO. Aquí se guarda "PEN" y lo que se lee es
                        "S/": el código lo entiende un banco, no quien abre la app. */}
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {t(`negocios.cat.${n.categoria}`)} · {currencySymbolFor(n.moneda)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94a3b8" />
                </TouchableOpacity>

                {borrando === n.id ? (
                  /* LA CONFIRMACIÓN, CON LO QUE SE PIERDE DICHO. "Se va a borrar" no informa
                     igual que "se van sus productos y sus ventas", y es justo el dato que
                     hace dudar. */
                  <View className="mt-3 pt-3 border-t-[1.5px] border-slate-100 dark:border-noche-borde">
                    <Text className="text-[11px] leading-5 text-rose-600 dark:text-rose-400">
                      {t("negocios.borrarAviso")}
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
                          quitarNegocio(n.id);
                          setBorrando(null);
                          showToast(t("negocios.borrado"));
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
                    {/* PRODUCTOS PRIMERO, y en verde: es lo que se hace a diario con un
                        negocio. Editar el nombre se hace una vez. Con los dos del mismo color
                        se leerían como igual de importantes. */}
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: "/negocio/productos", params: { id: n.id } })}
                      className="flex-1 py-2.5 rounded-xl items-center bg-emerald-600 flex-row justify-center gap-1.5"
                    >
                      <Package size={13} color="#ffffff" />
                      <Text className="text-[11px] font-bold text-white">
                        {t("negocios.productos")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setBorrando(null);
                        setEnEdicion(n);
                      }}
                      className="py-2.5 px-3 rounded-xl items-center bg-slate-100 dark:bg-noche-2"
                    >
                      <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                        {t("negocios.editar")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setBorrando(n.id)}
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
            <Text className="text-sm font-bold text-white">{t("negocios.crear")}</Text>
          </TouchableOpacity>
        )}

        {/* QUÉ NO HACE TODAVÍA, DICHO EN LA PANTALLA.
            Es la lección de la pantalla de exportar: un límite que no se dice hace que la
            persona lo tome por un fallo y lo busque durante horas. Aquí, alguien que crea su
            pollería esperaría poner productos ahora mismo. */}
        {negocios.length > 0 && (
          <View className="rounded-2xl bg-slate-50 dark:bg-noche-2 p-4 mt-5 flex-row gap-2.5">
            <X size={14} color="#94a3b8" />
            <Text className="flex-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              {t("negocios.proximoPaso2")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
