import type { Transaction } from "@/types";

/**
 * Los minutos desde medianoche de una hora escrita ("3:40 p.m." → 940).
 *
 * Hace falta porque la hora se guarda ya escrita para poder enseñarla, y
 * escrita NO se puede ordenar: comparando el texto, "11:20 a.m." va antes que
 * "3:40 a.m." porque el "1" es menor que el "3". Justo al revés.
 *
 * Devuelve -1 si no hay hora. Los movimientos guardados antes de que se
 * empezara a guardar la hora, y los importados de un estado de cuenta, no la
 * tienen: van al final de su día, que es lo menos malo — no hay forma de
 * saber a qué hora ocurrieron.
 */
export function minutosDeHora(time: string | undefined): number {
  if (!time) return -1;
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)?$/i);
  if (!m) return -1;

  let horas = Number(m[1]);
  const minutos = Number(m[2]);
  const sufijo = (m[3] ?? "").toLowerCase();

  if (sufijo === "p.m." && horas !== 12) horas += 12;
  // Las 12 a.m. son la medianoche: la hora cero, no las doce del día.
  if (sufijo === "a.m." && horas === 12) horas = 0;

  return horas * 60 + minutos;
}

/**
 * El orden en que se leen los movimientos: lo más reciente arriba.
 *
 * POR QUÉ EN SU PROPIO ARCHIVO
 *
 * Antes cada pantalla ordenaba a su manera, y la de Inicio lo hacía con
 * `a.date < b.date ? 1 : -1`. Eso tiene un fallo escondido: cuando las dos
 * fechas son IGUALES —dos movimientos del mismo día, que es lo normal—
 * devuelve -1, o sea "a va antes que b", sin mirar nada más. Y como también
 * diría lo mismo comparándolos al revés, el orden que sale depende de por
 * dónde empiece a comparar el celular. De ahí que un movimiento recién
 * anotado no siempre apareciera arriba.
 *
 * EL DESEMPATE
 *
 *   1. La fecha, lo más nuevo primero.
 *   2. La hora. Es lo que de verdad ordena dos movimientos del mismo día.
 *   3. El identificador: los números van subiendo, así que el más alto es el
 *      último que se anotó. Resuelve los que no tienen hora y los empates
 *      exactos.
 */
export function compararMovimientos(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;

  const ha = minutosDeHora(a.time);
  const hb = minutosDeHora(b.time);
  if (ha !== hb) return hb - ha;

  return b.id - a.id;
}

/** La lista ordenada, sin tocar la original. */
export function ordenarMovimientos(txs: Transaction[]): Transaction[] {
  return [...txs].sort(compararMovimientos);
}
