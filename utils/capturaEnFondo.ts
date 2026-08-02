import { flushPendingSaves, loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";
import { processCaptured, type CaptureLogEntry } from "@/utils/autoCapture";
import { mergeTransactions } from "@/utils/mergeTransactions";
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
export async function capturarEnFondo(): Promise<number> {
  // Si la función está apagada o Android quitó el permiso, no se toca nada.
  if (!notificationReader.isEnabled() || !notificationReader.isPermissionGranted()) return 0;

  const captured = await notificationReader.drain();
  if (captured.length === 0) return 0;

  const [guardadas, learned, logPrevio, perfil] = await Promise.all([
    loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []),
    loadJSON<Record<string, string>>(STORAGE_KEYS.merchantLearned, {}),
    loadJSON<CaptureLogEntry[]>(STORAGE_KEYS.autoCaptureLog, []),
    loadJSON<Partial<Profile>>(STORAGE_KEYS.profile, {}),
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

  const { toAdd, log } = processCaptured(captured, guardadas, learned, traducir);

  // El registro de lo visto se guarda siempre, aunque no se añada nada: es lo
  // que permite saber después por qué un Yape no entró.
  saveJSON(STORAGE_KEYS.autoCaptureLog, [...logPrevio, ...log].slice(-40));

  if (toAdd.length > 0) {
    saveJSON(STORAGE_KEYS.transactions, mergeTransactions(toAdd, guardadas));
  }

  // ESTO NO SE PUEDE OLVIDAR. saveJSON no escribe al instante: deja el dato
  // en cola y lo escribe un momento despues, para no castigar el disco cuando
  // se tocan varias cosas seguidas. Aqui no hay ese "momento despues": el
  // trabajo de fondo termina y Android mata el proceso. Sin esta linea, el
  // yapeo se registraria en memoria y no llegaria nunca al disco.
  await flushPendingSaves();
  return toAdd.length;
}
