/**
 * Que el presupuesto siga vigente el mes siguiente, sin volver a ponerlo.
 *
 * EL PROBLEMA
 *
 * Los presupuestos se guardan mes por mes ({ "2026-07": 500 }). Un mes sin su
 * entrada no tiene presupuesto: vale cero. Así que cada 1 de mes había que
 * volver a escribirlo, y hasta hacerlo la pantalla de Inicio decía que no hay
 * presupuesto. Doce veces al año, siempre.
 *
 * POR QUÉ SE COPIA Y NO SE HEREDA AL VUELO
 *
 * Lo evidente sería no guardar nada y, al pedir el presupuesto de un mes sin
 * entrada, devolver el del mes anterior. Se ve bien y rompe las cuentas.
 *
 * El Saldo anterior suma los presupuestos de TODOS los meses previos. Con la
 * herencia al vuelo, alguien que puso 500 en enero y no abrió la app en seis
 * meses tendría de golpe seis presupuestos de 500 que nunca existieron: 3.000
 * soles de saldo salidos de la nada. Es exactamente el tipo de número
 * inventado que hace desconfiar de toda la app.
 *
 * Copiándolo solo al mes en curso, únicamente los meses que la persona vivió
 * de verdad tienen presupuesto. La historia no se toca.
 */
export function presupuestoAHeredar(
  budgets: Record<string, number>,
  mesActual: string
): number | null {
  // Ya tiene el suyo —aunque sea cero, que es una decisión— no se toca.
  if (budgets[mesActual] !== undefined) return null;

  // El mes con presupuesto más reciente ANTERIOR a este. Se compara como
  // texto porque "AAAA-MM" se ordena igual escrito que por fecha.
  let ultimo: string | null = null;
  for (const mes of Object.keys(budgets)) {
    if (mes >= mesActual) continue;
    if (ultimo === null || mes > ultimo) ultimo = mes;
  }
  if (ultimo === null) return null;

  const monto = budgets[ultimo];
  // Un presupuesto de cero no se arrastra: copiarlo o no dejarlo se ve igual
  // en pantalla, y no escribir es siempre mejor.
  return monto > 0 ? monto : null;
}
