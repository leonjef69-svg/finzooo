import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
let failures = 0;
function ok(condition, message) {
  console.log(`  ${condition ? "OK   " : "FALLA"} ${message}`);
  if (!condition) failures += 1;
}

console.log("\nAuditoría financiera y de seguridad");
const creditStore = read("utils/creditStore.ts");
const storage = read("utils/storage.ts");
const encryption = read("utils/encryption.ts");
const lock = read("utils/appLock.ts");
const context = read("contexts/AppDataContext.tsx");
const addSheet = read("screens/AddSheet.tsx");
const pay = read("screens/CreditPayV1.tsx");
const detail = read("screens/Detail.tsx");
const family = read("screens/Family.tsx");
const sharedBoxes = read("screens/SharedBoxes.tsx");
const rules = read("firestore.rules");
const contributionFunction = read("functions/index.js");
const familySettings = read("app/family-settings.tsx");

ok(
  creditStore.includes("saveJSONNow(STORAGE_KEYS.creditCards") &&
    creditStore.includes("loadJSON<unknown>(STORAGE_KEYS.creditCards"),
  "las tarjetas usan el almacén cifrado central",
);
ok(
  storage.includes("STORAGE_KEYS.creditCards") &&
    storage.includes('AsyncStorage.removeItem("@fino/credit-v1")'),
  "cerrar sesión borra tarjetas actuales y antiguas",
);
ok(
  !fs.existsSync(path.join(root, "utils/decoyMode.ts")) &&
    !read("screens/AppLockSettings.tsx").includes("decoy") &&
    !context.includes("enterDecoyMode"),
  "el modo señuelo fue retirado de la app",
);
ok(
  encryption.includes("CryptoJS.HmacSHA256") &&
    encryption.includes("constantTimeEqual") &&
    encryption.includes("return `v2:"),
  "el cifrado detecta alteraciones con HMAC",
);
ok(
  lock.includes("KEY_FAILED_ATTEMPTS") &&
    lock.includes("KEY_LOCK_UNTIL") &&
    lock.includes('return "locked"'),
  "el PIN bloquea temporalmente los intentos repetidos",
);
ok(
  context.includes("pagosEnCurso") &&
    context.includes("pago.movimientos?.[mes]") &&
    context.includes("movementStillExists"),
  "un pago programado no crea dos movimientos al remarcarlo",
);
ok(
  addSheet.includes("if (submittingRef.current) return") &&
    addSheet.includes("disabled={!valid || submitting}"),
  "el formulario principal ignora el doble toque",
);
ok(
  context.includes('existing?.method === "credit-card-payment"') &&
    detail.includes("!linkedCreditPayment"),
  "un pago de tarjeta no puede desincronizarse editándolo desde Inicio",
);
ok(
  !pay.includes('label="Otra tarjeta"'),
  "se retiró el pago riesgoso de una tarjeta con otra",
);
ok(
  context.includes("pruneDeletedTransactionIds") &&
    read("utils/mergeTransactions.ts").includes("slice(0, limit)"),
  "la lista de borrados tiene un límite seguro",
);
ok(
  read("utils/creditCloud.ts").includes("deleteCreditCloudAccount") &&
    read("utils/cloudSync.ts").includes("deleteCreditCloudAccount(uid)"),
  "eliminar la cuenta también borra el respaldo de tarjetas",
);
ok(
  family.includes('actualizarAportePersonal("family"') &&
    family.includes('borrarAportePersonal("family"') &&
    sharedBoxes.includes('actualizarAportePersonal("box"') &&
    sharedBoxes.includes('borrarAportePersonal("box"'),
  "Familia y Caja validan en el servidor la edición y el borrado de aportes Personal",
);
ok(
  !contributionFunction.includes("numberOrZero(current.data().monto)"),
  "la función desplegable no depende de un conversor inexistente al validar el aporte",
);
ok(
  contributionFunction.includes("action === \"delete\" && linkedReturn") &&
    contributionFunction.includes("transaction.delete(movementRef)"),
  "deshacer una devolución enlazada también mantiene sincronizados Caja/Familia y Personal",
);
ok(
  !rules.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['monto', 'descripcion'])"),
  "las reglas impiden saltarse el servidor editando un aporte directamente",
);
ok(
  contributionFunction.includes("exports.manageLinkedSpace") &&
    contributionFunction.includes("canCloseLinkedSpace(movements)") &&
    rules.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nombre'])"),
  "cerrar o preparar el borrado de un espacio también exige validación del servidor",
);
ok(
  familySettings.includes("familyId ? listaFamilias.find") &&
    !familySettings.includes("listaFamilias.find(item => item.id === familyId) ?? listaFamilias[0]"),
  "un enlace inválido de ajustes no puede administrar por accidente la primera familia",
);
ok(
  contributionFunction.includes("exports.leaveLinkedSpace") &&
    contributionFunction.includes("hasUnreturnedPersonalContribution(movements, memberUid)") &&
    family.includes("salirDeFamilia(uid, familyId)"),
  "salir o retirar a un miembro no deja aportes Personal huérfanos",
);
ok(
  contributionFunction.includes("function validDocumentId") &&
    contributionFunction.includes("!validDocumentId(spaceId)") &&
    contributionFunction.includes("!validDocumentId(movementId)"),
  "las funciones rechazan identificadores manipulados antes de construir rutas Firestore",
);

if (failures) process.exit(1);
console.log("Auditoría financiera: protecciones verificadas.");
