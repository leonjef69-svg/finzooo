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
import * as Notifications from "expo-notifications";
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
let enFila: Promise<number> = Promise.resolve(0);

export function reprogramarAvisosDePagos(
  lista: PagoProgramado[],
  t: (clave: string, valores?: Record<string, string | number>) => string,
  ahora: Date = new Date()
): Promise<number> {
  enFila = enFila.then(() => hacerlo(lista, t, ahora)).catch(() => 0);
  return enFila;
}

async function hacerlo(
  lista: PagoProgramado[],
  t: (clave: string, valores?: Record<string, string | number>) => string,
  ahora: Date
): Promise<number> {
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
      const permiso = await Notifications.getPermissionsAsync();
      if (!permiso.granted) {
        const pedido = await Notifications.requestPermissionsAsync();
        if (!pedido.granted) return 0;
      }
      // Su propio canal, aparte del de la exportación: así se puede silenciar uno sin
      // silenciar el otro desde los ajustes de Android, que es donde la gente los apaga.
      await Notifications.setNotificationChannelAsync("finzo-pagos", {
        name: "Calendario de pagos",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await retirarLosNuestros();

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

        await Notifications.scheduleNotificationAsync({
          content: {
            title: t("calendario.avisoTitulo", { nombre: pago.nombre }),
            body: textoDelAviso(pago, t),
            data: { [MARCA]: true, pagoId: pago.id, mes },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: "finzo-pagos",
            date: cuando,
          },
        });
        puestos++;
      }
      mes = mesSiguiente(mes);
    }
    return puestos;
  } catch {
    // Un aviso que no se pudo programar no puede tumbar la app ni impedir que el pago se
    // guarde: lo que se guarda es el dato, y el aviso es su consecuencia.
    return 0;
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
