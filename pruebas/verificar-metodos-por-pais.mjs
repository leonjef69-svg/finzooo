import assert from "node:assert/strict";
import fs from "node:fs";

const addSheet = fs.readFileSync("screens/AddSheet.tsx", "utf8");
const methods = fs.readFileSync("constants/i18n.ts", "utf8");

assert.match(addSheet, /m\.id !== "plin" \|\| userCountry === "PE"/);
assert.match(addSheet, /m\.id !== "yape" \|\| userCountry === "PE" \|\| userCountry === "BO"/);
assert.match(addSheet, /\[userCountry\]/, "la lista se actualiza si cambia el país");
for (const id of ["cash", "debit", "credit", "transfer", "yape", "plin"]) {
  assert.match(methods, new RegExp(`id: "${id}"`), `${id} sigue en el catálogo y los datos antiguos se conservan`);
}
assert.match(addSheet, /transaction\?\.method \|\| "debit"/, "al editar se conserva el método ya guardado");

console.log("Métodos de pago: Yape/Plin respetan el país sin borrar datos antiguos.");
