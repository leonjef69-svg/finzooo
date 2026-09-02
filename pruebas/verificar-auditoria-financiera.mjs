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

if (failures) process.exit(1);
console.log("Auditoría financiera: protecciones verificadas.");
