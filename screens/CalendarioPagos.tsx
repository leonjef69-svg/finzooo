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
import { ChevronLeft, ChevronRight, Check, CheckCircle2, Circle, ListChecks, Plus, Settings, Trash2, X } from "lucide-react-native";
import { irUnaVez } from "@/utils/nav";
import { useColorScheme } from "nativewind";
import BackButton from "@/components/BackButton";
import ConfirmDialog from "@/components/ConfirmDialog";
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
 * LOS COLORES, EN UN SOLO SITIO. **Uno, no dos.**
 *
 * Aquí hubo dos tablas durante unas horas el 20/08/2026 —la vieja de tres estados y esta— y
 * ya habían empezado a discrepar: el resumen de arriba pintaba "Pagado" de verde mientras el
 * botón "Pagados" y las filas lo pintaban de morado. El mismo estado, dos colores, la misma
 * pantalla. Hay una prueba que cuenta las tablas para que no vuelva a pasar.
 *
 * Con Ingresos y Recuerdos como categorías propias, un día tiene que decir *qué* hay en él y
 * no solo si está pagado: *"si yo pongo un ingreso el 30, ese 30 debería ponerse verde, y así
 * con todos los demás"*.
 */
type ColorDeDia = "recuerdos" | "pagados" | "ingresos" | "porPagar" | "vencido";

const COLOR_DIA: Record<ColorDeDia, string> = {
  recuerdos: "#2563eb",
  pagados: "#7c6cf0",
  ingresos: "#059669",
  porPagar: "#d97706",
  vencido: "#e11d48",
};

/**
 * Qué gana cuando un día tiene varias cosas. **Manda lo que aún te falta**, en este orden de
 * menos a más: un recuerdo, algo ya pagado, un ingreso, algo por pagar, algo vencido.
 *
 * La razón es para qué se mira el calendario: si el 20 tienes un recibo vencido y otro ya
 * pagado, ese día tiene que verse rojo. El globito con el número dice que hay más de una cosa
 * y al tocarlo se ven todas.
 */
const URGENCIA_DIA: ColorDeDia[] = ["recuerdos", "pagados", "ingresos", "porPagar", "vencido"];

/**
 * En qué color cae un pago. **Vive fuera del componente a propósito**: lo usan el día del
 * calendario, la franja de la fila y la tarjeta de arriba, y con la regla escrita en tres
 * sitios bastaría con tocar uno para que el mismo pago saliera de dos colores distintos.
 */
function colorDe(pago: PagoProgramado, estado: EstadoDelPago): ColorDeDia {
  if (pago.tipo === "recordatorio") return "recuerdos";
  if (pago.tipo === "ingreso") return "ingresos";
  if (estado === "pagado") return "pagados";
  return estado === "vencido" ? "vencido" : "porPagar";
}

function mesAnterior(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

/** Los filtros de arriba, con sus palabras: *"lo que falta por pagar, lo que se pagó y recordatorios"*. */
type Filtro = "porPagar" | "ingresos" | "pagados" | "recuerdos";

const FILTROS: Filtro[] = ["porPagar", "ingresos", "pagados", "recuerdos"];

/**
 * EL COLOR DE UN FILTRO ES EL MISMO COLOR DE SIEMPRE. **No hay segunda tabla.**
 *
 * La hubo durante unas horas el 20/08/2026, y ya había empezado a discrepar: el resumen de
 * arriba pintaba "Pagado" de VERDE mientras el botón "Pagados" y las filas lo pintaban de
 * MORADO — el mismo estado de dos colores en la misma pantalla, que es justo lo que la regla
 * de los colores existe para impedir. Dos tablas con lo mismo son una que se queda atrás.
 *
 * Las claves de `Filtro` coinciden a propósito con las de `ColorDeDia`.
 */
const COLOR_FILTRO = (f: Filtro): string => COLOR_DIA[f];

export default function CalendarioPagos({ onBack }: { onBack: () => void }) {
  const { t, fmt, monthNames, pagosProgramados, marcarPagoDelMes, quitarPagoProgramado, showToast } =
    useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const oscuro = colorScheme === "dark";

  const hoy = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(() => mesDe(hoy));
  const [filtro, setFiltro] = useState<Filtro>("porPagar");
  /** El día tocado, cuando tiene varias cosas. Ver el bloque de abajo. */
  const [diaAbierto, setDiaAbierto] = useState<number | null>(null);
  /**
   * BORRAR VARIOS DE UNA VEZ, COMO EN INICIO.
   *
   * Pedido suyo: *"al igual que en la pantalla de inicio de nuevos movimientos, que haya un
   * icono para seleccionar y borrar"*. Con veinte recibos, quitar los viejos de uno en uno
   * —abrir, bajar hasta Borrar, confirmar, volver— son cinco toques por cada uno.
   *
   * Se copia el modo de Inicio a propósito: mismo icono, mismo círculo, mismo sitio. Dos
   * formas distintas de seleccionar en la misma app son dos cosas que aprender.
   */
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [confirmandoBorrarTodo, setConfirmandoBorrarTodo] = useState(false);

  function alternarSeleccion(id: string) {
    setSeleccionados((antes) =>
      antes.includes(id) ? antes.filter((x) => x !== id) : [...antes, id]
    );
  }

  /** Borra los del filtro que se está mirando. Ver el botón: no los del mes entero. */
  function borrarTodosLosDelFiltro() {
    const cuantos = visibles.length;
    for (const p of visibles) quitarPagoProgramado(p.id);
    showToast(t(cuantos > 1 ? "calendario.borradosPlural" : "calendario.borrados", { n: cuantos }));
    setSeleccionados([]);
    setSeleccionando(false);
    setConfirmandoBorrarTodo(false);
  }

  function borrarSeleccionados() {
    for (const id of seleccionados) quitarPagoProgramado(id);
    showToast(
      t(seleccionados.length > 1 ? "calendario.borradosPlural" : "calendario.borrados", {
        n: seleccionados.length,
      })
    );
    setSeleccionados([]);
    setSeleccionando(false);
    setConfirmandoBorrar(false);
  }
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
  /** Cuantos GASTOS hay en cada estado. Solo para la barra de debajo del resumen. */
  const gastosPorEstado = useMemo(() => {
    const cuenta = { pagados: 0, porPagar: 0, vencido: 0 };
    for (const p of pagosDelMes(pagosProgramados, mes)) {
      if (p.tipo !== "pago") continue;
      const e = estadoEn(p, mes, hoy);
      if (e === "pagado") cuenta.pagados++;
      else if (e === "vencido") cuenta.vencido++;
      else cuenta.porPagar++;
    }
    return cuenta;
  }, [pagosProgramados, mes, hoy]);
  const falta = faltaPorPagar(pagosProgramados, mes, hoy);
  const siguiente = proximoPago(pagosProgramados, hoy);

  function estadoDe(p: PagoProgramado) {
    return estadoEn(p, mes, hoy);
  }
  function diaDe(p: PagoProgramado) {
    return Number(fechaEnElMes(p, mes).slice(8));
  }

  /**
   * QUÉ ENSEÑA CADA BOTÓN.
   *
   * "Por pagar" son gastos: los ingresos salieron de ahí al tener botón propio. Antes vivían
   * mezclados y él no los encontraba —*"en nuevo pago le pongo ingreso, ¿en qué botón está?
   * no lo veo"*—, porque un sueldo bajo el rótulo "por pagar" no es donde nadie lo busca.
   *
   * Un ingreso ya cobrado sigue contando como ingreso y no salta a "Pagados": lo que se
   * pregunta ahí es *qué recibos ya cumplí*, y un sueldo no es un recibo.
   */
  function pasaElFiltro(p: PagoProgramado, f: Filtro): boolean {
    if (f === "recuerdos") return p.tipo === "recordatorio";
    if (f === "ingresos") return p.tipo === "ingreso";
    if (f === "pagados") return p.tipo === "pago" && estadoDe(p) === "pagado";
    return p.tipo === "pago" && estadoDe(p) !== "pagado";
  }

  const cuantosHay = (f: Filtro) => delMes.filter((p) => pasaElFiltro(p, f)).length;

  const enFiltro = delMes.filter((p) => pasaElFiltro(p, filtro));

  /** Lo que hay en el día tocado. Vacío mientras no hay ninguno abierto. */
  const delDiaAbierto = diaAbierto == null ? [] : delMes.filter((p) => diaDe(p) === diaAbierto);

  /**
   * LA LISTA LOS ENSEÑA TODOS, TAMBIEN EL DE LA TARJETA. **Esto era un fallo.**
   *
   * Antes se excluia el de la tarjeta para no verlo dos veces, y con UN solo pago pendiente
   * el filtro decia "Por pagar 1" y debajo no aparecia nada: el unico que habia estaba
   * arriba. El lo encontro al primer intento — *"agrego un pago y en el boton de por pagar le
   * doy click y no aparece"*.
   *
   * La contradiccion de la que se quejo al principio -ver el mismo nombre dos veces- era
   * otra cosa y ya esta arreglada: la tarjeta enseñaba el recibo del MES SIGUIENTE mientras
   * la lista lo daba por pagado. Ahora las dos hablan del mismo mes y del mismo estado, asi
   * que la tarjeta es lo que dice ser: un atajo al primero, no una fila aparte.
   *
   * Y asi el numero del filtro y lo que se ve debajo no pueden discrepar, que es lo unico que
   * no se puede permitir aqui.
   */
  /**
   * Y CON UN DÍA ABIERTO, LA LISTA ES LA DE ESE DÍA.
   *
   * Sin filtrar por nada más: quien toca el 20 quiere ver **todo** lo del 20 —los recibos, el
   * sueldo y los recordatorios—, no lo del 20 que además cumpla el botón que estuviera
   * marcado. Por eso los botones se apagan mientras tanto.
   */
  const visibles = diaAbierto == null ? enFiltro : delDiaAbierto;

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
    const mapa: Record<number, { color: ColorDeDia; n: number }> = {};
    for (const p of delMes) {
      const d = diaDe(p);
      const c = colorDe(p, estadoDe(p));
      const antes = mapa[d];
      if (!antes) mapa[d] = { color: c, n: 1 };
      else {
        mapa[d] = {
          color: URGENCIA_DIA.indexOf(c) > URGENCIA_DIA.indexOf(antes.color) ? c : antes.color,
          n: antes.n + 1,
        };
      }
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delMes, mes, hoy]);

  const [anio, numeroMes] = mes.split("-").map(Number);
  const diasEnElMes = new Date(anio, numeroMes, 0).getDate();
  const primerDia = (new Date(anio, numeroMes - 1, 1).getDay() + 6) % 7;
  const esEsteMes = mes === mesDe(hoy);

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
      className="flex-1 bg-white dark:bg-noche"
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
        {/* Solo el engranaje. El icono de seleccionar bajó a la fila de debajo de los
            filtros, que es donde se elige QUÉ se está mirando y por tanto qué se va a
            borrar: *"tiene que estar debajo de los botones de por pagar, pagados,
            recuerdos"*. */}
        <TouchableOpacity onPress={() => irUnaVez("/calendario/avisos")} className="w-10 items-end p-1">
          <Settings size={19} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* TODO SE DESLIZA JUNTO, Y LOS FILTROS SE QUEDAN PEGADOS ARRIBA.
          Antes el calendario ocupaba sitio fijo y a la lista le quedaba una franja de dos
          dedos: *"se ve poquito, al momento de deslizar hacia abajo se ve feo"*. Ahora al
          bajar sube todo —próximo pago, mes, cuadrícula— y la lista se queda con la pantalla
          entera.

          Lo que NO se va es la fila de filtros (stickyHeaderIndices): se queda clavada arriba
          mientras se desliza. Eso era el motivo de tenerlo todo quieto —no saber qué estás
          mirando— y se resuelve dejando pegado solo eso, que es lo único que hacía falta. */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 10 }}
        stickyHeaderIndices={[1]}
      >
      <View className="px-5">
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
              {/* MISMOS COLORES QUE LOS BOTONES Y LAS FILAS. Hasta el 20/08 "Pagado" salia
                  aqui de verde y abajo de morado: el mismo estado, dos colores, la misma
                  pantalla. Ahora los tres salen de COLOR_DIA, que es la unica tabla. */}
              <Cuadro texto={t("calendario.resumen.porPagar")} valor={fmt(totales.porPagar)} color={COLOR_DIA.porPagar} />
              <Cuadro texto={t("calendario.resumen.pagado")} valor={fmt(totales.pagado)} color={COLOR_DIA.pagados} />
              <Cuadro texto={t("calendario.resumen.vencido")} valor={fmt(totales.vencido)} color={COLOR_DIA.vencido} />
            </View>
            {/* LA BARRA MIDE LOS TRES CUADROS DE ARRIBA, ASI QUE CUENTA LO MISMO QUE ELLOS.
                Usaba `cuentaPorEstado`, que cuenta TODO lo del mes — y desde que existen los
                ingresos y los recuerdos eso metia en la barra cosas que no son un recibo: un
                recordatorio sin monto ocupaba su trozo como si fuera plata. Los cuadros de
                arriba siempre fueron solo de gastos; ahora la barra tambien. */}
            <View className="flex-row h-1.5 rounded-full overflow-hidden mb-4">
              {(["pagados", "porPagar", "vencido"] as const).map((c) => (
                <View key={c} style={{ flex: Math.max(gastosPorEstado[c], 0), backgroundColor: COLOR_DIA[c] }} />
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
                    /* UN DÍA CON ALGO ABRE SU LISTA, TENGA UNA COSA O CINCO.
                       Antes, con una sola, tocar el día abría ESE pago para editarlo — y
                       entonces no había manera de ponerle un segundo desde el calendario:
                       *"en el día 30 le quiero agregar 2 o más pagos, no se puede"*. Se podía
                       por el botón verde de abajo eligiendo la fecha a mano, que es
                       justo el rodeo que el calendario existe para ahorrar.
                       Ahora el día siempre enseña lo que tiene y su botón de agregar. */
                    if (!x) {
                      irUnaVez(`/calendario/nuevo?fecha=${mes}-${String(dia).padStart(2, "0")}`);
                    } else {
                      setDiaAbierto(diaAbierto === dia ? null : dia);
                    }
                  }}
                  style={{ flex: 1, aspectRatio: 1 }}
                  className="items-center justify-center p-0.5"
                >
                  {/* CUADRADO PRIMERO Y CÍRCULO DESPUÉS: eso era el fallo.
                      La casilla es `w-full h-full` dentro de un padre cuyo alto sale de su
                      `aspectRatio`, o sea que el ancho se sabe en una pasada y el alto en la
                      siguiente. Entre las dos, `rounded-full` redondeaba un rectángulo — y se
                      veía el cuadrado antes de cerrarse: *"sale como un cuadro, luego se
                      vuelve un círculo"*. Poniéndole a ESTA vista su propio `aspectRatio`,
                      nace cuadrada en cuanto se conoce el ancho y no hay paso intermedio. */}
                  <View
                    className="items-center justify-center"
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      borderRadius: 999,
                      backgroundColor: x ? COLOR_DIA[x.color] : "transparent",
                    }}
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
                        // Un par de píxeles más y letra de 11: *"ese número dentro de su
                        // circulito tiene que ser más visible, un poquito más grande pero no
                        // tanto"*. El borde del color del fondo es lo que lo despega del día.
                        className="absolute -top-1 -right-1 px-1 rounded-full bg-slate-900 dark:bg-slate-100 border-2 border-white dark:border-noche"
                        style={{ minWidth: 18, height: 18, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text className="text-[11px] font-bold text-white dark:text-slate-900">{x.n}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* SIN LEYENDA. Hasta el 20/08 aquí había una fila de puntitos explicando los colores,
            primero tres y luego solo el rojo. Se quitó entera: los cuatro botones de abajo ya
            dicen nombre y color, y el rojo se entiende solo —la fila vencida lo lleva en la
            franja y dice "se pasó el 4" con todas sus letras. Una leyenda que repite lo que
            ya está escrito dos centímetros más abajo es sitio gastado. */}

        {/* AQUÍ NO SE ABRE NADA AL TOCAR UN DÍA, Y ESA ES LA GRACIA.
            Hasta el 20/08 el día abría su propio recuadro entre el calendario y los botones.
            Dos problemas: empujaba media pantalla hacia abajo, y un pago del 20 salía DOS
            VECES —en el recuadro y en la lista de siempre—, que es exactamente de lo que se
            había quejado al principio con la tarjeta de arriba.

            Ahora el día manda sobre la lista que ya existe: tocas el 20 y esa misma lista, en
            el mismo sitio, pasa a enseñar las cosas del 20. Ver `visibles` y el chip que sale
            junto a "Seleccionar". Una sola lista, nada repetido, nada que se mueva. */}

      </View>

      {/* LA FILA PEGADA. Lleva su propio fondo porque, al quedarse clavada, la lista pasa
          por debajo: sin fondo se verían los pagos cruzando los botones. */}
      <View className="px-5 pt-1 bg-white dark:bg-noche">
        {/* UNA SOLA BARRA, NO CUATRO BOTONES SUELTOS.
            Con tres cabían separados; al entrar Ingresos ya no: *"4 botones me parece mucho,
            en todo caso un poco más pequeño o mejor acomodado"*. Pegados y sin bordes propios
            ocupan lo mismo que los tres de antes y se leen como una pieza.

            EL NÚMERO VA DEBAJO DEL NOMBRE. Primero se probó como globito en la esquina y se
            montaba sobre el botón vecino: *"se ve apretado y distorsionado, no se puede
            distinguir bien"*. Debajo no se pisa nada, el nombre queda entero y el número
            grande.

            EL FONDO DE COLOR SOLO EN EL QUE SE TOCA. El color de cada categoría está siempre
            presente —en su número—, pero el fondo pintado significa una única cosa: cuál
            estás mirando. Pintando los cuatro haría falta un aro encima para decir cuál es el
            activo, que es justo el ruido que se quería quitar. */}
        {delMes.length > 0 && (
          <View
            /* APAGADOS MIENTRAS SE MIRA UN DÍA. No están filtrando nada en ese momento —manda
               el día— y dejarlos encendidos haría creer que sí. */
            className="flex-row rounded-2xl p-1 mt-0.5 mb-2 bg-slate-100 dark:bg-noche-2"
            style={diaAbierto == null ? undefined : { opacity: 0.4 }}
          >
            {FILTROS.map((f) => {
              const n = cuantosHay(f);
              const activo = filtro === f && diaAbierto == null;
              const color = COLOR_FILTRO(f);
              return (
                <TouchableOpacity
                  key={f}
                  /* Tocar un botón con un día abierto cierra el día: se pide ver el mes
                     entero por ese lado, y dejar las dos cosas a la vez sería mentir sobre
                     cuál manda. */
                  onPress={() => {
                    setFiltro(f);
                    setDiaAbierto(null);
                  }}
                  className="flex-1 py-1.5 rounded-xl items-center"
                  style={activo ? { backgroundColor: color } : undefined}
                >
                  <Text
                    className={`text-[11px] ${
                      activo ? "text-white font-bold" : "text-slate-500 dark:text-slate-400"
                    }`}
                    numberOfLines={1}
                  >
                    {t(`calendario.filtro.${f}`)}
                  </Text>
                  <Text
                    className="text-[14px] font-extrabold"
                    style={{ color: activo ? "#ffffff" : color }}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* LA FILA DE SELECCIONAR, DEBAJO DE LOS FILTROS.
            En reposo es solo la palabra "Seleccionar" a la derecha, como en Inicio. Al
            tocarla, esta misma fila se convierte en cuántos hay elegidos, la papelera,
            "Borrar todo" y "Cancelar" — sin abrir nada ni mover la pantalla. */}
        {delMes.length > 0 && (
          <View className="flex-row items-center justify-between px-1 mb-2">
            {seleccionando ? (
              <>
                <Text className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
                  {t(seleccionados.length === 1 ? "calendario.elegido" : "calendario.elegidos", {
                    n: seleccionados.length,
                  })}
                </Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setConfirmandoBorrar(true)}
                    disabled={seleccionados.length === 0}
                    className={`w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950 items-center justify-center ${
                      seleccionados.length === 0 ? "opacity-40" : ""
                    }`}
                  >
                    <Trash2 size={19} color="#f43f5e" />
                  </TouchableOpacity>
                  {/* BORRAR TODO: los del filtro que se está mirando, no los del mes entero.
                      Estando en "Pagados", "borrar todo" tiene que borrar los pagados — que es
                      lo que se ve— y no llevarse por delante lo que aún queda por pagar. */}
                  <TouchableOpacity onPress={() => setConfirmandoBorrarTodo(true)} hitSlop={6}>
                    <Text className="text-[13px] font-bold text-rose-500">
                      {t("calendario.borrarTodo")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSeleccionando(false);
                      setSeleccionados([]);
                    }}
                    hitSlop={6}
                  >
                    <Text className="text-[13px] font-bold text-emerald-600">
                      {t("common.cancel")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* EL CHIP DEL DÍA ABIERTO, que además es el botón de cerrarlo.
                    Ocupa el hueco que ya había a la izquierda de "Seleccionar", así que
                    abrir un día no añade ninguna fila nueva a la pantalla. Sin día abierto
                    no hay chip y el hueco vuelve a estar vacío, como siempre. */}
                {diaAbierto == null ? (
                  <View />
                ) : (
                  <TouchableOpacity
                    onPress={() => setDiaAbierto(null)}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-slate-100"
                  >
                    <Text className="text-[12px] font-bold text-white dark:text-slate-900">
                      {/* "1 cosas" no lo dice nadie. */}
                      {delDiaAbierto.length === 1
                        ? t("calendario.diaConUna", { dia: diaAbierto })
                        : t("calendario.diaConVarias", { dia: diaAbierto, n: delDiaAbierto.length })}
                    </Text>
                    <X size={13} color={oscuro ? "#0f172a" : "#ffffff"} strokeWidth={3} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setSeleccionando(true)} className="flex-row items-center gap-1.5">
                  <ListChecks size={15} color="#94a3b8" />
                  <Text className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                    {t("calendario.seleccionar")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      <View className="px-5">
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
            onAbrir={() =>
              seleccionando ? alternarSeleccion(p.id) : irUnaVez(`/calendario/nuevo?id=${p.id}`)
            }
            seleccionando={seleccionando}
            elegido={seleccionados.includes(p.id)}
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

      </View>
      </ScrollView>

      {/* EL BOTÓN DE AGREGAR, PEGADO ABAJO Y CON SU NOMBRE.
          Primero estuvo al final de la lista, y con veinte recibos quedaba fuera de la
          pantalla: *"si yo agrego 100 recordatorios, pagos, ingresos, no voy a estar bajando
          con mi celular"*. Luego fue el botón redondo de Inicio, y tampoco: *"quita ese +,
          donde podrías poner un botón de agregar visible para el usuario"*.

          Pegado abajo cumple las dos cosas: se ve siempre, tengas 3 pagos o 100, y dice lo
          que hace. Mientras se selecciona se apaga — ahí lo que se hace es borrar, y un botón
          verde en medio invita a tocar lo que no toca.

          Va sobre el borde de abajo del celular (insets), no sobre el borde de la pantalla:
          en los que tienen barra de gestos, un botón pegado al borde se toca con dificultad. */}
      <View
        className="px-5 pt-2.5 border-t-[1.5px] border-slate-100 dark:border-noche-borde bg-white dark:bg-noche"
        style={{ paddingBottom: 10 }}
      >
        <TouchableOpacity
          /* CON UN DÍA ABIERTO, ESTE BOTÓN AGREGA EN ESE DÍA.
             Es el mismo botón de siempre, en el mismo sitio, y solo cambia lo que dice: si
             estás mirando el 30, dice "Agregar un pago el 30" y llega al formulario con la
             fecha puesta. Cerrando el día vuelve a ser el de siempre. */
          onPress={() =>
            irUnaVez(
              diaAbierto == null
                ? "/calendario/nuevo"
                : `/calendario/nuevo?fecha=${mes}-${String(diaAbierto).padStart(2, "0")}`
            )
          }
          disabled={seleccionando}
          className={`flex-row items-center justify-center gap-2 py-3.5 rounded-2xl ${
            seleccionando ? "bg-slate-200 dark:bg-noche-3" : "bg-emerald-600"
          }`}
        >
          <Plus size={17} color={seleccionando ? "#94a3b8" : "#ffffff"} strokeWidth={2.6} />
          <Text
            className={`text-[14px] font-bold ${seleccionando ? "text-slate-400" : "text-white"}`}
          >
            {diaAbierto == null
              ? t("calendario.agregar")
              : t("calendario.agregarEnEsteDia", { dia: diaAbierto })}
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={confirmandoBorrar}
        title={t("calendario.borrarTitulo")}
        message={t(
          seleccionados.length > 1 ? "calendario.borrarTextoPlural" : "calendario.borrarTexto",
          { n: seleccionados.length }
        )}
        confirmLabel={t("calendario.nuevo.borrar")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={borrarSeleccionados}
        onCancel={() => setConfirmandoBorrar(false)}
      />

      <ConfirmDialog
        visible={confirmandoBorrarTodo}
        title={t("calendario.borrarTodoTitulo")}
        message={t("calendario.borrarTextoPlural", { n: visibles.length })}
        confirmLabel={t("calendario.borrarTodo")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={borrarTodosLosDelFiltro}
        onCancel={() => setConfirmandoBorrarTodo(false)}
      />
    </View>
  );
}

/** Los tres números del resumen. Uno solo para que los tres midan y separen igual. */
function Cuadro({ texto, valor, color }: { texto: string; valor: string; color: string }) {
  return (
    <View className="flex-1 rounded-xl py-2.5 px-2 items-center bg-slate-50 dark:bg-noche-2">
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
  const color = COLOR_DIA[colorDe(pago, estado)];
  const suColor = (pago.color && COLOR_HEX_600[pago.color]) || color;
  const Dibujo = iconoDe(pago.icono || iconoSugerido(pago.nombre, pago.tipo));
  const x = cuandoTexto(pago, mes, hoy);
  const f = x.fecha ? x.fecha.split("-").map(Number) : null;
  return (
    <TouchableOpacity
      onPress={onAbrir}
      activeOpacity={0.9}
      /* EL FONDO LO PONE EL PAGO, NO LA PANTALLA.
         Antes era el mismo gris de cualquier caja y la tarjeta se perdía entre lo demás:
         *"le podrías agregar como un fondo"*. Ahora lleva un velo del color de su estado
         —ámbar si falta, rojo si se pasó, verde si es un ingreso— con su borde del mismo
         tono. Un vistazo y ya sabes si vas bien o mal, sin leer nada.

         Muy suave a propósito (un 12% de color): el botón verde de Pagar tiene que seguir
         siendo lo más llamativo de la tarjeta. */
      className="rounded-2xl p-3.5 mb-4 border"
      style={{ backgroundColor: color + (oscuro ? "22" : "14"), borderColor: color + (oscuro ? "44" : "33") }}
    >
      {/* EL RÓTULO, EN VERSALITAS Y DEL COLOR DEL PAGO.
          Era gris y del mismo tamaño que la fecha de abajo, así que competía con ella.
          En mayúsculas pequeñas y separadas ya no se lee como una frase más: se lee como un
          título, que es lo que es. */}
      <Text
        className="text-[10px] font-extrabold mb-2.5"
        style={{ color, letterSpacing: 1.1 }}
      >
        {t("calendario.proximo").toUpperCase()}
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
            <Text className="text-[13px] font-bold text-white">
              {t(pago.tipo === "ingreso" ? "calendario.cobrar" : "calendario.pagar")}
            </Text>
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
  seleccionando,
  elegido,
}: {
  pago: PagoProgramado;
  estado: EstadoDelPago;
  cuando: string;
  fmt: (n: number) => string;
  t: T;
  oscuro: boolean;
  onPagar: () => void;
  onAbrir: () => void;
  seleccionando: boolean;
  elegido: boolean;
}) {
  const color = COLOR_DIA[colorDe(pago, estado)];
  const suColor = (pago.color && COLOR_HEX_600[pago.color]) || color;
  const Dibujo = iconoDe(pago.icono || iconoSugerido(pago.nombre, pago.tipo));
  const pagado = estado === "pagado";
  return (
    <TouchableOpacity
      onPress={onAbrir}
      activeOpacity={0.9}
      className="flex-row items-center gap-3 p-3 rounded-2xl mb-2 bg-slate-50 dark:bg-noche-2"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      {/* El círculo de elegir, igual que en Inicio: mismo icono y mismo sitio. */}
      {seleccionando &&
        (elegido ? <CheckCircle2 size={22} color="#059669" /> : <Circle size={22} color="#cbd5e1" />)}
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
        {!seleccionando && pago.tipo !== "recordatorio" &&
          (pagado ? (
            <View className="mt-1.5">
              {/* Verde de "todo bien", no el color de la categoría Pagados: esto confirma
                  que no queda nada, no clasifica nada. */}
              <Check size={20} color="#059669" strokeWidth={3} />
            </View>
          ) : (
            <TouchableOpacity
              onPress={onPagar}
              className="mt-1.5 px-3 py-1.5 rounded-lg bg-emerald-600"
            >
              {/* UN SUELDO NO SE PAGA, SE COBRA (20/08/2026).
                  El boton decia "Pagar" tambien en los ingresos: *"un ingreso sale el boton,
                  no deberia"*. El boton hace falta —es lo que convierte el sueldo en un
                  movimiento de verdad cuando llega— pero con esa palabra dice lo contrario de
                  lo que hace. Cambia la palabra, no el boton. */}
              <Text className="text-[12px] font-bold text-white">
                {t(pago.tipo === "ingreso" ? "calendario.cobrar" : "calendario.pagar")}
              </Text>
            </TouchableOpacity>
          ))}
      </View>
    </TouchableOpacity>
  );
}
