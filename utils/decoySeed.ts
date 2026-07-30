// LOS DATOS FALSOS DEL MODO SEÑUELO
//
// El objetivo no es una cuenta vacía: es una cuenta ABURRIDA y creíble.
//
// Una app de finanzas sin un solo movimiento levanta más sospechas que
// cualquier otra cosa — "¿y para qué la tienes instalada?". Lo que tiene que
// ver quien esté mirando es una persona normal que anota sus gastos, con
// cifras modestas y ningún saldo que llame la atención.
//
// Por eso los movimientos son de comida, pasajes y recargas, con importes
// pequeños, repartidos por las últimas semanas. Nada de sueldos altos, ni
// metas de ahorro, ni transferencias grandes.
//
// Se genera UNA sola vez y se guarda. Si alguien obliga a abrir la app dos
// veces, tiene que ver lo mismo las dos veces: unos movimientos que cambian
// solos entre una revisión y otra delatan que están inventados.

import { nextId } from "@/utils/id";
import type { Transaction } from "@/types";

/** Un gasto del guion: cuántos días atrás, cuánto, de qué y dónde. */
type Guion = {
  hace: number;
  amount: number;
  category: string;
  description: string;
  merchant?: string;
};

// Un mes y pico de vida normal y sin sobresaltos.
const GUION: Guion[] = [
  { hace: 1, amount: 6.5, category: "comida", description: "Menú del día" },
  { hace: 1, amount: 2.5, category: "transporte", description: "Pasaje" },
  { hace: 2, amount: 12, category: "comida", description: "Pollo a la brasa" },
  { hace: 3, amount: 2.5, category: "transporte", description: "Pasaje" },
  { hace: 4, amount: 18.9, category: "comida", description: "Compras", merchant: "Bodega" },
  { hace: 5, amount: 5, category: "transporte", description: "Mototaxi" },
  { hace: 6, amount: 7.5, category: "comida", description: "Desayuno" },
  { hace: 8, amount: 30, category: "servicios", description: "Recarga de celular" },
  { hace: 9, amount: 2.5, category: "transporte", description: "Pasaje" },
  { hace: 10, amount: 9, category: "comida", description: "Almuerzo" },
  { hace: 12, amount: 24.5, category: "compras", description: "Útiles" },
  { hace: 14, amount: 2.5, category: "transporte", description: "Pasaje" },
  { hace: 15, amount: 11, category: "comida", description: "Cena" },
  { hace: 18, amount: 45, category: "servicios", description: "Recibo de luz" },
  { hace: 20, amount: 8, category: "comida", description: "Almuerzo" },
  { hace: 22, amount: 2.5, category: "transporte", description: "Pasaje" },
  { hace: 25, amount: 16, category: "comida", description: "Compras", merchant: "Mercado" },
  { hace: 28, amount: 60, category: "servicios", description: "Internet" },
  { hace: 30, amount: 3, category: "transporte", description: "Pasaje" },
  { hace: 33, amount: 13.5, category: "comida", description: "Almuerzo" },
];

// Dos entradas modestas: sin ingresos no cuadraría que se pueda gastar, y
// un sueldo alto llamaría la atención justo en la pantalla principal.
const INGRESOS: Guion[] = [
  { hace: 2, amount: 380, category: "otro_ingreso", description: "Trabajo" },
  { hace: 27, amount: 400, category: "otro_ingreso", description: "Trabajo" },
];

function isoHace(dias: number, now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Arma los movimientos falsos.
 *
 * `now` se puede pasar para poder probar el resultado sin depender del reloj.
 */
export function buildDecoyTransactions(now: Date = new Date()): Transaction[] {
  const armar = (g: Guion, type: "expense" | "income"): Transaction => ({
    id: nextId(),
    type,
    amount: g.amount,
    category: g.category,
    date: isoHace(g.hace, now),
    method: "cash",
    description: g.description,
    notes: "",
    merchant: g.merchant,
    origin: "manual",
  });

  return [
    ...GUION.map((g) => armar(g, "expense")),
    ...INGRESOS.map((g) => armar(g, "income")),
    // Ordenados del más reciente al más antiguo, como los guarda la app.
  ].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Un presupuesto mensual redondo y corriente.
 *
 * Sin presupuesto, la pantalla de Inicio se ve a medio configurar y eso
 * también se nota.
 */
export const DECOY_BUDGET = 800;
