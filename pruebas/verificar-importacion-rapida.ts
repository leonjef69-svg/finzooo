import assert from "node:assert/strict";

import type { Transaction } from "@/types";
import { findBestMatch } from "@/utils/duplicates";
import type { RawRow } from "@/utils/importEngine";

function movimiento(id: number, date: string): Transaction {
  return {
    id,
    type: "expense",
    amount: 25,
    category: "Comida",
    date,
    method: "Tarjeta",
    description: "Mercado Central",
    notes: "",
    merchant: "Mercado Central",
    account: "bcp",
  };
}

const entrante: RawRow = {
  date: "2026-09-20",
  amount: 25,
  type: "expense",
  description: "Mercado Central",
  merchant: "Mercado Central",
  reference: "REF-1",
  categoryRaw: "Comida",
  methodRaw: "Tarjeta",
  account: "bcp",
};

// Este movimiento está varios meses lejos. Si el buscador intenta puntuarlo,
// el getter lanza: así se prueba el comportamiento real y no una frase del código.
const lejano = movimiento(1, "2026-01-01");
Object.defineProperty(lejano, "type", {
  get() {
    throw new Error("un movimiento lejano no debe compararse");
  },
});

const cercano = movimiento(2, "2026-09-19");
assert.equal(findBestMatch([lejano, cercano], entrante, new Set())?.existing.id, 2);

// Catorce días todavía pertenecen a la ventana; quince ya no.
const limite = movimiento(3, "2026-09-06");
assert.equal(findBestMatch([limite], entrante, new Set())?.existing.id, 3);
assert.equal(findBestMatch([movimiento(4, "2026-09-05")], entrante, new Set()), null);

// Una fila del historial solo puede enlazarse con una fila importada.
assert.equal(findBestMatch([cercano], entrante, new Set([cercano.id])), null);

console.log("La importación limita comparaciones a 14 días y no reutiliza coincidencias.");
