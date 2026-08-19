/**
 * EL CALENDARIO DE PAGOS (18/08/2026)
 *
 * Lo pidió así: *"un calendario para que la gente pueda poner en una fecha el monto —mi
 * suscripción de Netflix, el recibo del agua o la luz— y pueda personalizar qué día y a qué
 * hora me avise para pagarlo"*, con *"colores que digan por ejemplo verde pagado, otro color
 * pendiente"*, y **filtros arriba**: *"Todos | Pendientes | Pagados | Vencidos"*.
 *
 * Las cuentas NO están aquí: viven en `utils/calendarioPagos.ts`, sin React, para poder
 * comprobarlas con números. Esta pantalla solo dibuja lo que aquéllas deciden.
 */
import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Plus, Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { router } from "expo-router";
import BackButton from "@/components/BackButton";
import { useAppData } from "@/contexts/AppDataContext";
import { CARD_SHADOW } from "@/constants/style";
import {
  cuentaPorEstado,
  cuentaPorTipo,
  estadoEn,
  faltaPorPagar,
  fechaEnElMes,
  hayVariosTipos,
  mesDe,
  mesSiguiente,
  pagosDelMes,
  proximoPago,
  type EstadoDelPago,
  type TipoDeAnotacion,
} from "@/utils/calendarioPagos";

/**
 * LOS TRES COLORES, EN UN SOLO SITIO.
 *
 * Verde pagado, ámbar por pagar, rojo se pasó — con sus palabras. Escritos en cada sitio
 * donde se usan, cambiar uno dejaría el punto del calendario de un color y la franja de su
 * fila de otro, para el mismo pago.
 */
const COLOR: Record<EstadoDelPago, string> = {
  pagado: "#059669",
  pendiente: "#f59e0b",
  vencido: "#e11d48",
};

/** "2026-08" → el mes anterior. La otra mitad de `mesSiguiente`. */
function mesAnterior(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

type Filtro = "todos" | EstadoDelPago;

export default function CalendarioPagos({ onBack }: { onBack: () => void }) {
  const { t, fmt, monthNames, pagosProgramados, marcarPagoDelMes } = useAppData();
  const insets = useSafeAreaInsets();

  const hoy = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(() => mesDe(hoy));
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [tipo, setTipo] = useState<TipoDeAnotacion | "todos">("todos");

  const delMes = pagosDelMes(pagosProgramados, mes);
  const porEstado = cuentaPorEstado(pagosProgramados, mes, hoy);
  const porTipo = cuentaPorTipo(pagosProgramados, mes);
  const falta = faltaPorPagar(pagosProgramados, mes, hoy);
  const siguiente = proximoPago(pagosProgramados, hoy);

  /**
   * LA MISMA LISTA PARA EL CALENDARIO Y PARA LAS FILAS.
   *
   * Con dos filtrados distintos, tocar "Vencidos" podría dejar el calendario enseñando todos
   * los días encendidos y la lista solo uno — y eso no se ve mirando: se ve cuando alguien
   * dice que la app le miente. Ya se tomó esta misma decisión en el panel del negocio.
   */
  const visibles = delMes.filter(
    (p) =>
      (filtro === "todos" || estadoEn(p, mes, hoy) === filtro) &&
      (tipo === "todos" || p.tipo === tipo)
  );

  // Qué color lleva cada día del calendario. Si un día tiene dos, manda el más urgente:
  // vencido sobre pendiente, y pendiente sobre pagado.
  const colorPorDia = useMemo(() => {
    const orden: EstadoDelPago[] = ["pagado", "pendiente", "vencido"];
    const mapa: Record<number, EstadoDelPago> = {};
    for (const p of visibles) {
      const fecha = fechaEnElMes(p, mes);
      if (fecha === "") continue;
      const dia = Number(fecha.slice(8));
      const est = estadoEn(p, mes, hoy);
      if (mapa[dia] == null || orden.indexOf(est) > orden.indexOf(mapa[dia])) mapa[dia] = est;
    }
    return mapa;
  }, [visibles, mes, hoy]);

  const [anio, numeroMes] = mes.split("-").map(Number);
  const diasEnElMes = new Date(anio, numeroMes, 0).getDate();
  // Lunes primero, como el calendario de aquí. getDay() da 0 para domingo.
  const primerDia = (new Date(anio, numeroMes - 1, 1).getDay() + 6) % 7;
  const esEsteMes = mes === mesDe(hoy);

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t("calendario.titulo")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* TU PRÓXIMO PAGO, ARRIBA Y EN GRANDE.
            Es la pregunta de quien abre esta pantalla —"¿qué me toca ahora?"— y contestarla
            sin que haya que buscar en la lista es lo que separa un calendario de una tabla.
            Manda lo vencido sobre lo que viene: ver proximoPago. */}
        {siguiente && (
          <View
            className="rounded-2xl p-4 mb-4 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
            style={CARD_SHADOW}
          >
            <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2.5">
              {t("calendario.proximo")}
            </Text>
            <View className="flex-row items-center gap-3">
              <View
                className="w-11 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: COLOR[estadoEn(siguiente.pago, siguiente.mes, hoy)] + "22" }}
              >
                <IconoDelTipo tipo={siguiente.pago.tipo} color={COLOR[estadoEn(siguiente.pago, siguiente.mes, hoy)]} />
              </View>
              <View className="flex-1">
                <Text className="text-base text-slate-900 dark:text-slate-100">
                  {siguiente.pago.nombre}
                  {siguiente.pago.monto != null ? ` · ${fmt(siguiente.pago.monto)}` : ""}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("calendario.avisoA", {
                    dia: Number(fechaEnElMes(siguiente.pago, siguiente.mes).slice(8)),
                    hora: siguiente.pago.avisoHora,
                  })}
                </Text>
              </View>
            </View>
            {siguiente.pago.tipo !== "recordatorio" && (
              <TouchableOpacity
                onPress={() => marcarPagoDelMes(siguiente.pago.id, siguiente.mes, true)}
                className="mt-3 py-3 rounded-xl items-center bg-emerald-600"
              >
                <Text className="text-[13px] font-bold text-white">{t("calendario.yaPague")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View
          className="rounded-2xl bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden"
          style={CARD_SHADOW}
        >
          <View className="px-4 pt-3.5 pb-3">
            <View className="flex-row items-center justify-between mb-3">
              <TouchableOpacity onPress={() => setMes(mesAnterior(mes))} className="p-1">
                <ChevronLeft size={19} color="#94a3b8" />
              </TouchableOpacity>
              <View className="items-center">
                <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {monthNames[numeroMes - 1]} {anio}
                </Text>
                {falta > 0 && (
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t("calendario.teFaltan", { monto: fmt(falta) })}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setMes(mesSiguiente(mes))} className="p-1">
                <ChevronRight size={19} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* LOS FILTROS, CON SU NÚMERO Y SIN LOS VACÍOS.
                El número contesta sin tocarlos: un filtro que no dice cuántos hay obliga a
                probarlos todos. Y el que está a cero no se dibuja — tocarlo solo podría
                dejar la pantalla en blanco. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              <View className="flex-row gap-1.5 px-1">
                <Chip
                  texto={t("calendario.filtro.todos")}
                  activo={filtro === "todos"}
                  onPress={() => setFiltro("todos")}
                />
                {(["pendiente", "vencido", "pagado"] as EstadoDelPago[])
                  .filter((e) => porEstado[e] > 0)
                  .map((e) => (
                    <Chip
                      key={e}
                      texto={`${t(`calendario.filtro.${e}`)} ${porEstado[e]}`}
                      color={COLOR[e]}
                      activo={filtro === e}
                      onPress={() => setFiltro(filtro === e ? "todos" : e)}
                    />
                  ))}
              </View>
            </ScrollView>

            {/* LA SEGUNDA FILA SOLO CON MÁS DE UN TIPO. Con solo pagos, estos botones no
                pueden cambiar nada de lo que se ve: son tres estorbos. Va más chica y sin
                borde a propósito — la de arriba es la de cada día, ésta es de afinar. */}
            {hayVariosTipos(pagosProgramados, mes) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mt-1.5">
                <View className="flex-row gap-1.5 px-1">
                  {(["pago", "ingreso", "recordatorio"] as TipoDeAnotacion[])
                    .filter((x) => porTipo[x] > 0)
                    .map((x) => (
                      <TouchableOpacity
                        key={x}
                        onPress={() => setTipo(tipo === x ? "todos" : x)}
                        className={`px-2.5 py-1 rounded-full ${
                          tipo === x ? "bg-slate-200 dark:bg-slate-700" : "bg-slate-50 dark:bg-slate-800"
                        }`}
                      >
                        <Text className="text-[11px] text-slate-500 dark:text-slate-300">
                          {t(`calendario.tipo.${x}`)} {porTipo[x]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>
            )}
          </View>

          <View className="px-4 pb-3.5">
            <View className="flex-row mb-1.5">
              {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                <Text
                  key={i}
                  className="flex-1 text-[10px] text-center text-slate-400 dark:text-slate-400"
                >
                  {d}
                </Text>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {Array.from({ length: primerDia }).map((_, i) => (
                <View key={`h${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
              ))}
              {Array.from({ length: diasEnElMes }).map((_, i) => {
                const dia = i + 1;
                const color = colorPorDia[dia];
                const esHoy = esEsteMes && dia === hoy.getDate();
                return (
                  <View
                    key={dia}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1 }}
                    className="items-center justify-center p-0.5"
                  >
                    <View
                      className="w-full h-full rounded-full items-center justify-center"
                      style={{
                        backgroundColor: color ? COLOR[color] : "transparent",
                        borderWidth: !color && esHoy ? 1.5 : 0,
                        borderColor: "#94a3b8",
                      }}
                    >
                      {/* EL COLOR DEL NÚMERO SE DICE SIEMPRE, Y ESTO ERA UN FALLO.
                          Sin clase de color, React Native pinta el texto en negro por
                          defecto: en modo oscuro el calendario entero quedaba casi
                          invisible, con los números del mismo tono que el fondo. Lo vio él
                          en el celular. Un día con estado sí lleva color propio —blanco
                          sobre su círculo—, y por eso el `style` sigue mandando ahí. */}
                      <Text
                        className="text-[11px] text-slate-900 dark:text-slate-100"
                        style={color ? { color: "#ffffff" } : undefined}
                      >
                        {dia}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="px-4 pb-4">
            {visibles.length === 0 ? (
              <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 py-3">
                {t(delMes.length === 0 ? "calendario.vacio" : "calendario.vacioFiltro")}
              </Text>
            ) : (
              visibles.map((p) => {
                const estado = estadoEn(p, mes, hoy);
                const dia = Number(fechaEnElMes(p, mes).slice(8));
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => router.push(`/calendario/nuevo?id=${p.id}`)}
                    className="flex-row items-center gap-3 p-3 rounded-xl mb-2 bg-slate-50 dark:bg-slate-800"
                    style={{ borderLeftWidth: 3, borderLeftColor: COLOR[estado] }}
                  >
                    <IconoDelTipo tipo={p.tipo} color={COLOR[estado]} />
                    <View className="flex-1">
                      <Text
                        className={`text-[13px] ${
                          estado === "pagado"
                            ? "text-slate-400 dark:text-slate-500"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {p.nombre}
                      </Text>
                      <Text className="text-[11px] mt-0.5" style={{ color: COLOR[estado] }}>
                        {t(`calendario.estado.${estado}`, { dia })}
                      </Text>
                    </View>
                    {p.monto != null ? (
                      <Text
                        className={`text-[14px] ${
                          estado === "pagado" ? "text-slate-400" : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {p.tipo === "ingreso" ? "+" : "−"}
                        {fmt(p.monto)}
                      </Text>
                    ) : (
                      <Text className="text-[11px] text-slate-400">{t("calendario.sinMonto")}</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              onPress={() => router.push("/calendario/nuevo")}
              className="flex-row items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 mt-1"
            >
              <Plus size={15} color="#94a3b8" />
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                {t("calendario.agregar")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** El dibujo de cada tipo: sale plata, entra plata, o solo un aviso. */
function IconoDelTipo({ tipo, color }: { tipo: TipoDeAnotacion; color: string }) {
  if (tipo === "ingreso") return <ArrowDownLeft size={19} color={color} />;
  if (tipo === "recordatorio") return <Bell size={19} color={color} />;
  return <ArrowUpRight size={19} color={color} />;
}

function Chip({
  texto,
  activo,
  color,
  onPress,
}: {
  texto: string;
  activo: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
        activo
          ? "bg-slate-900 dark:bg-slate-100"
          : "border-[1.5px] border-slate-200 dark:border-slate-700"
      }`}
    >
      {color && !activo && (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      )}
      <Text
        className={`text-[12px] ${
          activo ? "text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-300"
        }`}
      >
        {texto}
      </Text>
    </TouchableOpacity>
  );
}
