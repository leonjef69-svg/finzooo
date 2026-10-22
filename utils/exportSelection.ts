import type { Transaction } from "@/types";
import { showInPersonalRecent } from "@/utils/recentMovementFilters";

/** Misma selección en PDF, Excel y CSV, sin cargar archivos ni hojas de cálculo. */
export function movimientosParaReporte(
  movimientos: Transaction[],
  tipo: "all" | "expense" | "income",
): Transaction[] {
  // La misma regla que Inicio: los recibos antiguos de Ahorro no son otro
  // ingreso/gasto. Se conservan en el historial, no se vuelven a sumar al
  // exportar. Familia/Cajas y las compras reales siguen dentro del reporte.
  const visibles = movimientos.filter(tx => tx.hiddenFromHistory !== true && showInPersonalRecent(tx));
  if (tipo === "all") return visibles;
  return visibles.filter(tx => !tx.internalTransfer && tx.type === tipo);
}
