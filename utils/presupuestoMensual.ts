// CADA MES EMPIEZA VACÍO, Y EL PRESUPUESTO LO PONE LA PERSONA (10/08/2026)
//
// LA VUELTA ATRÁS, Y POR QUÉ
//
// El 09/08/2026 se hizo justo lo contrario: el presupuesto se repetía solo cada mes, para no
// tener que volver a escribirlo doce veces al año. Un día después se pidió deshacerlo.
//
// El motivo, dicho por él, fue ver "S/ 100" en NOVIEMBRE estando en agosto — un mes que no
// había tocado, con un número que no había escrito. Hizo falta un rótulo debajo ("Igual que el
// mes pasado") para explicar de dónde salía, y ni con el rótulo quedaba claro.
//
// Ese rótulo era la señal: si un número necesita una nota al pie para no dar desconfianza, el
// problema es el número, no la nota. En una app de dinero, lo que no escribió la persona no
// debería estar ahí.
//
// LO QUE ESTO CUESTA, PARA QUE CONSTE
//
// Cada 1 de mes la app amanece con el presupuesto en cero, y hay que volver a ponerlo. Es el
// inconveniente que se arregló el 09/08 y que ahora se acepta a cambio de que ningún mes
// enseñe cifras que nadie puso. Fue una decisión suya, tomada sabiendo esto.
//
// SI ALGÚN DÍA SE QUIERE RECUPERAR, el punto medio que quedó sin probar era heredar solo en el
// mes en curso y dejar los meses futuros en blanco: lo que confundía era ver el número en
// meses que todavía no habían llegado.

/**
 * El presupuesto de un mes: el que se escribió para ESE mes, y nada más.
 *
 * `mes` va como "AAAA-MM", igual que las claves. Un mes sin entrada vale cero, y un cero
 * escrito a mano vale cero también: las dos cosas se ven igual en pantalla, que es lo que se
 * quería. No se mira ningún otro mes, ni hacia atrás ni hacia adelante.
 */
export function presupuestoDelMes(budgets: Record<string, number>, mes: string): number {
  return budgets[mes] ?? 0;
}
