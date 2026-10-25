import { flushPendingSavesChecked, loadJSON, saveJSON, saveJSONNow, STORAGE_KEYS } from "@/utils/storage";
import { processCaptured, type CaptureLogEntry } from "@/utils/autoCapture";
import { mergeCaptureLog, mergeTransactions } from "@/utils/mergeTransactions";
import { negocioQueRecibeYapesSegunPlan, separarLoDelNegocio } from "@/utils/negocioCaptura";
import type { MovimientoNegocio, Negocio, Producto } from "@/utils/negocio";
import { loadPrueba, pruebaVigente } from "@/utils/pruebaPremium";
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
 * esperando en el buzón hasta que alguien abría Fino, y si pasaban tres días
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
 * Respaldo de los avisos reclamados que todavía no se confirmaron.
 * El servicio actual retiene el lote hasta ackDrain; esta lista conserva
 * además avisos de intentos anteriores para recuperarlos al volver a abrir.
 */
const CLAVE_PENDIENTES = "finzo:capturaPendiente";

export async function guardarPendientes(items: unknown[]): Promise<void> {
  if (!await saveJSONNow(CLAVE_PENDIENTES, items)) throw new Error("capture-backup-not-persisted");
  // Conservar también los cambios de Personal/Negocio que ya estaban en cola
  // antes de leer la base a la que se añadirá esta captura.
  if (!await flushPendingSavesChecked()) throw new Error("capture-source-not-persisted");
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

  const delBuzon = await notificationReader.drain();
  const anteriores = await pendientesDeCaptura() as typeof delBuzon;
  const captured = [...new Map([...anteriores, ...delBuzon].map(item => [
    item.captureId || `${item.package}|${item.postedAt}|${item.title}|${item.text}`, item,
  ])).values()];
  if (captured.length === 0) return 0;

  // LO PRIMERO: dejarlo a buen recaudo.
  //
  // El servicio actual conserva su lote hasta ackDrain. El respaldo también
  // conserva avisos de un intento anterior, incluso si ya no están en ese
  // lote. No se sustituye por los avisos nuevos ni se confía en una escritura
  // que solo haya quedado en cola.
  await guardarPendientes(captured);

  const [guardadas, learned, logPrevio, perfil, negocios, cajaGuardada, premiumCuenta, inicioPrueba, productos] = await Promise.all([
    loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []),
    loadJSON<Record<string, string>>(STORAGE_KEYS.merchantLearned, {}),
    loadJSON<CaptureLogEntry[]>(STORAGE_KEYS.autoCaptureLog, []),
    loadJSON<Partial<Profile>>(STORAGE_KEYS.profile, {}),
    // EL NEGOCIO TAMBIÉN SE LEE AQUÍ, y esto era el agujero del paso 5.
    //
    // Este trabajo corre con la app CERRADA, así que no pasa por el reparto que hace el
    // contexto: sin estas dos líneas, encender "los yapeos entran a mi negocio" habría
    // funcionado solo con Fino abierta, y con la app cerrada —que es cuando más yapeos
    // llegan— la plata del negocio habría seguido cayendo en las cuentas de casa.
    //
    // No habría dado ningún error. Habría dado cuentas que no cuadran.
    loadJSON<Negocio[]>(STORAGE_KEYS.negocios, []),
    loadJSON<MovimientoNegocio[]>(STORAGE_KEYS.movimientosNegocio, []),
    loadJSON<boolean>(STORAGE_KEYS.isPremium, false),
    loadPrueba(),
    loadJSON<Producto[]>(STORAGE_KEYS.productos, []),
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
  // dependería de si tenías Fino abierta o no.
  const caja = Array.isArray(cajaGuardada) ? cajaGuardada : [];
  // En el trabajo sin pantalla no se confía en un permiso de tester guardado:
  // puede haber sido revocado. Sin una prueba vigente o Premium de la cuenta,
  // el destino seguro de un ingreso nuevo es Personal.
  const premiumNegocio = premiumCuenta === true || pruebaVigente(inicioPrueba, Date.now());
  const { personales, delNegocio } = separarLoDelNegocio(
    toAdd,
    avisoDe,
    negocioQueRecibeYapesSegunPlan(Array.isArray(negocios) ? negocios : [], premiumNegocio),
    caja,
    Array.isArray(productos) ? productos : []
  );

  // Cada destino debe confirmar su guardado antes de liberar el respaldo o
  // el lote nativo. Esperar la cola antigua no comunicaba los fallos del disco.
  // Si solo se guardó un destino, el siguiente intento vuelve a leerlo y
  // reconoce captureId en Personal y avisoId en Negocio, sin repetir dinero.
  const guardados = await Promise.all([
    saveJSONNow(STORAGE_KEYS.autoCaptureLog, mergeCaptureLog(logPrevio, log).slice(-40)),
    personales.length > 0
      ? saveJSONNow(STORAGE_KEYS.transactions, mergeTransactions(personales, guardadas))
      : Promise.resolve(true),
    delNegocio.length > 0
      ? saveJSONNow(STORAGE_KEYS.movimientosNegocio, [...caja, ...delNegocio])
      : Promise.resolve(true),
  ]);
  if (guardados.some(ok => !ok)) throw new Error("capture-not-persisted");
  if (!await saveJSONNow(CLAVE_PENDIENTES, [])) throw new Error("capture-backup-not-cleared");
  await notificationReader.ackDrain();
  return personales.length + delNegocio.length;
}
