import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { canCloseLinkedSpace, contributionLimits } = require("../functions/src/personal-contribution.js");

// Es el par de la captura: el aporte y la devolución aparecen juntos en una
// tarjeta, pero siguen siendo dos documentos de Firebase.
const amount = 1_123_123_124_124;
const contribution = {
  tipo: "ingreso", monto: amount, personalTransactionId: 101,
  personalOwnerUid: "owner", creadoPor: "owner",
};
const returned = {
  tipo: "gasto", monto: amount, personalTransactionId: 102,
  personalOwnerUid: "owner", personalReturnAmount: amount, creadoPor: "owner",
};
const paired = [contribution, returned];

assert.equal(canCloseLinkedSpace(paired), true, "Familia/Caja se puede cerrar con saldo cero y aporte totalmente devuelto");
assert.equal(contributionLimits([contribution], "owner", amount).canDelete, true, "al borrar primero la devolución, luego ya se puede borrar el aporte");
assert.equal(canCloseLinkedSpace([
  contribution,
  { ...returned, personalOwnerUid: "another-user", creadoPor: "another-user" },
]), false, "una devolución de otra persona no liquida el aporte del propietario");

console.log("Servidor de Familia/Cajas: cierre y borrado del par reportado verificados.");
