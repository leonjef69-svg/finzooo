import { flushPendingSaves, loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";
import { processCaptured, type CaptureLogEntry } from "@/utils/autoCapture";
import { mergeTransactions } from "@/utils/mergeTransactions";
import { negocioQueRecibeYapes, separarLoDelNegocio } from "@/utils/negocioCaptura";
import type { MovimientoNegocio, Negocio } from "@/utils/negocio";
import { reserveIdsAbove } from "@/utils/id";
import * as notificationReader from "@/modules/notification-reader";
import { translations } from "@/constants/i18n";
import type { Profile, Transaction } from "@/types";

/**
 * Registra el yapeo EN EL MOMENTO, con la app cerrada.
 *
 * QUÉ ES ESTO
 *
 * Android despierta este trabajo desde el servicio que escucha las
 * notificaciones, sin abrir la app ni enseñar nada. Es lo que convierte el
 * registro automático en automático de verdad: antes el aviso se quedaba
 * esperando en el buzón hasta que alguien abría Finzo, y si pasaban tres días
 * sin abrirla, tres días sin movimientos.
 *
 * SI ESTO NO CORRE, NO PASA NADA MALO
 *
 * Y eso es a propósito. Android puede negarse a despertar el trabajo —cada
 * fabricante aprieta el ahorro de batería a su manera— y en ese caso lo
 * capturado sigue intacto en el buzón: la app lo recoge al abrirse, igual que
 * antes. El peor caso de esta función es el comportamiento de siempre, nunca
 * un movimiento perdido.
 *
 * POR QUÉ LEE Y GUARDA EN VEZ DE AVISAR A LA APP
 *
 * Porque la app no está viva. No hay pantalla, ni contexto, ni estado: solo
 * el disco. Por eso vuelve a leer la lista guardada, le añade lo nuevo y la
 * escribe. Y por eso hizo falta primero la fusión al volver (ver
 * utils/mergeTransactions): sin ella, la app pisaba esto al reabrirse.
 */
/**
 * Donde se dejan los avisos ya sacados del buzon pero todavia sin registrar.
 *
 * Es la red debajo del trapecio: entre vaciar el buzon y guardar el
 * movimiento hay un momento en el que el yapeo no esta en ningun sitio, y en
 * un trabajo de fondo Android puede cortar justo ahi.
 */
const CLAVE_PENDIENTES = "finzo:capturaPendiente";

async function guardarPendientes(items: unknown[]): Promise<void> {
  saveJSON(CLAVE_PENDIENTES, items);
  await flushPendingSaves();
}

/**
 * Lo que se saco del buzon y nunca llego a registrarse.
 *
 * La app la mira al abrirse. Si hay algo, es que un trabajo de fondo se quedo
 * a medias — y ese yapeo, sin esto, no lo veria nadie nunca.
 */
export async function pendientesDeCaptura(): Promise<unknown[]> {
  const guardados = await loadJSON<unknown[]>(CLAVE_PENDIENTES, []);
  return Array.isArray(guardados) ? guardados : [];
}

export function limpiarPendientes(): void {
  saveJSON(CLAVE_PENDIENTES, []);
}

export async function capturarEnFondo(): Promise<number> {
  // Si la función está apagada o Android quitó el permiso, no se toca nada.
  if (!notificationReader.isEnabled() || !notificationReader.isPermissionGranted()) return 0;

  const captured = await notificationReader.drain();
  if (captured.length === 0) return 0;

  // LO PRIMERO: dejarlo a buen recaudo.
  //
  // drain() VACIA el buzon del servicio. A partir de esta linea, lo capturado
  // solo existe aqui, en memoria. Si algo falla despues —o Android mata el
  // proceso a media faena, que es lo normal en un trabajo de fondo— el yapeo
  // desaparece: ni registrado ni en el buzon. No queda ni rastro de que
  // llego.
  //
  // Se guarda en una lista aparte antes de tocar nada, y se borra solo cuando
  // ya esta registrado. Si el proceso muere entremedias, la app lo encuentra
  // ahi la proxima vez que se abre.
  await guardarPendientes(captured);

  const [guardadas, learned, logPrevio, perfil, negocios, cajaGuardada] = await Promise.all([
    loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []),
    loadJSON<Record<string, string>>(STORAGE_KEYS.merchantLearned, {}),
    loadJSON<CaptureLogEntry[]>(STORAGE_KEYS.autoCaptureLog, []),
    loadJSON<Partial<Profile>>(STORAGE_KEYS.profile, {}),
    // EL NEGOCIO TAMBIÉN SE LEE AQUÍ, y esto era el agujero del paso 5.
    //
    // Este trabajo corre con la app CERRADA, así que no pasa por el reparto que hace el
    // contexto: sin estas dos líneas, encender "los yapeos entran a mi negocio" habría
    // funcionado solo con Finzo abierta, y con la app cerrada —que es cuando más yapeos
    // llegan— la plata del negocio habría seguido cayendo en las cuentas de casa.
    //
    // No habría dado ningún error. Habría dado cuentas que no cuadran.
    loadJSON<Negocio[]>(STORAGE_KEYS.negocios, []),
    loadJSON<MovimientoNegocio[]>(STORAGE_KEYS.movimientosNegocio, []),
  ]);

  // Los identificadores nuevos tienen que ir por encima de los que ya
  // existen. Sin esto, un movimiento registrado aquí podría nacer con el
  // mismo número que uno de la app y, al juntarse las dos listas, uno se
  // comería al otro.
  reserveIdsAbove(guardadas.reduce((mayor, t) => (t.id > mayor ? t.id : mayor), 0));

  // La traducción, leída del disco igual que todo lo demás. Aquí no hay
  // contexto de React del que sacarla.
  const idioma = perfil.userLanguage ?? "es";
  const textos = (translations as Record<string, Record<string, string>>)[idioma] ?? {};
  const traducir = (clave: string) => textos[clave] ?? clave;

  const { toAdd, log, avisoDe } = processCaptured(captured, guardadas, learned, traducir);

  // Y EL REPARTO, EL MISMO QUE HACE LA APP ABIERTA. Es la misma función a propósito: dos
  // repartos escritos aparte acabarían decidiendo distinto, y entonces dónde cae tu plata
  // dependería de si tenías Finzo abierta o no.
  const caja = Array.isArray(cajaGuardada) ? cajaGuardada : [];
  const { personales, delNegocio } = separarLoDelNegocio(
    toAdd,
    avisoDe,
    negocioQueRecibeYapes(Array.isArray(negocios) ? negocios : []),
    caja
  );

  // El registro de lo visto se guarda siempre, aunque no se añada nada: es lo
  // que permite saber después por qué un Yape no entró.
  saveJSON(STORAGE_KEYS.autoCaptureLog, [...logPrevio, ...log].slice(-40));

  if (personales.length > 0) {
    saveJSON(STORAGE_KEYS.transactions, mergeTransactions(personales, guardadas));
  }
  if (delNegocio.length > 0) {
    // Se escribe sobre lo que se acaba de leer del disco, no sobre una lista de memoria: aquí
    // no hay app viva que tenga una lista. Ver la explicación de arriba del archivo.
    saveJSON(STORAGE_KEYS.movimientosNegocio, [...caja, ...delNegocio]);
  }

  // ESTO NO SE PUEDE OLVIDAR. saveJSON no escribe al instante: deja el dato
  // en cola y lo escribe un momento despues, para no castigar el disco cuando
  // se tocan varias cosas seguidas. Aqui no hay ese "momento despues": el
  // trabajo de fondo termina y Android mata el proceso. Sin esta linea, el
  // yapeo se registraria en memoria y no llegaria nunca al disco.
  // Ya esta guardado: se puede soltar el respaldo.
  saveJSON(CLAVE_PENDIENTES, []);

  // ESTO NO SE PUEDE OLVIDAR. saveJSON no escribe al instante: deja el dato
  // en cola y lo escribe un momento despues. Aqui no hay ese "momento
  // despues" — Android mata el proceso al terminar.
  await flushPendingSaves();
  return personales.length + delNegocio.length;
}
