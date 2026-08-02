import type { Transaction } from "@/types";

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
  return [...porId.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/** ¿Hay algo en el disco que la app todavía no tiene? */
export function hayNovedades(enMemoria: Transaction[], guardadas: Transaction[]): boolean {
  if (guardadas.length === 0) return false;
  const conocidas = new Set<number>(enMemoria.map((t) => t.id));
  return guardadas.some((t) => !conocidas.has(t.id));
}
