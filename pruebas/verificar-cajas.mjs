import assert from "node:assert/strict";
import fs from "node:fs";
import { fusionarCajas, saldoCaja } from "../utils/cajas.ts";

const local = {
  cajas: [{ id: "ahorro", nombre: "Ahorro", creadaEn: 1 }],
  movimientos: [
    { id: "i1", cajaId: "ahorro", tipo: "ingreso", monto: 100, descripcion: "", fecha: "2026-09-06", creadoEn: 1 },
    { id: "g1", cajaId: "ahorro", tipo: "gasto", monto: 25, descripcion: "", fecha: "2026-09-06", creadoEn: 2 },
  ],
  cajasBorradas: [],
  movimientosBorrados: [],
};

assert.equal(saldoCaja("ahorro", local.movimientos), 75, "la caja suma ingresos y resta gastos");

const unido = fusionarCajas(local, {
  cajas: [...local.cajas, { id: "viaje", nombre: "Viaje", creadaEn: 2 }],
  movimientos: [...local.movimientos, { id: "i2", cajaId: "viaje", tipo: "ingreso", monto: 50, descripcion: "", fecha: "2026-09-06", creadoEn: 3 }],
  cajasBorradas: ["ahorro"],
  movimientosBorrados: [],
});
assert.deepEqual(unido.cajas.map((caja) => caja.id), ["viaje"], "una caja borrada no reaparece al sincronizar");
assert.deepEqual(unido.movimientos.map((movimiento) => movimiento.id), ["i2"], "no quedan movimientos huérfanos");

const storage = fs.readFileSync("utils/storage.ts", "utf8");
const cloud = fs.readFileSync("utils/cloudCajas.ts", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");
const deletion = fs.readFileSync("utils/cloudSync.ts", "utf8");
assert.match(storage, /cajasDinero/, "las cajas se guardan aparte");
assert.match(cloud, /doc\(db, "cajas", uid\)/, "las cajas usan un documento propio en la nube");
assert.match(rules, /match \/cajas\/\{userId\}/, "la nube protege las cajas por propietario");
assert.match(deletion, /borrarCajasDeLaNube/, "al eliminar la cuenta también se eliminan sus cajas");

console.log("Cajas: saldo, borrado, guardado separado y privacidad verificados.");
