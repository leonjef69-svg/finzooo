import type { Transaction } from "@/types";

/** Misma selección en PDF, Excel y CSV, sin cargar archivos ni hojas de cálculo. */
export function movimientosParaReporte(
  movimientos: Transaction[],
  tipo: "all" | "expense" | "income",
): Transaction[] {
  const visibles = movimientos.filter(tx => tx.hiddenFromHistory !== true);
  if (tipo === "all") return visibles;
  return visibles.filter(tx => !tx.internalTransfer && tx.type === tipo);
}
