/**
 * LOS AVISOS DEL CALENDARIO DE PAGOS (18/08/2026)
 *
 * Lo pidió con estas palabras: *"pueda yo personalizar qué día y hora me avise para
 * pagarlo"*. Así que cada pago trae **sus** días de antelación y **su** hora, y no un ajuste
 * general — el recibo de la luz y el sueldo no se avisan igual.
 *
 * Se apoya en `expo-notifications`, que ya usa la exportación automática, y en el permiso
 * `POST_NOTIFICATIONS` que la app ya declara. **Por eso esto NO necesita un APK nuevo**: no
 * hay ni una línea de código de Android.
 */
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { loadJSON, saveJSON } from "@/utils/storage";
import {
  cuandoAvisar,
  estadoEn,
  mesDe,
  mesSiguiente,
  type PagoProgramado,
} from "@/utils/calendarioPagos";

/**
 * La marca con la que se reconocen NUESTROS avisos.
 *
 * Hace falta porque al reprogramar hay que retirar los de antes, y
 * `cancelAllScheduledNotificationsAsync` se llevaría por delante **el aviso de la
 * exportación automática**, que lo programa otro archivo y no tiene nada que ver. Un
 * borrado ancho es de las cosas que funcionan hasta que alguien añade la segunda función
 * que usa avisos — y entonces el fallo es "mi reporte dejó de llegar", sin ninguna pista.
 */
const MARCA = "calendarioPagos";

/**
 * EL CANAL DE ANDROID, Y POR QUÉ LLEVA UN NÚMERO AL FINAL.
 *
 * **Un canal no se puede cambiar después de creado.** Android lo congela la primera vez, y a
 * partir de ahí manda lo que decida la persona en los ajustes del sistema: si el código
 * cambia el sonido, la importancia o la vibración, no pasa absolutamente nada.
 *
 * El primero se creó con importancia `DEFAULT` y sin decir nada del sonido, y el aviso
 * llegaba mudo: *"ya llegó la notificación pero no hace ningún sonido"*. Cambiarlo en el
 * sitio no habría servido de nada — de ahí el `-v2`.
 *
 * **Si alguna vez hay que volver a tocar el sonido o la importancia, hay que subir el
 * número.** Es lo único que hace que Android se entere.
 */
const CANAL = "finzo-pagos-v2";

/** Cuántos meses por delante se programan. Ver `reprogramarAvisosDePagos`. */
const MESES_POR_DELANTE = 3;

/**
 * Vuelve a dejar programados TODOS los avisos del calendario.
 *
 * **Se rehacen enteros en vez de tocar el que cambió.** Llevar la cuenta de qué aviso es de
 * qué pago es un segundo almacén que puede desincronizarse, y cuando lo hace el resultado es
 * un aviso de algo ya pagado o uno que no suena nunca. Son unos pocos avisos: rehacerlos
 * cuesta milésimas y ninguno puede quedar huérfano.
 *
 * **Tres meses por delante, y no uno.** Android guarda los avisos programados aunque la app
 * no se abra, pero solo se reprograman cuando algo cambia: con un solo mes, alguien que no
 * abriera Fino en cuatro semanas se quedaría sin avisos justo por no usarla, que es cuando
 * más falta hacen. Y no más de tres porque cada uno ocupa un hueco en el sistema.
 */
/**
 * UNA REPROGRAMACIÓN CADA VEZ, EN FILA. **Esto era el fallo del 18/08/2026.**
 *
 * Reprogramar son dos pasos: retirar los avisos de antes y volver a ponerlos. Con dos
 * ejecuciones a la vez, la segunda **retira los que acababa de poner la primera** y el
 * resultado es cero avisos programados — sin ningún error, y con la pantalla diciendo que
 * todo está guardado.
 *
 * Y pasaba de verdad: el efecto que llama aquí tenía `t` entre sus dependencias, y `t` se
 * crea de nuevo en cada dibujado del contexto. Así que esto corría decenas de veces seguidas,
 * cada una pisando a la anterior. Él lo reportó como *"no me llegó nada"*.
 *
 * Encadenándolas, la siguiente espera a que la anterior termine. Es una fila, no un candado:
 * ninguna se pierde, solo esperan.
 */
let enFila: Promise<ResultadoDeProgramar> = Promise.resolve({ puestos: 0 });

/**
 * QUÉ PASÓ AL PROGRAMAR, Y NO SOLO CUÁNTOS QUEDARON.
 *
 * Antes esto devolvía un número y el `catch` convertía cualquier fallo en un 0. Así, "no se
 * programó ninguno" y "reventó al programarlos" se veían **idénticos** desde la pantalla — y
 * son problemas distintos con arreglos distintos. Se perdió una noche entera por eso.
 *
 * Es exactamente la lección que dejó el PDF automático el 06/08: el `catch` guardaba
 * "error" y tiraba el mensaje, y el único caso que necesitaba detalle era justo el que lo
 * perdía.
 */
export type ResultadoDeProgramar = { puestos: number; fallo?: string };

export function reprogramarAvisosDePagos(
  lista: PagoProgramado[],
  t: (clave: string, valores?: Record<string, string | number>) => string,
  ahora: Date = new Date()
): Promise<ResultadoDeProgramar> {
  enFila = enFila
    .then(() => hacerlo(lista, t, ahora))
    .catch((e) => ({ puestos: 0, fallo: String(e?.message ?? e) }));
  return enFila;
}

async function hacerlo(
  lista: PagoProgramado[],
  t: (clave: string, valores?: Record<string, string | number>) => string,
  ahora: Date
): Promise<ResultadoDeProgramar> {
  // Cada paso dice dónde está, para que si algo revienta el mensaje diga EN CUÁL. Sin esto,
  // "cannot read property of undefined" no distingue el permiso del canal ni del programado.
  let paso = "empezando";
  try {
    // EL PERMISO, Y ESTO FALTABA (18/08/2026).
    //
    // Desde Android 13 los avisos se piden a mano, y aquí no se pedían: se programaban
    // perfectamente y no aparecía ninguno. El único sitio que lo pedía era la exportación
    // automática, así que el calendario solo funcionaba si la persona había configurado
    // ANTES otra cosa que no tiene nada que ver.
    //
    // Se pide al programar y no al abrir la pantalla: la ventana de Android sale cuando ya
    // se entiende para qué sirve —acabas de guardar un recibo— y no nada más entrar.
    if (lista.length > 0) {
      paso = "permiso";
      const permiso = await Notifications.getPermissionsAsync();
      if (!permiso.granted) {
        const pedido = await Notifications.requestPermissionsAsync();
        if (!pedido.granted) return { puestos: 0, fallo: "sin-permiso" };
      }
      // Su propio canal, aparte del de la exportación: así se puede silenciar uno sin
      // silenciar el otro desde los ajustes de Android, que es donde la gente los apaga.
      paso = "canal";
      await prepararCanal();
    }

    paso = "retirando";
    await retirarLosNuestros();

    // APAGADOS DESDE AJUSTES: se retiran los que hubiera y no se pone ninguno. Se comprueba
    // DESPUES de retirar, no antes, para que apagar el interruptor limpie de verdad lo que ya
    // estaba programado en vez de dejarlo sonando.
    if (!(await avisosEncendidos())) return { puestos: 0 };

    let puestos = 0;
    let mes = mesDe(ahora);
    for (let i = 0; i < MESES_POR_DELANTE; i++) {
      for (const pago of lista) {
        // Lo ya pagado no se avisa. Recordarle a alguien que pague lo que pagó es la forma
        // más rápida de que apague los avisos de la app entera.
        if (estadoEn(pago, mes, ahora) === "pagado") continue;

        const cuando = cuandoAvisar(pago, mes);
        if (cuando == null) continue;
        // Lo que ya pasó no se programa: Android dispara al instante un aviso con fecha
        // pasada, así que al abrir la app sonarían de golpe todos los de los meses viejos.
        if (cuando.getTime() <= ahora.getTime()) continue;

        paso = `programando ${pago.nombre} de ${mes}`;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t("calendario.avisoTitulo", { nombre: pago.nombre }),
            body: textoDelAviso(pago, t),
            sound: "default",
            data: { [MARCA]: true, pagoId: pago.id, mes },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: CANAL,
            date: cuando,
          },
        });
        puestos++;
      }
      mes = mesSiguiente(mes);
    }
    return { puestos };
  } catch (e) {
    // Un aviso que no se pudo programar no puede tumbar la app ni impedir que el pago se
    // guarde: lo que se guarda es el dato, y el aviso es su consecuencia. Pero el motivo SÍ
    // se cuenta, con el paso en el que estaba.
    return { puestos: 0, fallo: `${paso}: ${String((e as Error)?.message ?? e)}` };
  }
}

/**
 * El cuerpo del aviso, con el monto dentro.
 *
 * Con el monto se puede decidir desde la pantalla bloqueada si hay que ir a pagarlo ahora o
 * no; sin él hay que abrir la app para saber de cuánto se está hablando. Un recordatorio no
 * tiene monto y por eso lleva su propio texto en vez de un "S/ 0".
 */
function textoDelAviso(
  pago: PagoProgramado,
  t: (clave: string, valores?: Record<string, string | number>) => string
): string {
  if (pago.tipo === "recordatorio" || pago.monto == null) {
    return t("calendario.avisoRecordatorio");
  }
  const clave = pago.tipo === "ingreso" ? "calendario.avisoIngreso" : "calendario.avisoPago";
  return t(clave, { monto: pago.monto.toFixed(2) });
}

/**
 * Retira solo los avisos de este archivo, por su marca.
 *
 * Ver `MARCA`: borrar todos se llevaría el de la exportación automática.
 */
async function retirarLosNuestros(): Promise<void> {
  const puestos = await Notifications.getAllScheduledNotificationsAsync();
  for (const aviso of puestos) {
    if (aviso.content?.data?.[MARCA]) {
      await Notifications.cancelScheduledNotificationAsync(aviso.identifier);
    }
  }
}

/**
 * CUÁNTOS AVISOS DEL CALENDARIO ESTÁN PUESTOS AHORA MISMO.
 *
 * Lo enseña la pantalla. Un "no me llegó nada" tiene cuatro causas que desde fuera se ven
 * iguales —permiso denegado, hora ya pasada, fallo al programar, o el celular durmiendo la
 * app— y este número separa las dos primeras de las dos últimas.
 */
export async function avisosPuestos(): Promise<number> {
  try {
    const todos = await Notifications.getAllScheduledNotificationsAsync();
    return todos.filter((a) => a.content?.data?.[MARCA]).length;
  } catch {
    return 0;
  }
}

/**
 * PROBAR EL AVISO AHORA MISMO, SIN ESPERAR AL DÍA DEL PAGO.
 *
 * Es la respuesta a *"no me llegó ninguna notificación, soluciona el problema de raíz, no
 * puedo estar con problemas en cada momento"*. Y tenía toda la razón: hasta ahora, comprobar
 * si los avisos funcionaban costaba **poner una hora y esperar**, y si no sonaba había cuatro
 * causas posibles y ninguna forma de separarlas. Un día entero por intento.
 *
 * Con esto se sabe en diez segundos. Es exactamente lo que ya se hizo con "Probar la voz
 * ahora" el 07/08, y por el mismo motivo: lo que convierte *"no funciona"* en *"te falta
 * esto"*.
 *
 * Devuelve qué pasó, para poder DECIRLO en la pantalla en vez de callar:
 *   "listo"      → programado; debe sonar en unos segundos
 *   "sin-permiso" → Android no deja; hay que concederlo en los ajustes
 *   "error"       → falló al programarlo
 */
export type ResultadoDeLaPrueba = "listo" | "sin-permiso" | "error";

export async function probarAviso(
  t: (clave: string, valores?: Record<string, string | number>) => string
): Promise<ResultadoDeLaPrueba> {
  try {
    const permiso = await Notifications.getPermissionsAsync();
    if (!permiso.granted) {
      const pedido = await Notifications.requestPermissionsAsync();
      if (!pedido.granted) return "sin-permiso";
    }
    await prepararCanal();
    // TRES SEGUNDOS, a petición suya el 19/08/2026 (antes eran diez).
    //
    // Diez daban tiempo de sobra a salir de la app y ver el aviso como se ve de verdad. Pero
    // esperar diez segundos mirando el celular por cada prueba es mucho, y probar es
    // justamente lo que hay que poder hacer sin pensarlo. Con tres se alcanza a salir si uno
    // ya sabe que va a salir.
    //
    // Si llega con Fino delante, se ve igual pero sin sonido: el sonido lo pone el canal de
    // Android y ese solo manda con la app detrás.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("calendario.pruebaTitulo"),
        body: t("calendario.pruebaTexto"),
        sound: "default",
        data: { [MARCA]: true, prueba: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: CANAL,
        seconds: 3,
      },
    });
    return "listo";
  } catch {
    return "error";
  }
}

/**
 * Deja el canal listo, con sonido y asomándose por arriba.
 *
 * `HIGH` es lo que hace que el aviso se muestre encima de lo que estés haciendo, como el de
 * Yape. Con `DEFAULT` baja a la barra en silencio y hay que ir a buscarlo — que es justo lo
 * que no sirve para un recibo que vence hoy.
 *
 * Ver `CANAL`: cambiar estos valores sin subir el número del canal no hace nada.
 */
async function prepararCanal(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: "Calendario de pagos",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * ABRE LOS AJUSTES DE ANDROID DE **ESTE** CANAL, PARA ELEGIR EL SONIDO.
 *
 * Pedido suyo: *"sería bueno que se pueda personalizar el sonido; cada usuario puede elegir
 * el sonido y saber cuándo le llegue una notificación"*.
 *
 * **No se hace una lista de sonidos dentro de Fino, y el motivo importa.** En Android el
 * sonido pertenece al canal, y un canal no se puede cambiar después de creado: para ofrecer
 * seis sonidos habría que crear seis canales, y el día que alguien quisiera el séptimo —o
 * uno suyo— no habría forma de dárselo. Además la app tendría que llevar los archivos de
 * audio dentro, lo cual es código nativo y otro APK.
 *
 * La pantalla de Android ya hace todo eso mejor: deja elegir **cualquier** tono del celular,
 * la vibración y si se asoma por arriba, y lo recuerda aunque Fino se actualice. Esto solo
 * abre esa puerta.
 *
 * Se usa `Linking.sendIntent`, que es de React Native y no pide nada nativo: por eso llega
 * por internet como todo lo demás del calendario.
 *
 * Devuelve false si no se pudo abrir — hay fabricantes que mueven esa pantalla— para poder
 * decirlo en vez de dejar un botón que al tocarlo no hace nada.
 */
export async function abrirAjustesDelSonido(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const paquete =
    Constants.expoConfig?.android?.package ?? "com.finoapp.gastos";
  try {
    // El canal tiene que existir antes: Android no abre los ajustes de uno que no ha creado.
    await prepararCanal();
    await Linking.sendIntent("android.settings.CHANNEL_NOTIFICATION_SETTINGS", [
      { key: "android.provider.extra.APP_PACKAGE", value: paquete },
      { key: "android.provider.extra.CHANNEL_ID", value: CANAL },
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * EL INTERRUPTOR GENERAL DE AVISOS (19/08/2026)
 *
 * Existía en Ajustes desde hace meses y **no hacía absolutamente nada**: era un `useState`
 * suelto dentro de la pantalla. Lo preguntó él —*"tenemos en ajustes una opción de
 * notificación, eso sirve, está de adorno, hace algo?"*— y no, no hacía nada.
 *
 * Es justo lo que este proyecto lleva meses limpiando: un botón que promete y no cumple. Con
 * el calendario mandando avisos de verdad, ya tiene algo que apagar.
 *
 * **Apagarlo retira los avisos puestos y no deja poner más**; encenderlo los vuelve a
 * programar solos, sin que haya que tocar cada pago. No borra ningún pago: solo decide si
 * suenan.
 */
const CLAVE_AVISOS = "finzo:avisosEncendidos";

export async function avisosEncendidos(): Promise<boolean> {
  return loadJSON<boolean>(CLAVE_AVISOS, true);
}

export function guardarAvisosEncendidos(valor: boolean): void {
  saveJSON(CLAVE_AVISOS, valor);
}
