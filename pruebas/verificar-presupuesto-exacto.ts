import assert from "node:assert/strict";

import { formatBudgetDisplay } from "@/utils/budgetDisplay";

let montoRecibido = 0;
const exacto = formatBudgetDisplay(false, 1359, (amount) => {
  montoRecibido = amount;
  return `S/ ${amount.toLocaleString("en-US")}`;
});

assert.equal(montoRecibido, 1359, "el formateador debe recibir el monto sin redondearlo");
assert.equal(exacto, "S/ 1,359");

const oculto = formatBudgetDisplay(true, 1359, () => {
  throw new Error("un monto oculto no debe formatearse");
});
assert.equal(oculto, "••••");

console.log("El presupuesto conserva el monto exacto y respeta el modo oculto.");
