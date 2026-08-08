import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Info,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react-native";
import BackButton from "@/components/BackButton";
import { CARD_SHADOW } from "@/constants/style";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { fmt as fmtConSimbolo, fmtDate } from "@/utils/format";
import { historialDelNegocio, horaVisible, totalesDelNegocio } from "@/utils/negocioTotales";

/**
 * EL PANEL DE UN NEGOCIO: cómo va la caja y qué pasó hoy.
 *
 * MODO NEGOCIO V1, PASO 4 (08/08/2026). Las cinco líneas que pidió —ventas, ingresos
 * automáticos, gastos, saldo y cuántas ventas— y debajo el historial.
 *
 * LAS CUENTAS NO SE HACEN AQUÍ, y es a propósito: están en utils/negocioTotales para poder
 * comprobarlas con números en las pruebas. Una cuenta de dinero escrita dentro de una pantalla
 * solo se puede comprobar abriendo la app y mirando, y eso no es comprobar.
 *
 * ES TODO LO REGISTRADO, SIN CORTAR POR FECHA. Los reportes por día y por mes son V2 y no se
 * adelantan; lo que sí se hace es DECIRLO en la pantalla, para que nadie tome por fallo un
 * total que incluye la semana pasada.
 */
export default function PanelNegocio({
  negocioId,
  onBack,
}: {
  negocioId: string;
  onBack: () => void;
}) {
  const {
    t,
    monthNames,
    negocios,
    ventas,
    movimientosNegocio,
    quitarVenta,
    quitarMovimientoNegocio,
    showToast,
  } = useAppData();
  const insets = useSafeAreaInsets();

  const negocio = negocios.find((n) => n.id === negocioId);

  /**
   * EL DINERO SE ESCRIBE CON LA MONEDA DEL NEGOCIO, no con la de la app.
   *
   * El negocio guarda la suya desde el primer día porque puede no ser la misma: alguien lleva
   * su casa en soles y un negocio que cobra en dólares. Usar la de la app pondría el símbolo
   * equivocado delante de un número correcto, que es la peor mezcla de las dos.
   */
  const dinero = (n: number) => fmtConSimbolo(n, currencySymbolFor(negocio?.moneda ?? ""));

  const totales = useMemo(
    () => totalesDelNegocio(negocioId, ventas, movimientosNegocio),
    [negocioId, ventas, movimientosNegocio]
  );
  const historial = useMemo(
    () => historialDelNegocio(negocioId, ventas, movimientosNegocio),
    [negocioId, ventas, movimientosNegocio]
  );

  /** Cuál fila se está confirmando para borrar. En la propia fila, como en el resto de la app. */
  const [borrando, setBorrando] = useState<string | null>(null);

  function borrar(fila: { id: string; clase: string }) {
    if (fila.clase === "venta") quitarVenta(fila.id);
    else quitarMovimientoNegocio(fila.id);
    setBorrando(null);
    showToast(t("panel.borrado"));
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>
          {negocio?.nombre ?? t("panel.title")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-start gap-3 mb-5">
          <View className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-slate-800 items-center justify-center">
            <Store size={18} color="#059669" />
          </View>
          <Text className="flex-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {t("panel.subtitle")}
          </Text>
        </View>

        {/* EL SALDO ARRIBA Y GRANDE: es el número por el que se abre esta pantalla. */}
        <View
          className="rounded-2xl p-5 bg-emerald-600 mb-4"
          style={CARD_SHADOW}
        >
          <View className="flex-row items-center gap-2">
            <Wallet size={14} color="#d1fae5" />
            <Text className="text-[11px] font-bold text-emerald-50">{t("panel.saldo")}</Text>
          </View>
          <Text className="text-3xl font-extrabold text-white mt-1.5">{dinero(totales.saldo)}</Text>
          <Text className="text-[11px] text-emerald-50 mt-1">
            {t("panel.cantidadVentas", { count: totales.cantidadVentas })}
          </Text>
        </View>

        {/* LAS LÍNEAS, UNA DEBAJO DE OTRA. Cada una dice de dónde sale el saldo de arriba. */}
        <View
          className="rounded-2xl bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700 p-4 gap-3"
          style={CARD_SHADOW}
        >
          <Linea
            icono={<ShoppingBag size={15} color="#059669" />}
            texto={t("panel.ventas")}
            valor={dinero(totales.ventas)}
            color="text-emerald-600"
          />
          <Linea
            icono={<Zap size={15} color="#059669" />}
            texto={t("panel.ingresosAutomaticos")}
            valor={dinero(totales.ingresosAutomaticos)}
            color="text-emerald-600"
          />
          {/* SOLO SI HAY. Un ingreso anotado a mano es raro en V1, pero si existe tiene que
              verse: plata guardada que no sale en ninguna línea es plata que desaparece de la
              vista, y entonces el saldo no cuadra con nada de lo que se lee. */}
          {totales.ingresosManuales > 0 && (
            <Linea
              icono={<TrendingUp size={15} color="#059669" />}
              texto={t("panel.ingresosManuales")}
              valor={dinero(totales.ingresosManuales)}
              color="text-emerald-600"
            />
          )}
          <Linea
            icono={<TrendingDown size={15} color="#f43f5e" />}
            texto={t("panel.gastos")}
            valor={`- ${dinero(totales.gastos)}`}
            color="text-rose-500"
          />
        </View>

        {/* EL DOBLE CONTEO, DICHO SIEMPRE Y NO SOLO CUANDO PASA.
            En V1 una venta cobrada por Yape puede contarse dos veces: como venta y como
            ingreso automático. Él lo aceptó —vincular las dos cosas es V2— pero callarlo haría
            que el saldo pareciera equivocado, y un número de dinero que parece equivocado no
            se vuelve a mirar. */}
        <View className="rounded-2xl bg-amber-50 dark:bg-slate-800 p-4 mt-4 flex-row gap-2.5">
          <Info size={14} color="#d97706" />
          <View className="flex-1">
            <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
              {t("panel.avisoTitulo")}
            </Text>
            <Text className="text-[11px] leading-5 text-slate-600 dark:text-slate-300 mt-1">
              {t("panel.avisoDoble")}
            </Text>
          </View>
        </View>

        {/* REGISTRAR UNA VENTA ES LO QUE SE HACE CIEN VECES AL DÍA, así que va primero, solo y
            en verde. Los productos se ponen una vez y se retocan de vez en cuando: con los dos
            del mismo tamaño se leerían como igual de importantes. */}
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/negocio/venta", params: { id: negocioId } })}
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 mt-4"
        >
          <Plus size={16} color="#ffffff" />
          <Text className="text-sm font-bold text-white">{t("venta.registrar")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push({ pathname: "/negocio/productos", params: { id: negocioId } })}
          className="flex-row items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-2.5"
        >
          <Package size={15} color="#059669" />
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {t("negocios.productos")}
          </Text>
        </TouchableOpacity>

        {/* EL HISTORIAL. */}
        <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-6 mb-3">
          {t("panel.historial")}
        </Text>

        {historial.length === 0 ? (
          <View className="rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-slate-700 p-6 items-center">
            <Store size={26} color="#94a3b8" />
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200 mt-3">
              {t("panel.vacioTitulo")}
            </Text>
            <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 text-center mt-1">
              {t("panel.vacioTexto")}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {historial.map((f) => {
              const entra = f.clase !== "gasto";
              return (
                <View
                  key={f.id}
                  className="rounded-2xl p-4 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
                  style={CARD_SHADOW}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-9 h-9 rounded-2xl items-center justify-center ${
                        entra ? "bg-emerald-50 dark:bg-slate-800" : "bg-rose-50 dark:bg-slate-800"
                      }`}
                    >
                      {f.clase === "venta" ? (
                        <ShoppingBag size={15} color="#059669" />
                      ) : f.clase === "ingreso" ? (
                        <TrendingUp size={15} color="#059669" />
                      ) : (
                        <TrendingDown size={15} color="#f43f5e" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-bold text-slate-900 dark:text-slate-100"
                        numberOfLines={1}
                      >
                        {f.detalle || t(`venta.metodo.${f.metodo}`)}
                      </Text>
                      {/* LA MARCA DEL NEGOCIO EN CADA FILA. Pedida así para que ni una línea
                          de aquí se confunda con un movimiento personal. Va con el dibujo de
                          la tienda y no con un emoji: los emojis se quitaron de la app entera
                          el 03/08/2026 y la misma cosa se veía de dos maneras distintas. */}
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Store size={10} color="#94a3b8" />
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>
                          {negocio?.nombre} · {fmtDate(f.fecha, monthNames)} {horaVisible(f.hora)} ·{" "}
                          {t(`venta.metodo.${f.metodo}`)}
                          {f.automatico ? ` · ${t("panel.automatico")}` : ""}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className={`text-sm font-bold ${entra ? "text-emerald-600" : "text-rose-500"}`}
                    >
                      {entra ? "+ " : "- "}
                      {dinero(f.monto)}
                    </Text>
                  </View>

                  {borrando === f.id ? (
                    <View className="mt-3 pt-3 border-t-[1.5px] border-slate-100 dark:border-slate-700">
                      <Text className="text-[11px] leading-5 text-rose-600 dark:text-rose-400">
                        {t("panel.borrarAviso")}
                      </Text>
                      <View className="flex-row gap-2.5 mt-3">
                        <TouchableOpacity
                          onPress={() => setBorrando(null)}
                          className="flex-1 py-2.5 rounded-xl items-center bg-slate-100 dark:bg-slate-800"
                        >
                          <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                            {t("nuevaCat.cancelar")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => borrar(f)}
                          className="flex-1 py-2.5 rounded-xl items-center bg-rose-500"
                        >
                          <Text className="text-[11px] font-bold text-white">
                            {t("negocios.borrarSi")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row justify-end mt-2">
                      <TouchableOpacity
                        onPress={() => setBorrando(f.id)}
                        className="w-11 py-2 rounded-xl items-center justify-center bg-rose-50 dark:bg-rose-900/20"
                      >
                        <Trash2 size={14} color="#f43f5e" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* LO QUE TODAVÍA NO HACE, DICHO AQUÍ. Es la lección de la pantalla de exportar: un
            límite que no se cuenta se toma por un fallo y se busca durante horas. */}
        <View className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 mt-5">
          <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            {t("panel.proximoPaso")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** Una línea del resumen: dibujo, nombre y número. Todas iguales, para poder leerlas en columna. */
function Linea({
  icono,
  texto,
  valor,
  color,
}: {
  icono: React.ReactNode;
  texto: string;
  valor: string;
  color: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      {icono}
      <Text className="flex-1 text-xs text-slate-600 dark:text-slate-300">{texto}</Text>
      <Text className={`text-sm font-bold ${color}`}>{valor}</Text>
    </View>
  );
}
