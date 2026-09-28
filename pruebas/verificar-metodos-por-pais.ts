import assert from "node:assert/strict";

import {
  availablePaymentMethods,
  initialPaymentMethod,
} from "@/utils/paymentMethods";

const ids = (country: string) => availablePaymentMethods(country).map((method) => method.id);
const universales = ["cash", "debit", "credit", "transfer"] as const;

for (const country of ["PE", "BO", "US", "MX", ""]) {
  for (const method of universales) {
    assert.ok(ids(country).includes(method), `${method} debe estar disponible en ${country || "país vacío"}`);
  }
}

assert.ok(ids("PE").includes("yape"), "Yape debe aparecer en Perú");
assert.ok(ids("PE").includes("plin"), "Plin debe aparecer en Perú");
assert.ok(ids("BO").includes("yape"), "Yape debe aparecer en Bolivia");
assert.ok(!ids("BO").includes("plin"), "Plin no debe aparecer en Bolivia");
assert.ok(!ids("US").includes("yape"), "Yape no debe aparecer fuera de Perú y Bolivia");
assert.ok(!ids("US").includes("plin"), "Plin no debe aparecer fuera de Perú");

assert.equal(initialPaymentMethod(), "debit", "un movimiento nuevo empieza con débito");
assert.equal(
  initialPaymentMethod({ method: "plin" }),
  "plin",
  "al editar no se debe borrar un método histórico",
);

console.log("Métodos de pago: país correcto y datos antiguos conservados.");
