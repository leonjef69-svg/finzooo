import { useMemo, useState } from "react";
import { irUnaVez } from "@/utils/nav";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import AvisoSoloLectura from "@/components/AvisoSoloLectura";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { CARD_SHADOW } from "@/constants/style";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { fmt as fmtConSimbolo, fmtDate } from "@/utils/format";
import { hayRegistroAutomatico } from "@/utils/dondeHayYape";
import { ahoraDelNegocio } from "@/utils/negocio";
import {
  diferenciaConElMesPasado,
  filtrarPorPeriodo,
  historialDelNegocio,
  horaVisible,
  mejorMesDe,
  productosVendidos,
  resumenPorMes,
  totalesDelNegocio,
  type PeriodoDelPanel,
} from "@/utils/negocioTotales";

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
  soloLectura = false,
}: {
  negocioId: string;
  onBack: () => void;
  /**
   * Se puede mirar pero no tocar: la prueba se acabó y este negocio ya existía.
   *
   * Los números y el historial se ven ENTEROS. Lo que desaparece son los botones de registrar,
   * el de anotar un gasto, el de productos y el interruptor de los yapeos — todo lo que
   * CAMBIA algo. Ver utils/candado.
   */
  soloLectura?: boolean;
}) {
  const {
    t,
    monthNames,
    negocios,
    ventas,
    movimientosNegocio,
    quitarVenta,
    quitarMovimientoNegocio,
    mandarYapesAlNegocio,
    showToast,
    userCurrency,
  } = useAppData();
  const insets = useSafeAreaInsets();

  const negocio = negocios.find((n) => n.id === negocioId);

  /** ¿Los yapeos que entren caen en este negocio? */
  const recibeYapes = negocio?.activo === true && negocio.destinoYapes === "negocio";
  /** Y si no, ¿los está recibiendo OTRO negocio? Hay que decirlo antes de quitárselos. */
  const otroRecibe = negocios.find((n) => n.id !== negocioId && n.activo && n.destinoYapes === "negocio");

  /**
   * EL DINERO SE ESCRIBE CON LA MONEDA DEL NEGOCIO, no con la de la app.
   *
   * El negocio guarda la suya desde el primer día porque puede no ser la misma: alguien lleva
   * su casa en soles y un negocio que cobra en dólares. Usar la de la app pondría el símbolo
   * equivocado delante de un número correcto, que es la peor mezcla de las dos.
   */
  const dinero = (n: number) => fmtConSimbolo(n, currencySymbolFor(negocio?.moneda ?? ""));

  /**
   * QUÉ TROZO DE TIEMPO SE MIRA. Empieza en HOY, y no en "todo", a propósito: la pregunta de
   * un negocio al cerrar el día es *"¿cuánto hice hoy?"*. "Todo" sigue estando, pero es la
   * respuesta que menos se busca y no tiene por qué ser la primera que se ve.
   */
  const [periodo, setPeriodo] = useState<PeriodoDelPanel>("hoy");
  /** El día de HOY según el celular. Ver ahoraDelNegocio: nunca la hora de Londres. */
  const hoy = ahoraDelNegocio().fecha;

  // SE FILTRA UNA VEZ Y PARA LAS DOS COSAS. Con un filtro para los totales y otro para el
  // historial, bastaría cambiar uno para que la pantalla enseñara un saldo de hoy encima de
  // una lista de la semana pasada, y eso no se ve mirando: se ve cuando las cuentas no cuadran.
  const ventasDelPeriodo = useMemo(
    () => filtrarPorPeriodo(ventas, periodo, hoy),
    [ventas, periodo, hoy]
  );
  const movimientosDelPeriodo = useMemo(
    () => filtrarPorPeriodo(movimientosNegocio, periodo, hoy),
    [movimientosNegocio, periodo, hoy]
  );

  const totales = useMemo(
    () => totalesDelNegocio(negocioId, ventasDelPeriodo, movimientosDelPeriodo),
    [negocioId, ventasDelPeriodo, movimientosDelPeriodo]
  );
  const historial = useMemo(
    () => historialDelNegocio(negocioId, ventasDelPeriodo, movimientosDelPeriodo),
    [negocioId, ventasDelPeriodo, movimientosDelPeriodo]
  );
  /**
   * ¿ESTE NEGOCIO REGISTRA VENTAS, ALGUNA VEZ?
   *
   * De esto depende media pantalla, y es la lección del 08/08/2026: él decidió que la app
   * lleve **solo la plata**, sin que el vendedor toque nada —*"el vendedor no va a estar
   * haciendo manualmente todo, está enfocado en vender sus productos"*—. Con esa forma de
   * usarla, la línea de "Ventas", el contador de ventas y el aviso del doble conteo son un
   * cero permanente y un problema imposible: **exactamente la clase de promesa vacía que se ha
   * estado limpiando de esta app**.
   *
   * Se mira en TODAS las ventas y no en las del periodo: si registró ventas el mes pasado y
   * este no, la línea tiene que seguir ahí — un cero que puede cambiar sí informa.
   *
   * No se borra nada: en cuanto registre una venta, todo eso vuelve solo.
   */
  const usaVentas = useMemo(
    () => ventas.some((v) => v.negocioId === negocioId),
    [ventas, negocioId]
  );

  /** Qué se vendió en ese mismo periodo: *"cuánto Broster salió"*. */
  const vendidos = useMemo(
    () => productosVendidos(negocioId, ventasDelPeriodo),
    [negocioId, ventasDelPeriodo]
  );

  /**
   * MES A MES, y con TODAS las ventas, no con las del periodo.
   *
   * Es la única parte de esta pantalla que no obedece al botón de arriba, y tiene que ser así:
   * comparar agosto con julio teniendo puesto "Hoy" daría una sola columna.
   */
  const meses = useMemo(
    () => resumenPorMes(negocioId, ventas, movimientosNegocio),
    [negocioId, ventas, movimientosNegocio]
  );
  /**
   * Cuánto más (o menos) que el mes pasado, y cuál fue el mejor mes para medir las barras.
   *
   * LAS DOS CUENTAS SE PIDEN HECHAS, como todo el dinero de esta pantalla. Restar aquí dos
   * saldos parece inofensivo y es exactamente por donde vuelve el fallo de siempre: una cuenta
   * de plata escrita en una pantalla no se puede comprobar sin abrir la app y mirar.
   */
  const diferencia = diferenciaConElMesPasado(meses, hoy.slice(0, 7));
  const mejorMes = mejorMesDe(meses);

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
      className="flex-1 bg-white dark:bg-noche"
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
          <View className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-noche-2 items-center justify-center">
            <Store size={18} color="#059669" />
          </View>
          <Text className="flex-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {t("panel.subtitle")}
          </Text>
        </View>

        {/* PRIMERO, POR QUÉ NO SE PUEDE TOCAR NADA. Antes que los números: quien entra y ve los
            botones desaparecidos sin explicación piensa que la app se rompió. */}
        {soloLectura && <AvisoSoloLectura />}

        {/* HOY · ESTE MES · TODO.
            Va ARRIBA DEL TODO y no escondido tras un botón: es lo que cambia el significado de
            cada número de esta pantalla. Un total sin saber de qué días es no dice nada. */}
        <View className="flex-row gap-2 mb-4">
          {PERIODOS.map((p) => {
            const puesto = periodo === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriodo(p)}
                className={`flex-1 py-2.5 rounded-xl items-center border-[1.5px] ${
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
                  {t(`panel.periodo.${p}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* EL SALDO ARRIBA Y GRANDE: es el número por el que se abre esta pantalla. */}
        <View
          className="rounded-2xl p-5 bg-emerald-600 mb-4"
          style={CARD_SHADOW}
        >
          <View className="flex-row items-center gap-2">
            <Wallet size={14} color="#d1fae5" />
            {/* EL NOMBRE DEL NÚMERO CAMBIA CON EL PERIODO. Decir "saldo del negocio" encima de
                lo de hoy sería mentir: el saldo es todo, lo de hoy es lo de hoy. */}
            <Text className="text-[11px] font-bold text-emerald-50">
              {periodo === "todo" ? t("panel.saldo") : t(`panel.saldo.${periodo}`)}
            </Text>
          </View>
          <Text className="text-3xl font-extrabold text-white mt-1.5">{dinero(totales.saldo)}</Text>
          {/* EL CONTADOR DE VENTAS, SOLO SI SE REGISTRAN VENTAS. Ver usaVentas: sin ellas
              decía "0 ventas registradas" debajo de un saldo de S/ 2, para siempre. Un cero
              que no puede cambiar no informa: confunde. */}
          {usaVentas && (
            <Text className="text-[11px] text-emerald-50 mt-1">
              {t("panel.cantidadVentas", { count: totales.cantidadVentas })}
            </Text>
          )}
        </View>

        {/* LAS LÍNEAS, UNA DEBAJO DE OTRA. Cada una dice de dónde sale el saldo de arriba. */}
        <View
          className="rounded-2xl bg-white dark:bg-noche-2 border-[1.5px] border-slate-200 dark:border-noche-borde p-4 gap-3"
          style={CARD_SHADOW}
        >
          {/* LA LÍNEA DE VENTAS, SOLO SI LAS HAY. Igual que el contador de arriba. */}
          {usaVentas && (
            <Linea
              icono={<ShoppingBag size={15} color="#059669" />}
              texto={t("panel.ventas")}
              valor={dinero(totales.ventas)}
              color="text-emerald-600"
            />
          )}
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

        {/* EL DOBLE CONTEO, PERO SOLO CUANDO PUEDE PASAR.
            Una venta cobrada por Yape puede contarse dos veces: como venta y como ingreso
            automático. Callarlo haría que el saldo pareciera equivocado, y un número de dinero
            que parece equivocado no se vuelve a mirar.

            PERO SIN VENTAS REGISTRADAS ESO NO PUEDE OCURRIR, y entonces el aviso deja de
            avisar: es media pantalla de letra explicando un problema imposible, justo encima
            de los números que sí importan. Vuelve solo en cuanto haya una venta. */}
        {usaVentas && (
          <View className="rounded-2xl bg-amber-50 dark:bg-noche-2 p-4 mt-4 flex-row gap-2.5">
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
        )}

        {/* EL BOTÓN GRANDE ES EL QUE SE USA, Y ESO DEPENDE DE CÓMO SE LLEVE EL NEGOCIO.
            Registrar ventas es lo que se haría cien veces al día EN UN NEGOCIO QUE LAS
            REGISTRA. En el suyo no —*"el vendedor está enfocado en vender sus productos"*— y
            entonces el botón grande y verde es el que nunca se toca, encima del que sí: anotar
            un gasto. Cambia solo con el uso; no se quita nada. */}
        {soloLectura ? null : usaVentas ? (
          <TouchableOpacity
            onPress={() => irUnaVez({ pathname: "/negocio/venta", params: { id: negocioId } })}
            className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 mt-4"
          >
            <Plus size={16} color="#ffffff" />
            <Text className="text-sm font-bold text-white">{t("venta.registrar")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => irUnaVez({ pathname: "/negocio/movimiento", params: { id: negocioId } })}
            className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 mt-4"
          >
            <Plus size={16} color="#ffffff" />
            <Text className="text-sm font-bold text-white">{t("caja.rowLabel")}</Text>
          </TouchableOpacity>
        )}

        {/* GASTO Y PRODUCTOS, SOLO EN UN NEGOCIO QUE REGISTRA VENTAS.
            Sin ventas, los productos no alimentan nada: solo sirven para elegirlos al registrar
            una venta y para la lista de "lo que más vendes". Él lo vio antes que nadie mirando
            su propia pantalla —*"ya no le pondré el nombre broster, yo ya no lo veo
            necesario"*— y tiene razón: el Yape entra solo, con productos o sin ellos. */}
        {usaVentas && !soloLectura && (
          <View className="flex-row gap-2.5 mt-2.5">
            <TouchableOpacity
              onPress={() => irUnaVez({ pathname: "/negocio/movimiento", params: { id: negocioId } })}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 dark:bg-noche-2"
            >
              <TrendingDown size={15} color="#f43f5e" />
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {t("caja.rowLabel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => irUnaVez({ pathname: "/negocio/productos", params: { id: negocioId } })}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 dark:bg-noche-2"
            >
              <Package size={15} color="#059669" />
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {t("negocios.productos")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LAS PUERTAS DISCRETAS.
            "Mis negocios" hace falta desde que Ajustes entra directo aquí cuando solo hay un
            negocio, o crear el segundo se volvería imposible de encontrar.

            Y "Registrar una venta" TIENE QUE SEGUIR AQUÍ cuando no se usan las ventas, aunque
            sea en gris y chiquito: esconderlo del todo lo convertiría en un camino sin
            retorno —no habría forma de registrar la primera venta, y sin la primera nunca
            volverían ni el botón, ni los productos, ni "lo que más vendes"—. Escondido no es
            lo mismo que borrado, y esta línea es la diferencia. */}
        <View className="flex-row justify-center items-center gap-4 py-3">
          {!usaVentas && !soloLectura && (
            <TouchableOpacity
              onPress={() => irUnaVez({ pathname: "/negocio/venta", params: { id: negocioId } })}
            >
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {t("venta.registrar")}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => irUnaVez("/negocio")}>
            <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {t("panel.misNegocios")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* LO QUE MÁS VENDES, del periodo elegido igual que todo lo demás.
            Solo sale si hubo ventas: una lista vacía con un título encima ocupa sitio y no
            dice nada, y esta pantalla ya es larga. */}
        {vendidos.length > 0 && (
          <>
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-6 mb-3">
              {t("panel.vendidos")}
            </Text>
            <View
              className="rounded-2xl bg-white dark:bg-noche-2 border-[1.5px] border-slate-200 dark:border-noche-borde p-4 gap-3.5"
              style={CARD_SHADOW}
            >
              {vendidos.map((p) => (
                <View key={p.productoId}>
                  <View className="flex-row items-center gap-3">
                    <Text
                      className="flex-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                      numberOfLines={1}
                    >
                      {p.nombre}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t("panel.vendidosCantidad", { count: p.cantidad })}
                    </Text>
                    <Text className="text-xs font-bold text-emerald-600">{dinero(p.total)}</Text>
                  </View>
                  {/* LA BARRA ES CONTRA EL QUE MÁS VENDE, no contra el total: comparada con el
                      total, con veinte productos todas las barras salen igual de cortas y no
                      se distingue nada. Así se lee de un vistazo quién manda. */}
                  <View className="h-1.5 rounded-full bg-slate-100 dark:bg-noche-2 mt-1.5 overflow-hidden">
                    <View
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(4, (p.total / vendidos[0].total) * 100)}%` }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* MES A MES. Solo sale con DOS meses o más: con uno no hay nada que comparar y sería
            un título con una fila debajo diciendo lo que ya está arriba. */}
        {meses.length > 1 && (
          <>
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-6 mb-3">
              {t("panel.mesAMes")}
            </Text>

            {/* LA COMPARACIÓN, EN UNA FRASE. Es lo que preguntó: cuánto ganó este mes contra
                el pasado. Los números están en la lista, pero la resta la tiene que hacer la
                app: si hay que hacerla de cabeza, no se hace. */}
            {diferencia !== null && (
              <View className="rounded-2xl bg-slate-50 dark:bg-noche-2 p-4 mb-3">
                <Text className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                  {diferencia > 0
                    ? t("panel.comparaMas", { dif: dinero(Math.abs(diferencia)) })
                    : diferencia < 0
                      ? t("panel.comparaMenos", { dif: dinero(Math.abs(diferencia)) })
                      : t("panel.comparaIgual")}
                </Text>
              </View>
            )}

            <View
              className="rounded-2xl bg-white dark:bg-noche-2 border-[1.5px] border-slate-200 dark:border-noche-borde p-4 gap-3.5"
              style={CARD_SHADOW}
            >
              {meses.map((m) => (
                <View key={m.mes}>
                  <View className="flex-row items-center gap-3">
                    <Text className="flex-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                      {nombreDelMes(m.mes, monthNames)}
                    </Text>
                    <Text
                      className={`text-sm font-bold ${
                        m.queda < 0 ? "text-rose-500" : "text-emerald-600"
                      }`}
                    >
                      {dinero(m.queda)}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t("panel.mesDetalle", { entro: dinero(m.entro), salio: dinero(m.salio) })}
                  </Text>
                  <View className="h-1.5 rounded-full bg-slate-100 dark:bg-noche-2 mt-1.5 overflow-hidden">
                    <View
                      className={`h-full rounded-full ${m.queda < 0 ? "bg-rose-400" : "bg-emerald-500"}`}
                      // Un mes en rojo no tiene barra que estirar: se deja el mínimo para que
                      // la fila no parezca vacía.
                      style={{
                        width: `${m.queda > 0 && mejorMes > 0 ? Math.max(4, (m.queda / mejorMes) * 100) : 4}%`,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* SOLO DONDE HAY YAPE (11/08/2026).

            Este interruptor decide si los yapeos entran al negocio, y en Colombia o Argentina
            no hay yapeos que repartir. Ver utils/dondeHayYape: la funcion de registro
            automatico se esconde entera fuera de Peru y Bolivia, y esta es la otra puerta por
            la que se llegaba a lo mismo. Esconderla en un sitio y dejarla en otro es la
            costura donde se cuelan los fallos de este proyecto. */}
        {/* A QUÉ BOLSILLO VAN LOS YAPEOS QUE ENTREN.
            Va en el panel y no escondido en "editar el negocio": es lo que cambia dónde cae
            tu plata todos los días, y una decisión así no puede estar donde no se ve. Empieza
            APAGADO: crear un negocio no cambia dónde caían los yapeos que ya se registraban
            bien. */}
        {hayRegistroAutomatico(userCurrency) && (
          <View
            className="rounded-2xl p-4 mt-6 bg-white dark:bg-noche-2 border-[1.5px] border-slate-200 dark:border-noche-borde"
            style={CARD_SHADOW}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-noche-2 items-center justify-center">
                <Zap size={17} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t("panel.yapesTitulo")}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {recibeYapes ? t("panel.yapesAqui") : t("panel.yapesPersonal")}
                </Text>
              </View>
              {/* EL INTERRUPTOR SE VE PERO NO SE TOCA en solo lectura, y verlo es lo importante:
                  dice a dónde está cayendo la plata AHORA MISMO, que es justo lo que hay que
                  poder comprobar aunque no se pueda cambiar. Esconderlo dejaría a alguien sin
                  saber por qué sus yapeos no aparecen en Inicio. */}
              <Toggle
                on={recibeYapes}
                onChange={(v: boolean) => {
                  if (soloLectura) return;
                  mandarYapesAlNegocio(negocioId, v);
                  showToast(v ? t("panel.yapesActivado") : t("panel.yapesDesactivado"));
                }}
              />
            </View>
            <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 mt-3">
              {t("panel.yapesExplicacion")}
            </Text>
            {/* SI OTRO NEGOCIO LOS ESTABA RECIBIENDO, HAY QUE DECIRLO ANTES de que se los quite
                sin avisar. Solo uno puede recibir: con dos, el mismo yapeo tendría dos destinos
                posibles. */}
            {!recibeYapes && otroRecibe && (
              <Text className="text-[11px] leading-5 text-amber-700 dark:text-amber-400 mt-2">
                {t("panel.yapesOtroNegocio", { nombre: otroRecibe.nombre })}
              </Text>
            )}
          </View>
        )}

        {/* EL HISTORIAL. */}
        <Text className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-6 mb-3">
          {t("panel.historial")}
        </Text>

        {historial.length === 0 ? (
          <View className="rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-noche-borde p-6 items-center">
            <Store size={26} color="#94a3b8" />
            {/* EL VACÍO DICE DE QUÉ PERIODO ESTÁ VACÍO. "Todavía no hay nada registrado" con
                "Hoy" puesto haría pensar que se perdió todo lo de ayer. */}
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200 mt-3">
              {periodo === "todo" ? t("panel.vacioTitulo") : t(`panel.vacio.${periodo}`)}
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
                  className="rounded-2xl p-4 bg-white dark:bg-noche-2 border-[1.5px] border-slate-200 dark:border-noche-borde"
                  style={CARD_SHADOW}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-9 h-9 rounded-2xl items-center justify-center ${
                        entra ? "bg-emerald-50 dark:bg-noche-2" : "bg-rose-50 dark:bg-noche-2"
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
                    <View className="mt-3 pt-3 border-t-[1.5px] border-slate-100 dark:border-noche-borde">
                      <Text className="text-[11px] leading-5 text-rose-600 dark:text-rose-400">
                        {t("panel.borrarAviso")}
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
                          onPress={() => borrar(f)}
                          className="flex-1 py-2.5 rounded-xl items-center bg-rose-500"
                        >
                          <Text className="text-[11px] font-bold text-white">
                            {t("negocios.borrarSi")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : soloLectura ? null : (
                    /* BORRAR TAMBIÉN ES CAMBIAR, así que en solo lectura no está. Y aquí importa
                       más que en los otros botones: lo que se borra es dinero registrado. */
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
        <View className="rounded-2xl bg-slate-50 dark:bg-noche-2 p-4 mt-5">
          <Text className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            {t("panel.proximoPaso")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * "2026-07" → "julio 2026", con los nombres del idioma elegido.
 *
 * El año se pone SIEMPRE. Sin él, "julio" a principios de enero podría ser el de hace seis
 * meses o el de hace año y medio, y en una lista de meses seguidos eso se confunde solo.
 */
function nombreDelMes(mes: string, monthNames: string[]): string {
  const [anio, numero] = mes.split("-").map(Number);
  const nombre = monthNames[numero - 1];
  if (!nombre) return mes;
  return `${nombre} ${anio}`;
}

/** Los tres trozos de tiempo, en el orden en que se preguntan: hoy primero. */
const PERIODOS: PeriodoDelPanel[] = ["hoy", "mes", "todo"];

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
