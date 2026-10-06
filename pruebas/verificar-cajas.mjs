import assert from "node:assert/strict";
import fs from "node:fs";
import { fusionarCajas, saldoCaja } from "../utils/cajas.ts";
import { canUndoContribution } from "../utils/linkedTransfers.ts";

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
const aporteDevuelto = { id: "aporte", tipo: "ingreso", monto: 10, personalTransactionId: 10, personalOwnerUid: "dueño" };
const devolucion = { id: "devolucion", tipo: "gasto", monto: 10, personalTransactionId: 11, personalOwnerUid: "dueño", personalReturnAmount: 10 };
assert.equal(canUndoContribution([aporteDevuelto, devolucion], aporteDevuelto), false, "no se deshace solo el aporte mientras la devolución enlazada siga registrada");
assert.equal(canUndoContribution([aporteDevuelto], aporteDevuelto), true, "al borrar primero la devolución seleccionada, el aporte se puede quitar sin dejar saldo huérfano");

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
const movementSheet = fs.readFileSync("components/SpaceMovementSheet.tsx", "utf8");
const movementControls = fs.readFileSync("components/SpaceMovementControls.tsx", "utf8");
const movementFields = fs.readFileSync("components/SpaceMovementFields.tsx", "utf8");
const categorySheet = fs.readFileSync("components/TransactionCategorySheet.tsx", "utf8");
const sharedScreen = fs.readFileSync("screens/SharedBoxes.tsx", "utf8");
const invitationSheet = fs.readFileSync("components/SpaceInvitationSheet.tsx", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const finances = fs.readFileSync("utils/finances.ts", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
assert.match(storage, /cajasDinero/, "las cajas se guardan aparte");
assert.match(cloud, /doc\(db, "cajas", uid\)/, "las cajas usan un documento propio en la nube");
assert.match(rules, /match \/cajas\/\{userId\}/, "la nube protege las cajas por propietario");
assert.match(deletion, /borrarCajasDeLaNube/, "al eliminar la cuenta también se eliminan sus cajas");
assert.match(screen, /internalTransferLink: link/, "el débito de Personal queda enlazado con el ingreso de la caja");
assert.match(movementSheet, /TransactionCategorySheet/, "Caja usa el selector actual de categorías");
assert.match(movementSheet, /<SpacePaymentMethod value=\{method\} onChange=\{onMethod\} disabled=\{disabled\} compact \/>/, "Caja usa el método de pago compacto en el formulario compartido");
assert.match(movementControls, /compact \? "min-w-0 flex-1" : "mt-2"/, "el campo de pago ocupa la mitad disponible junto a descripción en Familia y Caja");
assert.match(movementControls, /compact \? "h-12 w-full flex-row items-center justify-center/, "el control de pago llena su columna y queda alineado con descripción");
assert.match(movementFields, /onOpenCategory/, "el campo de caja abre el selector reutilizable");
assert.doesNotMatch(movementFields, /<Modal|EXPENSE_CATS|INCOME_CATS/, "Caja ya no conserva el selector antiguo de categorías");
assert.match(categorySheet, /chooseImage\("camera"\)/, "la categoría de caja acepta foto de cámara");
assert.match(categorySheet, /chooseImage\("library"\)/, "la categoría de caja acepta foto de galería");
assert.match(categorySheet, /onPress=\{saveCategory\}/, "la categoría de caja se guarda desde la misma hoja");
assert.match(screen, /guardarCambioCaja\([\s\S]*?plan\.items\.flatMap\(item => item\.personalTransactionId/, "borrar un aporte enlazado guarda ambas mitades y sus marcas juntas");
assert.match(sharedCloud, /export async function compartirCajaExistente/, "una caja existente se comparte sin crear otra desde cero");
assert.match(sharedCloud, /migrationComplete: false/, "una copia incompleta nunca reemplaza la caja privada");
assert.match(sharedCloud, /await task.wait\(\(\) => confirmarConversionCaja\(uid, caja.id, digest, currency, "finish", caja.sharingAttempt\)\)/, "solo el servidor confirma la copia completa y el intento dentro de la sesión vigente");
assert.doesNotMatch(sharedCloud, /updateDoc\(ref, \{ migrationComplete: true/, "el celular no declara terminada una copia sin comprobación del servidor");
assert.match(sharedCloud, /inicio \+= 400/, "una caja grande se copia en lotes admitidos por Firebase");
assert.match(screen, /Solo después de terminar toda la copia se retira la versión privada/, "la pantalla no borra la caja si falla la migración");
assert.match(screen, /crearInvitacionCaja\(uid, compartida\.id\)/, "compartir genera el código para la persona invitada");
assert.match(screen, /unirseACaja\(uid, userName \|\| t\("family\.member"\), codigo\)/, "Caja valida el código desde su propia pantalla antes de abrir el espacio compartido");
assert.doesNotMatch(screen, /shared-boxes\?join=1/, "Unirme ya no manda a un formulario diferente en otra pantalla");
assert.match(screen, /params: \{ boxId: compartida\.id, \.\.\.\(codigo \? \{ invitation: codigo \}/, "se abre la Caja con código si se pudo crear, sin deshacer la conversión si falla Invitar");
assert.match(sharedScreen, /SpaceInvitationSheet code=\{invitacion\}/, "la invitación de una caja compartida usa la misma hoja");
assert.match(invitationSheet, /import\("expo-clipboard"\)[\s\S]*?setStringAsync\(code\)/, "la hoja compartida solo carga el portapapeles al pedir copiar");
assert.match(screen, /boxes\.inviteAccessibility/, "el propietario conserva un acceso accesible para invitar a una caja");
assert.match(screen, /<View className="mb-2 mt-1 flex-row items-center justify-between">[\s\S]*?t\("boxes\.all"\)[\s\S]*?boxes\.inviteAccessibility[\s\S]*?<\/View>[\s\S]*?<View className="rounded-3xl bg-teal-600/, "la invitación de Caja comparte la fila de Ver todas y queda fuera de la tarjeta de saldo, con aviso de conversión pendiente entre ambas");
assert.match(screen, /MovementAllButton label=\{t\("boxes\.history"\)\}[\s\S]*?filterIncome[\s\S]*?filterExpense[\s\S]*?boxes\.selectMovements[\s\S]*?<\/\>}/, "el filtro de caja usa una sola fila, igual que Personal");
assert.match(sharedCloud, /export async function listarMiembrosCaja/, "la caja compartida puede mostrar sus miembros");
assert.match(sharedCloud, /export async function quitarMiembroCaja/, "el propietario puede retirar el acceso de un miembro");
assert.match(sharedCloud, /export async function cerrarCajaCompartida/, "una caja compartida puede cerrarse de forma explícita");
assert.match(sharedScreen, /returnableToPersonal\(movimientos, uid\)/, "solo vuelve a Personal dinero aportado que aún queda en la caja");
assert.match(screen, /canSpendFromSpace\(movimientos, valor\)/, "una caja impide gastar más que su saldo");
assert.equal((screen.match(/width: "48%", height: 40/g) || []).length, 2, "Agregar dinero y Cerrar caja ocupan exactamente el mismo ancho y alto");
assert.ok(screen.indexOf("boxes.returnAmount") < screen.indexOf("width: \"48%\", height: 40"), "Devolver dinero aparece encima de Agregar dinero y Cerrar caja");
assert.match(screen, /planSpaceMovementDeletion\(movimientos, ids\)/, "Caja usa el plan compartido que valida y ordena el borrado de aportes y devoluciones");
assert.match(screen, /movementIdsForCompactRow\(\{ key, item, transferGroup \}, visibles\)/, "la tarjeta agrupada selecciona todos sus movimientos enlazados");
assert.match(screen, /countSelectedCompactRows\(filasVisibles, visibles, seleccionados\)/, "el contador de selección coincide con las tarjetas visibles");
assert.match(screen, /spaces\.deleteLinkedMovementsMessage/, "la confirmación explica que un aporte y una devolución se guardan por separado");
assert.match(screen, /Movimientos de caja|boxes\.history/, "el control usa la etiqueta breve de movimientos de caja");
assert.doesNotMatch(screen, /SpaceActionBar|MoreVertical|boxes\.options/, "Caja no muestra el + flotante ni el menú que ya fueron retirados");
assert.match(screen, /minimumContributionAmount/, "editar un aporte respeta la parte ya utilizada");
assert.match(screen, /repairLinkedTransferTransactions/, "las cajas reparan transferencias huérfanas");
assert.match(sharedScreen, /canCloseLinkedSpace\(movimientos\)/, "una caja no se cierra si deja saldo o aportes de Personal pendientes");
assert.match(finances, /availableBalance\(f\) - f\.transfersOut \+ f\.transfersIn/, "devolver dinero aumenta Personal sin contarlo como un ingreso nuevo");
assert.match(home, /availablePersonalBalance/, "Inicio descuenta lo enviado a Familia y Cajas");
assert.match(context, /transaction\?\.internalTransfer/, "una transferencia enlazada no se puede borrar directamente desde Personal");
assert.match(context, /deleteLinkedTransferTransaction/, "Familia y Cajas conservan una vía controlada para borrar ambos lados");

console.log("Cajas: saldo, borrado, guardado separado y privacidad verificados.");
