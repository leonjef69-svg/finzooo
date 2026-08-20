/**
 * EL CALENDARIO DE PAGOS (18/08/2026, rediseñado el 19)
 *
 * Lo pidió así: *"un calendario para que la gente pueda poner en una fecha el monto —mi
 * suscripción de Netflix, el recibo del agua o la luz— y pueda personalizar qué día y a qué
 * hora me avise para pagarlo"*, con *"colores que digan por ejemplo verde pagado, otro color
 * pendiente"*.
 *
 * **EL REDISEÑO DEL 19/08 salió de cuatro cosas que vio él en su celular:**
 *
 * 1. *"¿Por qué arriba hay un próximo pago y abajo otro? O sea, ¿hay 2?"* — la tarjeta de
 *    arriba repetía una fila de la lista. Ahora **la lista excluye el de la tarjeta**.
 * 2. *"No quiero deformidades, algo más grande que otro, que el texto se pueda leer."* Todas
 *    las filas miden lo mismo y los tamaños de letra son tres en toda la pantalla.
 * 3. *"El 19, el 21… no tiene sentido esas letras."* Ahora dice **hoy**, **mañana**, **en 3
 *    días** o el día con su fecha. Ver `cuandoTexto`.
 * 4. *"Cada color tiene una identificación."* Hay una leyenda bajo el calendario: sin ella,
 *    un círculo ámbar no dice nada la primera vez que se entra.
 *
 * Las cuentas NO están aquí: viven en `utils/calendarioPagos.ts`, sin React, para poder
 * comprobarlas con números.
 */
import { useMemo, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Check, Plus, Settings, X } from "lucide-react-native";
import { irUnaVez } from "@/utils/nav";
import { useColorScheme } from "nativewind";
import BackButton from "@/components/BackButton";
import { useAppData } from "@/contexts/AppDataContext";
import { iconoDe } from "@/constants/iconos";
import { esFoto } from "@/utils/iconosFavoritos";
import { COLOR_HEX_600 } from "@/constants/colors";
import {
  cuandoTexto,
  cuentaPorEstado,
  estadoEn,
  faltaPorPagar,
  fechaEnElMes,
  iconoSugerido,
  mesDe,
  mesSiguiente,
  pagosDelMes,
  proximoPago,
  type EstadoDelPago,
  type PagoProgramado,
} from "@/utils/calendarioPagos";

/**
 * LOS TRES COLORES, EN UN SOLO SITIO.
 *
 * Verde pagado, ámbar por pagar, rojo se pasó — con sus palabras. Escritos en cada sitio
 * donde se usan, cambiar uno dejaría el círculo del calendario de un color y la franja de su
 * fila de otro, para el mismo pago.
 */
const COLOR: Record<EstadoDelPago, string> = {
  pagado: "#059669",
  pendiente: "#d97706",
  vencido: "#e11d48",
};

/** Qué gana cuando un día tiene varias cosas: lo vencido manda, y lo pagado es lo último. */
const URGENCIA: EstadoDelPago[] = ["pagado", "pendiente", "vencido"];

function mesAnterior(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

/** Los filtros de arriba, con sus palabras: *"lo que falta por pagar, lo que se pagó y recordatorios"*. */
type Filtro = "porPagar" | "pagados" | "recuerdos";

export default function CalendarioPagos({ onBack }: { onBack: () => void }) {
  const { t, fmt, monthNames, pagosProgramados, marcarPagoDelMes, showToast } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const oscuro = colorScheme === "dark";

  const hoy = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(() => mesDe(hoy));
  const [filtro, setFiltro] = useState<Filtro>("porPagar");
  /** El día tocado, cuando tiene varias cosas. Ver el bloque de abajo. */
  const [diaAbierto, setDiaAbierto] = useState<number | null>(null);
  /**
   * PAGAR ES UN SOLO TOQUE, Y LA CONFIRMACIÓN VA ABAJO.
   *
   * Aquí hubo dos intentos antes de acertar, y los dos los cortó él:
   *
   * 1. Al principio la tarjeta saltaba al siguiente pago **en el mismo instante**. Desde
   *    fuera eso se ve igual que si el botón no hubiera hecho nada, así que se vuelve a
   *    tocar: *"¿por qué tengo que hacerlo 2 veces?"*. Acabó con los cuatro pagos del mes
   *    marcados sin querer.
   * 2. Después la tarjeta se quedaba unos segundos en verde diciendo "Pagado". Tampoco:
   *    *"no me gusta que tenga que darle 2 click de pagar para que se cierre, confunde"*.
   *    Una tarjeta que se queda quieta después de tocarla parece que espera otro toque.
   *
   * Lo que faltaba en los dos era **decirlo en otro sitio**. Ahora la tarjeta pasa al
   * siguiente al momento —que es lo que uno espera— y la confirmación sale abajo, donde ya
   * salen las de toda la app. Se ve que funcionó sin que nada se quede a medias.
   */
  function pagar(id: string, mesDelPago: string) {
    const p = pagosProgramados.find((x) => x.id === id);
    marcarPagoDelMes(id, mesDelPago, true);
    if (p) {
      showToast(
        p.monto != null
          ? t("calendario.pagadoAviso", { nombre: p.nombre, monto: fmt(p.monto) })
          : t("calendario.pagadoAvisoSinMonto", { nombre: p.nombre })
      );
    }
  }

  const delMes = pagosDelMes(pagosProgramados, mes);
  const porEstado = cuentaPorEstado(pagosProgramados, mes, hoy);
  const falta = faltaPorPagar(pagosProgramados, mes, hoy);
  const siguiente = proximoPago(pagosProgramados, hoy);

  function estadoDe(p: PagoProgramado) {
    return estadoEn(p, mes, hoy);
  }
  function diaDe(p: PagoProgramado) {
    return Number(fechaEnElMes(p, mes).slice(8));
  }

  const enFiltro = delMes.filter((p) => {
    const e = estadoDe(p);
    if (filtro === "pagados") return e === "pagado";
    if (filtro === "recuerdos") return p.tipo === "recordatorio";
    return e !== "pagado" && p.tipo !== "recordatorio";
  });

  /**
   * LA LISTA NO REPITE EL DE LA TARJETA. Era su primera queja del rediseño: *"lo que está
   * encerrado en la imagen confunde al usuario si hay 2"*. Solo se excluye cuando la tarjeta
   * habla de ESTE mes; si enseña el de septiembre, el de agosto sigue en su sitio.
   */
  const enLaTarjeta = siguiente && siguiente.mes === mes ? siguiente.pago.id : null;
  const visibles = enFiltro.filter((p) => p.id !== enLaTarjeta);

  const totales = useMemo(() => {
    let pagado = 0;
    let vencido = 0;
    for (const p of delMes) {
      // Number.isFinite y no un "!= null": un monto NaN -que ya se coló una vez- hacía que
      // el total entero saliera como "S/ NaN.undefined" en la pantalla. La regla de verdad
      // está en validarPago; esto es el cinturón, por si ya hay uno guardado de antes.
      if (p.tipo !== "pago" || !Number.isFinite(p.monto)) continue;
      const e = estadoDe(p);
      if (e === "pagado") pagado += p.monto as number;
      if (e === "vencido") vencido += p.monto as number;
    }
    return { pagado, vencido, porPagar: falta - vencido };
  }, [delMes, falta, mes, hoy]);

  /** Qué color y cuántas cosas tiene cada día. El color es el del más urgente. */
  const porDia = useMemo(() => {
    const mapa: Record<number, { estado: EstadoDelPago; n: number }> = {};
    for (const p of delMes) {
      const d = diaDe(p);
      const e = estadoDe(p);
      const antes = mapa[d];
      if (!antes) mapa[d] = { estado: e, n: 1 };
      else {
        mapa[d] = {
          estado: URGENCIA.indexOf(e) > URGENCIA.indexOf(antes.estado) ? e : antes.estado,
          n: antes.n + 1,
        };
      }
    }
    return mapa;
  }, [delMes, mes, hoy]);

  const [anio, numeroMes] = mes.split("-").map(Number);
  const diasEnElMes = new Date(anio, numeroMes, 0).getDate();
  const primerDia = (new Date(anio, numeroMes - 1, 1).getDay() + 6) % 7;
  const esEsteMes = mes === mesDe(hoy);
  const delDiaAbierto = diaAbierto == null ? [] : delMes.filter((p) => diaDe(p) === diaAbierto);

  function textoCuando(p: PagoProgramado) {
    const x = cuandoTexto(p, mes, hoy);
    const f = x.fecha ? x.fecha.split("-").map(Number) : null;
    return t(x.clave, {
      dias: x.dias ?? 0,
      dia: f ? f[2] : 0,
      mes: f ? monthNames[f[1] - 1] : "",
    });
  }

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
        {/* EL ENGRANAJE guarda lo que se mira una vez —probar el aviso, elegir el sonido y
            cuántos hay puestos— y que hasta hoy ocupaba sitio en la pantalla todos los días. */}
        {/* EL ENGRANAJE LLEVA A SU PROPIA PANTALLA. Era un panel que se abría encima y
            ocupaba media pantalla principal: *"se ve horrible, me sale prácticamente toda la
            pantalla del calendario"*. */}
        <TouchableOpacity onPress={() => irUnaVez("/calendario/avisos")} className="w-10 items-end p-1">
          <Settings size={19} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* TU PRÓXIMO PAGO. Una sola tarjeta, con su botón al costado. Al pagarlo se pone
            verde y dice "Pagado": *"algo que identifique que ya pagó"*. */}
        {/* SIN NADA PENDIENTE, SE DICE. Antes aquí no salía nada y quedaba un hueco donde
            estaba la tarjeta; peor: hasta el 19/08 se enseñaba el mismo recibo del mes que
            viene, y pagarlo dos veces era un toque. Decir "estás al día" contesta la pregunta
            con la que se entra y no invita a adelantar nada. */}
        {!siguiente && delMes.length > 0 && (
          <View className="rounded-2xl p-4 mb-4 flex-row items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40">
            <Check size={22} color="#059669" strokeWidth={3} />
            <View className="flex-1">
              <Text className="text-[14px] font-bold text-emerald-800 dark:text-emerald-300">
                {t("calendario.alDia")}
              </Text>
              <Text className="text-[12px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                {t("calendario.alDiaTexto")}
              </Text>
            </View>
          </View>
        )}

        {siguiente && (
          <TarjetaProxima
            pago={siguiente.pago}
            mes={siguiente.mes}
            hoy={hoy}
            t={t}
            fmt={fmt}
            monthNames={monthNames}
            oscuro={oscuro}
            onPagar={() => pagar(siguiente.pago.id, siguiente.mes)}
            onAbrir={() => irUnaVez(`/calendario/nuevo?id=${siguiente.pago.id}`)}
          />
        )}

        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={() => { setMes(mesAnterior(mes)); setDiaAbierto(null); }} className="p-1.5">
            <ChevronLeft size={19} color="#94a3b8" />
          </TouchableOpacity>
          <Text className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
            {monthNames[numeroMes - 1]} {anio}
          </Text>
          <TouchableOpacity onPress={() => { setMes(mesSiguiente(mes)); setDiaAbierto(null); }} className="p-1.5">
            <ChevronRight size={19} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* EL RESUMEN DEL MES, que también pidió. Tres números y una barra: de un vistazo se
            sabe cuánto falta, cuánto se lleva y si se pasó algo. */}
        {delMes.length > 0 && (
          <>
            <View className="flex-row gap-2 mb-2.5">
              <Cuadro texto={t("calendario.resumen.porPagar")} valor={fmt(totales.porPagar)} color={COLOR.pendiente} />
              <Cuadro texto={t("calendario.resumen.pagado")} valor={fmt(totales.pagado)} color={COLOR.pagado} />
              <Cuadro texto={t("calendario.resumen.vencido")} valor={fmt(totales.vencido)} color={COLOR.vencido} />
            </View>
            <View className="flex-row h-1.5 rounded-full overflow-hidden mb-4">
              {(["pagado", "pendiente", "vencido"] as EstadoDelPago[]).map((e) => (
                <View key={e} style={{ flex: Math.max(porEstado[e], 0), backgroundColor: COLOR[e] }} />
              ))}
            </View>
          </>
        )}

        <View className="flex-row mb-1.5">
          {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
            <Text key={i} className="flex-1 text-[11px] text-center text-slate-400 dark:text-slate-400">
              {d}
            </Text>
          ))}
        </View>
        {/* POR SEMANAS, Y NO POR "FLEX-WRAP".
            Iba con 31 casillas seguidas de ancho 100/7 % y dejando que se envolvieran solas.
            Sobre el papel entran siete; en su celular entraban SEIS, y el calendario salió
            corrido un día entero: *"el calendario se movió"*. Con siete de 14,2857 % basta
            un pelo de redondeo para que el séptimo no quepa y baje de fila.

            Repartido en semanas de siete con "flex: 1", cada fila reparte lo que hay y no
            existe el redondeo que sobra. Siete son siete siempre. */}
        {Array.from({ length: Math.ceil((primerDia + diasEnElMes) / 7) }).map((_, semana) => (
          <View key={semana} className="flex-row">
            {Array.from({ length: 7 }).map((__, columna) => {
              const dia = semana * 7 + columna - primerDia + 1;
              if (dia < 1 || dia > diasEnElMes) {
                return <View key={columna} style={{ flex: 1, aspectRatio: 1 }} />;
              }
              const x = porDia[dia];
              const esHoy = esEsteMes && dia === hoy.getDate();
              return (
                <TouchableOpacity
                  key={columna}
                  onPress={() => {
                    if (!x) {
                      irUnaVez(`/calendario/nuevo?fecha=${mes}-${String(dia).padStart(2, "0")}`);
                    } else if (x.n === 1) {
                      const uno = delMes.find((p) => diaDe(p) === dia);
                      if (uno) irUnaVez(`/calendario/nuevo?id=${uno.id}`);
                    } else {
                      // Con varios NO se abre ninguno: no se sabría cuál abrió. Se enseñan.
                      setDiaAbierto(diaAbierto === dia ? null : dia);
                    }
                  }}
                  style={{ flex: 1, aspectRatio: 1 }}
                  className="items-center justify-center p-0.5"
                >
                  <View
                    className="w-full h-full rounded-full items-center justify-center"
                    style={{ backgroundColor: x ? COLOR[x.estado] : "transparent" }}
                  >
                    <Text
                      className="text-[12px] text-slate-900 dark:text-slate-100"
                      style={x ? { color: "#ffffff" } : undefined}
                    >
                      {dia}
                    </Text>
                    {/* HOY, CON UN PUNTO DEBAJO. Elegido por él entre tres formas: el aro
                        gris no le gustaba, y el fondo suave desaparecía en cuanto el día
                        tenía un pago. El punto se ve igual sobre el color. */}
                    {esHoy && (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          marginTop: 2,
                          backgroundColor: x ? "#ffffff" : oscuro ? "#f1f5f9" : "#0f172a",
                        }}
                      />
                    )}
                    {x && x.n > 1 && (
                      <View
                        className="absolute -top-0.5 -right-0.5 px-1 rounded-full bg-slate-900 dark:bg-slate-100 border-2 border-white dark:border-slate-900"
                        style={{ minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text className="text-[9px] font-bold text-white dark:text-slate-900">{x.n}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* LA LEYENDA. Sin ella, un círculo ámbar no dice nada la primera vez. */}
        {delMes.length > 0 && (
          <View className="flex-row justify-center gap-4 mt-3">
            {(["pagado", "pendiente", "vencido"] as EstadoDelPago[]).map((e) => (
              <View key={e} className="flex-row items-center gap-1.5">
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLOR[e] }} />
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(`calendario.leyenda.${e}`)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {diaAbierto != null && (
          <View className="mt-4 rounded-2xl p-3 bg-slate-50 dark:bg-slate-800">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[13px] text-slate-900 dark:text-slate-100">
                {t("calendario.diaConVarias", { dia: diaAbierto, n: delDiaAbierto.length })}
              </Text>
              <TouchableOpacity onPress={() => setDiaAbierto(null)} className="p-1">
                <X size={15} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {delDiaAbierto.map((p) => (
              <Fila
                key={p.id}
                pago={p}
                estado={estadoDe(p)}
                cuando={textoCuando(p)}
                fmt={fmt}
                t={t}
                oscuro={oscuro}
                onPagar={() => pagar(p.id, mes)}
                onAbrir={() => irUnaVez(`/calendario/nuevo?id=${p.id}`)}
              />
            ))}
          </View>
        )}

        {delMes.length > 0 && (
          <View className="flex-row gap-2 mt-5 mb-3">
            {(["porPagar", "pagados", "recuerdos"] as Filtro[]).map((f) => {
              const n =
                f === "pagados"
                  ? porEstado.pagado
                  : f === "recuerdos"
                    ? delMes.filter((p) => p.tipo === "recordatorio").length
                    : delMes.filter((p) => estadoDe(p) !== "pagado" && p.tipo !== "recordatorio").length;
              const activo = filtro === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFiltro(f)}
                  className={`flex-1 py-2.5 rounded-xl items-center border-[1.5px] ${
                    activo
                      ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-[12px] ${
                      activo ? "text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {t(`calendario.filtro.${f}`)} {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {visibles.map((p) => (
          <Fila
            key={p.id}
            pago={p}
            estado={estadoDe(p)}
            cuando={textoCuando(p)}
            fmt={fmt}
            t={t}
            oscuro={oscuro}
            onPagar={() => pagar(p.id, mes)}
            onAbrir={() => irUnaVez(`/calendario/nuevo?id=${p.id}`)}
          />
        ))}

        {delMes.length === 0 && (
          <Text className="text-[12px] leading-5 text-slate-500 dark:text-slate-400 my-4">
            {t("calendario.vacio")}
          </Text>
        )}
        {delMes.length > 0 && visibles.length === 0 && diaAbierto == null && (
          <Text className="text-[12px] leading-5 text-slate-500 dark:text-slate-400 mb-3">
            {t("calendario.vacioFiltro")}
          </Text>
        )}

        <TouchableOpacity
          onPress={() => irUnaVez("/calendario/nuevo")}
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 mt-1"
        >
          <Plus size={16} color="#64748b" />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400">
            {t("calendario.agregar")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/** Los tres números del resumen. Uno solo para que los tres midan y separen igual. */
function Cuadro({ texto, valor, color }: { texto: string; valor: string; color: string }) {
  return (
    <View className="flex-1 rounded-xl py-2.5 px-2 items-center bg-slate-50 dark:bg-slate-800">
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">{texto}</Text>
      <Text className="text-[14px] font-bold" style={{ color }}>
        {valor}
      </Text>
    </View>
  );
}

type T = (k: string, v?: Record<string, string | number>) => string;

function TarjetaProxima({
  pago,
  mes,
  hoy,
  t,
  fmt,
  monthNames,
  oscuro,
  onPagar,
  onAbrir,
}: {
  pago: PagoProgramado;
  mes: string;
  hoy: Date;
  t: T;
  fmt: (n: number) => string;
  monthNames: string[];
  oscuro: boolean;
  onPagar: () => void;
  onAbrir: () => void;
}) {
  const estado = estadoEn(pago, mes, hoy);
  const color = COLOR[estado];
  const suColor = (pago.color && COLOR_HEX_600[pago.color]) || color;
  const Dibujo = iconoDe(pago.icono || iconoSugerido(pago.nombre, pago.tipo));
  const x = cuandoTexto(pago, mes, hoy);
  const f = x.fecha ? x.fecha.split("-").map(Number) : null;
  return (
    <TouchableOpacity
      onPress={onAbrir}
      activeOpacity={0.9}
      className="rounded-2xl p-3.5 mb-4 bg-slate-50 dark:bg-slate-800"
    >
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
        {t("calendario.proximo")}
      </Text>
      <View className="flex-row items-center gap-3">
        <View
          className="w-[42px] h-[42px] rounded-xl items-center justify-center overflow-hidden"
          style={{ backgroundColor: color + (oscuro ? "33" : "22") }}
        >
          {esFoto(pago.icono ?? "") ? (
            <Image source={{ uri: pago.icono }} style={{ width: 42, height: 42 }} />
          ) : (
            <Dibujo size={21} color={suColor} strokeWidth={2.2} />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-[15px] text-slate-900 dark:text-slate-100" numberOfLines={1}>
            {pago.nombre}
            {pago.monto != null ? ` · ${fmt(pago.monto)}` : ""}
          </Text>
          <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5" numberOfLines={1}>
            {t(x.clave, {
              dias: x.dias ?? 0,
              dia: f ? f[2] : 0,
              mes: f ? monthNames[f[1] - 1] : "",
            })}
          </Text>
        </View>
        {pago.tipo !== "recordatorio" && (
          <TouchableOpacity
            onPress={onPagar}
            className="px-4 h-10 rounded-xl items-center justify-center bg-emerald-600"
          >
            <Text className="text-[13px] font-bold text-white">{t("calendario.pagar")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Una fila de la lista. Todas iguales: mismo alto, mismo dibujo, mismos tres tamaños. */
function Fila({
  pago,
  estado,
  cuando,
  fmt,
  t,
  oscuro,
  onPagar,
  onAbrir,
}: {
  pago: PagoProgramado;
  estado: EstadoDelPago;
  cuando: string;
  fmt: (n: number) => string;
  t: T;
  oscuro: boolean;
  onPagar: () => void;
  onAbrir: () => void;
}) {
  const color = COLOR[estado];
  const suColor = (pago.color && COLOR_HEX_600[pago.color]) || color;
  const Dibujo = iconoDe(pago.icono || iconoSugerido(pago.nombre, pago.tipo));
  const pagado = estado === "pagado";
  return (
    <TouchableOpacity
      onPress={onAbrir}
      activeOpacity={0.9}
      className="flex-row items-center gap-3 p-3 rounded-2xl mb-2 bg-slate-50 dark:bg-slate-800"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <View
        className="w-[38px] h-[38px] rounded-xl items-center justify-center overflow-hidden"
        style={{ backgroundColor: color + (oscuro ? "33" : "22") }}
      >
        {esFoto(pago.icono ?? "") ? (
          <Image source={{ uri: pago.icono }} style={{ width: 38, height: 38 }} />
        ) : (
          <Dibujo size={20} color={suColor} strokeWidth={2.2} />
        )}
      </View>
      <View className="flex-1">
        <Text
          className={`text-[14px] ${pagado ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}
          numberOfLines={1}
        >
          {pago.nombre}
        </Text>
        <Text className="text-[12px] mt-0.5" style={{ color: pagado ? "#94a3b8" : color }} numberOfLines={1}>
          {cuando}
        </Text>
      </View>
      <View className="items-end">
        {pago.monto != null && (
          <Text
            className={`text-[15px] ${pagado ? "text-slate-400" : "text-slate-900 dark:text-slate-100"}`}
          >
            {pago.tipo === "ingreso" ? "+" : "−"}
            {fmt(pago.monto)}
          </Text>
        )}
        {pago.tipo !== "recordatorio" &&
          (pagado ? (
            <View className="mt-1.5">
              <Check size={20} color={COLOR.pagado} strokeWidth={3} />
            </View>
          ) : (
            <TouchableOpacity
              onPress={onPagar}
              className="mt-1.5 px-3 py-1.5 rounded-lg bg-emerald-600"
            >
              <Text className="text-[12px] font-bold text-white">{t("calendario.pagar")}</Text>
            </TouchableOpacity>
          ))}
      </View>
    </TouchableOpacity>
  );
}
