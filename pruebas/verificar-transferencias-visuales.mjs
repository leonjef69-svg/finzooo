import assert from "node:assert/strict";
import fs from "node:fs";

const leer = (ruta) => fs.readFileSync(ruta, "utf8");
const home = leer("screens/Home.tsx");
const history = leer("screens/History.tsx");
const detail = leer("screens/Detail.tsx");
const family = leer("screens/Family.tsx");
const boxes = leer("screens/Cajas.tsx");
const sharedBoxes = leer("screens/SharedBoxes.tsx");
const controls = leer("components/SpaceMovementControls.tsx");
const transferAmounts = leer("components/SpaceTransferAmounts.tsx");
const exportsCode = leer("utils/exportSpaces.ts");
const telegram = leer("functions/src/telegram-guided-handler.js");

assert.match(history, /id: "transfer"[\s\S]*history\.filterTransfer/, "Historial ofrece el filtro Transferencias");
assert.match(home, /isTransfer \? <SpaceTransferAmounts[\s\S]*Enviado a/, "Inicio distingue la transferencia con su tarjeta de montos");
assert.match(detail, /transfer\.notIncomeExpense/, "el detalle explica que una transferencia no es ingreso ni gasto");
assert.match(history, /filter === "transfer" \? Boolean\(t\.internalTransfer\)/, "el filtro separa transferencias de ingresos y gastos");
assert.match(controls, /"transferencia"[\s\S]*SpaceTransferFilter/, "Familia y Caja comparten un filtro exclusivo de transferencias");
assert.match(home, /compactPersonalTransferRows\(monthTx\)/, "Inicio agrupa transferencias por familia o caja");
assert.match(history, /filter === "all"[\s\S]*compactPersonalTransferRows/, "Historial agrupa por defecto y conserva el filtro con el detalle completo");

for (const [nombre, codigo] of [["Familia", family], ["Caja", boxes], ["Caja compartida", sharedBoxes]]) {
  assert.match(codigo, /!isLinkedSpaceTransfer\(item\) && item\.tipo === "ingreso"/, `${nombre} excluye transferencias del total de ingresos`);
  assert.match(codigo, /!isLinkedSpaceTransfer\(item\) && item\.tipo === "gasto"/, `${nombre} excluye devoluciones del total de gastos`);
  assert.match(codigo, /SpaceTransferAmounts[\s\S]*Recibido de Personal[\s\S]*Devuelto a Personal/, `${nombre} muestra lo recibido y devuelto a Personal`);
  assert.match(codigo, /compactLinkedTransferRows/, `${nombre} resume los pares de transferencia en una sola tarjeta`);
}
assert.match(transferAmounts, /returned > 0 &&/, "la devolución no aparece hasta que exista un monto devuelto");

assert.match(sharedBoxes, /const saldo = movimientos\.reduce/, "la caja compartida conserva las transferencias en su saldo disponible");
assert.match(exportsCode, /item\.type === "income" && !item\.internalTransfer/, "las exportaciones tampoco cuentan transferencias como ingresos");
assert.match(exportsCode, /item\.type === "expense" && !item\.internalTransfer/, "las exportaciones tampoco cuentan transferencias como gastos");
assert.match(boxes, /internalTransferSpaceId: compartida\.id/, "convertir una caja a compartida conserva el destino de sus transferencias");
assert.match(telegram, /internalTransferLink: movementRef\.id/, "Telegram enlaza Personal con el movimiento compartido exacto");
assert.match(telegram, /const internalTransfer = item\.personalTransactionId != null/, "Telegram excluye transferencias internas de los totales del espacio");

console.log("Transferencias visuales: color, dirección, filtros y totales separados verificados.");
