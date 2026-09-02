import type { Transaction } from "@/types";
import type { CaptureLogEntry } from "@/utils/autoCapture";
import { compararMovimientos } from "@/utils/ordenarMovimientos";

/**
 * Junta los movimientos que tiene la app en memoria con los que hay
 * guardados en el disco.
 *
 * POR QUÉ HACE FALTA
 *
 * La app guarda la LISTA ENTERA cada vez que cambia algo. Mientras solo
 * escriba ella, eso funciona. Pero en cuanto algo más escriba —el servicio
 * que registra un yapeo con la app cerrada, o la copia de la nube— la lista
 * que la app tiene en memoria se queda vieja, y el siguiente guardado la pisa
 * entera: el movimiento registrado por fuera desaparece sin dejar rastro.
 *
 * Con dinero eso no es un despiste: es un movimiento que existió y ya no
 * está, y nadie se entera hasta que las cuentas no cuadran.
 *
 * QUÉ HACE
 *
 * Se queda con TODO lo que esté en cualquiera de los dos lados. Ante el mismo
 * identificador manda lo que hay en memoria, porque es lo que la persona
 * acaba de tocar en pantalla.
 *
 * Nunca borra. Un movimiento borrado de verdad desaparece de los dos lados a
 * la vez —se borra y se guarda en el mismo momento—, así que aquí no puede
 * llegar uno "que sobra". Y ante la duda entre perder un movimiento o
 * quedarse uno de más, el de más se ve y se borra a mano; el que falta no se
 * ve nunca.
 */
export function mergeTransactions(
  enMemoria: Transaction[],
  guardadas: Transaction[]
): Transaction[] {
  if (guardadas.length === 0) return enMemoria;
  if (enMemoria.length === 0) return guardadas;

  const porId = new Map<number, Transaction>();
  // Primero las guardadas, y encima las de memoria: así, con el mismo
  // identificador, gana la de memoria.
  for (const tx of guardadas) porId.set(tx.id, tx);
  for (const tx of enMemoria) porId.set(tx.id, tx);

  // Las más nuevas primero, que es como las espera toda la app. Con la misma
  // fecha se ordena por identificador para que el orden no baile entre dos
  // aperturas: una lista que se reordena sola parece que cambió sin que nadie
  // la tocara.
  // El mismo orden que usan las pantallas. Ordenar aqui de otra manera haria
  // que la lista se recolocara sola al volver a la app.
  return [...porId.values()].sort(compararMovimientos);
}

/** ¿Hay algo en el disco que la app todavía no tiene? */
export function hayNovedades(enMemoria: Transaction[], guardadas: Transaction[]): boolean {
  if (guardadas.length === 0) return false;
  const conocidas = new Set<number>(enMemoria.map((t) => t.id));
  return guardadas.some((t) => !conocidas.has(t.id));
}

/**
 * Los borrados evitan que otro teléfono resucite movimientos antiguos, pero
 * no deben crecer para siempre. Los identificadores salen del tiempo, así que
 * conservar los 5.000 más recientes cubre años de uso sin inflar la copia.
 */
export function pruneDeletedTransactionIds(ids: number[], limit = 5000) {
  return [...new Set(ids)]
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .slice(0, limit);
}

// Cuántos avisos se recuerdan. El mismo tope que usa processCaptured: si
// aquí fuera otro, la lista crecería o se recortaría de dos maneras
// distintas según quién la escribiera.
const MAX_REGISTRO = 40;

/** Un aviso concreto. No tiene identificador, así que se arma con lo que lo distingue. */
function claveDeAviso(e: CaptureLogEntry): string {
  return `${e.at}|${e.result}|${e.amount ?? ""}|${e.text}`;
}

/**
 * Junta el registro de avisos que tiene la app en memoria con el del disco.
 *
 * POR QUÉ HACE FALTA
 *
 * Es el mismo problema que arriba, con los movimientos, pero con la lista de
 * la pantalla de registro automático — y aquí nadie lo había resuelto.
 *
 * La app leía esa lista del disco UNA sola vez, al arrancar, y la guardaba
 * entera cada vez que cambiaba. Mientras solo escribiera ella, bien. Pero el
 * trabajo de fondo —el que registra el yapeo con la app en segundo plano—
 * también escribe ahí. Resultado: el yapeo se registraba de verdad y se veía
 * en los movimientos, pero en la pantalla de registro automático no aparecía
 * hasta cerrar la app del todo y volver a abrirla. Y peor: el siguiente
 * guardado de la app pisaba esa entrada con su copia vieja.
 *
 * Que un yapeo esté registrado pero la pantalla que existe para comprobarlo
 * diga que no llegó es de lo peor que puede pasar aquí: es la pantalla a la
 * que se recurre justo cuando se sospecha que algo falla.
 *
 * DEVUELVE LA MISMA LISTA SI NO HAY NADA NUEVO
 *
 * A propósito, y con la misma referencia: esto se llama cada ocho segundos.
 * Devolver una lista nueva cada vez haría repintar la pantalla y volver a
 * cifrar y guardar el registro entero sin que nada hubiera cambiado.
 */
export function mergeCaptureLog(
  enMemoria: CaptureLogEntry[],
  guardadas: CaptureLogEntry[]
): CaptureLogEntry[] {
  if (guardadas.length === 0) return enMemoria;

  const conocidas = new Set(enMemoria.map(claveDeAviso));
  const nuevas = guardadas.filter((e) => !conocidas.has(claveDeAviso(e)));
  if (nuevas.length === 0) return enMemoria;

  // Por hora, que es como los espera la pantalla, y sin pasar del tope.
  return [...enMemoria, ...nuevas].sort((a, b) => a.at - b.at).slice(-MAX_REGISTRO);
}
