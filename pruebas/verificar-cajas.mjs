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
const sharedCloud = fs.readFileSync("utils/cloudCajasCompartidas.ts", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");
const deletion = fs.readFileSync("utils/cloudSync.ts", "utf8");
const screen = fs.readFileSync("screens/Cajas.tsx", "utf8");
const sharedScreen = fs.readFileSync("screens/SharedBoxes.tsx", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
assert.match(storage, /cajasDinero/, "las cajas se guardan aparte");
assert.match(cloud, /doc\(db, "cajas", uid\)/, "las cajas usan un documento propio en la nube");
assert.match(rules, /match \/cajas\/\{userId\}/, "la nube protege las cajas por propietario");
assert.match(deletion, /borrarCajasDeLaNube/, "al eliminar la cuenta también se eliminan sus cajas");
assert.match(screen, /internalTransferLink: link/, "el débito de Personal queda enlazado con el ingreso de la caja");
assert.match(screen, /deleteTransaction\(movimiento\.personalTransactionId\)/, "borrar un aporte enlazado también restaura Personal");
assert.match(sharedCloud, /export async function compartirCajaExistente/, "una caja existente se comparte sin crear otra desde cero");
assert.match(sharedCloud, /migrationComplete: false/, "una copia incompleta nunca reemplaza la caja privada");
assert.match(sharedCloud, /await updateDoc\(ref, \{ migrationComplete: true \}\)/, "la caja solo queda compartida después de copiar todos sus movimientos");
assert.match(sharedCloud, /inicio \+= 400/, "una caja grande se copia en lotes admitidos por Firebase");
assert.match(screen, /Solo después de terminar toda la copia se retira la versión privada/, "la pantalla no borra la caja si falla la migración");
assert.match(screen, /crearInvitacionCaja\(uid, compartida\.id\)/, "compartir genera el código para la persona invitada");
assert.match(sharedCloud, /export async function listarMiembrosCaja/, "la caja compartida puede mostrar sus miembros");
assert.match(sharedCloud, /export async function quitarMiembroCaja/, "el propietario puede retirar el acceso de un miembro");
assert.match(sharedCloud, /export async function cerrarCajaCompartida/, "una caja compartida puede cerrarse de forma explícita");
assert.match(sharedScreen, /Math\.max\(0, Math\.min\(saldo, aportadoDesdePersonal\)\)/, "solo vuelve a Personal dinero aportado que aún queda en la caja");
assert.match(sharedScreen, /Math\.abs\(saldo\) > 0\.000001/, "una caja con saldo pendiente no se puede cerrar");
assert.match(context, /transfersOut \+ transfersIn/, "devolver dinero aumenta Personal sin contarlo como un ingreso nuevo");

console.log("Cajas: saldo, borrado, guardado separado y privacidad verificados.");
