import { useMemo } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { fechaLocalISO } from "@/utils/date";
import { disponiblePersonalEnFecha } from "@/utils/finances";
import { hayDescuadre, saldoLibre, totalApartado } from "@/utils/ahorro";

/** Ahorrar hoy nunca usa el presupuesto de otro mes abierto en Inicio. */
export function useSavingsBalance() {
  const { transactions, goals, budgets, carryoverCleared, monthNames } = useAppData();
  const date = fechaLocalISO();
  const total = useMemo(() => disponiblePersonalEnFecha(date, budgets, transactions, carryoverCleared), [date, budgets, transactions, carryoverCleared]);
  const apartado = useMemo(() => totalApartado(goals), [goals]);
  const free = saldoLibre(total, apartado);
  return { total, apartado, free, max: Math.max(0, free), descuadre: hayDescuadre(total, apartado), monthLabel: `${monthNames[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}` };
}
