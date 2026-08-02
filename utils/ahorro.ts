import type { Goal } from "@/types";

/**
 * EL AHORRO COMO SOBRES, NO COMO ALCANCÍA.
 *
 * El dinero NO se mueve a ningún lado: sigue en la misma cuenta. Una meta
 * solo marca qué parte de lo que ya tienes tiene dueño. Como poner el dinero
 * en sobres dentro de la misma billetera.
 *
 * POR QUÉ ASÍ Y NO SACÁNDOLO DE VERDAD
 *
 * Lo evidente sería anotar un gasto al ahorrar. Dos cosas lo tumban:
 *
 * 1. Ahorrar no es gastar. Ese gasto entraría en el gráfico de gastos, subiría
 *    la barra del presupuesto y Reportes acabaría diciendo "te pasaste de tu
 *    presupuesto" por haber ahorrado. Al revés de lo que debe ser.
 *
 * 2. El registro automático. Si de verdad se yapea el dinero a otra cuenta,
 *    la notificación ya lo anota. Anotarlo también aquí lo contaría dos veces:
 *    descontaría 400 por mover 200.
 *
 * LO QUE ESTO ARREGLA
 *
 * Hasta ahora apartar dinero solo subía un número dentro de la meta, sin
 * mirar nada. Con S/ 500 se podían apartar S/ 500 en tres metas distintas:
 * S/ 1.500 que no existen. Nada lo impedía porque el dinero nunca salía de
 * ningún lado.
 */

/** Lo que suman todas las metas sin cumplir. */
export function totalApartado(goals: Goal[]): number {
  return goals.reduce((suma, g) => (g.completed ? suma : suma + g.saved), 0);
}

/**
 * Lo que se puede gastar sin tocar las metas.
 *
 * Es EL número que hace falta antes de gastar, y hasta ahora no existía en
 * ninguna pantalla.
 */
export function saldoLibre(disponible: number, apartado: number): number {
  return disponible - apartado;
}

/**
 * Cuánto más se puede apartar. Nunca menos de cero.
 *
 * Es el tope que faltaba: sin él se apartaba dinero inexistente.
 */
export function maximoAApartar(disponible: number, apartado: number): number {
  return Math.max(0, disponible - apartado);
}

/**
 * ¿Hay más apartado que dinero?
 *
 * Pasa por dos caminos legítimos, y ninguno es un fallo:
 *
 *   · Se gastó parte de lo apartado (el dinero estaba a mano, se podía gastar)
 *   · Se puso el Saldo anterior en cero, y el disponible bajó de golpe
 *
 * La app NO baja la meta sola. Que un número de dinero baje sin que nadie lo
 * tocara es de las cosas que hacen desconfiar de una app entera. Se avisa y
 * se deja decidir.
 */
export function hayDescuadre(disponible: number, apartado: number): boolean {
  return apartado > disponible;
}

/** Cuánto falta para respaldar todo lo apartado. Cero si no falta nada. */
export function faltaParaRespaldar(disponible: number, apartado: number): number {
  return Math.max(0, apartado - disponible);
}
