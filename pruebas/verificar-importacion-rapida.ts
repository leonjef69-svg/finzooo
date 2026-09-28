import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import type { Transaction } from "@/types";
import {
  buildDuplicateDateIndex,
  findBestMatch,
  findBestMatchInIndex,
} from "@/utils/duplicates";
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

// Una importación grande no debe volver a recorrer 10.000 movimientos por
// cada fila: construye el índice una vez y busca solo en las fechas cercanas.
const historialGrande = Array.from({ length: 10_000 }, (_, index) =>
  movimiento(10_000 + index, "2025-01-01")
);
historialGrande.push(cercano);
const inicio = performance.now();
const indice = buildDuplicateDateIndex(historialGrande);
assert.equal(findBestMatchInIndex(indice, entrante, new Set())?.existing.id, cercano.id);
const duracion = performance.now() - inicio;
assert.ok(duracion < 2_000, `indexar y buscar 10.001 movimientos tardó ${duracion.toFixed(0)} ms`);

const cambioDeMes = { ...entrante, date: "2026-09-02" };
const agosto = movimiento(30_001, "2026-08-20");
assert.equal(
  findBestMatchInIndex(buildDuplicateDateIndex([agosto]), cambioDeMes, new Set())?.existing.id,
  agosto.id,
  "la ventana de 14 días debe funcionar al cruzar de mes",
);

console.log(`La importación indexa 10.001 movimientos y busca por fecha en ${duracion.toFixed(0)} ms.`);
