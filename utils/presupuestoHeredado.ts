// EL PRESUPUESTO SE REPITE SOLO CADA MES (09/08/2026)
//
// Estaba apuntado como pendiente desde hace semanas: *"el presupuesto mensual no se repite solo
// cada mes: hay que volver a ponerlo"*. Cada 1 de mes la app amanecía diciendo que el
// presupuesto era cero — y con cero, la pantalla de Inicio no puede decir cuánto queda, que es
// el número por el que se abre la app. Había que acordarse de volver a escribirlo.
//
// LO QUE NO SE PUEDE ROMPER AL ARREGLARLO
//
// Un presupuesto puesto A MANO manda siempre, aunque sea cero. "Este mes no me pongo
// presupuesto" es una decisión, y heredar por encima de ella sería la app corrigiendo a la
// persona. Por eso se distingue **no haber puesto nada** de **haber puesto cero**, que en los
// datos guardados se ven casi igual.
//
// Y NO SE ESCRIBE NADA EN EL DISCO
//
// Se hereda al LEER, no copiando el número al mes nuevo. Copiarlo tendría dos efectos malos:
// llenaría el guardado de meses que nadie tocó, y —peor— dejaría el valor congelado, así que
// cambiar el presupuesto de este mes no arreglaría el siguiente. Heredando al leer, el último
// que se escribió a mano manda hasta que se escriba otro.

/**
 * El presupuesto de un mes, heredando el último puesto a mano si ese mes no tiene.
 *
 * `mes` va como "AAAA-MM", igual que las claves. Se busca hacia atrás porque los meses futuros
 * no pueden decidir el presente: quien mire diciembre desde agosto tiene que ver lo de agosto,
 * no algo que puso mirando el año que viene.
 */
export function presupuestoDelMes(budgets: Record<string, number>, mes: string): number {
  // Puesto a mano en ESTE mes: manda, aunque sea cero.
  if (Object.prototype.hasOwnProperty.call(budgets, mes)) return budgets[mes] ?? 0;

  const anteriores = Object.keys(budgets)
    .filter((k) => /^\d{4}-\d{2}$/.test(k) && k < mes)
    .sort();
  const ultimo = anteriores[anteriores.length - 1];
  return ultimo === undefined ? 0 : (budgets[ultimo] ?? 0);
}

/**
 * ¿El presupuesto que se está viendo viene heredado de otro mes?
 *
 * La pantalla lo necesita para DECIRLO. Un número que aparece solo, sin que nadie lo haya
 * escrito, es de las cosas que hacen desconfiar de una app de dinero: quien vea 1.500 en un mes
 * que no ha tocado tiene que saber de dónde salió, y poder cambiarlo sin buscar cómo.
 */
export function esHeredado(budgets: Record<string, number>, mes: string): boolean {
  if (Object.prototype.hasOwnProperty.call(budgets, mes)) return false;
  return presupuestoDelMes(budgets, mes) > 0;
}
