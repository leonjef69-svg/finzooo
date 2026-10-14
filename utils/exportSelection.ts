import type { Transaction } from "@/types";

/** Misma selección en PDF, Excel y CSV, sin cargar archivos ni hojas de cálculo. */
export function movimientosParaReporte(
  movimientos: Transaction[],
  tipo: "all" | "expense" | "income",
): Transaction[] {
  if (tipo === "all") return movimientos;
  return movimientos.filter(tx => !tx.internalTransfer && tx.type === tipo);
}
