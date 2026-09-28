/**
 * Conserva el presupuesto exacto escrito por la persona.
 *
 * La función recibe el formateador de moneda para que Inicio no sustituya
 * accidentalmente el monto por una versión compacta (por ejemplo, 1.4 mil).
 * Si el saldo está oculto, tampoco debe intentar formatearlo.
 */
export function formatBudgetDisplay(
  hidden: boolean,
  budget: number,
  formatCurrency: (amount: number) => string,
): string {
  return hidden ? "••••" : formatCurrency(budget);
}
