import assert from "node:assert/strict";

import { categoryForImportedRow } from "@/utils/importCategory";
import type { RawRow } from "@/utils/importEngine";

const translate = (key: string) => key;
const row = (overrides: Partial<RawRow>): RawRow => ({
  date: "2026-09-28",
  amount: 20,
  type: "expense",
  description: "",
  merchant: "",
  reference: "",
  categoryRaw: "",
  methodRaw: "",
  ...overrides,
});

for (const [written, expected] of [
  ["alimentación", "comida"],
  ["movilidad", "transporte"],
  ["farmacia", "salud"],
] as const) {
  assert.equal(categoryForImportedRow(row({ categoryRaw: written }), translate, {}), expected);
}

assert.equal(
  categoryForImportedRow(row({ categoryRaw: "movilidad", merchant: "KFC" }), translate, {}),
  "transporte",
  "la categoría escrita debe ganar a la adivinanza del comercio",
);
assert.equal(
  categoryForImportedRow(row({ categoryRaw: "desconocida", merchant: "KFC" }), translate, {}),
  "comida",
  "solo una categoría desconocida debe usar el clasificador",
);
assert.equal(
  categoryForImportedRow(row({ categoryRaw: "desconocida", merchant: "Mi tienda" }), translate, { "mi tienda": "compras" }),
  "compras",
  "debe respetarse lo aprendido por la persona",
);
assert.equal(
  categoryForImportedRow(row({ type: "income", categoryRaw: "trabajo" }), translate, {}),
  "salario",
);
assert.equal(
  categoryForImportedRow(row({ categoryRaw: "venta" }), translate, {}),
  "otros",
  "una categoría de ingreso no puede colarse en un gasto",
);

console.log("Las categorías del archivo tienen prioridad y nunca cruzan ingreso con gasto.");
